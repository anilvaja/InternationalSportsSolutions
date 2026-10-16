-- Migration: 006_add_technique_tracking_to_attendance.sql
-- Enforces:
-- 1. Student technique assignment tracking with single active technique constraint
-- 2. Technique tracking & remarks on student attendance records
-- 3. Immutable attendance technique snapshot log

-- 1. Student Technique Assignments Table
CREATE TABLE IF NOT EXISTS student_technique_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  technique_id INTEGER NOT NULL,
  assigned_by INTEGER,
  start_date DATE NOT NULL DEFAULT (DATE('now')),
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'downgraded', 'archived')),
  sessions_attended INTEGER NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (technique_id) REFERENCES syllabus_techniques(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Engine-level guarantee: A student can have at most ONE 'active' technique assignment at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_single_active_technique
ON student_technique_assignments(student_id)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_technique_assignment_student ON student_technique_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_technique_assignment_technique ON student_technique_assignments(technique_id);
CREATE INDEX IF NOT EXISTS idx_technique_assignment_academy ON student_technique_assignments(academy_id);

-- 2. Add technique tracking columns to student_attendance
ALTER TABLE student_attendance ADD COLUMN technique_id INTEGER;
ALTER TABLE student_attendance ADD COLUMN technique_level INTEGER;
ALTER TABLE student_attendance ADD COLUMN technique_status TEXT DEFAULT 'keep' CHECK(technique_status IN ('keep', 'upgrade', 'downgrade', 'direct_jump', 'custom'));
ALTER TABLE student_attendance ADD COLUMN technique_remarks TEXT;
ALTER TABLE student_attendance ADD COLUMN attended_sessions_snapshot INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_student_attendance_technique ON student_attendance(technique_id);

-- 3. Historical Attendance Technique Snapshots
CREATE TABLE IF NOT EXISTS attendance_technique_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attendance_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  technique_id INTEGER NOT NULL,
  technique_level INTEGER,
  progression_action TEXT NOT NULL DEFAULT 'keep' CHECK(progression_action IN ('keep', 'upgrade', 'downgrade', 'direct_jump', 'custom')),
  sessions_count_at_time INTEGER NOT NULL DEFAULT 1,
  remarks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (technique_id) REFERENCES syllabus_techniques(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_snap_attendance ON attendance_technique_snapshots(attendance_id);
CREATE INDEX IF NOT EXISTS idx_snap_student ON attendance_technique_snapshots(student_id);
CREATE INDEX IF NOT EXISTS idx_snap_technique ON attendance_technique_snapshots(technique_id);
