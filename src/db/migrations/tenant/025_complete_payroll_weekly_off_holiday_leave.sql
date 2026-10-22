-- Migration 025: Complete Employee Payroll, Weekly Off, Holiday Calendar & Leave Management Schema
-- Multi-tenant Karate Academy SaaS

-- 1. Branch Work Schedules (Branch-level working days, multi-shifts, and weekly off defaults)
CREATE TABLE IF NOT EXISTS branch_work_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER NOT NULL,
  schedule_name TEXT DEFAULT 'Standard Branch Schedule',
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_branch_schedules_branch ON branch_work_schedules(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_schedules_effective ON branch_work_schedules(branch_id, effective_from, effective_to);

-- 2. Branch Schedule Days (Weekday specific shifts and weekly off configuration)
CREATE TABLE IF NOT EXISTS branch_schedule_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_schedule_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL, -- 1=Monday, ..., 7=Sunday
  shift_name TEXT DEFAULT 'Regular Shift',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  scheduled_hours REAL NOT NULL,
  break_duration_minutes INTEGER DEFAULT 0,
  is_break_paid INTEGER DEFAULT 0,
  is_working_day INTEGER DEFAULT 1, -- 1 = working day, 0 = weekly off
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_schedule_id) REFERENCES branch_work_schedules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_branch_schedule_days ON branch_schedule_days(branch_schedule_id, day_of_week);

-- 3. Employee Work Exceptions (Weekly-Off & Holiday Work, Comp-Off Accrual & Usage)
CREATE TABLE IF NOT EXISTS employee_work_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER,
  user_id INTEGER NOT NULL,
  date DATE NOT NULL,
  exception_type TEXT CHECK(exception_type IN ('weekly_off_work', 'holiday_work', 'comp_off_earned', 'comp_off_used')) NOT NULL,
  compensation_type TEXT CHECK(compensation_type IN ('overtime_pay', 'comp_off', 'none')) DEFAULT 'comp_off',
  hours_worked REAL DEFAULT 0,
  comp_off_days REAL DEFAULT 1.0,
  reason TEXT,
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
  approved_by INTEGER,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_work_exceptions_user ON employee_work_exceptions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_work_exceptions_status ON employee_work_exceptions(status);

-- 4. Academy Leave Policies (Configurable entitlements, accrual, carry-forward, sandwich rules)
CREATE TABLE IF NOT EXISTS leave_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER, -- NULL = applies to all branches
  leave_type TEXT NOT NULL, -- 'casual', 'sick', 'earned', 'unpaid', 'maternity', 'bereavement'
  name TEXT NOT NULL,
  annual_quota REAL NOT NULL DEFAULT 12,
  monthly_accrual REAL DEFAULT 1.0,
  is_paid INTEGER DEFAULT 1,
  allow_half_day INTEGER DEFAULT 1,
  allow_carry_forward INTEGER DEFAULT 0,
  max_carry_forward REAL DEFAULT 0,
  allow_encashment INTEGER DEFAULT 0,
  sandwich_rule INTEGER DEFAULT 0, -- 1 = weekly off / holidays falling inside leave counted as leave
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(academy_id, branch_id, leave_type)
);

CREATE INDEX IF NOT EXISTS idx_leave_policies_type ON leave_policies(academy_id, leave_type);

-- 5. Employee Leave Balances (Yearly opening, accrued, used, and remaining balance tracking)
CREATE TABLE IF NOT EXISTS employee_leave_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER NOT NULL,
  leave_type TEXT NOT NULL,
  year INTEGER NOT NULL,
  opening_balance REAL DEFAULT 0,
  accrued REAL DEFAULT 0,
  used REAL DEFAULT 0,
  remaining REAL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, leave_type, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user ON employee_leave_balances(user_id, year);

-- 6. Payroll Audit Logs (Immutable audit trail of calculations, revisions, approvals, reopenings)
CREATE TABLE IF NOT EXISTS payroll_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL, -- 'schedule', 'holiday', 'leave', 'salary_profile', 'payroll_period', 'statement', 'payment'
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'approve', 'reject', 'cancel', 'finalize', 'reopen', 'recalculate', 'disburse'
  actor_id INTEGER NOT NULL,
  changes_summary TEXT,
  reason TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_audit_entity ON payroll_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_academy ON payroll_audit_logs(academy_id);

-- 7. Add columns safely to existing tables if missing

-- Enhance academy_holidays
ALTER TABLE academy_holidays ADD COLUMN end_date DATE;
ALTER TABLE academy_holidays ADD COLUMN category TEXT DEFAULT 'public';
ALTER TABLE academy_holidays ADD COLUMN is_closed INTEGER DEFAULT 1;
ALTER TABLE academy_holidays ADD COLUMN is_recurring INTEGER DEFAULT 0;
ALTER TABLE academy_holidays ADD COLUMN status TEXT DEFAULT 'approved';
ALTER TABLE academy_holidays ADD COLUMN created_by INTEGER;
ALTER TABLE academy_holidays ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Enhance leave_requests
ALTER TABLE leave_requests ADD COLUMN academy_id INTEGER DEFAULT 1;
ALTER TABLE leave_requests ADD COLUMN branch_id INTEGER;
ALTER TABLE leave_requests ADD COLUMN user_id INTEGER;
ALTER TABLE leave_requests ADD COLUMN leave_type TEXT DEFAULT 'casual';
ALTER TABLE leave_requests ADD COLUMN day_part TEXT DEFAULT 'full'; -- 'full', 'first_half', 'second_half'
ALTER TABLE leave_requests ADD COLUMN days_count REAL DEFAULT 1.0;
ALTER TABLE leave_requests ADD COLUMN is_paid INTEGER DEFAULT 1;
ALTER TABLE leave_requests ADD COLUMN cancellation_reason TEXT;
ALTER TABLE leave_requests ADD COLUMN cancelled_at DATETIME;
ALTER TABLE leave_requests ADD COLUMN cancelled_by INTEGER;

-- Enhance staff_payroll_periods
ALTER TABLE staff_payroll_periods ADD COLUMN approved_by INTEGER;
ALTER TABLE staff_payroll_periods ADD COLUMN approved_at DATETIME;
ALTER TABLE staff_payroll_periods ADD COLUMN reopened_by INTEGER;
ALTER TABLE staff_payroll_periods ADD COLUMN reopened_at DATETIME;
ALTER TABLE staff_payroll_periods ADD COLUMN reopen_reason TEXT;

-- Enhance staff_salary_profiles
ALTER TABLE staff_salary_profiles ADD COLUMN payment_frequency TEXT DEFAULT 'monthly';
ALTER TABLE staff_salary_profiles ADD COLUMN scheduled_payday INTEGER DEFAULT 1;
ALTER TABLE staff_salary_profiles ADD COLUMN allowances TEXT;
ALTER TABLE staff_salary_profiles ADD COLUMN deductions TEXT;

-- Seed Standard Leave Policies for Default Academy 1
INSERT OR IGNORE INTO leave_policies (academy_id, branch_id, leave_type, name, annual_quota, monthly_accrual, is_paid, allow_half_day, allow_carry_forward, max_carry_forward, allow_encashment, sandwich_rule)
VALUES 
  (1, NULL, 'casual', 'Casual Leave (CL)', 12, 1.0, 1, 1, 0, 0, 0, 0),
  (1, NULL, 'sick', 'Sick Leave (SL)', 12, 1.0, 1, 1, 1, 12, 0, 0),
  (1, NULL, 'earned', 'Earned / Annual Leave (EL)', 15, 1.25, 1, 1, 1, 30, 1, 0),
  (1, NULL, 'unpaid', 'Leave Without Pay (LWP)', 0, 0.0, 0, 1, 0, 0, 0, 0),
  (1, NULL, 'half_day', 'Half-Day Leave', 12, 1.0, 1, 1, 0, 0, 0, 0);

-- Seed Default Branch Schedules for Existing Branches in Academy 1
INSERT OR IGNORE INTO branch_work_schedules (id, academy_id, branch_id, schedule_name, effective_from, is_active)
SELECT id, academy_id, id, 'Branch General Schedule', '2026-01-01', 1
FROM branches
WHERE is_active = 1;

-- Seed Mon-Sat 9am-5pm shifts and Sun off for branch schedules
INSERT OR IGNORE INTO branch_schedule_days (branch_schedule_id, day_of_week, shift_name, start_time, end_time, scheduled_hours, break_duration_minutes, is_break_paid, is_working_day)
SELECT bws.id, 1, 'Regular Shift', '09:00', '17:00', 8.0, 60, 1, 1 FROM branch_work_schedules bws
UNION ALL
SELECT bws.id, 2, 'Regular Shift', '09:00', '17:00', 8.0, 60, 1, 1 FROM branch_work_schedules bws
UNION ALL
SELECT bws.id, 3, 'Regular Shift', '09:00', '17:00', 8.0, 60, 1, 1 FROM branch_work_schedules bws
UNION ALL
SELECT bws.id, 4, 'Regular Shift', '09:00', '17:00', 8.0, 60, 1, 1 FROM branch_work_schedules bws
UNION ALL
SELECT bws.id, 5, 'Regular Shift', '09:00', '17:00', 8.0, 60, 1, 1 FROM branch_work_schedules bws
UNION ALL
SELECT bws.id, 6, 'Regular Shift', '09:00', '17:00', 8.0, 60, 1, 1 FROM branch_work_schedules bws
UNION ALL
SELECT bws.id, 7, 'Weekly Off', '00:00', '00:00', 0.0, 0, 0, 0 FROM branch_work_schedules bws;
