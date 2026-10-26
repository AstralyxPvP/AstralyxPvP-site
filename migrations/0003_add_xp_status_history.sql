CREATE TABLE IF NOT EXISTS astralyx_xp_status_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checked_at TEXT NOT NULL,
  sample_bucket INTEGER NOT NULL UNIQUE,
  source TEXT NOT NULL,
  online INTEGER CHECK (online IS NULL OR online IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_astralyx_xp_status_checks_checked_at
  ON astralyx_xp_status_checks (checked_at DESC);
