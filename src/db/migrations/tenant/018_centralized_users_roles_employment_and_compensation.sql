-- Migration: 018_centralized_users_roles_employment_and_compensation.sql
-- Implements centralized Users, Roles, Employment Records, Compensation History, and Audit Trail

-- 1. User Branch Assignments
CREATE TABLE IF NOT EXISTS user_branch_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  is_primary INTEGER DEFAULT 1,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_branches_user ON user_branch_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON user_branch_assignments(branch_id);

-- 2. Employment Records
CREATE TABLE IF NOT EXISTS employment_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  employment_type TEXT DEFAULT 'full_time', -- 'full_time', 'part_time', 'contract', 'visiting'
  joining_date DATE NOT NULL,
  exit_date DATE,
  status TEXT DEFAULT 'active', -- 'active', 'probation', 'suspended', 'resigned', 'terminated'
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  sport_id INTEGER REFERENCES sports(id) ON DELETE SET NULL,
  specializations TEXT,
  experience_years INTEGER DEFAULT 0,
  certifications TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employment_user ON employment_records(user_id);

-- 3. Employee Compensation History (Effective-dated salary revisions)
CREATE TABLE IF NOT EXISTS employee_compensation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employment_record_id INTEGER REFERENCES employment_records(id) ON DELETE SET NULL,
  compensation_mode TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'hourly', 'per_day', 'per_session', 'per_minute'
  previous_amount REAL DEFAULT 0,
  new_amount REAL NOT NULL,
  currency TEXT DEFAULT 'INR',
  effective_from DATE NOT NULL,
  effective_to DATE,
  reason TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'pending', 'superseded', 'cancelled'
  created_by_user_id INTEGER,
  approved_by_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comp_history_user ON employee_compensation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_history_effective ON employee_compensation_history(effective_from);

-- 4. User Role History (Effective-dated role transitions and promotions)
CREATE TABLE IF NOT EXISTS user_role_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  previous_role TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  reason TEXT,
  changed_by_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_role_history_user ON user_role_history(user_id);

-- 5. Safe Data Migration: Populate employment records and compensation history from existing coaches & staff
INSERT OR IGNORE INTO employment_records (
  academy_id, user_id, designation, employment_type, joining_date, status, branch_id, sport_id, specializations, experience_years, effective_from
)
SELECT 
  COALESCE(c.branch_id, 1),
  c.user_id,
  'Sports Coach',
  'full_time',
  DATE(COALESCE(c.created_at, '2026-01-01')),
  CASE WHEN c.is_active = 1 THEN 'active' ELSE 'suspended' END,
  c.branch_id,
  c.sport_id,
  c.specializations,
  COALESCE(c.experience_years, 0),
  DATE(COALESCE(c.created_at, '2026-01-01'))
FROM coaches c
WHERE c.user_id IS NOT NULL;

-- Initial compensation record for existing coaches
INSERT OR IGNORE INTO employee_compensation_history (
  academy_id, user_id, compensation_mode, previous_amount, new_amount, currency, effective_from, reason, status
)
SELECT 
  COALESCE(c.branch_id, 1),
  c.user_id,
  COALESCE(c.salary_type, 'monthly'),
  0,
  COALESCE(c.salary_amount, 30000),
  'INR',
  DATE(COALESCE(c.created_at, '2026-01-01')),
  'Initial employment compensation baseline',
  'active'
FROM coaches c
WHERE c.user_id IS NOT NULL;

-- Initial branch assignment for existing coaches
INSERT OR IGNORE INTO user_branch_assignments (
  academy_id, user_id, branch_id, is_primary, effective_from
)
SELECT 
  COALESCE(c.branch_id, 1),
  c.user_id,
  c.branch_id,
  1,
  DATE(COALESCE(c.created_at, '2026-01-01'))
FROM coaches c
WHERE c.user_id IS NOT NULL AND c.branch_id IS NOT NULL;
