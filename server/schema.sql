-- CASEFLOW PostgreSQL schema. The server applies this file during startup.
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'account_manager')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'NEW',
  blocker TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  owner_user_id BIGINT NOT NULL REFERENCES users(id),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cases_owner_updated_idx ON cases(owner_user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS case_evidence (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  created_by BIGINT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  source_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS case_evidence_case_idx ON case_evidence(case_id, created_at);
CREATE TABLE IF NOT EXISTS case_history (
  id BIGSERIAL PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  actor_user_id BIGINT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS case_history_case_idx ON case_history(case_id, created_at);

-- Self-service Account Manager onboarding. Invitation and verification secrets are stored as hashes.
CREATE TABLE IF NOT EXISTS company_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  invite_code_hash TEXT,
  invite_code_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO company_settings(id) VALUES(1) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_verification_email_idx ON email_verification_tokens(email, created_at DESC);

-- A company has exactly one owner/Admin account. Provisioning additional Admins is not supported.
CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin_idx ON users ((role)) WHERE role = 'admin';

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens(user_id, created_at DESC);
