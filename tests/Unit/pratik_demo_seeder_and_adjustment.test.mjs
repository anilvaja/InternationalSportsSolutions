import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import { PratikKarateAcademyDemoSeeder } from '../../src/db/pratikKarateAcademyDemoSeeder.js';
import { AttendanceAdjustmentService } from '../../src/services/attendanceAdjustmentService.js';
import app from '../../server.js';

describe('Pratik Karate Academy Demo Seeder & Attendance Adjustment Suite', () => {
  let server;
  let baseUrl;
  let centralDb;
  let tenantDb;
  let superAdminToken;
  let coachToken;

  const ACADEMY_ID = 1;

  before(async () => {
    process.env.NODE_ENV = 'test';
    centralDb = getCentralDb();
    tenantDb = getTenantDbById(ACADEMY_ID);

    // Setup Super Admin user
    let sa = centralDb.prepare("SELECT * FROM super_admins WHERE email = 'superadmin@pratikkarate.com'").get();
    if (!sa) {
      const ins = centralDb.prepare(`
        INSERT INTO super_admins (name, email, password_hash, status)
        VALUES ('Super Admin', 'superadmin@pratikkarate.com', '$2a$10$abcdefghijklmnopqrstuv', 'active')
      `).run();
      sa = centralDb.prepare('SELECT * FROM super_admins WHERE id = ?').get(ins.lastInsertRowid);
    }

    superAdminToken = signToken({
      id: sa.id,
      email: sa.email,
      name: sa.name,
      isSuperAdmin: true,
      role: 'super_admin'
    });

    coachToken = signToken({
      id: 9999,
      email: 'regular.coach@pratikkarate.com',
      name: 'Regular Coach',
      academyId: 1,
      isSuperAdmin: false,
      role: 'coach',
      permissions: ['view_attendance']
    });

    // Start ephemeral HTTP test server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function apiRequest(method, endpoint, { token, body, academyId = 1 } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Academy-ID': String(academyId)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  it('1. Executes PratikKarateAcademyDemoSeeder directly and returns success', async () => {
    const results = await PratikKarateAcademyDemoSeeder.run();
    assert.strictEqual(results.success, true);
    assert.ok(results.executionId.startsWith('SEED-'));
    assert.strictEqual(results.academy.id, 1);
    assert.strictEqual(results.academy.name, 'Pratik Karate Academy');
    assert.strictEqual(results.stats.salaryStatementsVerified, 6);
  });

  it('2. Demonstrates complete idempotency when run a second time', async () => {
    const secondRun = await PratikKarateAcademyDemoSeeder.run();
    assert.strictEqual(secondRun.success, true);
    assert.strictEqual(secondRun.errors.length, 0);
    // Should reuse existing entities rather than duplicate
    assert.strictEqual(secondRun.stats.branchesReused, 3);
    assert.strictEqual(secondRun.stats.batchesReused, 7);
    assert.strictEqual(secondRun.stats.staffReused, 6);
    assert.strictEqual(secondRun.stats.studentsReused, 18);
    assert.strictEqual(secondRun.stats.branchesCreated, 0);
    assert.strictEqual(secondRun.stats.batchesCreated, 0);
    assert.strictEqual(secondRun.stats.studentsCreated, 0);
  });

  it('3. Verifies strictly Karate is the seeded sport with full syllabus hierarchy', () => {
    const sports = tenantDb.prepare('SELECT * FROM sports WHERE is_active = 1').all();
    const karateSport = sports.find(s => s.name.toLowerCase().includes('karate'));
    assert.ok(karateSport, 'Karate sport must exist in tenant database');

    const categories = tenantDb.prepare('SELECT * FROM syllabus_categories WHERE sport_id = ?').all(karateSport.id);
    assert.ok(categories.length >= 4, 'Must seed Kihon, Kata, Kumite, Bunkai syllabus categories');

    const techniques = tenantDb.prepare('SELECT * FROM syllabus_techniques').all();
    assert.ok(techniques.length >= 8, 'Must seed syllabus techniques with belts and requirements');
  });

  it('4. Verifies 3 Ahmedabad branches with distinct working schedules', () => {
    const branches = tenantDb.prepare('SELECT * FROM branches WHERE is_active = 1').all();
    assert.ok(branches.length >= 3, 'Must have at least 3 active branches');

    const branchNames = branches.map(b => b.name);
    assert.ok(branchNames.some(n => n.includes('Navrangpura Main Dojo')));
    assert.ok(branchNames.some(n => n.includes('Satellite Elite Dojo')));
    assert.ok(branchNames.some(n => n.includes('Vastrapur Community Dojo')));

    // Verify weekly off configs
    for (const b of branches) {
      const schedule = tenantDb.prepare('SELECT * FROM branch_work_schedules WHERE branch_id = ? AND is_active = 1').get(b.id);
      assert.ok(schedule, `Branch ${b.name} must have a branch_work_schedule`);
    }
  });

  it('5. Enforces student constraints: single active batch enrollment per student', () => {
    const students = tenantDb.prepare("SELECT * FROM students WHERE email LIKE '%@demostudent.iss'").all();
    assert.strictEqual(students.length, 18, 'Must have exactly 18 demo karate students');

    for (const stu of students) {
      assert.strictEqual(stu.academy_id, 1, 'Student must belong exclusively to Academy 1');

      const activeEnrollment = tenantDb.prepare(`
        SELECT COUNT(*) as count, batch_id FROM student_batch_enrollments
        WHERE student_id = ? AND status = 'active'
      `).get(stu.id);

      assert.strictEqual(activeEnrollment.count, 1, `Student #${stu.id} must have exactly 1 active batch enrollment`);
      assert.ok(activeEnrollment.batch_id, `Student #${stu.id} must have an active batch assigned`);
    }
  });

  it('6. Verifies salary engine calculations across diverse compensation modes', async () => {
    const results = await PratikKarateAcademyDemoSeeder.run();
    const verifs = results.salaryVerifications;
    assert.strictEqual(verifs.length, 6, 'Must verify all 6 staff members');

    const pratik = verifs.find(v => v.email === 'pratik.headcoach@pratikkarate.com');
    assert.strictEqual(pratik.mode, 'monthly');
    assert.strictEqual(pratik.net, 45000);
    assert.strictEqual(pratik.passed, true);

    const rajesh = verifs.find(v => v.email === 'rajesh.kumite@pratikkarate.com');
    assert.strictEqual(rajesh.mode, 'hourly');
    assert.strictEqual(rajesh.baseRate, 600);
    assert.ok(rajesh.gross > 0 && rajesh.net > 0);
    assert.strictEqual(rajesh.passed, true);

    const sneha = verifs.find(v => v.email === 'sneha.kata@pratikkarate.com');
    assert.strictEqual(sneha.mode, 'per_session');
    assert.strictEqual(sneha.baseRate, 500);
    assert.strictEqual(sneha.passed, true);

    const amit = verifs.find(v => v.email === 'amit.trainer@pratikkarate.com');
    assert.strictEqual(amit.mode, 'per_day');
    assert.strictEqual(amit.baseRate, 1200);
    assert.ok(amit.gross > 0 && amit.net > 0);
    assert.strictEqual(amit.passed, true);

    const vikram = verifs.find(v => v.email === 'vikram.staff@pratikkarate.com');
    assert.strictEqual(vikram.mode, 'monthly');
    // Approved attendance adjustment restored full attendance, avoiding absence deduction
    assert.strictEqual(vikram.deductions, 0);
    assert.strictEqual(vikram.net, 28000);
    assert.strictEqual(vikram.passed, true);

    const anita = verifs.find(v => v.email === 'anita.finance@pratikkarate.com');
    assert.strictEqual(anita.mode, 'monthly');
    assert.strictEqual(anita.net, 35000);
    assert.strictEqual(anita.passed, true);
  });

  it('7. Tests Attendance Adjustment: 2-day late rule and employee effective punch creation', () => {
    const vikramUser = tenantDb.prepare("SELECT id FROM users WHERE email = 'vikram.staff@pratikkarate.com'").get();
    assert.ok(vikramUser, 'Vikram user must exist');

    // Create adjustment for 5 days ago (triggers 2-day late rule)
    const testDate = '2026-09-10';
    // Clean up any existing record for this test date
    tenantDb.prepare("DELETE FROM attendance_corrections WHERE user_id = ? AND date = ?").run(vikramUser.id, testDate);
    tenantDb.prepare("DELETE FROM staff_time_punches WHERE user_id = ? AND punch_date = ?").run(vikramUser.id, testDate);

    const adj = AttendanceAdjustmentService.createAdjustment(
      tenantDb,
      ACADEMY_ID,
      {
        person_type: 'employee',
        user_id: vikramUser.id,
        date: testDate,
        original_status: 'absent',
        requested_status: 'present',
        reason: 'Automated test adjustment for missed duty punch'
      },
      vikramUser.id
    );

    assert.ok(adj.id, 'Adjustment request created');
    assert.strictEqual(adj.requires_admin_approval, 1, 'Must require admin approval due to 2-day cutoff rule');
    assert.strictEqual(adj.status, 'pending');

    // Prevent duplicate pending adjustment
    assert.throws(() => {
      AttendanceAdjustmentService.createAdjustment(
        tenantDb,
        ACADEMY_ID,
        {
          person_type: 'employee',
          user_id: vikramUser.id,
          date: testDate,
          requested_status: 'present',
          reason: 'Duplicate attempt',
          prevent_duplicate: true
        },
        vikramUser.id
      );
    }, /already exists/);

    // Review and approve adjustment
    const reviewResult = AttendanceAdjustmentService.reviewAdjustment(
      tenantDb,
      ACADEMY_ID,
      adj.id,
      { status: 'approved', reviewerNotes: 'Shift attendance verified via CCTV by Admin' },
      1
    );

    assert.strictEqual(reviewResult.status, 'approved');
    assert.ok(reviewResult.reviewed_at);
    assert.strictEqual(reviewResult.reviewer_notes, 'Shift attendance verified via CCTV by Admin');

    // Verify staff_time_punches was created and marked completed
    const punch = tenantDb.prepare('SELECT * FROM staff_time_punches WHERE user_id = ? AND punch_date = ?').get(vikramUser.id, testDate);
    assert.ok(punch, 'Effective punch must be created in staff_time_punches');
    assert.strictEqual(punch.status, 'completed');
    assert.strictEqual(punch.punch_type, 'duty');
    assert.ok(punch.duration_minutes > 0);
  });

  it('8. Verifies Super Admin endpoint security & authorization', async () => {
    // 1. Non-authenticated request must be rejected (401)
    const anonRes = await apiRequest('GET', '/api/central/seed-pratik-demo/info');
    assert.strictEqual(anonRes.status, 401);

    // 2. Regular non-SuperAdmin coach must be rejected (403)
    const coachRes = await apiRequest('GET', '/api/central/seed-pratik-demo/info', { token: coachToken });
    assert.strictEqual(coachRes.status, 403);

    // 3. Super Admin can access GET /info
    const saInfoRes = await apiRequest('GET', '/api/central/seed-pratik-demo/info', { token: superAdminToken });
    assert.strictEqual(saInfoRes.status, 200);
    assert.strictEqual(saInfoRes.data.success, true);
    assert.strictEqual(saInfoRes.data.academy.id, 1);
    assert.strictEqual(saInfoRes.data.targetSport, 'Karate');

    // 4. Super Admin can trigger POST /seed-pratik-demo
    const saRunRes = await apiRequest('POST', '/api/central/seed-pratik-demo', { token: superAdminToken });
    assert.strictEqual(saRunRes.status, 200);
    assert.strictEqual(saRunRes.data.success, true);
    assert.ok(saRunRes.data.executionId.startsWith('SEED-'));

    // 5. Verify central audit log was recorded
    const auditLog = centralDb.prepare(`
      SELECT * FROM central_audit_logs
      WHERE action = 'RUN_PRATIK_KARATE_DEMO_SEEDER'
      ORDER BY id DESC LIMIT 1
    `).get();
    assert.ok(auditLog, 'Execution must be recorded in central_audit_logs');
    assert.strictEqual(auditLog.entity, 'academy');
    assert.strictEqual(auditLog.entity_id, '1');
  });
});
