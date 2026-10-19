-- Tenant Database Schema: Migration 007
-- Description: Batch Sessions, Attendance Date Enforcement, Session Swaps, Staff Salary Profiles, and Payroll Engine

-- 1. Batch Sessions (Scheduled and actual training classes generated from timetable)
CREATE TABLE IF NOT EXISTS batch_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  start_time TEXT NOT NULL, -- e.g. '07:00'
  end_time TEXT NOT NULL,   -- e.g. '08:30'
  coach_id INTEGER NOT NULL,
  substitute_coach_id INTEGER,
  status TEXT CHECK(status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')) DEFAULT 'scheduled',
  attendance_status TEXT CHECK(attendance_status IN ('pending', 'completed', 'verified')) DEFAULT 'pending',
  attendance_taken_at DATETIME,
  attendance_taken_by INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  UNIQUE(batch_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_batch_sessions_date ON batch_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_coach ON batch_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_status ON batch_sessions(status, attendance_status);

-- 2. Attendance Corrections (For attendance entries outside allowed 2-day cutoff or amendments)
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  session_id INTEGER,
  batch_id INTEGER NOT NULL,
  date DATE NOT NULL,
  student_id INTEGER,
  original_status TEXT,
  requested_status TEXT,
  reason TEXT NOT NULL,
  requested_by INTEGER NOT NULL,
  approved_by INTEGER,
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewer_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  FOREIGN KEY (session_id) REFERENCES batch_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 3. Session Swaps (Controlled temporary session switching without changing permanent batch)
CREATE TABLE IF NOT EXISTS session_swaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  student_id INTEGER NOT NULL,
  original_session_id INTEGER NOT NULL,
  replacement_session_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  requested_by INTEGER NOT NULL,
  approved_by INTEGER,
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (original_session_id) REFERENCES batch_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (replacement_session_id) REFERENCES batch_sessions(id) ON DELETE CASCADE
);

-- 4. Staff Salary Profiles (Rates, modes, and effective dates)
CREATE TABLE IF NOT EXISTS staff_salary_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER NOT NULL, -- staff / coach user
  salary_mode TEXT CHECK(salary_mode IN ('monthly', 'hourly', 'per_minute', 'per_session')) NOT NULL DEFAULT 'monthly',
  base_rate REAL NOT NULL, -- monthly salary amount, hourly rate, per-min rate, or per-session rate
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_salary_profiles_user ON staff_salary_profiles(user_id);

-- 5. Staff Payroll Periods (Monthly cycle per academy)
CREATE TABLE IF NOT EXISTS staff_payroll_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  year_month TEXT NOT NULL, -- 'YYYY-MM' e.g. '2026-10'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  statement_visibility_day INTEGER DEFAULT 25,
  status TEXT CHECK(status IN ('provisional', 'pending_review', 'finalized', 'closed')) DEFAULT 'provisional',
  finalized_by INTEGER,
  finalized_at DATETIME,
  expected_payment_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(academy_id, year_month)
);

-- 6. Staff Salary Statements (Itemized monthly statement per employee)
CREATE TABLE IF NOT EXISTS staff_salary_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_period_id INTEGER NOT NULL,
  academy_id INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER NOT NULL,
  salary_mode TEXT NOT NULL,
  applicable_rate REAL NOT NULL,
  payable_units REAL DEFAULT 0, -- days, hours, minutes, or sessions
  gross_earnings REAL NOT NULL DEFAULT 0,
  total_additions REAL DEFAULT 0,
  total_deductions REAL DEFAULT 0,
  net_earnings REAL NOT NULL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  balance_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT CHECK(payment_status IN ('unpaid', 'partially_paid', 'paid')) DEFAULT 'unpaid',
  calculation_snapshot TEXT, -- JSON breakdown of verified sessions, dates, rate applied
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payroll_period_id) REFERENCES staff_payroll_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(payroll_period_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_salary_statements_period ON staff_salary_statements(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_salary_statements_user ON staff_salary_statements(user_id);

-- 7. Staff Salary Adjustments (Bonuses, overtime, unpaid leaves, deductions)
CREATE TABLE IF NOT EXISTS staff_salary_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  statement_id INTEGER NOT NULL,
  type TEXT CHECK(type IN ('addition', 'deduction')) NOT NULL,
  category TEXT NOT NULL, -- 'overtime', 'bonus', 'unpaid_leave', 'penalty', 'reimbursement'
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES staff_salary_statements(id) ON DELETE CASCADE
);

-- 8. Staff Salary Payments (Disbursements and partial payouts)
CREATE TABLE IF NOT EXISTS staff_salary_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  statement_id INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT CHECK(payment_method IN ('bank_transfer', 'upi', 'cash', 'cheque')) NOT NULL,
  reference_number TEXT,
  notes TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES staff_salary_statements(id) ON DELETE CASCADE
);
