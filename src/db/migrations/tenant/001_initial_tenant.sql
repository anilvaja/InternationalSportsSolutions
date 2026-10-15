-- Tenant (Academy) Database Schema
-- Version: 001

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'academy_staff', -- 'academy_admin', 'academy_staff', 'coach', 'student'
  phone TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academy_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL -- JSON array of permission strings
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  sport_id INTEGER,
  branch_id INTEGER,
  specializations TEXT,
  experience_years INTEGER DEFAULT 0,
  salary_type TEXT DEFAULT 'monthly' CHECK(salary_type IN ('monthly', 'per_session', 'contract')),
  salary_amount REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sport_id INTEGER,
  branch_id INTEGER,
  coach_id INTEGER,
  start_time TEXT NOT NULL, -- '07:00'
  end_time TEXT NOT NULL,   -- '08:30'
  days_of_week TEXT DEFAULT '["Mon","Wed","Fri"]', -- JSON array
  max_capacity INTEGER DEFAULT 30,
  monthly_fee REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT CHECK(gender IN ('male', 'female', 'other')),
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  address TEXT,
  branch_id INTEGER,
  blood_group TEXT,
  medical_notes TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
  enrolled_at DATE DEFAULT (DATE('now')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  joined_at DATE DEFAULT (DATE('now')),
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  UNIQUE(student_id, batch_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  date DATE NOT NULL,
  taken_by_user_id INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  UNIQUE(batch_id, date)
);

CREATE TABLE IF NOT EXISTS student_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attendance_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('present', 'absent', 'late', 'excused')) NOT NULL DEFAULT 'present',
  remarks TEXT,
  FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(attendance_id, student_id)
);

CREATE TABLE IF NOT EXISTS fee_structures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sport_id INTEGER,
  amount REAL NOT NULL,
  billing_frequency TEXT CHECK(billing_frequency IN ('monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time')) DEFAULT 'monthly',
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  fee_structure_id INTEGER,
  invoice_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  amount REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  net_amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  balance_amount REAL NOT NULL,
  status TEXT CHECK(status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')) DEFAULT 'pending',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_fee_id INTEGER NOT NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  payment_date DATE DEFAULT (DATE('now')),
  amount REAL NOT NULL,
  payment_mode TEXT CHECK(payment_mode IN ('cash', 'upi', 'bank_transfer', 'cheque', 'card', 'online')) DEFAULT 'upi',
  transaction_reference TEXT,
  proof_file TEXT,
  notes TEXT,
  collected_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE,
  FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_type TEXT CHECK(applicant_type IN ('student', 'coach', 'staff')) NOT NULL,
  applicant_id INTEGER NOT NULL,
  applicant_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  reviewer_comments TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'court', 'pool', 'gym', 'field', 'hall'
  capacity INTEGER DEFAULT 50,
  is_available INTEGER DEFAULT 1,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS equipment_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER,
  sport_id INTEGER,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  condition TEXT DEFAULT 'good' CHECK(condition IN ('new', 'good', 'fair', 'needs_repair', 'retired')),
  location TEXT,
  last_checked_date DATE DEFAULT (DATE('now')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Useful indices
CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON attendance(batch_id, date);
CREATE INDEX IF NOT EXISTS idx_student_fees_status ON student_fees(status);
CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_fee ON fee_payments(student_fee_id);
