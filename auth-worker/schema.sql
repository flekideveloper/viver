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

-- Daily YouTube channel snapshots, collected on successful user visits (not inferred).
CREATE TABLE IF NOT EXISTS youtube_cache (
  client_hash TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS youtube_snapshots (
  client_hash TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  date TEXT NOT NULL,
  view_count INTEGER NOT NULL,
  subscriber_count INTEGER,
  video_count INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (client_hash, channel_id, date)
);
CREATE INDEX IF NOT EXISTS idx_youtube_snapshots_by_client
  ON youtube_snapshots (client_hash, channel_id, date);

-- Cached YouTube Analytics weekly report and discovery sections; no OAuth tokens in cache.
CREATE TABLE IF NOT EXISTS youtube_analytics_cache (
  client_hash TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Only public, owner-verified YouTube upload metadata and read-only performance snapshots.
CREATE TABLE IF NOT EXISTS youtube_video_cache (
 client_hash TEXT PRIMARY KEY,
 channel_id TEXT NOT NULL,
 payload TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);


-- Independently authenticated Twitch, TikTok and X creator insights, 15min cache and observed history.
CREATE TABLE IF NOT EXISTS social_overview_cache (
 client_hash TEXT NOT NULL,
 provider TEXT NOT NULL,
 subject TEXT NOT NULL,
 payload TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(client_hash,provider)
);
CREATE TABLE IF NOT EXISTS social_metric_snapshots (
 client_hash TEXT NOT NULL,
 provider TEXT NOT NULL,
 subject TEXT NOT NULL,
 date TEXT NOT NULL,
 metrics TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(client_hash,provider,subject,date)
);
CREATE INDEX IF NOT EXISTS idx_social_history ON social_metric_snapshots(client_hash,provider,subject,date);
