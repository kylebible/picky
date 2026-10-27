-- What the app reports about itself: errors and key steps such as page views
-- and menu-read stages. Claude reads it to debug what people saw on their phones.
CREATE TABLE client_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  device_id TEXT NOT NULL,
  -- One id per page load, to follow a single visit.
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('event', 'error')),
  name TEXT NOT NULL,
  path TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  app_version TEXT,
  user_agent TEXT
);
CREATE INDEX client_events_created ON client_events(created_at);
CREATE INDEX client_events_device ON client_events(device_id, created_at);
