-- The menu read now returns a category per dish, used to pick its drawing.
ALTER TABLE dishes ADD COLUMN category TEXT NOT NULL DEFAULT 'other';
