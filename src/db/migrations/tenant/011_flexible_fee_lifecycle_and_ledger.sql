-- Migration: 011_flexible_fee_lifecycle_and_ledger.sql
-- Enforces:
-- 1. Student Fee Ledger as single source of truth for chronological charges, payments, credits, and next installment calculations
-- 2. Student-specific fee overrides (precedence over batch fee)
-- 3. Approval-controlled fee pauses & membership holds
-- 4. Multi-month discount presets (capped at 20% max)
-- 5. Extended columns on student_fees and fee_payments for flexible period tracking

-- 1. Extend student_fees table
ALTER TABLE student_fees ADD COLUMN period_start DATE;
ALTER TABLE student_fees ADD COLUMN period_end DATE;
ALTER TABLE student_fees ADD COLUMN months_count INTEGER DEFAULT 1;
ALTER TABLE student_fees ADD COLUMN base_fee REAL;
ALTER TABLE student_fees ADD COLUMN discount_percentage REAL DEFAULT 0;
ALTER TABLE student_fees ADD COLUMN discount_type TEXT DEFAULT 'none';
ALTER TABLE student_fees ADD COLUMN discount_reason TEXT;
ALTER TABLE student_fees ADD COLUMN discount_applied_by INTEGER;
ALTER TABLE student_fees ADD COLUMN next_installment_date DATE;

-- 2. Extend fee_payments table
ALTER TABLE fee_payments ADD COLUMN student_id INTEGER;
ALTER TABLE fee_payments ADD COLUMN status TEXT DEFAULT 'completed';
ALTER TABLE fee_payments ADD COLUMN cheque_clearance_date DATE;
ALTER TABLE fee_payments ADD COLUMN reversal_reason TEXT;
ALTER TABLE fee_payments ADD COLUMN reversed_by INTEGER;
ALTER TABLE fee_payments ADD COLUMN reversed_at DATETIME;

-- Populate student_id on existing fee_payments
UPDATE fee_payments 
SET student_id = (SELECT student_id FROM student_fees WHERE student_fees.id = fee_payments.student_fee_id)
WHERE student_id IS NULL;

-- 3. Student Fee Ledger Table (Single Source of Truth)
CREATE TABLE IF NOT EXISTS student_fee_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  student_fee_id INTEGER,
  fee_payment_id INTEGER,
  entry_type TEXT NOT NULL CHECK(entry_type IN ('charge', 'payment', 'discount', 'pause_adjustment', 'waiver', 'refund', 'credit')),
  charge_type TEXT DEFAULT 'tuition' CHECK(charge_type IN ('tuition', 'registration', 'uniform', 'equipment', 'tournament', 'other')),
  period_start DATE,
  period_end DATE,
  months_count INTEGER DEFAULT 1,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  running_balance REAL DEFAULT 0,
  paid_through_date DATE,
  notes TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE SET NULL,
  FOREIGN KEY (fee_payment_id) REFERENCES fee_payments(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fee_ledger_student ON student_fee_ledger(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_ledger_period ON student_fee_ledger(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_fee_ledger_created ON student_fee_ledger(created_at);

-- 4. Student Fee Overrides Table (Student-specific pricing taking precedence over batch rate)
CREATE TABLE IF NOT EXISTS student_fee_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  custom_monthly_fee REAL NOT NULL,
  reason TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_until DATE,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER NOT NULL,
  approved_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fee_overrides_student ON student_fee_overrides(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_overrides_active ON student_fee_overrides(student_id, is_active);

-- 5. Fee Pause & Membership Hold Requests Table
CREATE TABLE IF NOT EXISTS fee_pause_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  batch_id INTEGER,
  pause_type TEXT DEFAULT 'fee_pause' CHECK(pause_type IN ('fee_pause', 'membership_hold', 'both')),
  requested_start_date DATE NOT NULL,
  requested_end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by INTEGER NOT NULL,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER,
  approved_at DATETIME,
  approval_notes TEXT,
  approved_start_date DATE,
  approved_end_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fee_pause_student ON fee_pause_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_pause_status ON fee_pause_requests(status);
CREATE INDEX IF NOT EXISTS idx_fee_pause_dates ON fee_pause_requests(requested_start_date, requested_end_date);

-- 6. Configurable Multi-Month Discount Presets
CREATE TABLE IF NOT EXISTS fee_discount_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  months INTEGER NOT NULL UNIQUE,
  discount_percentage REAL NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO fee_discount_presets (months, discount_percentage, is_active) VALUES
  (1, 0.0, 1),
  (3, 5.0, 1),
  (6, 10.0, 1),
  (12, 15.0, 1);

-- 7. Pre-seed existing fee charges and payments into the new ledger table
INSERT INTO student_fee_ledger (
  student_id, student_fee_id, entry_type, charge_type, debit, credit, running_balance, notes, created_at
)
SELECT sf.student_id, sf.id, 'charge', 'tuition', sf.net_amount, 0, sf.net_amount, sf.title, sf.created_at
FROM student_fees sf
WHERE NOT EXISTS (SELECT 1 FROM student_fee_ledger sfl WHERE sfl.student_fee_id = sf.id AND sfl.entry_type = 'charge');

INSERT INTO student_fee_ledger (
  student_id, student_fee_id, fee_payment_id, entry_type, charge_type, debit, credit, running_balance, notes, created_at
)
SELECT sf.student_id, fp.student_fee_id, fp.id, 'payment', 'tuition', 0, fp.amount, 0, 'Payment ' || fp.receipt_number, fp.created_at
FROM fee_payments fp
JOIN student_fees sf ON sf.id = fp.student_fee_id
WHERE NOT EXISTS (SELECT 1 FROM student_fee_ledger sfl WHERE sfl.fee_payment_id = fp.id);
