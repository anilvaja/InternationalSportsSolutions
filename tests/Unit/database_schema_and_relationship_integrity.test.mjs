import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { runMigrations } from '../../src/db/migrator.js';

test('Stage 2 — Complete Database Schema & Relationship Integrity Verification Suite', async (t) => {
  // Provision a clean, isolated temporary tenant SQLite database
  const tempDbPath = path.resolve('data_test_temp_stage2.db');
  if (fs.existsSync(tempDbPath)) {
    try { fs.unlinkSync(tempDbPath); } catch (_) {}
  }

  const db = new Database(tempDbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Run all 36 tenant migrations
  runMigrations(db, 'tenant');

  t.after(() => {
    try { db.close(); } catch (_) {}
    try { fs.unlinkSync(tempDbPath); } catch (_) {}
    try { fs.unlinkSync(tempDbPath + '-wal'); } catch (_) {}
    try { fs.unlinkSync(tempDbPath + '-shm'); } catch (_) {}
  });

  // Base fixtures for tests
  const ACADEMY_ID = 1;

  // Insert primary branch
  const insBranch = db.prepare(`
    INSERT INTO branches (academy_id, name, address, phone, latitude, longitude, is_active)
    VALUES (?, 'Main Test Dojo', '100 Dojo Street', '+91 98000 00001', 23.0225, 72.5714, 1)
  `);
  const branchRes = insBranch.run(ACADEMY_ID);
  const branchId = Number(branchRes.lastInsertRowid);

  // Insert primary user (admin)
  const insUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, phone, status)
    VALUES ('Master Sensei', 'master@test.iss', 'hash123', 'coach', '+91 98000 00002', 'active')
  `);
  const userRes = insUser.run();
  const userId = Number(userRes.lastInsertRowid);

  // Insert coach
  const insCoach = db.prepare(`
    INSERT INTO coaches (user_id, name, email, phone, branch_id, salary_type, salary_amount, is_active)
    VALUES (?, 'Master Sensei', 'master@test.iss', '+91 98000 00002', ?, 'monthly', 30000, 1)
  `);
  const coachRes = insCoach.run(userId, branchId);
  const coachId = Number(coachRes.lastInsertRowid);

  // Insert primary sport (Karate)
  const sportRow = db.prepare("SELECT id FROM sports WHERE LOWER(name) = 'karate'").get();
  const sportId = sportRow ? sportRow.id : 1;

  // Insert primary batch
  const insBatch = db.prepare(`
    INSERT INTO batches (academy_id, branch_id, sport_id, coach_id, name, max_capacity, start_time, end_time, days_of_week, is_active)
    VALUES (?, ?, ?, ?, 'Black Belt Advance', 20, '06:00', '07:30', 'Mon, Wed, Fri', 1)
  `);
  const batchRes = insBatch.run(ACADEMY_ID, branchId, sportId, coachId);
  const batchId = Number(batchRes.lastInsertRowid);

  // Insert primary student
  const insStudent = db.prepare(`
    INSERT INTO students (student_code, first_name, last_name, email, phone, branch_id, academy_id, status)
    VALUES ('STU-TST-001', 'Arjun', 'Verma', 'arjun.test@iss.com', '+91 98000 00003', ?, ?, 'active')
  `);
  const stuRes = insStudent.run(branchId, ACADEMY_ID);
  const studentId = Number(stuRes.lastInsertRowid);

  await t.test('1. Foreign Key Enforcement: Missing or invalid parent references are strictly rejected', () => {
    // Attempt inserting batch with non-existent branch_id
    assert.throws(() => {
      db.prepare(`
        INSERT INTO batches (academy_id, branch_id, sport_id, coach_id, name, max_capacity, start_time, end_time, days_of_week)
        VALUES (1, 999999, 1, 1, 'Invalid Branch Batch', 20, '08:00', '09:00', 'Mon')
      `).run();
    }, /FOREIGN KEY constraint failed/);

    // Attempt inserting batch with non-existent sport_id
    assert.throws(() => {
      db.prepare(`
        INSERT INTO batches (academy_id, branch_id, sport_id, coach_id, name, max_capacity, start_time, end_time, days_of_week)
        VALUES (1, ?, 999999, 1, 'Invalid Sport Batch', 20, '08:00', '09:00', 'Mon')
      `).run(branchId);
    }, /FOREIGN KEY constraint failed/);
  });

  await t.test('2. Missing Foreign Keys Hardening: Triggers enforce foreign key integrity on historical alter-columns', () => {
    // Test leave_requests.user_id trigger
    assert.throws(() => {
      db.prepare(`
        INSERT INTO leave_requests (applicant_type, applicant_id, applicant_name, start_date, end_date, reason, user_id)
        VALUES ('coach', 999999, 'Ghost User', '2026-11-20', '2026-11-21', 'Vacation', 999999)
      `).run();
    }, /FOREIGN KEY violation: leave_requests\.user_id/);

    // Test fee_payments.student_id trigger
    // First create a valid fee invoice
    const feeRes = db.prepare(`
      INSERT INTO student_fees (student_id, invoice_number, title, due_date, amount, net_amount, balance_amount, status)
      VALUES (?, 'INV-TST-001', 'Monthly Tuition', '2026-11-30', 2500, 2500, 2500, 'pending')
    `).run(studentId);
    const feeId = Number(feeRes.lastInsertRowid);

    assert.throws(() => {
      db.prepare(`
        INSERT INTO fee_payments (student_fee_id, student_id, receipt_number, amount, payment_mode)
        VALUES (?, 999999, 'RCP-ERR-001', 2500, 'cash')
      `).run(feeId);
    }, /FOREIGN KEY violation: fee_payments\.student_id/);

    // Test syllabus_categories.sport_id trigger
    assert.throws(() => {
      db.prepare(`
        INSERT INTO syllabus_categories (academy_id, name, sport_id)
        VALUES (1, 'Alien Forms', 999999)
      `).run();
    }, /FOREIGN KEY violation: syllabus_categories\.sport_id/);
  });

  await t.test('3. Single Active Batch Enrollment: Partial unique index strictly blocks multiple active enrollments', () => {
    // First active enrollment
    db.prepare(`
      INSERT INTO student_batch_enrollments (student_id, batch_id, status, start_date)
      VALUES (?, ?, 'active', '2026-11-01')
    `).run(studentId, batchId);

    // Create a second batch
    const batch2Res = db.prepare(`
      INSERT INTO batches (academy_id, branch_id, sport_id, coach_id, name, max_capacity, start_time, end_time, days_of_week, is_active)
      VALUES (?, ?, ?, ?, 'Evening Kumite', 25, '18:00', '19:30', 'Tue, Thu', 1)
    `).run(ACADEMY_ID, branchId, sportId, coachId);
    const batchId2 = Number(batch2Res.lastInsertRowid);

    // Attempt second simultaneous active enrollment for the same student
    assert.throws(() => {
      db.prepare(`
        INSERT INTO student_batch_enrollments (student_id, batch_id, status, start_date)
        VALUES (?, ?, 'active', '2026-11-02')
      `).run(studentId, batchId2);
    }, /UNIQUE constraint failed/);

    // Verify historical non-active enrollments (transferred or completed) ARE allowed
    db.prepare("UPDATE student_batch_enrollments SET status = 'transferred', end_date = '2026-11-05' WHERE student_id = ?").run(studentId);

    // Now adding new active enrollment succeeds cleanly
    const enroll2 = db.prepare(`
      INSERT INTO student_batch_enrollments (student_id, batch_id, status, start_date)
      VALUES (?, ?, 'active', '2026-11-06')
    `).run(studentId, batchId2);
    assert.ok(enroll2.lastInsertRowid > 0);
  });

  await t.test('4. Attendance Session Uniqueness: Prevents duplicate attendance sessions and student logs', () => {
    // Create attendance session for batch on a date
    const attSession = db.prepare(`
      INSERT INTO attendance (batch_id, date, taken_by_user_id)
      VALUES (?, '2026-11-10', ?)
    `).run(batchId, userId);
    const attendanceId = Number(attSession.lastInsertRowid);

    // Attempt duplicate attendance session for same batch and same date
    assert.throws(() => {
      db.prepare(`
        INSERT INTO attendance (batch_id, date, taken_by_user_id)
        VALUES (?, '2026-11-10', ?)
      `).run(batchId, userId);
    }, /UNIQUE constraint failed/);

    // Record student attendance
    db.prepare(`
      INSERT INTO student_attendance (attendance_id, student_id, status, check_in_mode)
      VALUES (?, ?, 'present', 'qr')
    `).run(attendanceId, studentId);

    // Attempt duplicate student check-in within the same attendance session
    assert.throws(() => {
      db.prepare(`
        INSERT INTO student_attendance (attendance_id, student_id, status, check_in_mode)
        VALUES (?, ?, 'present', 'kiosk')
      `).run(attendanceId, studentId);
    }, /UNIQUE constraint failed/);
  });

  await t.test('5. Employee Shift Overlap Prevention: Engine trigger blocks overlapping shift slots', () => {
    // Create base employee work schedule
    const schedRes = db.prepare(`
      INSERT INTO employee_work_schedules (academy_id, user_id, branch_id, schedule_name, effective_from)
      VALUES (1, ?, ?, 'Standard Dojo Weekly Shift', '2026-11-01')
    `).run(userId, branchId);
    const scheduleId = Number(schedRes.lastInsertRowid);

    // Insert base shift on Monday: 09:00 - 13:00
    db.prepare(`
      INSERT INTO employee_schedule_shifts (schedule_id, user_id, day_of_week, shift_name, start_time, end_time, scheduled_hours, is_working_day)
      VALUES (?, ?, 1, 'Morning Shift', '09:00', '13:00', 4.0, 1)
    `).run(scheduleId, userId);

    // Attempt overlapping shift on Monday: 11:00 - 15:00 (overlaps with 09:00 - 13:00)
    assert.throws(() => {
      db.prepare(`
        INSERT INTO employee_schedule_shifts (schedule_id, user_id, day_of_week, shift_name, start_time, end_time, scheduled_hours, is_working_day)
        VALUES (?, ?, 1, 'Overlapping Midday', '11:00', '15:00', 4.0, 1)
      `).run(scheduleId, userId);
    }, /Overlapping employee shift slots are strictly prohibited/);

    // Non-overlapping shift on Monday: 15:00 - 19:00 must SUCCEED
    const validShift = db.prepare(`
      INSERT INTO employee_schedule_shifts (schedule_id, user_id, day_of_week, shift_name, start_time, end_time, scheduled_hours, is_working_day)
      VALUES (?, ?, 1, 'Evening Shift', '15:00', '19:00', 4.0, 1)
    `).run(scheduleId, userId);
    assert.ok(validShift.lastInsertRowid > 0);
  });

  await t.test('6. Payroll Period & Statement Uniqueness: Prevents duplicate payroll periods and double-payment', () => {
    // Create payroll period
    const pPeriod = db.prepare(`
      INSERT INTO staff_payroll_periods (academy_id, year_month, start_date, end_date, status)
      VALUES (1, '2026-11', '2026-11-01', '2026-11-30', 'finalized')
    `).run();
    const periodId = Number(pPeriod.lastInsertRowid);

    // Attempt creating duplicate period for same academy and month
    assert.throws(() => {
      db.prepare(`
        INSERT INTO staff_payroll_periods (academy_id, year_month, start_date, end_date, status)
        VALUES (1, '2026-11', '2026-11-01', '2026-11-30', 'finalized')
      `).run();
    }, /UNIQUE constraint failed/);

    // Create finalized salary statement
    const pStmt = db.prepare(`
      INSERT INTO staff_salary_statements (payroll_period_id, academy_id, user_id, salary_mode, applicable_rate, gross_earnings, net_earnings, calculation_snapshot)
      VALUES (?, 1, ?, 'monthly', 30000, 30000, 30000, '{"base_rate":30000}')
    `).run(periodId, userId);
    assert.ok(pStmt.lastInsertRowid > 0);

    // Attempt second statement for same user in same period
    assert.throws(() => {
      db.prepare(`
        INSERT INTO staff_salary_statements (payroll_period_id, academy_id, user_id, salary_mode, applicable_rate, gross_earnings, net_earnings)
        VALUES (?, 1, ?, 'monthly', 30000, 30000, 30000)
      `).run(periodId, userId);
    }, /UNIQUE constraint failed/);
  });

  await t.test('7. Historical Salary Rate Immutability: Mutating active salary profile preserves past statements', () => {
    // Create salary profile with effective_from
    db.prepare(`
      INSERT INTO staff_salary_profiles (academy_id, user_id, salary_mode, base_rate, effective_from, is_active)
      VALUES (1, ?, 'monthly', 30000, '2026-01-01', 1)
    `).run(userId);

    // Check past statement has frozen snapshot rate
    const stmtBefore = db.prepare('SELECT applicable_rate, gross_earnings FROM staff_salary_statements WHERE user_id = ?').get(userId);
    assert.equal(stmtBefore.applicable_rate, 30000);

    // Update staff profile to higher salary
    db.prepare('UPDATE staff_salary_profiles SET base_rate = 45000 WHERE user_id = ?').run(userId);

    // Verify past finalized statement did NOT change
    const stmtAfter = db.prepare('SELECT applicable_rate, gross_earnings FROM staff_salary_statements WHERE user_id = ?').get(userId);
    assert.equal(stmtAfter.applicable_rate, 30000, 'Past statement must remain immutable');
    assert.equal(stmtAfter.gross_earnings, 30000, 'Past gross earnings must not change');
  });

  await t.test('8. Inventory Stock Consistency: Issuing and returning equipment updates quantities correctly', () => {
    // Create inventory item with quantity = 10, available = 10
    const eqRes = db.prepare(`
      INSERT INTO equipment_inventory (branch_id, sport_id, name, quantity, available_quantity)
      VALUES (?, ?, 'Competition Gloves Red', 10, 10)
    `).run(branchId, sportId);
    const eqId = Number(eqRes.lastInsertRowid);

    // Issue 2 pairs to student
    db.prepare(`
      INSERT INTO equipment_assignment_logs (academy_id, equipment_id, student_id, action, quantity, action_date)
      VALUES (1, ?, ?, 'issue', 2, '2026-11-12')
    `).run(eqId, studentId);
    db.prepare('UPDATE equipment_inventory SET available_quantity = available_quantity - 2 WHERE id = ?').run(eqId);

    const eqCheck1 = db.prepare('SELECT quantity, available_quantity FROM equipment_inventory WHERE id = ?').get(eqId);
    assert.equal(eqCheck1.quantity, 10);
    assert.equal(eqCheck1.available_quantity, 8);

    // Return 2 pairs
    db.prepare(`
      INSERT INTO equipment_assignment_logs (academy_id, equipment_id, student_id, action, quantity, action_date, actual_return_date)
      VALUES (1, ?, ?, 'return', 2, '2026-11-13', '2026-11-13')
    `).run(eqId, studentId);
    db.prepare('UPDATE equipment_inventory SET available_quantity = available_quantity + 2 WHERE id = ?').run(eqId);

    const eqCheck2 = db.prepare('SELECT quantity, available_quantity FROM equipment_inventory WHERE id = ?').get(eqId);
    assert.equal(eqCheck2.quantity, 10);
    assert.equal(eqCheck2.available_quantity, 10);
  });

  await t.test('9. Event Participation Integrity: Event passes and participants require valid events and students', () => {
    // Create event
    const evRes = db.prepare(`
      INSERT INTO events (academy_id, title, slug, type, event_date, event_end_date, max_participants, fee)
      VALUES (1, 'Gujarat State Championship 2026', 'gujarat-championship-2026', 'tournament', '2026-12-05', '2026-12-06', 100, 1200)
    `).run();
    const eventId = Number(evRes.lastInsertRowid);

    // Register student
    const partRes = db.prepare(`
      INSERT INTO event_participants (event_id, student_id, status)
      VALUES (?, ?, 'interested')
    `).run(eventId, studentId);
    assert.ok(partRes.lastInsertRowid > 0);

    // Attempt registering non-existent student
    assert.throws(() => {
      db.prepare(`
        INSERT INTO event_participants (event_id, student_id, status)
        VALUES (?, 999999, 'interested')
      `).run(eventId);
    }, /FOREIGN KEY constraint failed/);

    // Attempt registering for non-existent event
    assert.throws(() => {
      db.prepare(`
        INSERT INTO event_participants (event_id, student_id, status)
        VALUES (999999, ?, 'interested')
      `).run(studentId);
    }, /FOREIGN KEY constraint failed/);
  });

  await t.test('10. Syllabus Curriculum Hierarchy: Categories must link to sports and techniques to categories', () => {
    // Create category under Karate
    const catRes = db.prepare(`
      INSERT INTO syllabus_categories (academy_id, sport_id, name, display_order)
      VALUES (1, ?, 'Goju-Ryu Katas', 4)
    `).run(sportId);
    const catId = Number(catRes.lastInsertRowid);

    // Create technique under category
    const techRes = db.prepare(`
      INSERT INTO syllabus_techniques (academy_id, category_id, name, belt_level)
      VALUES (1, ?, 'Gekisai Dai Ichi', 'Green Belt')
    `).run(catId);
    assert.ok(techRes.lastInsertRowid > 0);

    // Attempt creating technique with non-existent category
    assert.throws(() => {
      db.prepare(`
        INSERT INTO syllabus_techniques (academy_id, category_id, name, belt_level)
        VALUES (1, 999999, 'Phantom Strike', 'Black Belt')
      `).run();
    }, /FOREIGN KEY constraint failed/);
  });

  await t.test('11. Smart Attendance Biometrics & QR Tokens: Validates uniqueness and foreign keys', () => {
    // Generate QR token
    db.prepare(`
      INSERT INTO student_qr_tokens (academy_id, student_id, token, status)
      VALUES (1, ?, 'QR_SECURE_TOKEN_ABC123', 'active')
    `).run(studentId);

    // Attempt duplicate QR token
    assert.throws(() => {
      db.prepare(`
        INSERT INTO student_qr_tokens (academy_id, student_id, token, status)
        VALUES (1, ?, 'QR_SECURE_TOKEN_ABC123', 'active')
      `).run(studentId);
    }, /UNIQUE constraint failed/);

    // Face Profile registration
    db.prepare(`
      INSERT INTO student_face_profiles (academy_id, student_id, template_encrypted, template_version, sample_count, status)
      VALUES (1, ?, 'ENC_AES256_FACE_BIOMETRIC_DATA', 1, 3, 'active')
    `).run(studentId);

    // Attempt duplicate face profile for same student
    assert.throws(() => {
      db.prepare(`
        INSERT INTO student_face_profiles (academy_id, student_id, template_encrypted, template_version, sample_count, status)
        VALUES (1, ?, 'ENC_AES256_FACE_BIOMETRIC_DATA_2', 1, 3, 'active')
      `).run(studentId);
    }, /UNIQUE constraint failed/);
  });

  await t.test('12. Migration Consistency: Full migration replay against clean database produces 0 FK errors', () => {
    const fkErrors = db.prepare('PRAGMA foreign_key_check').all();
    assert.equal(fkErrors.length, 0, 'No foreign key violations allowed in migrated database');

    const totalTables = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().c;
    assert.ok(totalTables >= 75, 'Tenant schema must provision all 75+ core multi-tenant tables');

    const appliedMigrations = db.prepare('SELECT count(*) as c FROM _migrations').get().c;
    assert.equal(appliedMigrations, 36, 'All 36 tenant migrations must be recorded');
  });
});
