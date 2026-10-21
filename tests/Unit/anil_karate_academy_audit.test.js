import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';

describe('Anil Karate Academy — Complete Audit & Verification Suite', () => {
  let server;
  let baseUrl;
  let academyDb;
  let centralDb;

  const ACADEMY_ID = 1;
  const TENANT_HOST = 'anil-karate-academy.internationalsportssolutions.test';

  // Role tokens
  let adminToken;
  let coachToken;
  let staffToken;
  let financeToken;
  let frontDeskToken;
  let studentToken;
  let unauthorizedTenantToken;

  before(async () => {
    process.env.NODE_ENV = 'test';
    try {
      centralDb = getCentralDb();
      academyDb = getTenantDbById(ACADEMY_ID);

    // Verify Anil Karate Academy setup in central db
    const tenant = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(ACADEMY_ID);
    assert.ok(tenant, 'Academy 1 must exist in central.db');
    assert.strictEqual(tenant.name, 'Anil Karate Academy');

    // Clean up any audit test records inside Academy 1
    academyDb.prepare("DELETE FROM syllabus_techniques WHERE name LIKE 'Audit Tech%'").run();
    academyDb.prepare("DELETE FROM syllabus_categories WHERE name LIKE 'Audit Cat%'").run();
    academyDb.prepare("DELETE FROM sports WHERE name LIKE 'Audit Sport%'").run();
    academyDb.prepare("DELETE FROM fee_payments WHERE receipt_number LIKE 'REC-AUDIT%'").run();
    academyDb.prepare("DELETE FROM student_fees WHERE invoice_number LIKE 'INV-AUDIT%'").run();

    // Ensure system roles exist in academy_roles
    const roles = [
      { name: 'academy_admin', display_name: 'Academy Admin', perms: ['view_students', 'create_students', 'edit_students', 'delete_students', 'view_fees', 'collect_fees', 'view_syllabus', 'manage_syllabus', 'manage_payroll', 'view_inquiries', 'manage_inquiries'] },
      { name: 'coach', display_name: 'Coach', perms: ['view_students', 'view_syllabus', 'mark_attendance'] },
      { name: 'academy_staff', display_name: 'Academy Staff', perms: ['view_students', 'view_syllabus'] },
      { name: 'finance_manager', display_name: 'Finance Manager', perms: ['view_students', 'view_fees', 'collect_fees', 'manage_payroll'] },
      { name: 'front_desk', display_name: 'Front Desk', perms: ['view_students', 'view_inquiries', 'manage_inquiries'] }
    ];

    for (const r of roles) {
      academyDb.prepare(`
        INSERT INTO academy_roles (name, display_name, description, is_system, permissions)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(name) DO UPDATE SET permissions = excluded.permissions
      `).run(r.name, r.display_name, r.display_name, JSON.stringify(r.perms));
    }

    // Prepare test users in Academy 1
    const testUsers = [
      { id: 901, email: 'admin@anilkarate.test', name: 'Sensei Anil', role: 'academy_admin' },
      { id: 902, email: 'coach@anilkarate.test', name: 'Coach Ken', role: 'coach' },
      { id: 903, email: 'staff@anilkarate.test', name: 'Staff Priya', role: 'academy_staff' },
      { id: 904, email: 'finance@anilkarate.test', name: 'Finance Rahul', role: 'finance_manager' },
      { id: 905, email: 'reception@anilkarate.test', name: 'FrontDesk Maya', role: 'front_desk' }
    ];

    for (const u of testUsers) {
      academyDb.prepare(`
        INSERT INTO users (id, email, password_hash, name, role, status, created_at, updated_at)
        VALUES (?, ?, 'hash123', ?, ?, 'active', datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET role = excluded.role, name = excluded.name
      `).run(u.id, u.email, u.name, u.role);
    }

    // Generate JWTs
    adminToken = signToken({ userId: 901, email: 'admin@anilkarate.test', role: 'academy_admin', academyId: ACADEMY_ID, name: 'Sensei Anil' });
    coachToken = signToken({ userId: 902, email: 'coach@anilkarate.test', role: 'coach', academyId: ACADEMY_ID, name: 'Coach Ken' });
    staffToken = signToken({ userId: 903, email: 'staff@anilkarate.test', role: 'academy_staff', academyId: ACADEMY_ID, name: 'Staff Priya' });
    financeToken = signToken({ userId: 904, email: 'finance@anilkarate.test', role: 'finance_manager', academyId: ACADEMY_ID, name: 'Finance Rahul' });
    frontDeskToken = signToken({ userId: 905, email: 'reception@anilkarate.test', role: 'front_desk', academyId: ACADEMY_ID, name: 'FrontDesk Maya' });
    studentToken = signToken({ userId: 906, studentId: 1, email: 'student@anilkarate.test', role: 'student', academyId: ACADEMY_ID, name: 'Student Ryu' });

    // Unauthorized synthetic tenant token
    unauthorizedTenantToken = signToken({ userId: 999, email: 'attacker@other.test', role: 'academy_admin', academyId: 99999, name: 'Cross Tenant Attacker' });

    // Start server on ephemeral port
      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
    } catch (err) {
      console.error('CRITICAL BEFORE HOOK ERROR:', err);
      throw err;
    }
  });

  after(async () => {
    // Clean up audit test records
    academyDb.prepare("DELETE FROM syllabus_techniques WHERE name LIKE 'Audit Tech%'").run();
    academyDb.prepare("DELETE FROM syllabus_categories WHERE name LIKE 'Audit Cat%'").run();
    academyDb.prepare("DELETE FROM sports WHERE name LIKE 'Audit Sport%'").run();
    academyDb.prepare("DELETE FROM fee_payments WHERE receipt_number LIKE 'REC-AUDIT%'").run();
    academyDb.prepare("DELETE FROM student_fees WHERE invoice_number LIKE 'INV-AUDIT%'").run();
    academyDb.prepare('DELETE FROM users WHERE id IN (901, 902, 903, 904, 905)').run();

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  const request = async (method, path, { token, host = TENANT_HOST, body } = {}) => {
    const headers = {
      Host: host,
      'x-forwarded-host': host,
      'x-academy-domain': host,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return { status: res.status, headers: res.headers, body: data };
  };

  describe('1. Tenant Isolation & Identity Verification', () => {
    it('accurately resolves Anil Karate Academy via domain host', async () => {
      const res = await request('GET', '/api/academy/dashboard', { token: adminToken });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success, 'Dashboard request must succeed');
    });

    it('rejects cross-tenant synthetic token with 403 Forbidden', async () => {
      const res = await request('GET', '/api/academy/dashboard', { token: unauthorizedTenantToken });
      assert.strictEqual(res.status, 403);
      assert.match(res.body.error, /Cross-tenant access forbidden/i);
    });

    it('denies access if student token tries to access admin dashboard route', async () => {
      const res = await request('GET', '/api/academy/dashboard', { token: studentToken });
      assert.strictEqual(res.status, 403);
    });
  });

  describe('2. Data Relationships: Sports → Syllabus Categories → Techniques', () => {
    let sportKarateId;
    let sportJudoId;
    let categoryKarateKatasId;

    it('creates primary sports disciplines for testing hierarchy', async () => {
      const res1 = await request('POST', '/api/academy/sports', {
        token: adminToken,
        body: { name: 'Audit Sport Karate', description: 'Traditional Shotokan Karate' }
      });
      assert.strictEqual(res1.status, 201);
      sportKarateId = res1.body.sport.id;

      const res2 = await request('POST', '/api/academy/sports', {
        token: adminToken,
        body: { name: 'Audit Sport Judo', description: 'Kodokan Judo' }
      });
      assert.strictEqual(res2.status, 201);
      sportJudoId = res2.body.sport.id;
    });

    it('rejects syllabus category creation with invalid/nonexistent sport_id', async () => {
      const res = await request('POST', '/api/academy/syllabus-categories', {
        token: adminToken,
        body: {
          sport_id: 999999, // nonexistent sport
          name: 'Audit Cat Invalid',
          display_order: 1
        }
      });
      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /Sport does not exist/i);
    });

    it('creates syllabus category under valid sport', async () => {
      const res = await request('POST', '/api/academy/syllabus-categories', {
        token: adminToken,
        body: {
          sport_id: sportKarateId,
          name: 'Audit Cat Karate Katas',
          display_order: 1
        }
      });
      assert.strictEqual(res.status, 201);
      categoryKarateKatasId = res.body.category.id;
    });

    it('rejects technique creation when linked to category of a different sport discipline', async () => {
      const res = await request('POST', '/api/academy/syllabus-techniques', {
        token: adminToken,
        body: {
          sport_id: sportJudoId, // Judo sport
          category_id: categoryKarateKatasId, // Karate category!
          name: 'Audit Tech Cross-Discipline Seoi-Nage',
          level: 1
        }
      });
      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /Technique cannot be linked to a category from another sports discipline/i);
    });

    it('creates technique successfully when sport and category discipline match', async () => {
      const res = await request('POST', '/api/academy/syllabus-techniques', {
        token: adminToken,
        body: {
          sport_id: sportKarateId,
          category_id: categoryKarateKatasId,
          name: 'Audit Tech Heian Shodan Kata',
          level: 1,
          belt_level: 'Yellow Belt',
          display_order: 1
        }
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.technique.name, 'Audit Tech Heian Shodan Kata');
    });

    it('protects referenced sports from destructive deletion', async () => {
      // Deleting sportKarateId should safely deactivate it because it has syllabus categories and techniques
      const res = await request('DELETE', `/api/academy/sports/${sportKarateId}`, {
        token: adminToken
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.deactivated, true);
      assert.match(res.body.message, /deactivated/i);

      // Verify it is deactivated in DB rather than deleted
      const sportRecord = academyDb.prepare('SELECT is_active FROM sports WHERE id = ?').get(sportKarateId);
      assert.strictEqual(sportRecord.is_active, 0);
    });
  });

  describe('3. Role & Dynamic Permission Enforcement', () => {
    it('allows admin and finance_manager to view fees, but denies coach without fee permission', async () => {
      const adminFees = await request('GET', '/api/academy/fees', { token: adminToken });
      assert.strictEqual(adminFees.status, 200);

      const financeFees = await request('GET', '/api/academy/fees', { token: financeToken });
      assert.strictEqual(financeFees.status, 200);

      const coachFees = await request('GET', '/api/academy/fees', { token: coachToken });
      assert.strictEqual(coachFees.status, 403);
    });

    it('allows coach and admin to mark attendance, but denies front_desk', async () => {
      const coachAttendance = await request('POST', '/api/academy/attendance', {
        token: coachToken,
        body: {
          batch_id: 1,
          date: new Date().toISOString().slice(0, 10),
          records: [{ student_id: 1, status: 'present' }]
        }
      });
      // 200 or 400 depending on batch existence, but NOT 403 Forbidden
      assert.notStrictEqual(coachAttendance.status, 403);

      const frontDeskAttendance = await request('POST', '/api/academy/attendance', {
        token: frontDeskToken,
        body: {
          batch_id: 1,
          date: new Date().toISOString().slice(0, 10),
          records: [{ student_id: 1, status: 'present' }]
        }
      });
      assert.strictEqual(frontDeskAttendance.status, 403);
    });

    it('enforces dynamic permission changes immediately without re-login', async () => {
      // Temporarily give front_desk custom permission 'view_fees'
      academyDb.prepare(`
        UPDATE users 
        SET custom_permissions = json_array('view_fees') 
        WHERE id = 905
      `).run();

      const frontDeskFeesWithPerm = await request('GET', '/api/academy/fees', { token: frontDeskToken });
      assert.strictEqual(frontDeskFeesWithPerm.status, 200);

      // Now revoke custom permission
      academyDb.prepare(`
        UPDATE users 
        SET custom_permissions = NULL 
        WHERE id = 905
      `).run();

      const frontDeskFeesRevoked = await request('GET', '/api/academy/fees', { token: frontDeskToken });
      assert.strictEqual(frontDeskFeesRevoked.status, 403);
    });
  });

  describe('4. Financial Accuracy & Receipt Numbering', () => {
    it('records payments with accurate balance calculations', async () => {
      // Ensure student 1 exists
      const student = academyDb.prepare('SELECT id FROM students LIMIT 1').get();
      const studentId = student ? student.id : 1;

      // Create test invoice
      const invoiceInsert = academyDb.prepare(`
        INSERT INTO student_fees (
          student_id, invoice_number, title, due_date,
          amount, discount_amount, net_amount, paid_amount, balance_amount, status
        ) VALUES (
          ?, 'INV-AUDIT-001', 'Audit Monthly Fee', '2026-10-15',
          5000, 500, 4500, 0, 4500, 'pending'
        )
      `).run(studentId);
      const invoiceId = invoiceInsert.lastInsertRowid;

      // Collect partial payment of 2000 via finance manager
      const payRes = await request('POST', '/api/academy/fees/pay', {
        token: financeToken,
        body: {
          student_fee_id: invoiceId,
          amount: 2000,
          payment_mode: 'upi',
          transaction_reference: 'UPI-AUDIT-123'
        }
      });

      assert.strictEqual(payRes.status, 200);
      assert.ok(payRes.body.receiptNumber, 'Must generate receipt number');

      // Verify invoice state in database
      const updatedInvoice = academyDb.prepare('SELECT net_amount, paid_amount, balance_amount, status FROM student_fees WHERE id = ?').get(invoiceId);
      assert.strictEqual(updatedInvoice.net_amount, 4500);
      assert.strictEqual(updatedInvoice.paid_amount, 2000);
      assert.strictEqual(updatedInvoice.balance_amount, 2500);
      assert.strictEqual(updatedInvoice.status, 'partial');
    });
  });

  describe('5. Bulk Import Validation', () => {
    it('rejects student import rows with invalid branch or batch relationships', async () => {
      const res = await request('POST', '/api/academy/students/import', {
        token: adminToken,
        body: {
          students: [
            {
              first_name: 'AuditStudent',
              last_name: 'Valid',
              phone: '9898989898',
              gender: 'male',
              dob: '2010-01-01',
              branch_id: 999999 // nonexistent branch
            }
          ]
        }
      });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /Row 1: Branch ID 999999 does not exist/i);
    });
  });
});
