-- Picky MVP schema. Lists (allergies, ingredients...) are stored as JSON text.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  email TEXT UNIQUE,
  name TEXT,
  provider TEXT
);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  display_name TEXT,
  allergies TEXT NOT NULL DEFAULT '[]',
  diets TEXT NOT NULL DEFAULT '[]',
  likes TEXT NOT NULL DEFAULT '[]',
  dislikes TEXT NOT NULL DEFAULT '[]',
  spice_level INTEGER
);

CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(id),
  restaurant_name TEXT,
  currency TEXT,
  model TEXT NOT NULL,
  parsed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE dishes (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id),
  position INTEGER NOT NULL,
  section TEXT,
  name TEXT NOT NULL,
  price REAL,
  price_status TEXT NOT NULL CHECK (price_status IN ('listed', 'market_price', 'not_listed')),
  description TEXT,
  ingredients TEXT NOT NULL DEFAULT '[]',
  allergens TEXT NOT NULL DEFAULT '[]',
  diet_tags TEXT NOT NULL DEFAULT '[]',
  options TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX dishes_menu ON dishes(menu_id);

CREATE TABLE split_sessions (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id),
  host_id TEXT NOT NULL REFERENCES users(id),
  guest_id TEXT REFERENCES users(id),
  join_code TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL
);

CREATE TABLE matches (
  session_id TEXT NOT NULL REFERENCES split_sessions(id),
  dish_id TEXT NOT NULL REFERENCES dishes(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, dish_id)
);

CREATE TABLE plan_items (
  user_id TEXT NOT NULL REFERENCES users(id),
  menu_id TEXT NOT NULL REFERENCES menus(id),
  dish_id TEXT NOT NULL REFERENCES dishes(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  option TEXT,
  shared INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, dish_id)
);
