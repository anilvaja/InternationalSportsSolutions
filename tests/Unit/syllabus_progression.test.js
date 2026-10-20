import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';

describe('Sports Syllabus, Technique Progression & Learning Tracking', () => {
  let server;
  let baseUrl;
  let academy1Db;
  let academy2Db;
  let academy1Token;
  let academy2Token;

  const ACADEMY_1_ID = 1; // Mahavir Sports Academy
  const ACADEMY_2_ID = 2; // Sardar Martial Arts Academy

  before(async () => {
    process.env.NODE_ENV = 'test';
    const centralDb = getCentralDb();
    let a2 = centralDb.prepare('SELECT id FROM academies WHERE id = 2').get();
    if (!a2) {
      centralDb.prepare("INSERT INTO academies (id, name, slug, db_path, plan, max_branches, max_students, max_coaches) VALUES (2, 'Sardar Martial Arts Academy', 'sardar-martial-arts', 'data/academies/academy_2.db', 'professional', 5, 500, 50)").run();
    }
    academy1Db = getTenantDbById(ACADEMY_1_ID);
    academy2Db = getTenantDbById(ACADEMY_2_ID);

    academy1Token = signToken({
      userId: 1,
      email: 'john.smith@mahavirsportsacademy.com',
      role: 'academy_admin',
      academyId: ACADEMY_1_ID,
      name: 'John Smith',
    });

    academy2Token = signToken({
      userId: 2,
      email: 'admin@sardar-martial-arts.com',
      role: 'academy_admin',
      academyId: ACADEMY_2_ID,
      name: 'Sardar Admin',
    });

    // Ensure branch 1 and batch 1 exist for attendance and student tests
    let b1 = academy1Db.prepare('SELECT id FROM branches WHERE id = 1').get();
    if (!b1) {
      academy1Db.prepare("INSERT INTO branches (id, name, city, is_active, academy_id) VALUES (1, 'Main Campus Dojo', 'Ahmedabad', 1, 1)").run();
    }
    let bt1 = academy1Db.prepare('SELECT id FROM batches WHERE id = 1').get();
    if (!bt1) {
      academy1Db.prepare("INSERT INTO batches (id, name, branch_id, start_time, end_time, days_of_week, max_capacity, monthly_fee, academy_id, is_active) VALUES (1, 'Main Karate Batch', 1, '06:00', '07:30', '[\"Mon\",\"Wed\",\"Fri\"]', 30, 2000, 1, 1)").run();
    }
    academy1Db.prepare('DELETE FROM student_batch_enrollments WHERE batch_id = 1').run();

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (academy1Db) {
      try {
        const testTechs = academy1Db.prepare("SELECT id FROM syllabus_techniques WHERE category_id IN (SELECT id FROM syllabus_categories WHERE name LIKE '%-%')").all().map(t => t.id);
        if (testTechs.length) {
          academy1Db.prepare(`UPDATE student_attendance SET technique_id = NULL WHERE technique_id IN (${testTechs.join(',')})`).run();
          academy1Db.prepare(`DELETE FROM attendance_technique_snapshots WHERE technique_id IN (${testTechs.join(',')})`).run();
          academy1Db.prepare(`DELETE FROM student_technique_assignments WHERE technique_id IN (${testTechs.join(',')})`).run();
          academy1Db.prepare(`DELETE FROM syllabus_techniques WHERE id IN (${testTechs.join(',')})`).run();
        }
        academy1Db.prepare("DELETE FROM syllabus_categories WHERE name LIKE '%-%'").run();
      } catch (err) {
        console.error('Test cleanup error:', err);
      }
    }
  });

  async function api(path, { method = 'GET', body, token = academy1Token, academyId = ACADEMY_1_ID } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (academyId) headers['X-Academy-Id'] = String(academyId);

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // --------------------------------------------------------------------------
  // Category Management & Tenant Isolation
  // --------------------------------------------------------------------------
  it('1. Academy can create, list, and order its own syllabus categories', async () => {
    const catName = `Punching-${Date.now()}`;
    const res = await api('/api/academy/syllabus-categories', {
      method: 'POST',
      body: {
        name: catName,
        description: 'Basic karate punches and thrusts',
        display_order: 1,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.category.name, catName);

    // List categories for Academy 1
    const listRes = await api('/api/academy/syllabus-categories');
    assert.equal(listRes.status, 200);
    const found = listRes.data.categories.find((c) => c.name === catName);
    assert.ok(found, 'Created category should appear in academy categories list');

    // Cross-tenant verification: Academy 2 cannot see Academy 1 categories
    const ac2List = await api('/api/academy/syllabus-categories', { token: academy2Token, academyId: ACADEMY_2_ID });
    const ac2Found = ac2List.data.categories.find((c) => c.name === catName);
    assert.equal(ac2Found, undefined, 'Category must NOT leak to another academy database');
  });

  it('2. Category deletion is prevented when techniques exist', async () => {
    // 1. Create category
    const catRes = await api('/api/academy/syllabus-categories', {
      method: 'POST',
      body: { name: `CatProtect-${Date.now()}` },
    });
    const catId = catRes.data.category.id;

    // 2. Create technique inside it
    const techRes = await api('/api/academy/syllabus-techniques', {
      method: 'POST',
      body: {
        category_id: catId,
        name: `TechInCat-${Date.now()}`,
        level: 1,
        belt_level: 'White',
      },
    });
    assert.equal(techRes.status, 201);

    // 3. Attempt to delete category -> should be rejected with 400
    const delRes = await api(`/api/academy/syllabus-categories/${catId}`, { method: 'DELETE' });
    assert.equal(delRes.status, 400);
    assert.match(delRes.data.error, /contains \d+ technique/i);
  });

  // --------------------------------------------------------------------------
  // Technique Management
  // --------------------------------------------------------------------------
  it('3. Academy can create techniques with level and belt rank', async () => {
    const catRes = await api('/api/academy/syllabus-categories', {
      method: 'POST',
      body: { name: `Kicking-${Date.now()}` },
    });
    const catId = catRes.data.category.id;

    const techName = `Mae-Geri Front Kick ${Date.now()}`;
    const techRes = await api('/api/academy/syllabus-techniques', {
      method: 'POST',
      body: {
        category_id: catId,
        name: techName,
        code: 'KICK-01',
        level: 2,
        belt_level: 'Yellow Belt',
        display_order: 1,
      },
    });

    assert.equal(techRes.status, 201);
    assert.equal(techRes.data.technique.name, techName);
    assert.equal(techRes.data.technique.level, 2);
    assert.equal(techRes.data.technique.belt_level, 'Yellow Belt');
  });

  // --------------------------------------------------------------------------
  // Student Technique Assignment & History Preservation
  // --------------------------------------------------------------------------
  it('4. Student has at most one active technique and assignment preserves history', async () => {
    // Create Category & 2 Techniques
    const catRes = await api('/api/academy/syllabus-categories', {
      method: 'POST',
      body: { name: `ProgressionCat-${Date.now()}` },
    });
    const catId = catRes.data.category.id;

    const t1 = await api('/api/academy/syllabus-techniques', {
      method: 'POST',
      body: { category_id: catId, name: `Tech Level 1-${Date.now()}`, level: 1 },
    });
    const t2 = await api('/api/academy/syllabus-techniques', {
      method: 'POST',
      body: { category_id: catId, name: `Tech Level 2-${Date.now()}`, level: 2 },
    });

    // Create student
    const stuRes = await api('/api/academy/students', {
      method: 'POST',
      body: {
        first_name: 'Karate',
        last_name: 'Student',
        branch_id: 1,
        technique_id: t1.data.technique.id,
      },
    });
    assert.equal(stuRes.status, 201);
    const studentId = stuRes.data.studentId;

    // Check active technique
    let histRes = await api(`/api/academy/students/${studentId}/technique-history`);
    assert.equal(histRes.status, 200);
    assert.equal(histRes.data.currentTechnique.technique_id, t1.data.technique.id);
    assert.equal(histRes.data.history.length, 1);

    // Upgrade to Tech 2
    const upRes = await api(`/api/academy/students/${studentId}/assign-technique`, {
      method: 'POST',
      body: {
        technique_id: t2.data.technique.id,
        action: 'upgrade',
        remarks: 'Passed 8th Kyu examination',
      },
    });
    assert.equal(upRes.status, 200);

    // Verify current is now Tech 2, and previous is completed
    histRes = await api(`/api/academy/students/${studentId}/technique-history`);
    assert.equal(histRes.data.currentTechnique.technique_id, t2.data.technique.id);
    assert.equal(histRes.data.history.length, 2);

    const prev = histRes.data.history.find((h) => h.technique_id === t1.data.technique.id);
    assert.equal(prev.status, 'completed');
    assert.ok(prev.end_date, 'Previous assignment must have end_date recorded');

    // Verify database constraint: Exactly 1 active assignment
    const activeCount = academy1Db.prepare(`
      SELECT COUNT(*) as c FROM student_technique_assignments WHERE student_id = ? AND status = 'active'
    `).get(studentId).c;
    assert.equal(activeCount, 1, 'Database constraint must guarantee exactly ONE active assignment');
  });

  // --------------------------------------------------------------------------
  // Attendance Tracking with Technique Progression & Session Counts
  // --------------------------------------------------------------------------
  it('5. Attendance marking tracks technique, increments attended sessions across months and creates snapshot', async () => {
    // 1. Create a technique
    const catRes = await api('/api/academy/syllabus-categories', {
      method: 'POST',
      body: { name: `Kumite-${Date.now()}` },
    });
    const tRes = await api('/api/academy/syllabus-techniques', {
      method: 'POST',
      body: { category_id: catRes.data.category.id, name: `Sparring Basics-${Date.now()}`, level: 1 },
    });
    const techId = tRes.data.technique.id;

    // 2. Create student enrolled in batch 1
    const stuRes = await api('/api/academy/students', {
      method: 'POST',
      body: {
        first_name: 'Syllabus',
        last_name: 'AttendanceTest',
        branch_id: 1,
        batch_id: 1,
        technique_id: techId,
      },
    });
    const studentId = stuRes.data.studentId;

    // 3. Mark attendance for day 1 (Present)
    const attDate1 = '2026-09-15'; // September
    const attRes1 = await api('/api/academy/attendance', {
      method: 'POST',
      body: {
        batch_id: 1,
        date: attDate1,
        entries: [
          {
            student_id: studentId,
            status: 'present',
            technique_id: techId,
            technique_status: 'keep',
            technique_remarks: 'Good stance maintained',
          },
        ],
      },
    });
    assert.equal(attRes1.status, 200);

    // 4. Mark attendance for day 2 in next month (October)
    const attDate2 = '2026-10-05'; // October (persists across month boundary)
    const attRes2 = await api('/api/academy/attendance', {
      method: 'POST',
      body: {
        batch_id: 1,
        date: attDate2,
        entries: [
          {
            student_id: studentId,
            status: 'present',
            technique_id: techId,
            technique_status: 'keep',
            technique_remarks: 'Improved speed',
          },
        ],
      },
    });
    assert.equal(attRes2.status, 200);

    // 5. Mark attendance for day 3 (Absent - should NOT increment sessions)
    const attDate3 = '2026-10-08';
    await api('/api/academy/attendance', {
      method: 'POST',
      body: {
        batch_id: 1,
        date: attDate3,
        entries: [
          {
            student_id: studentId,
            status: 'absent',
            technique_id: techId,
            technique_status: 'keep',
          },
        ],
      },
    });

    // Verify session count: exactly 2 attended sessions
    const histRes = await api(`/api/academy/students/${studentId}/technique-history`);
    assert.equal(histRes.data.currentTechnique.sessions_attended, 2, 'Attended sessions count must be 2 (absent excluded)');

    // Verify snapshots were logged immutably
    assert.ok(histRes.data.snapshots.length >= 2, 'Attendance snapshots must be recorded');
  });

  // --------------------------------------------------------------------------
  // Downgrading technique & Returning to previously learned technique
  // --------------------------------------------------------------------------
  it('6. Student technique downgrade properly records downgraded status and keeps history', async () => {
    const catRes = await api('/api/academy/syllabus-categories', {
      method: 'POST',
      body: { name: `Kata-${Date.now()}` },
    });
    const tBasic = await api('/api/academy/syllabus-techniques', {
      method: 'POST',
      body: { category_id: catRes.data.category.id, name: `Heian Shodan-${Date.now()}`, level: 1 },
    });
    const tAdv = await api('/api/academy/syllabus-techniques', {
      method: 'POST',
      body: { category_id: catRes.data.category.id, name: `Heian Nidan-${Date.now()}`, level: 2 },
    });

    const stuRes = await api('/api/academy/students', {
      method: 'POST',
      body: {
        first_name: 'Kata',
        last_name: 'DowngradeTest',
        branch_id: 1,
        technique_id: tAdv.data.technique.id,
      },
    });
    const studentId = stuRes.data.studentId;

    // Downgrade back to basic kata
    const downRes = await api(`/api/academy/students/${studentId}/assign-technique`, {
      method: 'POST',
      body: {
        technique_id: tBasic.data.technique.id,
        action: 'downgrade',
        remarks: 'Needs further refinement on basics before resuming advanced kata',
      },
    });
    assert.equal(downRes.status, 200);

    const histRes = await api(`/api/academy/students/${studentId}/technique-history`);
    assert.equal(histRes.data.currentTechnique.technique_id, tBasic.data.technique.id);

    const downgradedRecord = histRes.data.history.find((h) => h.technique_id === tAdv.data.technique.id);
    assert.equal(downgradedRecord.status, 'downgraded');
  });

  // --------------------------------------------------------------------------
  // Syllabus Reports Endpoint
  // --------------------------------------------------------------------------
  it('7. Syllabus reports endpoint aggregates students by technique and duration', async () => {
    const repRes = await api('/api/academy/syllabus-reports');
    assert.equal(repRes.status, 200);
    assert.equal(repRes.data.success, true);
    assert.ok(Array.isArray(repRes.data.byTechnique));
    assert.ok(Array.isArray(repRes.data.extendedDurationStudents));
    assert.ok(Array.isArray(repRes.data.monthlyTechniqueAttendance));
  });

  // --------------------------------------------------------------------------
  // Attendance Saving with Null/Unset academy_id Self-Healing
  // --------------------------------------------------------------------------
  it('8. Attendance saving self-heals student with null academy_id and succeeds smoothly', async () => {
    // 1. Insert student directly with null academy_id in tenant database
    const rawStudent = academy1Db.prepare(`
      INSERT INTO students (student_code, first_name, last_name, branch_id, academy_id, status)
      VALUES ('STU-NULL-ACAD-' || hex(randomblob(3)), 'Rohan', 'Verma', 1, NULL, 'active')
    `).run();
    const testStuId = rawStudent.lastInsertRowid;

    // Enroll in batch 1
    academy1Db.prepare(`
      INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status)
      VALUES (?, 1, '2026-09-01', 'active')
    `).run(testStuId);

    // Get an available technique
    const tech = academy1Db.prepare('SELECT id FROM syllabus_techniques WHERE academy_id = 1 AND deleted_at IS NULL LIMIT 1').get();
    assert.ok(tech, 'Must have at least one technique');

    // 2. Mark attendance for this student with technique tracking
    const attRes = await api('/api/academy/attendance', {
      method: 'POST',
      body: {
        batch_id: 1,
        date: '2026-10-12',
        entries: [
          {
            student_id: testStuId,
            status: 'present',
            technique_id: tech.id,
            technique_status: 'keep',
            technique_remarks: 'Self-healing test passed',
          },
        ],
      },
    });

    assert.equal(attRes.status, 200, 'Attendance saving must not fail with 500 error');
    assert.equal(attRes.data.success, true);

    // 3. Verify student academy_id was self-healed to 1
    const healed = academy1Db.prepare('SELECT academy_id FROM students WHERE id = ?').get(testStuId);
    assert.equal(healed.academy_id, 1, 'Student academy_id must be self-healed to 1');
  });

  // --------------------------------------------------------------------------
  // Idempotency: Submitting 4 Times on Same Date
  // --------------------------------------------------------------------------
  it('9. Submitting attendance 4 times on the same date is idempotent: 1 session increment and 1 snapshot only', async () => {
    // 1. Create a student
    const stuRes = await api('/api/academy/students', {
      method: 'POST',
      body: {
        first_name: 'Idempotent',
        last_name: 'AttendanceTest',
        branch_id: 1,
        batch_id: 1,
      },
    });
    assert.equal(stuRes.status, 201);
    const testStuId = stuRes.data.studentId;

    const tech = academy1Db.prepare('SELECT id FROM syllabus_techniques WHERE academy_id = 1 AND deleted_at IS NULL LIMIT 1').get();
    const testDate = '2026-10-14';

    // 2. Submit attendance 4 times in a row for the exact same date
    let lastRes;
    for (let i = 1; i <= 4; i++) {
      const res = await api('/api/academy/attendance', {
        method: 'POST',
        body: {
          batch_id: 1,
          date: testDate,
          entries: [
            {
              student_id: testStuId,
              status: 'present',
              technique_id: tech.id,
              technique_status: 'keep',
              technique_remarks: `Submission round ${i}`,
            },
          ],
        },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      if (i > 1) {
        assert.equal(res.data.isUpdate, true, 'Subsequent submissions must be flagged as isUpdate');
        assert.ok(res.data.message.includes('updated successfully'), 'Message should indicate updated');
      }
      lastRes = res;
    }

    // 3. Verify exactly 1 attended session counted on active assignment
    const activeAss = academy1Db.prepare('SELECT sessions_attended FROM student_technique_assignments WHERE student_id = ? AND status = \'active\'').get(testStuId);
    assert.equal(activeAss.sessions_attended, 1, '4 submissions on the SAME date must only count as 1 session attended');

    // 4. Verify exactly 1 snapshot in attendance_technique_snapshots
    const snapCount = academy1Db.prepare('SELECT COUNT(*) as c FROM attendance_technique_snapshots WHERE student_id = ?').get(testStuId).c;
    assert.equal(snapCount, 1, 'Must have exactly 1 snapshot for the date, not 4 duplicate rows');
  });

  // --------------------------------------------------------------------------
  // Auto-assign default technique when taking attendance without selection
  // --------------------------------------------------------------------------
  it('10. Taking attendance without selecting a technique auto-assigns baseline technique and captures history', async () => {
    // 1. Create student without technique
    const stuRes = await api('/api/academy/students', {
      method: 'POST',
      body: {
        first_name: 'Baseline',
        last_name: 'AutoTechnique',
        branch_id: 1,
        batch_id: 1,
      },
    });
    assert.equal(stuRes.status, 201);
    const testStuId = stuRes.data.studentId;

    // 2. Submit attendance with technique_id = null
    const attRes = await api('/api/academy/attendance', {
      method: 'POST',
      body: {
        batch_id: 1,
        date: '2026-10-15',
        entries: [
          {
            student_id: testStuId,
            status: 'present',
            technique_id: null,
            technique_status: 'keep',
          },
        ],
      },
    });
    assert.equal(attRes.status, 200);
    assert.equal(attRes.data.success, true);

    // 3. Query student technique history
    const histRes = await api(`/api/academy/students/${testStuId}/technique-history`);
    assert.equal(histRes.status, 200);
    assert.ok(histRes.data.currentTechnique, 'Must have active technique assigned');
    assert.ok(histRes.data.currentTechnique.technique_name, 'Must have a technique name');
    assert.ok(histRes.data.snapshots.length > 0 || histRes.data.attendanceLogs.length > 0, 'Must capture attendance snapshot/log');
  });
});

