-- Migration 033: Academy-Level Payroll Settings and Employee Divisor Overrides
-- Multi-tenant Karate Academy SaaS

-- 1. Add payroll calculation configuration columns to academy_policy_settings
ALTER TABLE academy_policy_settings ADD COLUMN default_salary_divisor TEXT DEFAULT 'actual_scheduled_minutes';
ALTER TABLE academy_policy_settings ADD COLUMN custom_divisor_value REAL DEFAULT NULL;
ALTER TABLE academy_policy_settings ADD COLUMN paid_leave_policy TEXT DEFAULT 'credit_scheduled_minutes';
ALTER TABLE academy_policy_settings ADD COLUMN short_attendance_policy TEXT DEFAULT 'deduct_proportionate_minutes';

-- 2. Add employee-level policy override columns to staff_salary_profiles
ALTER TABLE staff_salary_profiles ADD COLUMN paid_leave_policy TEXT DEFAULT NULL;
ALTER TABLE staff_salary_profiles ADD COLUMN short_attendance_policy TEXT DEFAULT NULL;

-- 3. Populate default values for existing rows in academy_policy_settings
UPDATE academy_policy_settings SET
  default_salary_divisor = COALESCE(default_salary_divisor, 'actual_scheduled_minutes'),
  paid_leave_policy = COALESCE(paid_leave_policy, 'credit_scheduled_minutes'),
  short_attendance_policy = COALESCE(short_attendance_policy, 'deduct_proportionate_minutes');
