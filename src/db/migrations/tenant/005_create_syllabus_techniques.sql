-- Migration: 005_create_syllabus_techniques.sql
-- Creates syllabus_techniques table scoped to an academy and linked to a category

CREATE TABLE IF NOT EXISTS syllabus_techniques (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  belt_level TEXT,
  media_url TEXT,
  display_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES syllabus_categories(id) ON DELETE RESTRICT
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_syllabus_techniques_academy ON syllabus_techniques(academy_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_techniques_category ON syllabus_techniques(category_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_techniques_level ON syllabus_techniques(level);
CREATE INDEX IF NOT EXISTS idx_syllabus_techniques_status ON syllabus_techniques(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_technique_name_academy_category ON syllabus_techniques(academy_id, category_id, name);
