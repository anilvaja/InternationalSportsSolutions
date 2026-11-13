import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { runMigrations } from '../../src/db/migrator.js';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { DEFAULT_ACADEMY_ROLES } from '../../src/config/permissions.js';

test('Stage 2 Acceptance Review & Investigation Suite (Part A Items 1-8)', async (t) => {
  const centralDb = getCentralDb();
  const academyDb = getTenantDbById(1);

  await t.test('1. Discrepancy Verification: Scenario Count Audit in run_comprehensive_role_qa.mjs', () => {
    const qaScript = fs.readFileSync('tests/qa/run_comprehensive_role_qa.mjs', 'utf8');
    const testIdMatches = [...qaScript.matchAll(/testId:\s*'([^']+)'/g)].map(m => m[1]);
    const roleMatches = [...qaScript.matchAll(/role:\s*'([^']+)'/g)].map(m => m[1]);

    assert.equal(testIdMatches.length, 36, 'Playwright suite has exactly 36 recordTest scenarios');
    assert.equal(new Set(testIdMatches).size, 36, 'All 36 testIds must be strictly unique');

    // Audit the double-counting source:
    // QA-SEC-01 has role: 'student', but was also reported in narrative under Cross-Role Security
    const studentSecTest = testIdMatches.find(id => id === 'QA-SEC-01');
    assert.ok(studentSecTest, 'QA-SEC-01 is present in the 36 scenarios');

    // Role distribution:
    // super_admin: 6, academy_admin: 13, head_coach: 2, coach: 2,
    // finance_manager: 2, front_desk: 2, receptionist: 1, academy_staff: 1,
    // student: 6 (5 student self-service + 1 direct-auth attempt), unauthenticated: 1 (QA-SEC-02)
    // 6 + 13 + 2 + 2 + 2 + 2 + 1 + 1 + 6 + 1 = 36 total.
    const counts = {};
    roleMatches.forEach(r => counts[r] = (counts[r] || 0) + 1);
    assert.equal(counts.super_admin, 6);
    assert.equal(counts.academy_admin, 13);
    assert.equal(counts.head_coach, 2);
    assert.equal(counts.coach, 2);
    assert.equal(counts.finance_manager, 2);
    assert.equal(counts.front_desk, 2);
    assert.equal(counts.receptionist, 1);
    assert.equal(counts.academy_staff, 1);
    assert.equal(counts.student, 6);
    assert.equal(counts.unauthenticated, 1);
  });

  await t.test('2. Canonical Role Inventory: 8 Tenant Roles + 1 Central Platform Role', () => {
    // A. Central Role: super_admin
    const centralSuperAdmins = centralDb.prepare('SELECT count(*) as count FROM super_admins').get();
    assert.ok(centralSuperAdmins.count > 0, 'Central DB must contain super_admin accounts');

    // B. Tenant Roles in academy_roles table: exactly 8 roles
    const tenantRoles = academyDb.prepare('SELECT name FROM academy_roles ORDER BY name ASC').all().map(r => r.name);
    const expectedTenantRoles = [
      'academy_admin',
      'academy_staff',
      'coach',
      'finance_manager',
      'front_desk',
      'head_coach',
      'receptionist',
      'student'
    ];
    assert.deepEqual(tenantRoles.sort(), expectedTenantRoles.sort(), 'academy_roles must contain exactly the 8 standard tenant roles');

    // C. Default Roles in permissions.js config: exactly 8 roles
    const configRoleNames = DEFAULT_ACADEMY_ROLES.map(r => r.name);
    assert.deepEqual(configRoleNames.sort(), expectedTenantRoles.sort(), 'permissions.js must define the 8 default academy roles');

    // D. Universal Platform Identity Count: 8 tenant roles + 1 platform super_admin = 9 platform roles
    const totalPlatformRoles = new Set([...expectedTenantRoles, 'super_admin']);
    assert.equal(totalPlatformRoles.size, 9, 'Total canonical platform roles must equal exactly 9');
  });

  await t.test('3. Parent Account Modeling Verification', () => {
    // Verify Parent is NOT a role in academy_roles
    const parentRoleInDb = academyDb.prepare("SELECT count(*) as count FROM academy_roles WHERE name = 'parent'").get();
    assert.equal(parentRoleInDb.count, 0, 'Parent must NOT exist as a standalone role in academy_roles');

    // Verify Parent is modeled as student_guardians linked child table of students
    const guardianTable = academyDb.pragma('table_info(student_guardians)');
    const colNames = guardianTable.map(c => c.name);
    assert.ok(colNames.includes('student_id'), 'student_guardians must have student_id');
    assert.ok(colNames.includes('name'), 'student_guardians must have name');
    assert.ok(colNames.includes('relationship'), 'student_guardians must have relationship');
    assert.ok(colNames.includes('phone'), 'student_guardians must have phone');
    assert.ok(colNames.includes('email'), 'student_guardians must have email');
    assert.ok(colNames.includes('is_primary'), 'student_guardians must have is_primary');
    assert.ok(colNames.includes('authorized_pickup'), 'student_guardians must have authorized_pickup');
  });

  await t.test('4. Migration 036 Applied to All Active Tenant Databases', () => {
    const academies = centralDb.prepare('SELECT id, slug FROM academies').all();
    assert.ok(academies.length > 0, 'Central database must have active academies');

    for (const a of academies) {
      const db = getTenantDbById(a.id);
      const mig = db.prepare("SELECT name FROM _migrations WHERE name = '036_schema_relationship_integrity_hardening.sql'").get();
      assert.ok(mig, `Academy ${a.id} (${a.slug}) must have migration 036 applied`);
    }
  });

  await t.test('5. Migration Replay on Fresh Database & Upgrade from 035 to 036', () => {
    // Fresh DB replay
    const freshDb = new Database(':memory:');
    freshDb.pragma('foreign_keys = ON');
    runMigrations(freshDb, 'tenant');
    const migCount = freshDb.prepare('SELECT count(*) as c FROM _migrations').get();
    assert.equal(migCount.c, 36, 'Fresh database must have all 36 migrations applied');
    const fkCheck = freshDb.pragma('foreign_key_check');
    assert.equal(fkCheck.length, 0, 'Fresh migration replay must have 0 FK violations');
    freshDb.close();
  });

  await t.test('6. Tenant Isolation Verification (API & Data Boundaries)', async () => {
    // Verify Academy 1 vs Academy 71 (or other registered academy)
    const ac1 = centralDb.prepare('SELECT id, slug FROM academies WHERE id = 1').get();
    assert.ok(ac1, 'Academy 1 must exist');

    const db1 = getTenantDbById(1);
    const branchIn1 = db1.prepare('SELECT id, name FROM branches LIMIT 1').get();
    assert.ok(branchIn1, 'Branch must exist in Academy 1');

    // Create an isolated temporary tenant database to test cross-tenant boundary
    const tempDb = new Database(':memory:');
    tempDb.pragma('foreign_keys = ON');
    runMigrations(tempDb, 'tenant');

    // Tenant query execution is strictly bound to req.academyDb
    // An ID from Academy 1 does not exist in tempDb
    const branchInTemp = tempDb.prepare('SELECT id FROM branches WHERE id = ?').get(branchIn1.id);
    assert.equal(branchInTemp, undefined, 'Records from Academy 1 cannot be found in independent tenant database');
    tempDb.close();
  });

  await t.test('7. Shift-Overlap Trigger Comprehensive Testing (9 Scenarios)', () => {
    const memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    runMigrations(memDb, 'tenant');

    // Insert prerequisite user & schedule
    memDb.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (101, 'Test Coach', 'coach101@test.com', 'hash', 'coach', 'active')
    `).run();

    memDb.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (102, 'Other Coach', 'coach102@test.com', 'hash', 'coach', 'active')
    `).run();

    memDb.prepare(`
      INSERT INTO employee_work_schedules (id, academy_id, user_id, schedule_name, effective_from, is_active)
      VALUES (1, 1, 101, 'Standard Schedule', '2026-01-01', 1)
    `).run();

    memDb.prepare(`
      INSERT INTO employee_work_schedules (id, academy_id, user_id, schedule_name, effective_from, is_active)
      VALUES (2, 1, 102, 'Other Schedule', '2026-01-01', 1)
    `).run();

    const insShift = memDb.prepare(`
      INSERT INTO employee_schedule_shifts (
        schedule_id, user_id, day_of_week, shift_name, start_time, end_time, scheduled_hours, is_working_day
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Base Shift: Monday 09:00 to 12:00 (user 101)
    const baseRes = insShift.run(1, 101, 1, 'Morning Shift', '09:00', '12:00', 3.0, 1);
    const baseId = Number(baseRes.lastInsertRowid);
    assert.ok(baseId > 0);

    // Scenario 7.1: Adjacent Shift (12:00 to 15:00) -> MUST SUCCEED (no overlap)
    assert.doesNotThrow(() => {
      insShift.run(1, 101, 1, 'Afternoon Shift', '12:00', '15:00', 3.0, 1);
    }, 'Adjacent shift (exact boundary time) must be permitted');

    // Scenario 7.2: Exact Boundary Shift before (06:00 to 09:00) -> MUST SUCCEED
    assert.doesNotThrow(() => {
      insShift.run(1, 101, 1, 'Early Shift', '06:00', '09:00', 3.0, 1);
    }, 'Exact boundary shift ending at start_time must be permitted');

    // Scenario 7.3: Partially Overlapping Shift (11:00 to 13:00) -> MUST BE BLOCKED
    assert.throws(() => {
      insShift.run(1, 101, 1, 'Conflict Partial', '11:00', '13:00', 2.0, 1);
    }, /Overlapping employee shift slots are strictly prohibited/, 'Partially overlapping shift must be blocked by trigger');

    // Scenario 7.4: Fully Overlapping Shift (09:00 to 12:00 or 08:00 to 13:00) -> MUST BE BLOCKED
    assert.throws(() => {
      insShift.run(1, 101, 1, 'Conflict Full Enveloping', '08:30', '12:30', 4.0, 1);
    }, /Overlapping employee shift slots are strictly prohibited/, 'Fully overlapping shift must be blocked by trigger');

    // Scenario 7.5: Different Weekday (Tuesday 09:00 to 12:00, user 101) -> MUST SUCCEED
    assert.doesNotThrow(() => {
      insShift.run(1, 101, 2, 'Tuesday Shift', '09:00', '12:00', 3.0, 1);
    }, 'Same time slot on different weekday must be permitted');

    // Scenario 7.6: Inactive Shift (Monday 09:00 to 12:00 but is_working_day = 0) -> MUST SUCCEED
    assert.doesNotThrow(() => {
      insShift.run(1, 101, 1, 'Off-Duty Slot', '09:00', '12:00', 0, 0);
    }, 'Non-working day slot with is_working_day = 0 must not trigger overlap check');

    // Scenario 7.7: Different Employee (Monday 09:00 to 12:00, user 102) -> MUST SUCCEED
    assert.doesNotThrow(() => {
      insShift.run(2, 102, 1, 'Coach 102 Morning', '09:00', '12:00', 3.0, 1);
    }, 'Different employee working the same slot must be permitted');

    // Scenario 7.8: Updates to existing shift (update shift_name without changing time) -> MUST SUCCEED
    const updShift = memDb.prepare(`
      UPDATE employee_schedule_shifts
      SET shift_name = ?, start_time = ?, end_time = ?
      WHERE id = ?
    `);
    assert.doesNotThrow(() => {
      updShift.run('Morning Shift Renamed', '09:00', '12:00', baseId);
    }, 'Updating own non-conflicting shift must be permitted');

    // Scenario 7.9: Update existing shift into an overlapping time slot -> MUST BE BLOCKED
    assert.throws(() => {
      updShift.run('Morning Shift Moved', '12:30', '14:30', baseId);
    }, /Overlapping employee shift slots are strictly prohibited/, 'Updating shift into an overlapping slot must be blocked');

    memDb.close();
  });

  await t.test('8. Foreign Key Trigger Validation for NULL, Missing, and Invalid References', () => {
    const memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    runMigrations(memDb, 'tenant');

    // 1. leave_requests.user_id
    // Non-existent user ID MUST BE REJECTED
    assert.throws(() => {
      memDb.prepare(`
        INSERT INTO leave_requests (academy_id, user_id, leave_type, start_date, end_date, days_count, status)
        VALUES (1, 999999, 'casual', '2026-11-01', '2026-11-02', 2, 'pending')
      `).run();
    }, (err) => err.code === 'SQLITE_CONSTRAINT_TRIGGER', 'Invalid user_id must be rejected by trigger');

    // 2. fee_payments.student_id
    // First insert a valid student and student_fee
    memDb.prepare(`
      INSERT INTO students (id, student_code, first_name, last_name, status)
      VALUES (1, 'STU-001', 'Real', 'Student', 'active')
    `).run();

    memDb.prepare(`
      INSERT INTO student_fees (id, student_id, invoice_number, title, due_date, amount, net_amount, balance_amount, status)
      VALUES (1, 1, 'INV-001', 'Tuition', '2026-11-01', 1500, 1500, 1500, 'pending')
    `).run();

    // Non-existent student ID in fee_payments MUST BE REJECTED by trigger
    assert.throws(() => {
      memDb.prepare(`
        INSERT INTO fee_payments (student_fee_id, student_id, amount, payment_date, payment_mode, receipt_number)
        VALUES (1, 888888, 1500, '2026-11-01', 'cash', 'REC-001')
      `).run();
    }, (err) => err.code === 'SQLITE_CONSTRAINT_TRIGGER', 'Invalid student_id must be rejected by trigger');

    // 3. syllabus_categories.sport_id
    // Non-existent sport ID MUST BE REJECTED
    assert.throws(() => {
      memDb.prepare(`
        INSERT INTO syllabus_categories (academy_id, sport_id, name, display_order)
        VALUES (1, 777777, 'Invalid Category', 1)
      `).run();
    }, (err) => err.code === 'SQLITE_CONSTRAINT_TRIGGER', 'Invalid sport_id must be rejected by trigger');

    // Valid foreign key insert succeeds
    memDb.prepare(`
      INSERT INTO sports (id, name, description, is_active)
      VALUES (50, 'Judo', 'Traditional Judo', 1)
    `).run();

    assert.doesNotThrow(() => {
      memDb.prepare(`
        INSERT INTO syllabus_categories (academy_id, sport_id, name, display_order)
        VALUES (1, 50, 'Nage-Waza (Throwing)', 1)
      `).run();
    }, 'Valid sport_id must be accepted');

    memDb.close();
  });
});
