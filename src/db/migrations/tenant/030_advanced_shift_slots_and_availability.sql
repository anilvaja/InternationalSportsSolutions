-- Migration 030: Advanced Shift Management, Multiple Daily Slots, Staff Availability & Accurate Payroll Engine

-- 1. Upgrade staff_salary_profiles to support 'per_batch' and 'hybrid' modes, and dedicated rate columns
CREATE TABLE IF NOT EXISTS staff_salary_profiles_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER NOT NULL,
  salary_mode TEXT CHECK(salary_mode IN ('monthly', 'hourly', 'per_day', 'daily', 'per_session', 'per_minute', 'per_batch', 'hybrid')) NOT NULL DEFAULT 'monthly',
  base_rate REAL NOT NULL,
  session_rate REAL DEFAULT 0,
  hourly_rate REAL DEFAULT 0,
  batch_rate REAL DEFAULT 0,
  hybrid_components TEXT, -- JSON configuration e.g. {"base":"monthly","include_sessions":true,"include_overtime":true}
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
  payment_frequency TEXT DEFAULT 'monthly',
  scheduled_payday INTEGER DEFAULT 1,
  allowances TEXT,
  deductions TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO staff_salary_profiles_v2 (
  id, academy_id, user_id, salary_mode, base_rate, currency, scheduled_daily_hours, scheduled_days_per_week,
  overtime_eligible, overtime_rate_multiplier, deduction_policy, effective_from, effective_to, is_active,
  notes, payment_frequency, scheduled_payday, allowances, deductions, created_by, updated_by, created_at, updated_at
)
SELECT id, academy_id, user_id, salary_mode, base_rate, currency, scheduled_daily_hours, scheduled_days_per_week,
  overtime_eligible, overtime_rate_multiplier, deduction_policy, effective_from, effective_to, is_active,
  notes, payment_frequency, scheduled_payday, allowances, deductions, created_by, updated_by, created_at, updated_at
FROM staff_salary_profiles;

DROP TABLE staff_salary_profiles;
ALTER TABLE staff_salary_profiles_v2 RENAME TO staff_salary_profiles;

CREATE INDEX IF NOT EXISTS idx_salary_profiles_user ON staff_salary_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_profiles_effective ON staff_salary_profiles(user_id, effective_from, effective_to);

-- 2. Enhance employee_schedule_shifts with branch, shift_type and travel buffer
ALTER TABLE employee_schedule_shifts ADD COLUMN branch_id INTEGER;
ALTER TABLE employee_schedule_shifts ADD COLUMN shift_type TEXT DEFAULT 'regular';
ALTER TABLE employee_schedule_shifts ADD COLUMN travel_buffer_minutes INTEGER DEFAULT 0;

-- 3. Enhance batches with assistant_coach_id and replacement_coach_id
ALTER TABLE batches ADD COLUMN assistant_coach_id INTEGER;
ALTER TABLE batches ADD COLUMN replacement_coach_id INTEGER;

-- 4. Enhance batch_sessions with assistant_coach_id
ALTER TABLE batch_sessions ADD COLUMN assistant_coach_id INTEGER;

-- 5. Employee Schedule Overrides (Date-specific overrides: replace, add, cancel, off)
CREATE TABLE IF NOT EXISTS employee_schedule_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER,
  user_id INTEGER NOT NULL,
  override_date DATE NOT NULL,
  schedule_action TEXT CHECK(schedule_action IN ('replace', 'add', 'cancel', 'off')) NOT NULL DEFAULT 'replace',
  shift_name TEXT DEFAULT 'Custom Slot',
  start_time TEXT,
  end_time TEXT,
  scheduled_hours REAL DEFAULT 0,
  shift_type TEXT CHECK(shift_type IN ('regular', 'morning', 'evening', 'special_training', 'tournament', 'overtime', 'temporary_replacement')) DEFAULT 'regular',
  reason TEXT,
  approved_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_emp_overrides_user_date ON employee_schedule_overrides(user_id, override_date);

-- 6. Independent Staff Slot Attendance
CREATE TABLE IF NOT EXISTS staff_slot_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER,
  user_id INTEGER NOT NULL,
  schedule_id INTEGER,
  schedule_shift_id INTEGER,
  override_id INTEGER,
  batch_id INTEGER,
  attendance_date DATE NOT NULL,
  slot_name TEXT NOT NULL,
  shift_type TEXT DEFAULT 'regular',
  scheduled_start_time TEXT NOT NULL,
  scheduled_end_time TEXT NOT NULL,
  actual_check_in TEXT,
  actual_check_out TEXT,
  scheduled_minutes INTEGER DEFAULT 0,
  attended_minutes INTEGER DEFAULT 0,
  approved_payable_minutes INTEGER DEFAULT 0,
  late_arrival_minutes INTEGER DEFAULT 0,
  early_departure_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('present', 'absent', 'late', 'early_checkout', 'partial', 'paid_leave', 'unpaid_leave', 'holiday', 'off_day', 'cancelled', 'approved_overtime')) NOT NULL DEFAULT 'absent',
  source TEXT CHECK(source IN ('manual', 'self_punch', 'auto_checkout', 'system_scheduled', 'admin_adjustment', 'swap')) DEFAULT 'system_scheduled',
  adjustment_reason TEXT,
  approved_by INTEGER,
  approved_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, attendance_date, scheduled_start_time, scheduled_end_time)
);

CREATE INDEX IF NOT EXISTS idx_slot_att_user_date ON staff_slot_attendance(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_slot_att_status ON staff_slot_attendance(status);
CREATE INDEX IF NOT EXISTS idx_slot_att_branch ON staff_slot_attendance(branch_id);

-- 7. Staff Shift Swap and Replacement Requests
CREATE TABLE IF NOT EXISTS staff_shift_swaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  requester_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  slot_attendance_id INTEGER,
  swap_date DATE NOT NULL,
  slot_name TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  branch_id INTEGER,
  batch_id INTEGER,
  reason TEXT,
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  rejection_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_attendance_id) REFERENCES staff_slot_attendance(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_swaps_requester ON staff_shift_swaps(requester_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_recipient ON staff_shift_swaps(recipient_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON staff_shift_swaps(status);
