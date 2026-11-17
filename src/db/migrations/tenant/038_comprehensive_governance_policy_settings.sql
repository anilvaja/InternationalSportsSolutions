-- Migration 038: Comprehensive Governance & Operational Policy Settings
-- Multi-tenant Sports SaaS

-- 1. Add operational governance columns to academy_policy_settings
ALTER TABLE academy_policy_settings ADD COLUMN fee_grace_period_days INTEGER DEFAULT 7;
ALTER TABLE academy_policy_settings ADD COLUMN allow_fee_pauses INTEGER DEFAULT 1;
ALTER TABLE academy_policy_settings ADD COLUMN default_currency TEXT DEFAULT 'INR';
ALTER TABLE academy_policy_settings ADD COLUMN standard_shift_hours REAL DEFAULT 8.0;
ALTER TABLE academy_policy_settings ADD COLUMN late_attendance_threshold_mins INTEGER DEFAULT 15;
ALTER TABLE academy_policy_settings ADD COLUMN checkin_window_before_mins INTEGER DEFAULT 30;
ALTER TABLE academy_policy_settings ADD COLUMN checkin_window_after_mins INTEGER DEFAULT 60;
ALTER TABLE academy_policy_settings ADD COLUMN allow_wrong_batch_checkin INTEGER DEFAULT 0;
ALTER TABLE academy_policy_settings ADD COLUMN auto_approve_corrections INTEGER DEFAULT 0;
ALTER TABLE academy_policy_settings ADD COLUMN allow_student_portal_leaves INTEGER DEFAULT 1;

-- 2. Populate default values for existing rows
UPDATE academy_policy_settings SET
  fee_grace_period_days = COALESCE(fee_grace_period_days, 7),
  allow_fee_pauses = COALESCE(allow_fee_pauses, 1),
  default_currency = COALESCE(default_currency, 'INR'),
  standard_shift_hours = COALESCE(standard_shift_hours, 8.0),
  late_attendance_threshold_mins = COALESCE(late_attendance_threshold_mins, 15),
  checkin_window_before_mins = COALESCE(checkin_window_before_mins, 30),
  checkin_window_after_mins = COALESCE(checkin_window_after_mins, 60),
  allow_wrong_batch_checkin = COALESCE(allow_wrong_batch_checkin, 0),
  auto_approve_corrections = COALESCE(auto_approve_corrections, 0),
  allow_student_portal_leaves = COALESCE(allow_student_portal_leaves, 1);
