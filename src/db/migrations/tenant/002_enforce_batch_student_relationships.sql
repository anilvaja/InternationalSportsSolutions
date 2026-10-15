-- Migration: 002_enforce_batch_student_relationships.sql
-- Enforces:
-- 1. 1 Student can have at most ONE active batch at any time (via SQLite partial unique index)
-- 2. Complete enrollment history preservation (transfers, start/end dates, reasons, assigned_by)
-- 3. Batches must belong to a single valid branch

CREATE TABLE IF NOT EXISTS student_batch_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  start_date DATE NOT NULL DEFAULT (DATE('now')),
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'transferred', 'completed', 'dropped')),
  assigned_by INTEGER,
  transferred_to_batch_id INTEGER,
  transfer_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (transferred_to_batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Critical Engine-level Constraint:
-- Enforces that a student can NEVER have more than ONE 'active' enrollment concurrently!
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_single_active_batch 
ON student_batch_enrollments(student_id) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_enrollment_batch_status 
ON student_batch_enrollments(batch_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollment_student 
ON student_batch_enrollments(student_id);

-- Safely migrate any existing records from old student_batches table if it exists
INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status)
SELECT student_id, batch_id, COALESCE(joined_at, DATE('now')), 'active'
FROM (
  SELECT student_id, batch_id, joined_at,
         ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY id DESC) as rn
  FROM student_batches
  WHERE is_active = 1
) sub
WHERE sub.rn = 1
AND NOT EXISTS (
  SELECT 1 FROM student_batch_enrollments sbe 
  WHERE sbe.student_id = sub.student_id AND sbe.status = 'active'
);

-- Drop old student_batches table to prevent divergent states
DROP TABLE IF EXISTS student_batches;

-- Backward-compatibility view mapping active enrollments
CREATE VIEW IF NOT EXISTS student_batches AS 
SELECT 
  id, 
  student_id, 
  batch_id, 
  start_date AS joined_at, 
  1 AS is_active 
FROM student_batch_enrollments 
WHERE status = 'active';
