-- Tenant Database Schema: Migration 015
-- Description: Staff Daily Time Punches, Shift Logs, and Overtime Tracking

CREATE TABLE IF NOT EXISTS staff_time_punches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER NOT NULL,
  punch_date DATE NOT NULL,
  punch_in_time DATETIME NOT NULL,
  punch_out_time DATETIME,
  duration_minutes INTEGER DEFAULT 0,
  break_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('in_progress', 'completed', 'auto_closed')) DEFAULT 'in_progress',
  punch_type TEXT CHECK(punch_type IN ('duty', 'session', 'training', 'general')) DEFAULT 'duty',
  ip_address TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_punches_user_date ON staff_time_punches(user_id, punch_date);
CREATE INDEX IF NOT EXISTS idx_punches_status ON staff_time_punches(status);
CREATE INDEX IF NOT EXISTS idx_punches_date ON staff_time_punches(punch_date);
