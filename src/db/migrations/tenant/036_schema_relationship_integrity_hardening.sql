-- Migration: 036_schema_relationship_integrity_hardening.sql
-- Description: Strengthens database-level relationship integrity, adds foreign key validation triggers,
-- prevents overlapping employee shifts at the engine level, and adds indexes for unindexed foreign keys.

-- 1. Index optimization for foreign keys and frequent lookups
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_categories_sport ON syllabus_categories(sport_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assignment_equipment ON equipment_assignment_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assignment_student ON equipment_assignment_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assignment_staff ON equipment_assignment_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_smart_att_logs_student ON smart_attendance_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_smart_att_logs_device ON smart_attendance_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_smart_att_logs_batch ON smart_attendance_logs(batch_id);

-- 2. Foreign Key validation triggers for columns added via historical ALTER TABLE statements

-- A. leave_requests.user_id -> users(id)
CREATE TRIGGER IF NOT EXISTS trg_fk_leave_requests_user_insert
BEFORE INSERT ON leave_requests
FOR EACH ROW
WHEN NEW.user_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id)
  THEN RAISE(ABORT, 'FOREIGN KEY violation: leave_requests.user_id references non-existent user')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_fk_leave_requests_user_update
BEFORE UPDATE OF user_id ON leave_requests
FOR EACH ROW
WHEN NEW.user_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id)
  THEN RAISE(ABORT, 'FOREIGN KEY violation: leave_requests.user_id references non-existent user')
  END;
END;

-- B. fee_payments.student_id -> students(id)
CREATE TRIGGER IF NOT EXISTS trg_fk_fee_payments_student_insert
BEFORE INSERT ON fee_payments
FOR EACH ROW
WHEN NEW.student_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM students WHERE id = NEW.student_id)
  THEN RAISE(ABORT, 'FOREIGN KEY violation: fee_payments.student_id references non-existent student')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_fk_fee_payments_student_update
BEFORE UPDATE OF student_id ON fee_payments
FOR EACH ROW
WHEN NEW.student_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM students WHERE id = NEW.student_id)
  THEN RAISE(ABORT, 'FOREIGN KEY violation: fee_payments.student_id references non-existent student')
  END;
END;

-- C. syllabus_categories.sport_id -> sports(id)
CREATE TRIGGER IF NOT EXISTS trg_fk_syllabus_categories_sport_insert
BEFORE INSERT ON syllabus_categories
FOR EACH ROW
WHEN NEW.sport_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM sports WHERE id = NEW.sport_id)
  THEN RAISE(ABORT, 'FOREIGN KEY violation: syllabus_categories.sport_id references non-existent sport')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_fk_syllabus_categories_sport_update
BEFORE UPDATE OF sport_id ON syllabus_categories
FOR EACH ROW
WHEN NEW.sport_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM sports WHERE id = NEW.sport_id)
  THEN RAISE(ABORT, 'FOREIGN KEY violation: syllabus_categories.sport_id references non-existent sport')
  END;
END;

-- 3. Database Engine-Level Shift Overlap Prevention
-- Ensures that no employee can have overlapping active shift slots on the same day of week

CREATE TRIGGER IF NOT EXISTS trg_prevent_shift_overlap_insert
BEFORE INSERT ON employee_schedule_shifts
FOR EACH ROW
WHEN NEW.is_working_day = 1
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM employee_schedule_shifts
    WHERE user_id = NEW.user_id
      AND day_of_week = NEW.day_of_week
      AND is_working_day = 1
      AND (NEW.start_time < end_time AND NEW.end_time > start_time)
  )
  THEN RAISE(ABORT, 'Overlapping employee shift slots are strictly prohibited')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_shift_overlap_update
BEFORE UPDATE ON employee_schedule_shifts
FOR EACH ROW
WHEN NEW.is_working_day = 1
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM employee_schedule_shifts
    WHERE user_id = NEW.user_id
      AND day_of_week = NEW.day_of_week
      AND id != NEW.id
      AND is_working_day = 1
      AND (NEW.start_time < end_time AND NEW.end_time > start_time)
  )
  THEN RAISE(ABORT, 'Overlapping employee shift slots are strictly prohibited')
  END;
END;

