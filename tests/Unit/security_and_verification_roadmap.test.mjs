import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';

describe('Security QA Remediation & Feature Verification Suite', () => {
  let server;
  let baseUrl;
  let centralDb;
  let tenantDb;

  const ACADEMY_ID = 1;

  let coachToken;
  let adminToken;
  let coachUserId = 882;
  let adminUserId = 881;
  let testStudentId;

  before(async () => {
    process.env.NODE_ENV = 'test';
    centralDb = getCentralDb();
    tenantDb = getTenantDbById(ACADEMY_ID);

    // 1. Ensure test users exist in tenant DB
    tenantDb.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (?, 'QA Security Admin', 'admin.sec@test.iss', 'hash', 'academy_admin', 'active')
      ON CONFLICT(id) DO UPDATE SET role = 'academy_admin'
    `).run(adminUserId);

    tenantDb.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (?, 'QA Rajesh Coach', 'coach.sec@test.iss', 'hash', 'coach', 'active')
      ON CONFLICT(id) DO UPDATE SET role = 'coach'
    `).run(coachUserId);

    // Ensure role definitions exist in tenant DB
    tenantDb.prepare(`
      INSERT INTO academy_roles (name, display_name, description, is_system, permissions)
      VALUES ('coach', 'Coach', 'Sports coach', 1, '["view_batches", "view_students", "mark_attendance", "apply_leaves"]')
      ON CONFLICT(name) DO UPDATE SET permissions = '["view_batches", "view_students", "mark_attendance", "apply_leaves"]'
    `).run();

    // 2. Create a test student with password_hash
    const insStudent = tenantDb.prepare(`
      INSERT INTO students (student_code, first_name, last_name, email, password_hash, status)
      VALUES ('STU-QA-SEC-01', 'QA_Sec_Student', 'Test', 'qa_student_sec@test.iss', '$2a$10$SecretBcryptHashShouldNeverLeak', 'active')
    `).run();
    testStudentId = insStudent.lastInsertRowid;

    // 3. Generate tokens
    adminToken = signToken({
      userId: adminUserId,
      email: 'admin.sec@test.iss',
      role: 'academy_admin',
      academyId: ACADEMY_ID,
      isSuperAdmin: false,
    });

    coachToken = signToken({
      userId: coachUserId,
      email: 'coach.sec@test.iss',
      role: 'coach',
      academyId: ACADEMY_ID,
      isSuperAdmin: false,
    });

    // 4. Start HTTP server
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    try {
      if (testStudentId) {
        tenantDb.prepare('DELETE FROM students WHERE id = ?').run(testStudentId);
      }
      tenantDb.prepare('DELETE FROM users WHERE id IN (?, ?)').run(adminUserId, coachUserId);
    } catch (_) {}

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function apiRequest(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = {
      'Host': 'pratik-karate-academy.internationalsportssolutions.test',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return { status: response.status, data, headers: response.headers };
  }

  // ----------------------------------------------------
  // Finding 1 & 2: Privilege Escalation & Self Role-Change Block
  // ----------------------------------------------------
  it('1. Coach cannot self-escalate role to academy_admin (Finding #2)', async () => {
    const res = await apiRequest(`/api/academy/users/${coachUserId}/role`, {
      method: 'PUT',
      token: coachToken,
      body: { role: 'academy_admin' },
    });

    assert.equal(res.status, 403, 'Should return 403 Forbidden');
    assert.equal(res.data.success, false);

    // Verify DB was NOT updated
    const user = tenantDb.prepare('SELECT role FROM users WHERE id = ?').get(coachUserId);
    assert.equal(user.role, 'coach', 'Coach role in database must remain coach');
  });

  it('2. Admin cannot change their own role (self-escalation / lockout block)', async () => {
    const res = await apiRequest(`/api/academy/users/${adminUserId}/role`, {
      method: 'PUT',
      token: adminToken,
      body: { role: 'coach' },
    });

    assert.equal(res.status, 403, 'Should return 403 Forbidden on self-role change');
  });

  // ----------------------------------------------------
  // Finding 3: Coach cannot create new academy_admin accounts
  // ----------------------------------------------------
  it('3. Coach cannot create new academy_admin backdoor account (Finding #3)', async () => {
    const res = await apiRequest('/api/academy/users', {
      method: 'POST',
      token: coachToken,
      body: {
        name: 'Backdoor Admin',
        email: 'backdoor.admin@evil.test',
        role: 'academy_admin',
        password: 'password123',
      },
    });

    assert.equal(res.status, 403, 'Should return 403 Forbidden');
  });

  // ----------------------------------------------------
  // Finding 4: Coach cannot create custom god_mode roles
  // ----------------------------------------------------
  it('4. Coach cannot create custom role with permissions: [all] (Finding #4)', async () => {
    const res = await apiRequest('/api/academy/roles', {
      method: 'POST',
      token: coachToken,
      body: {
        name: 'god_mode_test',
        display_name: 'God Mode',
        permissions: ['all'],
      },
    });

    assert.equal(res.status, 403, 'Should return 403 Forbidden');
  });

  // ----------------------------------------------------
  // Finding 5: Coach cannot download tenant DB backup
  // ----------------------------------------------------
  it('5. Coach cannot download full academy database backup (Finding #5)', async () => {
    const res = await apiRequest('/api/academy/backup', {
      method: 'GET',
      token: coachToken,
    });

    assert.equal(res.status, 403, 'Should return 403 Forbidden');
  });

  // ----------------------------------------------------
  // Finding 6: Coach cannot view sensitive staff & payroll listings
  // ----------------------------------------------------
  it('6. Coach cannot view staff list with salaries or payroll periods (Finding #6)', async () => {
    const resUsers = await apiRequest('/api/academy/users', {
      method: 'GET',
      token: coachToken,
    });
    assert.equal(resUsers.status, 403, 'GET /users must return 403 for coach');

    const resProfiles = await apiRequest('/api/academy/payroll/profiles', {
      method: 'GET',
      token: coachToken,
    });
    assert.equal(resProfiles.status, 403, 'GET /payroll/profiles must return 403 for coach');

    const resAudit = await apiRequest('/api/academy/audit-logs', {
      method: 'GET',
      token: coachToken,
    });
    assert.equal(resAudit.status, 403, 'GET /audit-logs must return 403 for coach');
  });

  // ----------------------------------------------------
  // Finding 7: Students list must NOT leak password_hash
  // ----------------------------------------------------
  it('7. GET /api/academy/students does NOT leak password_hash (Finding #7)', async () => {
    const res = await apiRequest('/api/academy/students', {
      method: 'GET',
      token: adminToken,
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.students));
    assert.ok(res.data.students.length > 0);

    for (const s of res.data.students) {
      assert.equal(
        s.password_hash,
        undefined,
        `Student ${s.id} (${s.first_name}) leaked password_hash in response payload`
      );
    }
  });

  // ----------------------------------------------------
  // Finding 8: Coach cannot delete/archive student records
  // ----------------------------------------------------
  it('8. Coach cannot delete student record (Finding #8)', async () => {
    const res = await apiRequest(`/api/academy/students/${testStudentId}`, {
      method: 'DELETE',
      token: coachToken,
    });

    assert.equal(res.status, 403, 'DELETE /students/:id must return 403 for coach');
  });

  // ----------------------------------------------------
  // Phase 2: Batches Sample CSV & Import
  // ----------------------------------------------------
  it('9. GET /api/academy/batches/sample-csv provides downloadable sample template', async () => {
    const res = await apiRequest('/api/academy/batches/sample-csv', {
      method: 'GET',
      token: adminToken,
    });

    assert.equal(res.status, 200);
    assert.ok(typeof res.data === 'string');
    assert.ok(res.data.includes('Batch Name,Branch,Sport,Coach,Days,Start Time,End Time,Capacity,Fee'));
    assert.ok(res.data.includes('"Mon,Wed,Fri"'), 'Days field with commas must be enclosed in quotes');
  });

  // ----------------------------------------------------
  // Phase 2: My Salary Statement Endpoint
  // ----------------------------------------------------
  it('10. GET /api/academy/payroll/my-salary succeeds for logged-in coach', async () => {
    const res = await apiRequest('/api/academy/payroll/my-salary?year_month=2026-09', {
      method: 'GET',
      token: coachToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.statement, 'Should return statement object');
    assert.equal(res.data.visibility.isPastVisibilityDay, true, 'Historical month should have isPastVisibilityDay=true');
  });
});
