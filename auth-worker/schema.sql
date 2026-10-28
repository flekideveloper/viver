-- VIVER: independent database. All social tokens are encrypted at rest.
CREATE TABLE IF NOT EXISTS oauth_pending (
  state TEXT PRIMARY KEY,
  client_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  verifier TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_pending_time ON oauth_pending(created_at);
CREATE TABLE IF NOT EXISTS oauth_accounts (
  client_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  label TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  token_enc TEXT NOT NULL,
  refresh_enc TEXT,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(client_hash,provider)
);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_updated ON oauth_accounts(updated_at);
