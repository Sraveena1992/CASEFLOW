const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('server JavaScript parses without syntax errors', () => {
  const result = spawnSync(process.execPath, ['--check', path.join(root, 'server/index.js')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('server defines health, CSRF, authentication and logout routes', () => {
  const source = read('server/index.js');
  for (const route of [
    "app.get('/api/health'",
    "app.get('/api/auth/csrf'",
    "app.post('/api/auth/login'",
    "app.post('/api/auth/logout'"
  ]) assert.ok(source.includes(route), 'Missing route: ' + route);
});

test('server enforces session, CSRF and role checks on protected mutations', () => {
  const source = read('server/index.js');
  assert.match(source, /function requireAuth/);
  assert.match(source, /function requireCsrf/);
  assert.match(source, /function requireRole/);
  assert.match(source, /app\.post\('\/api\/cases'.*requireRole\('account_manager'\).*requireCsrf/s);
  assert.match(source, /app\.patch\('\/api\/cases\/\:id\/assignment'.*requireRole\('admin'\).*requireCsrf/s);
});

test('server serves the bundle and the dashboard entry point', () => {
  const source = read('server/index.js');
  assert.match(source, /express\.static\(path\.join\(__dirname, '\.\.', 'bundle'\)/);
  assert.match(source, /app\.get\('\*path'.*'bundle', 'index\.html'/);
  assert.ok(fs.existsSync(path.join(root, 'bundle/index.html')));
});

test('dashboard includes authentication guard and app bootstrap', () => {
  const html = read('bundle/index.html');
  assert.match(html, /auth-guard\.js/);
  assert.match(html, /app\.js/);
  assert.match(html, /meta name="viewport"/);
});

test('login page includes a route back to CASEFLOW and password recovery', () => {
  const html = read('bundle/login.html');
  assert.match(html, /Return to CASEFLOW/i);
  assert.match(html, /forgot-password|reset-password/i);
});

test('landing page includes product explanation and signup/login entry points', () => {
  const html = read('bundle/landing.html');
  assert.match(html, /About CASEFLOW|What is CASEFLOW/i);
  assert.match(html, /login\.html/);
  assert.match(html, /signup\.html/);
});

test('README explains why CASEFLOW exists and its product principles', () => {
  const readme = read('README.md');
  assert.match(readme, /Why CASEFLOW Exists/);
  assert.match(readme, /Evidence before conclusions/);
  assert.match(readme, /Human authority/);
  assert.match(readme, /Verified outcomes/);
});

test('landing page explains why CASEFLOW exists and distinguishes planned capabilities', () => {
  const html = read('bundle/landing.html');
  assert.match(html, /Why CASEFLOW/);
  assert.match(html, /Core features/);
  assert.match(html, /not yet represented as a live capability/i);
});

test('Anna dashboard includes a non-destructive product explanation', () => {
  const html = read('bundle/index.html');
  assert.match(html, /ABOUT CASEFLOW/);
  assert.match(html, /Core features/);
  assert.match(html, /not a live feature yet/i);
  assert.match(html, /cases-container/);
});

test('transition validator clearly describes human review rather than autonomous approval', () => {
  const manifest = JSON.parse(read('executas/caseflow/manifest.json'));
  assert.ok(manifest.tools.some((tool) => tool.name === 'evaluate_transition'));
  assert.match(manifest.description, /human review/i);
  assert.match(manifest.description, /Does not independently verify evidence/i);
});
