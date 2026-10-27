-- One row per menu scan: what each model read (dishes and prices as JSON),
-- why a careful read ran, and the result shown. Photos are never stored.
CREATE TABLE menu_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  device_id TEXT NOT NULL,
  strong INTEGER NOT NULL DEFAULT 0,
  pages INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('done', 'error')),
  error TEXT,
  ms INTEGER NOT NULL,
  final_model TEXT,
  retried INTEGER,
  -- Why the two quick reads disagreed (JSON array), empty when they agreed.
  reasons TEXT NOT NULL DEFAULT '[]',
  -- Each read: role, model, effort, ms, stop_reason, tokens and its full menu (JSON array).
  reads TEXT NOT NULL DEFAULT '[]',
  app_version TEXT
);
CREATE INDEX menu_reads_created ON menu_reads(created_at);
