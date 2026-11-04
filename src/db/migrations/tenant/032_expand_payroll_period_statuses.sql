-- Migration 032: Expand staff_payroll_periods status check constraint to include 'reopened' and 'approved'
-- Enables authorized reopen and approve workflows without SQLITE_CONSTRAINT_CHECK errors

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS staff_payroll_periods_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  year_month TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  statement_visibility_day INTEGER DEFAULT 25,
  status TEXT CHECK(status IN ('provisional', 'pending_review', 'approved', 'finalized', 'closed', 'reopened')) DEFAULT 'provisional',
  finalized_by INTEGER,
  finalized_at DATETIME,
  expected_payment_date DATE,
  approved_by INTEGER,
  approved_at DATETIME,
  reopened_by INTEGER,
  reopened_at DATETIME,
  reopen_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(academy_id, year_month)
);

INSERT OR IGNORE INTO staff_payroll_periods_new (
  id, academy_id, year_month, start_date, end_date, statement_visibility_day, status,
  finalized_by, finalized_at, expected_payment_date, approved_by, approved_at,
  reopened_by, reopened_at, reopen_reason, created_at
)
SELECT 
  id, academy_id, year_month, start_date, end_date, statement_visibility_day, status,
  finalized_by, finalized_at, expected_payment_date, approved_by, approved_at,
  reopened_by, reopened_at, reopen_reason, created_at
FROM staff_payroll_periods;

DROP TABLE staff_payroll_periods;

ALTER TABLE staff_payroll_periods_new RENAME TO staff_payroll_periods;

PRAGMA foreign_keys=on;
