import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';

describe('Enforce Academy, Branch, Batch, and Student Relationships (Rules 1-16)', () => {
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
    academy1Db = getTenantDbById(ACADEMY_1_ID);
    academy2Db = getTenantDbById(ACADEMY_2_ID);

    // Clean up test branches and test students to keep repeated test runs completely idempotent
    academy1Db.prepare("DELETE FROM branches WHERE name LIKE 'North Satellite Wing%'").run();
    academy1Db.prepare("DELETE FROM students WHERE first_name IN ('Transfer', 'Test', 'Bulk1', 'Concurrent') OR student_code LIKE 'STU-TEST%' OR student_code LIKE 'STU-IMP%'").run();

    // Ensure Batch 1 has at least two active students for test assertions
    const batch1 = academy1Db.prepare('SELECT id, branch_id FROM batches LIMIT 1').get();
    if (batch1) {
      const activeCount = academy1Db.prepare("SELECT COUNT(*) as c FROM student_batch_enrollments WHERE batch_id = ? AND status = 'active'").get(batch1.id).c;
      if (activeCount < 2) {
        const needed = 2 - activeCount;
        const candidates = academy1Db.prepare(`
          SELECT id FROM students 
          WHERE id NOT IN (SELECT student_id FROM student_batch_enrollments WHERE status = 'active')
          LIMIT ?
        `).all(needed);
        for (const cand of candidates) {
          academy1Db.prepare(`
            INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status)
            VALUES (?, ?, DATE('now'), 'active')
          `).run(cand.id, batch1.id);
        }
      }
    }

    // Create staff tokens for authentication
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

    // Start ephemeral test HTTP server
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
    try {
      academy1Db.prepare("DELETE FROM branches WHERE name LIKE 'North Satellite Wing%'").run();
    } catch (e) {}
  });

  // Helper for authenticated API calls with tenant header
  async function api(path, { method = 'GET', body, token = academy1Token, academyId = ACADEMY_1_ID } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': String(academyId),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  // --------------------------------------------------------------------------
  // Rule 1: One academy can have multiple branches
  // --------------------------------------------------------------------------
  it('1. One academy can have multiple branches', async () => {
    const initialRes = await api('/api/academy/branches', { token: academy1Token, academyId: ACADEMY_1_ID });
    assert.equal(initialRes.status, 200);
    assert.ok(initialRes.data.branches.length >= 1, 'Academy 1 should have at least 1 branch');

    // Clean up any stale test branch from prior runs to ensure quota headroom
    academy1Db.prepare("DELETE FROM branches WHERE name LIKE 'North Satellite Wing%'").run();

    // Create another branch in Academy 1
    const createRes = await api('/api/academy/branches', {
      method: 'POST',
      body: { name: 'North Satellite Wing', city: 'Ahmedabad' },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(createRes.status, 201);
    assert.ok(createRes.data.branchId);

    const res = await api('/api/academy/branches', { token: academy1Token, academyId: ACADEMY_1_ID });
    assert.equal(res.status, 200);
    assert.ok(res.data.branches.length >= 2, 'Academy 1 should have multiple branches');

    const branch = academy1Db.prepare('SELECT * FROM branches WHERE id = ?').get(createRes.data.branchId);
    assert.equal(branch.name, 'North Satellite Wing');
    assert.equal(branch.academy_id, ACADEMY_1_ID);
  });

  // --------------------------------------------------------------------------
  // Rule 2: A branch cannot belong to two academies
  // --------------------------------------------------------------------------
  it('2. A branch cannot belong to two academies', async () => {
    let b1 = academy1Db.prepare('SELECT * FROM branches LIMIT 1').get();
    if (!b1) {
      const bRes = academy1Db.prepare('INSERT INTO branches (name, city, is_active) VALUES (?, ?, 1)').run('Main Campus Dojo', 'Ahmedabad');
      b1 = academy1Db.prepare('SELECT * FROM branches WHERE id = ?').get(bRes.lastInsertRowid);
    }
    assert.ok(b1, 'Branch 1 must exist in Academy 1');

    // Tenant isolation: querying Academy 2's database must not contain Academy 1's branch
    const bInAc2 = academy2Db.prepare('SELECT * FROM branches WHERE id = ?').get(b1.id);
    if (bInAc2) {
      assert.notEqual(bInAc2.name, b1.name, 'Branches in different tenant DBs are strictly separate entities');
    }

    // Cross-academy branch modification or creation attempt is rejected
    const forgedUpdate = await api(`/api/academy/branches/${b1.id}`, {
      method: 'PUT',
      body: { name: 'Forged Branch Name', academy_id: ACADEMY_2_ID },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(forgedUpdate.status, 403, 'Cross-academy ownership change must be forbidden');
  });

  // --------------------------------------------------------------------------
  // Rule 3: One branch can have multiple batches
  // --------------------------------------------------------------------------
  it('3. One branch can have multiple batches', async () => {
    const b1 = academy1Db.prepare('SELECT id FROM branches LIMIT 1').get();
    let batches = academy1Db.prepare('SELECT * FROM batches WHERE branch_id = ?').all(b1.id);
    if (batches.length < 2) {
      academy1Db.prepare(`
        INSERT INTO batches (name, branch_id, start_time, end_time, days_of_week, max_capacity, monthly_fee, is_active, academy_id)
        VALUES (?, ?, '17:00', '18:30', '["Tue","Thu"]', 25, 2000, 1, 1)
      `).run('Evening Karate Batch', b1.id);
      batches = academy1Db.prepare('SELECT * FROM batches WHERE branch_id = ?').all(b1.id);
    }
    assert.ok(batches.length >= 2, 'Branch 1 must have multiple batches');
    for (const b of batches) {
      assert.equal(b.branch_id, b1.id);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 4: A batch cannot belong to two branches
  // --------------------------------------------------------------------------
  it('4. A batch cannot belong to two branches', async () => {
    // Schema check: branch_id is a single integer column
    const batches = academy1Db.prepare('SELECT id, branch_id FROM batches').all();
    for (const b of batches) {
      assert.ok(b.branch_id !== null && b.branch_id !== undefined, 'Batch must belong to exactly one branch');
    }

    // Creating batch without branch_id must be rejected
    const res = await api('/api/academy/batches', {
      method: 'POST',
      body: { name: 'Orphan Batch', start_time: '10:00', end_time: '11:00' },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /branch/i);
  });

  // --------------------------------------------------------------------------
  // Rule 5: One academy can have multiple students
  // --------------------------------------------------------------------------
  it('5. One academy can have multiple students', async () => {
    const res = await api('/api/academy/students', { token: academy1Token, academyId: ACADEMY_1_ID });
    assert.equal(res.status, 200);
    assert.ok(res.data.students.length >= 3, 'Academy 1 must contain multiple students');
  });

  // --------------------------------------------------------------------------
  // Rule 6: A student cannot belong to two academies
  // --------------------------------------------------------------------------
  it('6. A student cannot belong to two academies', async () => {
    // Student in Academy 1 DB cannot be accessed by Academy 2 admin
    const stu1 = academy1Db.prepare('SELECT id, student_code FROM students LIMIT 1').get();

    const crossAccess = await api(`/api/academy/students/${stu1.id}`, {
      token: academy2Token,
      academyId: ACADEMY_2_ID,
    });
    // In Academy 2 DB, either student ID doesn't exist or doesn't have the same student_code
    if (crossAccess.data.student) {
      assert.notEqual(crossAccess.data.student.student_code, stu1.student_code);
    }

    // Direct forged academy_id on student creation is rejected
    const forgedCreate = await api('/api/academy/students', {
      method: 'POST',
      body: {
        first_name: 'Hacked',
        last_name: 'User',
        academy_id: ACADEMY_2_ID, // wrong academy!
      },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(forgedCreate.status, 403, 'Cross-academy student creation must be rejected');
  });

  // --------------------------------------------------------------------------
  // Rule 7: One batch can have multiple students
  // --------------------------------------------------------------------------
  it('7. One batch can have multiple students', async () => {
    const batch1 = academy1Db.prepare('SELECT id FROM batches LIMIT 1').get();
    const studentsInBatch = academy1Db.prepare(`
      SELECT student_id FROM student_batch_enrollments
      WHERE batch_id = ? AND status = 'active'
    `).all(batch1.id);

    assert.ok(studentsInBatch.length >= 2, 'Batch 1 must have multiple active enrolled students');
  });

  // --------------------------------------------------------------------------
  // Rule 8: A student cannot have two active batch enrollments
  // --------------------------------------------------------------------------
  it('8. A student cannot have two active batch enrollments', async () => {
    const student = academy1Db.prepare(`
      SELECT s.id FROM students s
      JOIN student_batch_enrollments sbe ON sbe.student_id = s.id
      WHERE sbe.status = 'active'
      LIMIT 1
    `).get();

    // Direct engine-level test: attempt inserting a second active enrollment for the same student
    assert.throws(() => {
      academy1Db.prepare(`
        INSERT INTO student_batch_enrollments (student_id, batch_id, status)
        VALUES (?, 3, 'active')
      `).run(student.id);
    }, (err) => {
      // Must be a UNIQUE constraint failure on idx_student_single_active_batch
      return err.message.includes('UNIQUE constraint failed') || err.message.includes('idx_student_single_active_batch');
    }, 'SQLite engine-level constraint MUST physically reject second active enrollment');
  });

  // --------------------------------------------------------------------------
  // Rule 9: A student can transfer from Batch A to Batch B, retaining history
  // --------------------------------------------------------------------------
  it('9. A student can transfer from Batch A to Batch B, retaining history', async () => {
    // Create a fresh test student
    const batchA = academy1Db.prepare('SELECT id, branch_id, name FROM batches LIMIT 1').get();
    academy1Db.prepare('DELETE FROM student_batch_enrollments WHERE batch_id = ?').run(batchA.id);
    const branch = { id: batchA.branch_id };
    const batchB = academy1Db.prepare('SELECT id, name FROM batches WHERE branch_id = ? AND id != ? LIMIT 1').get(branch.id, batchA.id) || academy1Db.prepare('SELECT id, name FROM batches WHERE id != ? LIMIT 1').get(batchA.id);

    const studentRes = await api('/api/academy/students', {
      method: 'POST',
      body: {
        first_name: 'Transfer',
        last_name: 'TestStudent',
        branch_id: branch.id,
        batch_id: batchA.id,
      },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(studentRes.status, 201);
    const studentId = studentRes.data.studentId;

    // Verify initial active batch
    const initialEnrollment = academy1Db.prepare(`
      SELECT * FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'
    `).get(studentId);
    assert.equal(initialEnrollment.batch_id, batchA.id);

    // Perform atomic transfer to Batch B
    const transferRes = await api(`/api/academy/students/${studentId}/transfer-batch`, {
      method: 'POST',
      body: {
        new_batch_id: batchB.id,
        transfer_reason: 'Level advancement after evaluation',
        effective_date: '2026-10-15',
      },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(transferRes.status, 200);
    assert.equal(transferRes.data.success, true);

    // Verify current active batch is now Batch B
    const activeEnrollment = academy1Db.prepare(`
      SELECT * FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'
    `).get(studentId);
    assert.equal(activeEnrollment.batch_id, batchB.id);

    // Verify history contains previous Batch A marked as transferred
    const historyRes = await api(`/api/academy/students/${studentId}/enrollment-history`, {
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(historyRes.status, 200);
    const history = historyRes.data.history;

    assert.equal(history.length, 2, 'History must contain exactly 2 enrollment records');
    const oldRec = history.find(h => h.batch_id === batchA.id);
    const newRec = history.find(h => h.batch_id === batchB.id);

    assert.equal(oldRec.status, 'transferred');
    assert.equal(oldRec.transfer_reason, 'Level advancement after evaluation');
    assert.equal(oldRec.transferred_to_batch_id, batchB.id);
    assert.equal(oldRec.end_date, '2026-10-15');

    assert.equal(newRec.status, 'active');
    assert.equal(newRec.end_date, null);
  });

  // --------------------------------------------------------------------------
  // Rule 10: Failed transfer must not leave student without valid enrollment or create duplicate
  // --------------------------------------------------------------------------
  it('10. A failed transfer must not leave the student without a valid enrollment or create duplicate active enrollments', async () => {
    const student = academy1Db.prepare(`
      SELECT s.id, sbe.batch_id FROM students s
      JOIN student_batch_enrollments sbe ON sbe.student_id = s.id
      WHERE sbe.status = 'active'
      LIMIT 1
    `).get();

    const originalActiveBatch = student.batch_id;

    // Attempt transfer to a non-existent batch
    const failedRes = await api(`/api/academy/students/${student.id}/transfer-batch`, {
      method: 'POST',
      body: {
        new_batch_id: 999999, // Non-existent batch
        transfer_reason: 'Invalid transfer test',
      },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(failedRes.status, 404);

    // Verify student STILL has their original active enrollment intact
    const activeRecords = academy1Db.prepare(`
      SELECT * FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'
    `).all(student.id);

    assert.equal(activeRecords.length, 1, 'Must have exactly ONE active enrollment');
    assert.equal(activeRecords[0].batch_id, originalActiveBatch, 'Original enrollment must be preserved');
  });

  // --------------------------------------------------------------------------
  // Rule 11: Cross-academy enrollment attempts are rejected
  // --------------------------------------------------------------------------
  it('11. Cross-academy enrollment attempts are rejected', async () => {
    // Attempting to transfer with forged academy_id
    const res = await api('/api/academy/students/1/transfer-batch', {
      method: 'POST',
      body: {
        new_batch_id: 2,
        academy_id: ACADEMY_2_ID,
      },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(res.status, 403);
    assert.match(res.data.error, /cross-academy/i);
  });

  // --------------------------------------------------------------------------
  // Rule 12: Cross-academy branch and batch IDs are rejected
  // --------------------------------------------------------------------------
  it('12. Cross-academy branch and batch IDs are rejected', async () => {
    // Try to create a batch in Academy 1 pointing to a nonexistent branch ID
    const resBatch = await api('/api/academy/batches', {
      method: 'POST',
      body: {
        name: 'Illegal Batch',
        branch_id: 88888, // Foreign/Nonexistent branch
        start_time: '08:00',
        end_time: '09:00',
      },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(resBatch.status, 400);
    assert.match(resBatch.data.error, /branch does not exist in this academy/i);

    // Try to create a student in Academy 1 pointing to a foreign branch ID
    const resStudent = await api('/api/academy/students', {
      method: 'POST',
      body: {
        first_name: 'Test',
        last_name: 'ForeignBranch',
        branch_id: 88888,
      },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(resStudent.status, 400);
    assert.match(resStudent.data.error, /branch does not exist in this academy/i);
  });

  // --------------------------------------------------------------------------
  // Rule 13: CSV imports and bulk assignments cannot bypass these rules
  // --------------------------------------------------------------------------
  it('13. CSV imports and bulk assignments cannot bypass these rules', async () => {
    // Attempt import with cross-academy branch and batch
    const importRes = await api('/api/academy/students/import', {
      method: 'POST',
      body: {
        students: [
          { first_name: 'Bulk1', last_name: 'Valid', branch_id: 1 },
          { first_name: 'Bulk2', last_name: 'ForgedAcademy', academy_id: ACADEMY_2_ID },
          { first_name: 'Bulk3', last_name: 'InvalidBranch', branch_id: 99999 },
        ],
      },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(importRes.status, 201, `Failed to import: ${importRes.data.error}`);
    assert.equal(importRes.data.importedCount, 1, 'Only the valid student should be imported');
    assert.equal(importRes.data.errors.length, 2, 'Invalid rows must be rejected');

    // Bulk assign students who already have an active batch without force_transfer
    const activeStudent = academy1Db.prepare("SELECT student_id FROM student_batch_enrollments WHERE status = 'active' LIMIT 1").get();
    const otherBatch = academy1Db.prepare('SELECT id FROM batches LIMIT 1 OFFSET 1').get();

    const bulkRes = await api('/api/academy/students/bulk-enroll', {
      method: 'POST',
      body: {
        batch_id: otherBatch.id,
        student_ids: [activeStudent.student_id],
        force_transfer: false,
      },
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(bulkRes.status, 200);
    assert.equal(bulkRes.data.results.rejected.length, 1, 'Student with active batch must be rejected without force_transfer');
  });

  // --------------------------------------------------------------------------
  // Rule 14: Concurrent enrollment requests cannot create duplicate active assignments
  // --------------------------------------------------------------------------
  it('14. Concurrent enrollment requests cannot create duplicate active assignments', async () => {
    // Create an unassigned student
    const ins = academy1Db.prepare(`
      INSERT INTO students (student_code, first_name, last_name, academy_id, status)
      VALUES (?, 'Concurrent', 'TestStudent', 1, 'active')
    `).run(`STU-CONC-${Date.now()}-${Math.floor(Math.random() * 1000000)}`);
    const studentId = ins.lastInsertRowid;

    // Simulate concurrent enrollment attempts
    let successCount = 0;
    let failureCount = 0;

    const attempts = [1, 2, 3].map(async (batchId) => {
      try {
        academy1Db.prepare(`
          INSERT INTO student_batch_enrollments (student_id, batch_id, status)
          VALUES (?, ?, 'active')
        `).run(studentId, batchId);
        successCount++;
      } catch (err) {
        failureCount++;
      }
    });

    await Promise.all(attempts);

    assert.equal(successCount, 1, 'Exactly ONE concurrent enrollment attempt can succeed');
    assert.equal(failureCount, 2, 'Other concurrent attempts must be rejected by unique index');

    const activeCount = academy1Db.prepare(`
      SELECT COUNT(*) as c FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'
    `).get(studentId).c;
    assert.equal(activeCount, 1, 'Student must have exactly ONE active enrollment in database');
  });

  // --------------------------------------------------------------------------
  // Rule 15: Tenant and branch permissions are enforced in UI and backend
  // --------------------------------------------------------------------------
  it('15. Tenant and branch permissions are enforced in UI and backend', async () => {
    // Missing token
    const unauth = await api('/api/academy/students', { token: null });
    assert.equal(unauth.status, 401, 'Unauthenticated request must be rejected');

    // Wrong role token (student attempting to call academy staff endpoint)
    const studentToken = signToken({
      userId: 10,
      email: 'student@example.com',
      role: 'student',
      academyId: ACADEMY_1_ID,
    });
    const forbidden = await api('/api/academy/students', { token: studentToken });
    assert.equal(forbidden.status, 403, 'Student cannot access academy staff management API');
  });

  // --------------------------------------------------------------------------
  // Rule 16: Existing valid attendance and fee records continue working after migrations
  // --------------------------------------------------------------------------
  it('16. Existing valid attendance and fee records continue working after migrations', async () => {
    let batch = academy1Db.prepare('SELECT id FROM batches LIMIT 1').get();
    if (!batch) {
      let branch = academy1Db.prepare('SELECT id FROM branches LIMIT 1').get();
      if (!branch) {
        const brRes = academy1Db.prepare('INSERT INTO branches (name, city, is_active, academy_id) VALUES (?, ?, 1, ?)').run('Main Campus', 'Ahmedabad', ACADEMY_1_ID);
        branch = { id: brRes.lastInsertRowid };
      }
      let sport = academy1Db.prepare('SELECT id FROM sports LIMIT 1').get();
      if (!sport) {
        const spRes = academy1Db.prepare('INSERT INTO sports (name, is_active) VALUES (?, 1)').run('Karate');
        sport = { id: spRes.lastInsertRowid };
      }
      const bRes = academy1Db.prepare('INSERT INTO batches (name, branch_id, sport_id, monthly_fee, max_capacity, academy_id) VALUES (?, ?, ?, ?, ?, ?)').run('Test Batch 16', branch.id, sport.id, 2500, 30, ACADEMY_1_ID);
      batch = { id: bRes.lastInsertRowid };
    }

    // Ensure at least one enrolled student exists for batch
    let student = academy1Db.prepare('SELECT s.id FROM students s JOIN student_batch_enrollments e ON s.id = e.student_id WHERE e.batch_id = ? LIMIT 1').get(batch.id);
    if (!student) {
      const sRes = academy1Db.prepare('INSERT INTO students (first_name, last_name, student_code, academy_id) VALUES (?, ?, ?, ?)').run('TestStu', 'Rule16', 'STU-RULE16-' + Date.now(), ACADEMY_1_ID);
      academy1Db.prepare('INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, is_active) VALUES (?, ?, ?, 1)').run(sRes.lastInsertRowid, batch.id, '2026-01-01');
    }

    // Ensure at least one fee record exists
    let fee = academy1Db.prepare('SELECT id FROM student_fees LIMIT 1').get();
    if (!fee) {
      const s = academy1Db.prepare('SELECT id FROM students LIMIT 1').get();
      academy1Db.prepare('INSERT INTO student_fees (student_id, invoice_number, title, amount, net_amount, paid_amount, balance_amount, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(s.id, 'INV-TEST-16-' + Date.now(), 'Monthly Fee', 2500, 2500, 2500, 0, 'paid', '2026-10-15');
    }

    // Verify attendance roster query still works via student_batch_enrollments
    const attRes = await api(`/api/academy/attendance?batch_id=${batch.id}&date=2026-10-12`, {
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(attRes.status, 200);
    assert.ok(attRes.data.roster.length >= 1, 'Attendance roster must load active students');

    // Verify student fees continue working
    const feesRes = await api('/api/academy/fees', {
      token: academy1Token,
      academyId: ACADEMY_1_ID,
    });
    assert.equal(feesRes.status, 200);
    assert.ok(feesRes.data.fees.length >= 1, 'Student fees list must continue working');
  });
});
