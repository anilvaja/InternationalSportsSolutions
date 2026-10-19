-- Tenant Database Schema: Migration 008
-- Description: Overtime Requests, Approval Workflows, and Academy Policy Settings

-- 1. Academy Policy Settings (Configurable thresholds and rules)
CREATE TABLE IF NOT EXISTS academy_policy_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL UNIQUE DEFAULT 1,
  attendance_cutoff_days INTEGER DEFAULT 2, -- Today + previous 2 calendar days
  overtime_threshold_minutes INTEGER DEFAULT 30, -- <=30 mins auto-approved/normal policy; >=31 mins requires approval
  statement_visibility_day INTEGER DEFAULT 25, -- Statements visible from 25th of month
  expected_payday INTEGER DEFAULT 1, -- Expected payment date (e.g. 1st of month)
  overtime_compensation_mode TEXT CHECK(overtime_compensation_mode IN ('standard_rate', 'overtime_rate', 'none')) DEFAULT 'standard_rate',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  allow_future_attendance INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default policy settings if not present
INSERT OR IGNORE INTO academy_policy_settings (academy_id, attendance_cutoff_days, overtime_threshold_minutes, statement_visibility_day, expected_payday, timezone)
VALUES (1, 2, 30, 25, 1, 'Asia/Kolkata');

-- 2. Overtime Requests Table
CREATE TABLE IF NOT EXISTS overtime_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER,
  user_id INTEGER NOT NULL, -- Coach or employee
  session_id INTEGER,
  date DATE NOT NULL,
  scheduled_start_time TEXT,
  scheduled_end_time TEXT,
  actual_start_time TEXT,
  actual_end_time TEXT,
  overtime_minutes INTEGER NOT NULL,
  approval_required INTEGER DEFAULT 0, -- 1 if > threshold, 0 if <= threshold
  reason TEXT, -- Mandatory when approval_required = 1
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'auto_approved')) DEFAULT 'pending',
  requested_by INTEGER NOT NULL,
  approved_by INTEGER,
  reviewer_notes TEXT,
  reviewed_at DATETIME,
  payable_amount REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES batch_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_overtime_user ON overtime_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON overtime_requests(date);
CREATE INDEX IF NOT EXISTS idx_overtime_status ON overtime_requests(status);
