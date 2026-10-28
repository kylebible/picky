-- One row per menu scan, so a phone can come back to a scan after leaving the
-- app and list its recent menus. The read itself runs in the MenuScan Durable
-- Object; result is the finished menu as JSON. Photos are never stored.
CREATE TABLE scans (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status TEXT NOT NULL DEFAULT 'reading' CHECK (status IN ('reading', 'done', 'error')),
  strong INTEGER NOT NULL DEFAULT 0,
  pages INTEGER NOT NULL,
  restaurant_name TEXT,
  dish_count INTEGER,
  model TEXT,
  retried INTEGER,
  error TEXT,
  result TEXT
);
CREATE INDEX scans_device_created ON scans(device_id, created_at);

ALTER TABLE menu_reads ADD COLUMN scan_id TEXT;
