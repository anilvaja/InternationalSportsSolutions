-- Migration: 003_add_academy_id_columns.sql
-- Enforces explicit academy_id column on branches, batches, and students for multi-tenant relationship integrity

ALTER TABLE branches ADD COLUMN academy_id INTEGER;
ALTER TABLE batches ADD COLUMN academy_id INTEGER;
ALTER TABLE students ADD COLUMN academy_id INTEGER;

-- Populate with tenant academy_id from tenant_settings
UPDATE branches SET academy_id = (SELECT CAST(value AS INTEGER) FROM tenant_settings WHERE key = 'academy_id') WHERE academy_id IS NULL;
UPDATE batches SET academy_id = (SELECT CAST(value AS INTEGER) FROM tenant_settings WHERE key = 'academy_id') WHERE academy_id IS NULL;
UPDATE students SET academy_id = (SELECT CAST(value AS INTEGER) FROM tenant_settings WHERE key = 'academy_id') WHERE academy_id IS NULL;

-- Indices for rapid tenant-scoped lookups
CREATE INDEX IF NOT EXISTS idx_branches_academy ON branches(academy_id);
CREATE INDEX IF NOT EXISTS idx_batches_academy ON batches(academy_id);
CREATE INDEX IF NOT EXISTS idx_students_academy ON students(academy_id);
CREATE INDEX IF NOT EXISTS idx_batches_branch ON batches(branch_id);
