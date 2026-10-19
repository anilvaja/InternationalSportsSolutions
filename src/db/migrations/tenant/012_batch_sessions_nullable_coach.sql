-- Migration 012: Make coach_id nullable in batch_sessions to support unassigned coaches gracefully
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS batch_sessions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  coach_id INTEGER DEFAULT NULL,
  substitute_coach_id INTEGER DEFAULT NULL,
  status TEXT CHECK(status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')) DEFAULT 'scheduled',
  attendance_status TEXT CHECK(attendance_status IN ('pending', 'completed', 'verified')) DEFAULT 'pending',
  attendance_taken_at DATETIME,
  attendance_taken_by INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  UNIQUE(batch_id, scheduled_date)
);

INSERT INTO batch_sessions_new (
  id, academy_id, branch_id, batch_id, scheduled_date, start_time, end_time,
  coach_id, substitute_coach_id, status, attendance_status, attendance_taken_at,
  attendance_taken_by, notes, created_at, updated_at
)
SELECT 
  id, academy_id, branch_id, batch_id, scheduled_date, start_time, end_time,
  coach_id, substitute_coach_id, status, attendance_status, attendance_taken_at,
  attendance_taken_by, notes, created_at, updated_at
FROM batch_sessions;

DROP TABLE batch_sessions;

ALTER TABLE batch_sessions_new RENAME TO batch_sessions;

CREATE INDEX IF NOT EXISTS idx_batch_sessions_date ON batch_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_coach ON batch_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_status ON batch_sessions(status, attendance_status);

PRAGMA foreign_keys = ON;
