-- Adds the "unreadable" price_status (a price is printed but can't be read).
-- SQLite can't change a CHECK constraint, so the dishes table is rebuilt.
PRAGMA defer_foreign_keys = true;

CREATE TABLE dishes_new (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id),
  position INTEGER NOT NULL,
  section TEXT,
  name TEXT NOT NULL,
  price REAL,
  price_status TEXT NOT NULL CHECK (price_status IN ('listed', 'market_price', 'not_listed', 'unreadable')),
  description TEXT,
  ingredients TEXT NOT NULL DEFAULT '[]',
  allergens TEXT NOT NULL DEFAULT '[]',
  diet_tags TEXT NOT NULL DEFAULT '[]',
  options TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT 'other'
);
INSERT INTO dishes_new (id, menu_id, position, section, name, price, price_status, description, ingredients, allergens, diet_tags, options, category)
  SELECT id, menu_id, position, section, name, price, price_status, description, ingredients, allergens, diet_tags, options, category FROM dishes;
DROP TABLE dishes;
ALTER TABLE dishes_new RENAME TO dishes;
CREATE INDEX dishes_menu ON dishes(menu_id);
