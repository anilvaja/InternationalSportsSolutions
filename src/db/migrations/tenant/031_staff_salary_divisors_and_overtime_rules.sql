-- Migration 031: Staff Salary Divisors, Overtime Grace Rules, and Deduction Thresholds

-- 1. Add salary divisor and overtime grace rule columns to staff_salary_profiles
ALTER TABLE staff_salary_profiles ADD COLUMN salary_divisor TEXT DEFAULT 'actual_scheduled_minutes';
ALTER TABLE staff_salary_profiles ADD COLUMN overtime_grace_minutes INTEGER DEFAULT 30;
ALTER TABLE staff_salary_profiles ADD COLUMN min_present_percent REAL DEFAULT 75.0;
ALTER TABLE staff_salary_profiles ADD COLUMN min_halfday_percent REAL DEFAULT 25.0;
ALTER TABLE staff_salary_profiles ADD COLUMN custom_divisor_value REAL DEFAULT NULL;

-- 2. Index for divisor queries
CREATE INDEX IF NOT EXISTS idx_salary_profiles_divisor ON staff_salary_profiles(salary_divisor);

