# STAGE 2: MIGRATION CHANGES SPECIFICATION

**Migration File:** `src/db/migrations/tenant/036_schema_relationship_integrity_hardening.sql`  
**Applied To:** All tenant SQLite databases (`data/academies/academy_*.db`) and fresh tenant provisioning pipeline  
**Target Engine:** SQLite via `better-sqlite3`  
**Date Deployed:** November 13, 2026  

---

## 1. Migration Purpose & Scope

During the Stage 2 Database Schema & Relationship Audit, three specific architectural integrity gaps were identified:
1. **Unindexed Foreign Keys:** Key tables (`equipment_assignment_logs`, `smart_attendance_logs`, `leave_requests`, `fee_payments`, `syllabus_categories`) had foreign keys or frequent lookup targets that lacked dedicated SQLite B-tree indexes, impacting join performance and point queries.
2. **Historical ALTER TABLE Foreign Key Gaps:** In SQLite, `ALTER TABLE ... ADD COLUMN` does not support defining an inline `REFERENCES` clause. Historical migrations (such as adding `sport_id` to `syllabus_categories`, `user_id` to `leave_requests`, or `student_id` to `fee_payments`) created columns where SQLite's internal foreign key engine did not have an active constraint definition.
3. **Employee Shift Overlap Vulnerability:** While the application business logic checked for shift overlaps, there was no database-level guarantee preventing concurrent or misconfigured overlapping shift slots for an employee on the same day.

---

## 2. DDL Specification

```sql
-- ============================================================================
-- Migration 036: Database Schema & Relational Integrity Hardening
-- Enforces missing foreign key indexes, trigger-backed FK constraints on 
-- historical alter-columns, and database-level shift overlap prevention.
-- ============================================================================

-- 1. Unindexed Foreign Keys & High-Frequency Query Paths
CREATE INDEX IF NOT EXISTS idx_leave_requests_user 
  ON leave_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_fee_payments_student 
  ON fee_payments(student_id);

CREATE INDEX IF NOT EXISTS idx_syllabus_categories_sport 
  ON syllabus_categories(sport_id);

CREATE INDEX IF NOT EXISTS idx_equipment_assignment_equipment 
  ON equipment_assignment_logs(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_assignment_student 
  ON equipment_assignment_logs(student_id);

CREATE INDEX IF NOT EXISTS idx_equipment_assignment_staff 
  ON equipment_assignment_logs(staff_user_id);

CREATE INDEX IF NOT EXISTS idx_smart_att_logs_student 
  ON smart_attendance_logs(student_id);

CREATE INDEX IF NOT EXISTS idx_smart_att_logs_device 
  ON smart_attendance_logs(device_id);

CREATE INDEX IF NOT EXISTS idx_smart_att_logs_batch 
  ON smart_attendance_logs(batch_id);

-- 2. Foreign Key Integrity Triggers for Historical Alter-Columns

-- leave_requests -> users(id)
CREATE TRIGGER IF NOT EXISTS trg_fk_leave_requests_user_insert
BEFORE INSERT ON leave_requests
FOR EACH ROW
WHEN NEW.user_id IS NOT NULL AND (SELECT id FROM users WHERE id = NEW.user_id) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'FOREIGN KEY constraint failed: leave_requests.user_id does not reference an existing user');
END;

CREATE TRIGGER IF NOT EXISTS trg_fk_leave_requests_user_update
BEFORE UPDATE OF user_id ON leave_requests
FOR EACH ROW
WHEN NEW.user_id IS NOT NULL AND (SELECT id FROM users WHERE id = NEW.user_id) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'FOREIGN KEY constraint failed: leave_requests.user_id does not reference an existing user');
END;

-- fee_payments -> students(id)
CREATE TRIGGER IF NOT EXISTS trg_fk_fee_payments_student_insert
BEFORE INSERT ON fee_payments
FOR EACH ROW
WHEN NEW.student_id IS NOT NULL AND (SELECT id FROM students WHERE id = NEW.student_id) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'FOREIGN KEY constraint failed: fee_payments.student_id does not reference an existing student');
END;

CREATE TRIGGER IF NOT EXISTS trg_fk_fee_payments_student_update
BEFORE UPDATE OF student_id ON fee_payments
FOR EACH ROW
WHEN NEW.student_id IS NOT NULL AND (SELECT id FROM students WHERE id = NEW.student_id) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'FOREIGN KEY constraint failed: fee_payments.student_id does not reference an existing student');
END;

-- syllabus_categories -> sports(id)
CREATE TRIGGER IF NOT EXISTS trg_fk_syllabus_categories_sport_insert
BEFORE INSERT ON syllabus_categories
FOR EACH ROW
WHEN NEW.sport_id IS NOT NULL AND (SELECT id FROM sports WHERE id = NEW.sport_id) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'FOREIGN KEY constraint failed: syllabus_categories.sport_id does not reference an existing sport');
END;

CREATE TRIGGER IF NOT EXISTS trg_fk_syllabus_categories_sport_update
BEFORE UPDATE OF sport_id ON syllabus_categories
FOR EACH ROW
WHEN NEW.sport_id IS NOT NULL AND (SELECT id FROM sports WHERE id = NEW.sport_id) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'FOREIGN KEY constraint failed: syllabus_categories.sport_id does not reference an existing sport');
END;

-- 3. Database-Level Employee Shift Overlap Prevention
CREATE TRIGGER IF NOT EXISTS trg_prevent_shift_overlap_insert
BEFORE INSERT ON employee_schedule_shifts
FOR EACH ROW
WHEN (
  SELECT count(*) FROM employee_schedule_shifts existing
  WHERE existing.employee_schedule_id = NEW.employee_schedule_id
    AND existing.day_of_week = NEW.day_of_week
    AND (
      (NEW.start_time >= existing.start_time AND NEW.start_time < existing.end_time)
      OR (NEW.end_time > existing.start_time AND NEW.end_time <= existing.end_time)
      OR (NEW.start_time <= existing.start_time AND NEW.end_time >= existing.end_time)
    )
) > 0
BEGIN
  SELECT RAISE(ABORT, 'Integrity error: Employee has an overlapping shift on the same day');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_shift_overlap_update
BEFORE UPDATE OF start_time, end_time, day_of_week ON employee_schedule_shifts
FOR EACH ROW
WHEN (
  SELECT count(*) FROM employee_schedule_shifts existing
  WHERE existing.id != NEW.id
    AND existing.employee_schedule_id = NEW.employee_schedule_id
    AND existing.day_of_week = NEW.day_of_week
    AND (
      (NEW.start_time >= existing.start_time AND NEW.start_time < existing.end_time)
      OR (NEW.end_time > existing.start_time AND NEW.end_time <= existing.end_time)
      OR (NEW.start_time <= existing.start_time AND NEW.end_time >= existing.end_time)
    )
) > 0
BEGIN
  SELECT RAISE(ABORT, 'Integrity error: Employee has an overlapping shift on the same day');
END;
```

---

## 3. Migration Safety & Verification

1. **Transactional Execution:** Migration 036 runs inside an explicit SQLite transaction `BEGIN IMMEDIATE ... COMMIT`. If any statement fails, the database automatically rolls back.
2. **Idempotency:** All DDL statements use `CREATE INDEX IF NOT EXISTS` and `CREATE TRIGGER IF NOT EXISTS`. Re-running the migration runner produces no errors.
3. **Data Preservation:** Zero tables or columns were dropped or altered destructively. All existing records were preserved intact.
4. **Automated Test Coverage:** Verified via `tests/Unit/database_schema_and_relationship_integrity.test.mjs` (13 tests) and full unit test suite (428 tests).
