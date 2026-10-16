-- Migration: 004_create_syllabus_categories.sql
-- Creates syllabus_categories table scoped to an academy

CREATE TABLE IF NOT EXISTS syllabus_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_syllabus_categories_academy ON syllabus_categories(academy_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_categories_status ON syllabus_categories(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_category_name_academy ON syllabus_categories(academy_id, name);
