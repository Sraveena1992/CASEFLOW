'use strict';
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const argon2 = require('argon2');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (isProduction && (!process.env.SESSION_SECRET || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.COMPANY_INVITE_CODE || !process.env.ALLOWED_EMAIL_DOMAIN)) {
  throw new Error('SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, COMPANY_INVITE_CODE, and ALLOWED_EMAIL_DOMAIN must be configured in production');
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'disable' ? false : (isProduction ? { rejectUnauthorized: false } : undefined),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'], connectSrc: ["'self'"], objectSrc: ["'none'"],
    frameAncestors: ["'none'"], upgradeInsecureRequests: isProduction ? [] : null
  }}
}));
app.use(express.json({ limit: '256kb' }));
app.use(session({
  name: 'caseflow.sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex'),
  store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true, pruneSessionInterval: 15 * 60 }),
  resave: false, saveUninitialized: false, rolling: true,
  cookie: { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000, path: '/' }
}));
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' }
});
function normalizeEmail(v) { return typeof v === 'string' ? v.trim().toLowerCase() : ''; }
function validEmail(v) { return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
async function requireAuth(req, res, next) {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Authentication required.' });
    // Re-check role and active status on each protected request so a deactivated/demoted user
    // cannot keep using a stale role stored in an existing session.
    const result = await pool.query('SELECT id,email,role,active FROM users WHERE id=$1', [req.session.user.id]);
    const user = result.rows[0];
    if (!user || !user.active) {
      await new Promise(resolve => req.session.destroy(() => resolve()));
      return res.status(401).json({ error: 'Session is no longer valid. Sign in again.' });
    }
    req.session.user = { id: String(user.id), email: user.email, role: user.role };
    next();
  } catch (error) { next(error); }
}
function requireRole(...roles) {
  return (req, res, next) => requireAuth(req, res, error => {
    if (error) return next(error);
    if (res.headersSent) return;
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'You do not have permission for this action.' });
    next();
  });
}
function requireCsrf(req, res, next) {
  const expected = req.session.csrfToken;
  const supplied = req.get('X-CSRF-Token');
  if (!expected || !supplied || expected.length !== supplied.length ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return res.status(403).json({ error: 'CSRF token missing or invalid. Refresh your session and try again.' });
  }
  next();
}
async function getCaseForUser(req, res, next) {
  try {
    const params = [req.params.id];
    let sql = 'SELECT * FROM cases WHERE id = $1';
    if (req.session.user.role !== 'admin') { params.push(req.session.user.id); sql += ' AND owner_user_id = $2'; }
    const result = await pool.query(sql, params);
    if (!result.rowCount) return res.status(404).json({ error: 'Case not found.' });
    req.caseRecord = result.rows[0];
    next();
  } catch (error) { next(error); }
}
function recordHistory(client, caseId, actorId, type, summary, details = {}) {
  return client.query(
    'INSERT INTO case_history(case_id,actor_user_id,event_type,summary,details) VALUES($1,$2,$3,$4,$5)',
    [caseId, actorId, type, summary, JSON.stringify(details)]
  );
}
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'caseflow-api' }));

app.get('/api/auth/csrf', (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: req.session.csrfToken });
});

app.post('/api/auth/register', signupLimiter, requireCsrf, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const inviteCode = typeof req.body?.inviteCode === 'string' ? req.body.inviteCode.trim() : '';
    const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAIN || '').split(',').map(d => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
    const emailDomain = email.split('@')[1] || '';
    if (!validEmail(email) || !allowedDomains.includes(emailDomain)) return res.status(400).json({ error: 'Use an email address from your approved company work-email domain.' });
    if (password.length < 12 || password.length > 128 || inviteCode.length < 16 || inviteCode.length > 256) return res.status(400).json({ error: 'Use a 12–128 character password and enter the company invite code.' });
    const configured = await pool.query('SELECT invite_code_hash FROM company_settings WHERE id=1');
    const storedHash = configured.rows[0]?.invite_code_hash;
    const suppliedHash = crypto.createHash('sha256').update(inviteCode).digest('hex');
    if (!storedHash || !crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(suppliedHash))) return res.status(403).json({ error: 'Company invite code is invalid.' });
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM || !process.env.APP_BASE_URL) return res.status(503).json({ error: 'Email verification is not configured yet. Contact the company owner.' });
    if ((await pool.query('SELECT id FROM users WHERE email=$1', [email])).rowCount) return res.status(409).json({ error: 'An account with this email already exists.' });
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query('DELETE FROM email_verification_tokens WHERE email=$1 OR expires_at<NOW() OR consumed_at IS NOT NULL', [email]);
    await pool.query("INSERT INTO email_verification_tokens(email,token_hash,password_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 minutes')", [email, tokenHash, passwordHash]);
    const verifyUrl = new URL('/api/auth/verify-email', process.env.APP_BASE_URL);
    verifyUrl.searchParams.set('token', rawToken);
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [email],
        subject: 'Verify your CASEFLOW work email',
        text: 'Verify your CASEFLOW Account Manager email within 30 minutes: ' + verifyUrl.toString() + '\nIf you did not request this, ignore this email.'
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!emailResponse.ok) {
      const emailError = await emailResponse.json().catch(() => ({}));
      console.error('CASEFLOW email provider rejected request:', emailResponse.status, emailError.name || 'provider_error');
      await pool.query('DELETE FROM email_verification_tokens WHERE email=$1 AND token_hash=$2', [email, tokenHash]);
      return res.status(502).json({
        error: 'Verification email could not be sent. The owner must check that the Resend API key is valid and MAIL_FROM is an approved sender. No account was created; try again after email delivery is fixed.'
      });
    }
    res.status(202).json({ message: 'Verification email sent if details are valid. The link expires in 30 minutes.' });
  } catch (error) { next(error); }
});
app.get('/api/auth/verify-email', verifyLimiter, async (req, res, next) => {
  const rawToken = typeof req.query.token === 'string' ? req.query.token : '';
  if (!/^[a-f0-9]{64}$/.test(rawToken)) return res.status(400).send('Verification link is invalid or expired. Return to CASEFLOW and register again.');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT id,email,password_hash FROM email_verification_tokens WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>NOW() FOR UPDATE', [tokenHash]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(400).send('Verification link is invalid or expired. Return to CASEFLOW and register again.'); }
    const pending = found.rows[0];
    await client.query("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'account_manager')", [pending.email, pending.password_hash]);
    await client.query('UPDATE email_verification_tokens SET consumed_at=NOW() WHERE id=$1', [pending.id]);
    await client.query('COMMIT');
    res.set('Cache-Control', 'no-store');
    res.send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Email verified · CASEFLOW</title><body style="font:16px system-ui;max-width:640px;margin:12vh auto;padding:24px;color:#3A0F34"><h1>Email verified</h1><p>Your CASEFLOW Account Manager account is ready. Return to CASEFLOW sign-in to log in.</p></body></html>');
  } catch (error) { await client.query('ROLLBACK'); if (error.code === '23505') return res.status(409).send('An account with this email already exists.'); next(error); }
  finally { client.release(); }
});

app.post('/api/auth/login', loginLimiter, requireCsrf, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    const password = typeof (req.body && req.body.password) === 'string' ? req.body.password : '';
    if (!validEmail(email) || !password || password.length > 1024) return res.status(400).json({ error: 'Enter a valid email and password.' });
    const result = await pool.query('SELECT id,email,password_hash,role,active FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    const matches = user && user.active ? await argon2.verify(user.password_hash, password).catch(() => false) : false;
    if (!matches) return res.status(401).json({ error: 'Email or password is incorrect.' });
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.user = { id: String(user.id), email: user.email, role: user.role };
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    res.set('Cache-Control', 'no-store');
    res.json({ user: req.session.user });
  } catch (error) { next(error); }
});
app.post('/api/auth/logout', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    await new Promise((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
    res.clearCookie('caseflow.sid', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' });
    res.status(204).end();
  } catch (error) { next(error); }
});
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ user: req.session.user });
});

// No public registration: only an authenticated administrator can provision users.
app.post('/api/admin/users', requireRole('admin'), requireCsrf, async (req, res, next) => {
  const email = normalizeEmail(req.body && req.body.email);
  const password = typeof (req.body && req.body.password) === 'string' ? req.body.password : '';
  const role = req.body && req.body.role;
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 12 || password.length > 128) return res.status(400).json({ error: 'Password must be 12–128 characters.' });
  if (role !== 'account_manager') return res.status(400).json({ error: 'Only the company owner can be Admin. The owner can create Account Manager accounts only.' });
  try {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const result = await pool.query('INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id,email,role,active,created_at', [email, hash, role]);
    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A user with that email already exists.' });
    next(error);
  }
});
app.get('/api/admin/users', requireRole('admin'), async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT id,email,role,active,created_at FROM users ORDER BY created_at DESC');
    res.json({ users: result.rows });
  } catch (error) { next(error); }
});
app.patch('/api/admin/users/:id', requireRole('admin'), requireCsrf, async (req, res, next) => {
  const active = req.body && req.body.active;
  const role = req.body && req.body.role;
  if (active === undefined && role === undefined) return res.status(400).json({ error: 'Provide active and/or role.' });
  if (active !== undefined && typeof active !== 'boolean') return res.status(400).json({ error: 'active must be boolean.' });
  if (role !== undefined && role !== 'account_manager') return res.status(400).json({ error: 'Admin ownership cannot be transferred or duplicated through user management.' });
  try {
    const current = await pool.query('SELECT id FROM users WHERE id=$1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'User not found.' });
    if (String(req.params.id) === String(req.session.user.id) && (active === false || role === 'account_manager')) {
      return res.status(400).json({ error: 'You cannot deactivate or demote your own active administrator session.' });
    }
    const result = await pool.query('UPDATE users SET active=COALESCE($2,active),role=COALESCE($3,role),updated_at=NOW() WHERE id=$1 RETURNING id,email,role,active,created_at', [req.params.id, active === undefined ? null : active, role || null]);
    res.json({ user: result.rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/cases', requireAuth, async (req, res, next) => {
  try {
    const columns = 'c.id,c.title,c.description,c.state,c.blocker,c.next_action,c.owner_user_id,c.created_at,c.updated_at,u.email AS owner_email';
    const result = req.session.user.role === 'admin'
      ? await pool.query('SELECT ' + columns + ' FROM cases c JOIN users u ON u.id=c.owner_user_id ORDER BY c.updated_at DESC')
      : await pool.query('SELECT ' + columns + ' FROM cases c JOIN users u ON u.id=c.owner_user_id WHERE c.owner_user_id=$1 ORDER BY c.updated_at DESC', [req.session.user.id]);
    res.json({ cases: result.rows });
  } catch (error) { next(error); }
});
app.post('/api/cases', requireRole('account_manager'), requireCsrf, async (req, res, next) => {
  const title = typeof (req.body && req.body.title) === 'string' ? req.body.title.trim() : '';
  const description = typeof (req.body && req.body.description) === 'string' ? req.body.description.trim() : '';
  if (!title || title.length > 200 || description.length > 10000) return res.status(400).json({ error: 'Title is required (max 200 characters); description max is 10,000 characters.' });
  const id = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await client.query('INSERT INTO cases(id,title,description,owner_user_id) VALUES($1,$2,$3,$4) RETURNING *', [id, title, description, req.session.user.id]);
    await recordHistory(client, id, req.session.user.id, 'case_created', 'Case created', { title });
    await client.query('COMMIT');
    res.status(201).json({ case: created.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK'); next(error);
  } finally { client.release(); }
});
app.patch('/api/cases/:id/assignment', requireRole('admin'), requireCsrf, async (req, res, next) => {
  const ownerId = req.body && req.body.owner_user_id;
  if (!Number.isSafeInteger(Number(ownerId)) || Number(ownerId) < 1) return res.status(400).json({ error: 'owner_user_id must be a valid user ID.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const target = await client.query("SELECT id FROM users WHERE id=$1 AND active=TRUE AND role='account_manager'", [ownerId]);
    if (!target.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cases can only be assigned to an active Account Manager.' });
    }
    const updated = await client.query('UPDATE cases SET owner_user_id=$2,updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id, ownerId]);
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Case not found.' });
    }
    await recordHistory(client, req.params.id, req.session.user.id, 'case_assigned', 'Case assigned to Account Manager', { owner_user_id: Number(ownerId) });
    await client.query('COMMIT');
    res.json({ case: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});
app.get('/api/cases/:id', requireAuth, getCaseForUser, async (req, res, next) => {
  try {
    const results = await Promise.all([
      pool.query('SELECT id,created_by,content,source_label,created_at FROM case_evidence WHERE case_id=$1 ORDER BY created_at', [req.caseRecord.id]),
      pool.query('SELECT id,actor_user_id,event_type,summary,details,created_at FROM case_history WHERE case_id=$1 ORDER BY created_at DESC', [req.caseRecord.id])
    ]);
    res.json({ case: req.caseRecord, evidence: results[0].rows, history: results[1].rows });
  } catch (error) { next(error); }
});
app.patch('/api/cases/:id', requireRole('account_manager'), requireCsrf, getCaseForUser, async (req, res, next) => {
  const allowed = ['title', 'description', 'state', 'blocker', 'next_action'];
  const updates = {};
  for (const key of allowed) if (typeof (req.body && req.body[key]) === 'string') updates[key] = req.body[key].trim();
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields supplied.' });
  if (updates.title !== undefined && (!updates.title || updates.title.length > 200)) return res.status(400).json({ error: 'Title must be 1–200 characters.' });
  for (const field of ['description', 'blocker', 'next_action']) if (updates[field] && updates[field].length > 10000) return res.status(400).json({ error: 'Text fields must be at most 10,000 characters.' });
  const columnNames = { title: 'title', description: 'description', state: 'state', blocker: 'blocker', next_action: 'next_action' };
  const keys = Object.keys(updates);
  const setClause = keys.map((key, i) => columnNames[key] + '=$' + (i + 2)).join(',');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('UPDATE cases SET ' + setClause + ',updated_at=NOW() WHERE id=$1 RETURNING *', [req.caseRecord.id, ...keys.map(k => updates[k])]);
    await recordHistory(client, req.caseRecord.id, req.session.user.id, 'case_updated', 'Case fields updated', { fields: keys });
    await client.query('COMMIT');
    res.json({ case: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK'); next(error);
  } finally { client.release(); }
});
app.post('/api/cases/:id/evidence', requireRole('account_manager'), requireCsrf, getCaseForUser, async (req, res, next) => {
  const content = typeof (req.body && req.body.content) === 'string' ? req.body.content.trim() : '';
  const sourceLabel = typeof (req.body && req.body.source_label) === 'string' ? req.body.source_label.trim() : '';
  if (!content || content.length > 20000 || sourceLabel.length > 200) return res.status(400).json({ error: 'Evidence text is required (max 20,000 characters); source label max is 200.' });
  const id = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('INSERT INTO case_evidence(id,case_id,created_by,content,source_label) VALUES($1,$2,$3,$4,$5) RETURNING *', [id, req.caseRecord.id, req.session.user.id, content, sourceLabel]);
    await recordHistory(client, req.caseRecord.id, req.session.user.id, 'evidence_added', 'Evidence added', { evidence_id: id, source_label: sourceLabel });
    await client.query('COMMIT');
    res.status(201).json({ evidence: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK'); next(error);
  } finally { client.release(); }
});

app.post('/api/cases/:id/transition-review', requireRole('account_manager'), requireCsrf, getCaseForUser, async (req, res, next) => {
  const accepted = req.body && req.body.accepted;
  const stateValue = typeof (req.body && req.body.state) === 'string' ? req.body.state.trim() : '';
  const blocker = typeof (req.body && req.body.blocker) === 'string' ? req.body.blocker.trim() : '';
  const nextAction = typeof (req.body && req.body.next_action) === 'string' ? req.body.next_action.trim() : '';
  const reason = typeof (req.body && req.body.reason) === 'string' ? req.body.reason.trim() : '';
  if (typeof accepted !== 'boolean') return res.status(400).json({ error: 'accepted must be true or false.' });
  if (accepted && (!stateValue || !blocker || !nextAction || stateValue.length > 100 || blocker.length > 10000 || nextAction.length > 10000)) return res.status(400).json({ error: 'A valid state, blocker and next action are required to apply a proposal.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (accepted) {
      await client.query('UPDATE cases SET state=$2,blocker=$3,next_action=$4,updated_at=NOW() WHERE id=$1', [req.caseRecord.id, stateValue, blocker, nextAction]);
      await recordHistory(client, req.caseRecord.id, req.session.user.id, 'transition_confirmed', 'Account Manager reviewed and applied an AI-proposed transition', { state: stateValue, blocker, next_action: nextAction, reason });
    } else {
      await recordHistory(client, req.caseRecord.id, req.session.user.id, 'transition_rejected', 'Account Manager reviewed and rejected an AI-proposed transition', { reason });
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});

app.post('/api/cases/:id/review-request', requireRole('admin'), requireCsrf, getCaseForUser, async (req, res, next) => {
  const message = typeof (req.body && req.body.message) === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 5000) return res.status(400).json({ error: 'A review request is required (max 5,000 characters).' });
  try {
    await recordHistory(pool, req.caseRecord.id, req.session.user.id, 'admin_change_requested', 'Admin requested changes: ' + message, { message });
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});
app.get('/api/admin/audit-log', requireRole('admin'), async (_req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT h.id,h.case_id,h.actor_user_id,h.event_type,h.summary,h.details,h.created_at,c.title AS case_title,u.email AS actor_email FROM case_history h JOIN cases c ON c.id=h.case_id JOIN users u ON u.id=h.actor_user_id ORDER BY h.created_at DESC LIMIT 500'
    );
    res.json({ events: result.rows });
  } catch (error) { next(error); }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use('/api', (error, _req, res, _next) => {
  console.error('CASEFLOW API error:', error.message);
  if (!res.headersSent) res.status(500).json({ error: 'An unexpected server error occurred.' });
});
app.use(express.static(path.join(__dirname, '..', 'bundle'), { index: false, etag: true, maxAge: isProduction ? '5m' : 0 }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'bundle', 'landing.html')));
app.get('*path', (_req, res) => res.sendFile(path.join(__dirname, '..', 'bundle', 'index.html')));

async function bootstrapAdmin() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    if (isProduction) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required for first boot.');
    return;
  }
  if (!validEmail(email) || password.length < 12 || password.length > 128) throw new Error('ADMIN_EMAIL must be valid and ADMIN_PASSWORD must be 12–128 characters.');
  const count = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role='admin'");
  if (count.rows[0].count === 0) {
    const existing = await pool.query('SELECT role FROM users WHERE email=$1', [email]);
    if (existing.rowCount) throw new Error('ADMIN_EMAIL already belongs to a non-owner account. Choose the verified company owner email before first boot.');
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    await pool.query("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'admin')", [email, hash]);
    console.log('Company owner Admin provisioned from environment settings.');
  }
}

async function bootstrapInviteCode() {
  const code = process.env.COMPANY_INVITE_CODE;
  if (!code) { if (isProduction) throw new Error('COMPANY_INVITE_CODE is required for Account Manager self-registration.'); return; }
  if (code.length < 16 || code.length > 256) throw new Error('COMPANY_INVITE_CODE must be 16–256 characters.');
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const result = await pool.query('SELECT invite_code_hash FROM company_settings WHERE id=1');
  if (!result.rows[0].invite_code_hash) {
    await pool.query('UPDATE company_settings SET invite_code_hash=$1,invite_code_updated_at=NOW(),updated_at=NOW() WHERE id=1', [hash]);
    console.log('Initial company invite code hash stored.');
  } else if (result.rows[0].invite_code_hash !== hash) console.warn('Configured invite code differs from stored code; stored code remains active.');
}

async function start() {
  await pool.query('SELECT 1');
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await bootstrapAdmin();
  await bootstrapInviteCode();
  app.listen(port, () => console.log('CASEFLOW server listening on port ' + port));
}
start().catch(error => {
  console.error('CASEFLOW startup failed:', error.message);
  process.exit(1);
});
process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
