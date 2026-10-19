-- Tenant Database Schema: Migration 016
-- Description: Employee-Specific Work Schedules, Multiple Shifts, Independent Compensation Policies, and Academy Holidays

-- 1. Employee Work Schedules (Effective-dated schedules configured independently per employee)
CREATE TABLE IF NOT EXISTS employee_work_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER,
  user_id INTEGER NOT NULL,
  schedule_name TEXT DEFAULT 'Standard Schedule',
  effective_from DATE NOT NULL,
  effective_to DATE,
  expected_daily_hours REAL DEFAULT 8.0,
  expected_weekly_hours REAL DEFAULT 48.0,
  working_days_per_week INTEGER DEFAULT 6,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_emp_schedules_user ON employee_work_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_emp_schedules_effective ON employee_work_schedules(effective_from, effective_to);

-- 2. Employee Schedule Shifts (Weekday specific shifts, multi-shifts per day, breaks, weekly offs)
CREATE TABLE IF NOT EXISTS employee_schedule_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL, -- 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday
  shift_name TEXT DEFAULT 'Shift 1',
  start_time TEXT NOT NULL,     -- '09:00'
  end_time TEXT NOT NULL,       -- '13:00'
  scheduled_hours REAL NOT NULL, -- e.g. 4.0
  break_duration_minutes INTEGER DEFAULT 0,
  is_break_paid INTEGER DEFAULT 0,
  is_working_day INTEGER DEFAULT 1, -- 1 = active working day, 0 = weekly off
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES employee_work_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_emp_shifts_schedule ON employee_schedule_shifts(schedule_id);
CREATE INDEX IF NOT EXISTS idx_emp_shifts_user_day ON employee_schedule_shifts(user_id, day_of_week);

-- 3. Upgrade staff_salary_profiles to support per_day mode, currency, overtime eligibility & deduction policies
CREATE TABLE IF NOT EXISTS staff_salary_profiles_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER NOT NULL,
  salary_mode TEXT CHECK(salary_mode IN ('monthly', 'hourly', 'per_day', 'per_session', 'per_minute')) NOT NULL DEFAULT 'monthly',
  base_rate REAL NOT NULL,
  currency TEXT DEFAULT 'INR',
  scheduled_daily_hours REAL DEFAULT 8.0,
  scheduled_days_per_week INTEGER DEFAULT 6,
  overtime_eligible INTEGER DEFAULT 1,
  overtime_rate_multiplier REAL DEFAULT 1.0,
  deduction_policy TEXT DEFAULT 'working_days', -- 'working_days', 'calendar_days', 'none'
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy over existing salary profiles
INSERT INTO staff_salary_profiles_new (
  id, academy_id, user_id, salary_mode, base_rate, effective_from, effective_to, is_active, notes, created_at, updated_at
)
SELECT id, academy_id, user_id, salary_mode, base_rate, effective_from, effective_to, is_active, notes, created_at, updated_at
FROM staff_salary_profiles;

DROP TABLE staff_salary_profiles;
ALTER TABLE staff_salary_profiles_new RENAME TO staff_salary_profiles;

CREATE INDEX IF NOT EXISTS idx_salary_profiles_user ON staff_salary_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_profiles_effective ON staff_salary_profiles(user_id, effective_from, effective_to);

-- 4. Academy & Branch Holiday Calendar
CREATE TABLE IF NOT EXISTS academy_holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER, -- NULL = all branches in academy
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  is_paid INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_academy_holidays_date ON academy_holidays(holiday_date);
