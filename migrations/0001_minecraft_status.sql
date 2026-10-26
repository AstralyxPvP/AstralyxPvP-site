CREATE TABLE IF NOT EXISTS minecraft_status_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checked_at TEXT NOT NULL,
  source TEXT NOT NULL,
  online INTEGER NOT NULL CHECK (online IN (0, 1)),
  players_online INTEGER,
  players_max INTEGER,
  version TEXT,
  ping_ms INTEGER,
  api_response TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_minecraft_status_checks_checked_at
  ON minecraft_status_checks (checked_at DESC);
