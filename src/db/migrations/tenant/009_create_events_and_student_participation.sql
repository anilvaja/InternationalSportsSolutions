-- Migration: 009_create_events_and_student_participation.sql
-- Implements Event Lifecycle, Eligibility Snapshotting, Student Responses & Approval Workflows

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL,
  created_by INTEGER,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  content TEXT,
  type TEXT DEFAULT 'tournament' CHECK(type IN ('tournament', 'competition', 'training', 'workshop', 'seminar', 'grading', 'social', 'general')),
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'cancelled', 'completed', 'closed')),
  event_date DATETIME NOT NULL,
  event_end_date DATETIME,
  location TEXT,
  venue TEXT,
  fee REAL DEFAULT 0,
  max_participants INTEGER,
  waitlist_enabled INTEGER DEFAULT 1,
  requires_rsvp INTEGER DEFAULT 1,
  rsvp_deadline DATETIME,
  registration_approval_required INTEGER DEFAULT 0,
  eligibility_type TEXT DEFAULT 'manual' CHECK(eligibility_type IN ('all', 'criteria', 'manual')),
  eligibility_criteria TEXT, -- JSON configuration
  manual_participants TEXT, -- JSON array of student IDs
  eligibility_snapshot_version INTEGER DEFAULT 1,
  published_at DATETIME,
  cancelled_at DATETIME,
  cancellation_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_academy_status ON events(academy_id, status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_deadline ON events(rsvp_deadline);

CREATE TABLE IF NOT EXISTS event_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  branch_id INTEGER,
  batch_id INTEGER,
  status TEXT DEFAULT 'invited' CHECK(status IN ('invited', 'interested', 'not_interested', 'attended', 'no_show')),
  registration_status TEXT DEFAULT 'not_applicable' CHECK(registration_status IN ('not_applicable', 'pending', 'confirmed', 'rejected', 'waitlisted')),
  snapshot_version INTEGER DEFAULT 1,
  responded_at DATETIME,
  response_notes TEXT,
  approved_by INTEGER,
  approved_at DATETIME,
  payment_required INTEGER DEFAULT 0,
  payment_status TEXT CHECK(payment_status IN ('pending', 'paid', 'refunded')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, student_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_student ON event_participants(student_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_status ON event_participants(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_participants_reg_status ON event_participants(event_id, registration_status);

CREATE TABLE IF NOT EXISTS event_response_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  previous_registration_status TEXT,
  new_registration_status TEXT,
  notes TEXT,
  changed_by_type TEXT DEFAULT 'student' CHECK(changed_by_type IN ('student', 'staff', 'system')),
  changed_by_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_history_event_student ON event_response_history(event_id, student_id);
