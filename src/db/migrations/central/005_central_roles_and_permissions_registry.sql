-- Central Database Schema
-- Version: 005
-- Register central permissions catalog and academy role templates

CREATE TABLE IF NOT EXISTS central_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permission_key TEXT UNIQUE NOT NULL,
  category TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS central_role_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL,
  is_system INTEGER DEFAULT 1,
  theme_color TEXT DEFAULT 'blue',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_central_permissions_key ON central_permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_central_role_templates_name ON central_role_templates(name);

