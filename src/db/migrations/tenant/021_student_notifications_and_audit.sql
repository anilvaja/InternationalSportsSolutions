-- Migration: 021_student_notifications_and_audit.sql
-- Tracks all communication and notifications sent to students & guardians

CREATE TABLE IF NOT EXISTS student_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER DEFAULT 1,
  student_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'attendance', 'fee_reminder', 'fee_receipt', 'event', 'syllabus', 'general'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'sms', 'email', 'in_app'
  recipient TEXT,
  status TEXT NOT NULL DEFAULT 'delivered', -- 'delivered', 'sent', 'pending', 'read'
  metadata TEXT, -- JSON extra data (invoice_id, session_id, event_id, etc.)
  sent_by_user_id INTEGER,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_student_notifications_student ON student_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_student_notifications_type ON student_notifications(type);
