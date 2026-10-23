import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';

describe('Multi-Academy, Multi-Role & Complete Workflow Verification', () => {
  let server;
  let baseUrl;
  let centralDb;
  let academy1Db;
  let academy2Db;

  const ACADEMY_1_ID = 1;
  const ACADEMY_2_ID = 2;

  // Tokens for Academy 1
  let superAdminToken;
  let a1AdminToken;
  let a1CoachToken;
  let a1FinanceToken;
  let a1FrontDeskToken;
  let a1StudentToken;

  // Tokens for Academy 2
  let a2AdminToken;
  let a2CoachToken;

  before(async () => {
    process.env.NODE_ENV = 'test';
    centralDb = getCentralDb();

    // 1. Ensure Academy 1 and Academy 2 exist in central.db
    centralDb.prepare(`
      INSERT INTO academies (id, name, slug, status, plan, max_branches, max_students, max_coaches, db_path)
      VALUES (1, 'Pratik Karate Academy', 'pratik-karate-academy', 'active', 'enterprise', 10, 500, 50, 'data/academies/academy_1.db')
      ON CONFLICT(id) DO UPDATE SET name = 'Pratik Karate Academy', slug = 'pratik-karate-academy', db_path = 'data/academies/academy_1.db'
    `).run();

    centralDb.prepare(`
      INSERT INTO academies (id, name, slug, status, plan, max_branches, max_students, max_coaches, db_path)
      VALUES (2, 'Phoenix Martial Arts Academy', 'phoenix-martial-arts', 'active', 'professional', 5, 200, 20, 'data/academies/academy_2.db')
      ON CONFLICT(id) DO UPDATE SET name = 'Phoenix Martial Arts Academy', slug = 'phoenix-martial-arts', db_path = 'data/academies/academy_2.db'
    `).run();

    // Ensure domains
    centralDb.prepare(`
      INSERT INTO domains (academy_id, domain, is_primary, is_custom, status)
      VALUES (1, 'pratik-karate-academy.internationalsportssolutions.test', 1, 0, 'active')
      ON CONFLICT(domain) DO NOTHING
    `).run();

    centralDb.prepare(`
      INSERT INTO domains (academy_id, domain, is_primary, is_custom, status)
      VALUES (2, 'phoenix-martial-arts.internationalsportssolutions.test', 1, 0, 'active')
      ON CONFLICT(domain) DO NOTHING
    `).run();

    academy1Db = getTenantDbById(ACADEMY_1_ID);
    academy2Db = getTenantDbById(ACADEMY_2_ID);

    // Clean up test branches so quota limit is not exceeded across test runs
    try {
      academy1Db.prepare('DELETE FROM branches WHERE name LIKE "MultiBranch%" OR name LIKE "North City Dojo"').run();
      academy2Db.prepare('DELETE FROM branches WHERE name LIKE "MultiBranch%"').run();
    } catch (e) {}

    // Setup roles in both academies
    const roles = [
      { name: 'academy_admin', display_name: 'Academy Admin', perms: ['all'] },
      { name: 'coach', display_name: 'Coach', perms: ['view_students', 'view_syllabus', 'mark_attendance'] },
      { name: 'finance_manager', display_name: 'Finance Manager', perms: ['view_students', 'view_fees', 'collect_fees', 'manage_payroll'] },
      { name: 'front_desk', display_name: 'Front Desk', perms: ['view_students', 'view_inquiries', 'manage_inquiries'] }
    ];

    for (const r of roles) {
      academy1Db.prepare(`
        INSERT INTO academy_roles (name, display_name, description, is_system, permissions)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(name) DO UPDATE SET permissions = excluded.permissions
      `).run(r.name, r.display_name, r.display_name, JSON.stringify(r.perms));

      academy2Db.prepare(`
        INSERT INTO academy_roles (name, display_name, description, is_system, permissions)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(name) DO UPDATE SET permissions = excluded.permissions
      `).run(r.name, r.display_name, r.display_name, JSON.stringify(r.perms));
    }

    // Provision test users in Academy 1
    academy1Db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (801, 'Anil Sensei', 'admin@multi-e2e-a1.test', 'hash', 'academy_admin', 'active')
      ON CONFLICT(id) DO UPDATE SET role = 'academy_admin', email = 'admin@multi-e2e-a1.test'
    `).run();

    academy1Db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (802, 'Ken Coach', 'coach@multi-e2e-a1.test', 'hash', 'coach', 'active')
      ON CONFLICT(id) DO UPDATE SET role = 'coach', email = 'coach@multi-e2e-a1.test'
    `).run();

    academy1Db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (803, 'Finance Rahul', 'finance@multi-e2e-a1.test', 'hash', 'finance_manager', 'active')
      ON CONFLICT(id) DO UPDATE SET role = 'finance_manager', email = 'finance@multi-e2e-a1.test'
    `).run();

    academy1Db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (804, 'FrontDesk Maya', 'frontdesk@multi-e2e-a1.test', 'hash', 'front_desk', 'active')
      ON CONFLICT(id) DO UPDATE SET role = 'front_desk', email = 'frontdesk@multi-e2e-a1.test'
    `).run();

    // Provision test users in Academy 2
    academy2Db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (811, 'Phoenix Admin', 'admin@multi-e2e-a2.test', 'hash', 'academy_admin', 'active')
      ON CONFLICT(id) DO UPDATE SET role = 'academy_admin', email = 'admin@multi-e2e-a2.test'
    `).run();

    academy2Db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (812, 'Phoenix Coach', 'coach@multi-e2e-a2.test', 'hash', 'coach', 'active')
      ON CONFLICT(id) DO UPDATE SET role = 'coach', email = 'coach@multi-e2e-a2.test'
    `).run();

    // Fetch an existing student from Academy 1 for valid student self-service testing
    const firstStu = academy1Db.prepare('SELECT id, first_name, last_name, email FROM students LIMIT 1').get();
    const studentUid = firstStu ? firstStu.id : 1;

    // Sign Tokens
    superAdminToken = signToken({ userId: 1000, email: 'superadmin@iss.com', role: 'super_admin', isSuperAdmin: true, name: 'Global Super Admin' });
    a1AdminToken = signToken({ userId: 801, email: 'admin@multi-e2e-a1.test', role: 'academy_admin', academyId: 1, name: 'Anil Sensei' });
    a1CoachToken = signToken({ userId: 802, email: 'coach@multi-e2e-a1.test', role: 'coach', academyId: 1, name: 'Ken Coach' });
    a1FinanceToken = signToken({ userId: 803, email: 'finance@multi-e2e-a1.test', role: 'finance_manager', academyId: 1, name: 'Finance Rahul' });
    a1FrontDeskToken = signToken({ userId: 804, email: 'frontdesk@multi-e2e-a1.test', role: 'front_desk', academyId: 1, name: 'FrontDesk Maya' });
    a1StudentToken = signToken({ userId: studentUid, studentId: studentUid, email: firstStu ? firstStu.email : 'student@anilkarate.test', role: 'student', academyId: 1, name: firstStu ? `${firstStu.first_name} ${firstStu.last_name}` : 'Student Ryu' });

    a2AdminToken = signToken({ userId: 811, email: 'admin@multi-e2e-a2.test', role: 'academy_admin', academyId: 2, name: 'Phoenix Admin' });
    a2CoachToken = signToken({ userId: 812, email: 'coach@multi-e2e-a2.test', role: 'coach', academyId: 2, name: 'Phoenix Coach' });

    // Clean test data before running
    const cleanDb = (db) => {
      try {
        db.prepare("DELETE FROM student_technique_assignments WHERE student_id IN (SELECT id FROM students WHERE first_name LIKE 'MultiStu%')").run();
        db.prepare("DELETE FROM syllabus_techniques WHERE name LIKE 'MultiSport%'").run();
        db.prepare("DELETE FROM syllabus_categories WHERE name LIKE 'MultiSport%'").run();
        db.prepare("DELETE FROM sports WHERE name LIKE 'MultiSport%'").run();
        db.prepare("DELETE FROM branches WHERE name LIKE 'MultiBranch%'").run();
        db.prepare("DELETE FROM batches WHERE name LIKE 'MultiBatch%'").run();
        db.prepare("DELETE FROM students WHERE first_name LIKE 'MultiStu%'").run();
      } catch (e) {}
    };
    cleanDb(academy1Db);
    cleanDb(academy2Db);

    // Start ephemeral server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    // Clean up test records
    try {
      academy1Db.prepare("DELETE FROM users WHERE id IN (801, 802, 803, 804)").run();
      academy2Db.prepare("DELETE FROM users WHERE id IN (811, 812)").run();
      academy1Db.prepare("DELETE FROM student_technique_assignments WHERE student_id IN (SELECT id FROM students WHERE first_name LIKE 'MultiStu%')").run();
      academy1Db.prepare("DELETE FROM syllabus_techniques WHERE name LIKE 'MultiSport%'").run();
      academy1Db.prepare("DELETE FROM syllabus_categories WHERE name LIKE 'MultiSport%'").run();
      academy1Db.prepare("DELETE FROM sports WHERE name LIKE 'MultiSport%'").run();
      academy1Db.prepare("DELETE FROM branches WHERE name LIKE 'MultiBranch%'").run();
      academy1Db.prepare("DELETE FROM batches WHERE name LIKE 'MultiBatch%'").run();
      academy1Db.prepare("DELETE FROM students WHERE first_name LIKE 'MultiStu%'").run();
      academy2Db.prepare("DELETE FROM branches WHERE name LIKE 'MultiBranch%'").run();
      academy2Db.prepare("DELETE FROM batches WHERE name LIKE 'MultiBatch%'").run();
      academy2Db.prepare("DELETE FROM students WHERE first_name LIKE 'MultiStu%'").run();
    } catch (e) {}

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  const req = async (method, path, { token, academyId = 1, domain, body } = {}) => {
    const host = domain || (academyId === 2 ? 'phoenix-martial-arts.internationalsportssolutions.test' : 'anil-karate-academy.internationalsportssolutions.test');
    const headers = {
      Host: host,
      'x-forwarded-host': host,
      'x-academy-domain': host,
      'x-academy-id': String(academyId)
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

  describe('1. Central Super Admin Multi-Tenant Governance', () => {
    it('allows Super Admin to view academies and platform statistics', async () => {
      const res = await req('GET', '/api/central/academies', { token: superAdminToken, academyId: 1 });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.academies), 'Must return array of academies');
      const names = res.body.academies.map(a => a.name);
      assert.ok(names.includes('Pratik Karate Academy'));
      assert.ok(names.includes('Phoenix Martial Arts Academy'));
    });

    it('denies regular Academy Admin from accessing Central Super Admin endpoints', async () => {
      const res = await req('GET', '/api/central/academies', { token: a1AdminToken, academyId: 1 });
      assert.strictEqual(res.status, 403);
    });
  });

  describe('2. Multi-Academy Strict Data Isolation (Cross-Tenant Boundaries)', () => {
    let a1BranchId;
    let a2BranchId;

    it('creates isolated branches in Academy 1 and Academy 2', async () => {
      const res1 = await req('POST', '/api/academy/branches', {
        token: a1AdminToken,
        academyId: 1,
        body: { name: 'MultiBranch Dojo 1', city: 'Vadodara', phone: '9991110001' }
      });
      assert.strictEqual(res1.status, 201);
      a1BranchId = res1.body.branch.id;

      const res2 = await req('POST', '/api/academy/branches', {
        token: a2AdminToken,
        academyId: 2,
        body: { name: 'MultiBranch Phoenix West', city: 'Ahmedabad', phone: '9992220002' }
      });
      assert.strictEqual(res2.status, 201);
      a2BranchId = res2.body.branch.id;
    });

    it('Academy 1 listing does NOT include Academy 2 branch', async () => {
      const res = await req('GET', '/api/academy/branches', { token: a1AdminToken, academyId: 1 });
      assert.strictEqual(res.status, 200);
      const branchNames = res.body.branches.map(b => b.name);
      assert.ok(branchNames.includes('MultiBranch Dojo 1'), 'Must include Academy 1 branch');
      assert.ok(!branchNames.includes('MultiBranch Phoenix West'), 'Must NOT include Academy 2 branch');
    });

    it('blocks Academy 1 Admin from accessing Academy 2 domain (Cross-Tenant 403)', async () => {
      // a1AdminToken attempting to query Academy 2
      const res = await req('GET', '/api/academy/dashboard', {
        token: a1AdminToken,
        academyId: 2 // Targeted academy
      });
      assert.strictEqual(res.status, 403);
      assert.match(res.body.error, /Cross-tenant access forbidden/i);
    });

    it('blocks Academy 2 Admin from modifying Academy 1 branch', async () => {
      const res = await req('PUT', `/api/academy/branches/${a1BranchId}`, {
        token: a2AdminToken,
        academyId: 2,
        body: { name: 'Hacked Branch Name' }
      });
      // Branch does not exist in Academy 2 database
      assert.strictEqual(res.status, 404);
    });
  });

  describe('3. Role-Based Access Control Matrix (Positive & Negative Testing)', () => {
    it('Fee Records Access: Admin and Finance allowed, Coach strictly denied (403)', async () => {
      const adminFees = await req('GET', '/api/academy/fees', { token: a1AdminToken, academyId: 1 });
      assert.strictEqual(adminFees.status, 200);

      const financeFees = await req('GET', '/api/academy/fees', { token: a1FinanceToken, academyId: 1 });
      assert.strictEqual(financeFees.status, 200);

      const coachFees = await req('GET', '/api/academy/fees', { token: a1CoachToken, academyId: 1 });
      assert.strictEqual(coachFees.status, 403);
      assert.match(coachFees.body.error, /Permission to view fee records required|Access denied/i);
    });

    it('Attendance Marking: Front Desk denied (403)', async () => {
      const res = await req('POST', '/api/academy/attendance', {
        token: a1FrontDeskToken,
        academyId: 1,
        body: {
          batch_id: 1,
          date: new Date().toISOString().slice(0, 10),
          entries: [{ student_id: 1, status: 'present' }]
        }
      });
      assert.strictEqual(res.status, 403);
      assert.match(res.body.error, /Permission to mark attendance required/i);
    });

    it('Student Portal: Student denied access to staff dashboard (403)', async () => {
      const res = await req('GET', '/api/academy/dashboard', { token: a1StudentToken, academyId: 1 });
      assert.strictEqual(res.status, 403);
    });

    it('Student Portal: Student allowed access to own self-service portal', async () => {
      const res = await req('GET', '/api/student/dashboard', { token: a1StudentToken, academyId: 1 });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  describe('4. Full CRUD Workflow (Sports, Categories, Techniques, Batches, Students)', () => {
    let sportId;
    let catId;
    let techId;
    let studentId;

    it('Creates Sport, Category, and Technique in correct hierarchy', async () => {
      // 1. Sport
      const sportRes = await req('POST', '/api/academy/sports', {
        token: a1AdminToken,
        academyId: 1,
        body: { name: 'MultiSport Karate Shotokan', description: 'Shotokan Discipline' }
      });
      assert.strictEqual(sportRes.status, 201);
      sportId = sportRes.body.sport.id;

      // 2. Category
      const catRes = await req('POST', '/api/academy/syllabus-categories', {
        token: a1AdminToken,
        academyId: 1,
        body: { sport_id: sportId, name: 'MultiSport Kihon Basics', display_order: 1 }
      });
      assert.strictEqual(catRes.status, 201);
      catId = catRes.body.category.id;

      // 3. Technique
      const techRes = await req('POST', '/api/academy/syllabus-techniques', {
        token: a1AdminToken,
        academyId: 1,
        body: {
          sport_id: sportId,
          category_id: catId,
          name: 'MultiSport Oi-Zuki Punch',
          level: 1,
          belt_level: 'White Belt',
          display_order: 1
        }
      });
      assert.strictEqual(techRes.status, 201);
      techId = techRes.body.technique.id;
    });

    it('Enrolls a student with demographic details', async () => {
      const res = await req('POST', '/api/academy/students', {
        token: a1AdminToken,
        academyId: 1,
        body: {
          first_name: 'MultiStu Ken',
          last_name: 'Masters',
          dob: '2012-05-15',
          gender: 'male',
          phone: '9898000111',
          email: 'ken.masters@test.iss',
          address: 'Main Street Vadodara'
        }
      });
      assert.strictEqual(res.status, 201);
      studentId = res.body.studentId || (res.body.student && res.body.student.id);
      assert.ok(studentId);
    });

    it('Updates student profile and verifies changes', async () => {
      const res = await req('PUT', `/api/academy/students/${studentId}`, {
        token: a1AdminToken,
        academyId: 1,
        body: {
          phone: '9898000999',
          address: 'Updated Main Street Vadodara'
        }
      });
      assert.strictEqual(res.status, 200);

      const check = academy1Db.prepare('SELECT phone, address FROM students WHERE id = ?').get(studentId);
      assert.strictEqual(check.phone, '9898000999');
      assert.strictEqual(check.address, 'Updated Main Street Vadodara');
    });

    it('Safely deactivates / archives student on delete', async () => {
      const res = await req('DELETE', `/api/academy/students/${studentId}`, {
        token: a1AdminToken,
        academyId: 1
      });
      assert.strictEqual(res.status, 200);

      const student = academy1Db.prepare('SELECT status FROM students WHERE id = ?').get(studentId);
      assert.strictEqual(student.status, 'inactive');
    });
  });

  describe('5. Financial Invoicing, Partial Payments & Receipt Generation', () => {
    it('Creates fee structure, generates invoice, collects partial payment with accurate ledger balance', async () => {
      // Ensure student exists
      const student = academy1Db.prepare("SELECT id FROM students WHERE first_name LIKE 'MultiStu%' LIMIT 1").get();
      const sId = student ? student.id : 1;

      // 1. Generate fee invoice
      const invRes = academy1Db.prepare(`
        INSERT INTO student_fees (
          student_id, invoice_number, title, due_date,
          amount, discount_amount, net_amount, paid_amount, balance_amount, status
        ) VALUES (
          ?, 'INV-FIN-999', 'Multi-Month Term Fee', '2026-11-15',
          6000, 1000, 5000, 0, 5000, 'pending'
        )
      `).run(sId);
      const invoiceId = invRes.lastInsertRowid;

      // 2. Pay 2000 via finance manager
      const payRes = await req('POST', '/api/academy/fees/pay', {
        token: a1FinanceToken,
        academyId: 1,
        body: {
          student_fee_id: invoiceId,
          amount: 2000,
          payment_mode: 'upi',
          transaction_reference: 'UPI-FIN-999'
        }
      });
      assert.strictEqual(payRes.status, 200);
      assert.ok(payRes.body.receiptNumber, 'Must return receipt number');
      const receiptNo = payRes.body.receiptNumber;

      // 3. Verify invoice balance updated to 3000
      const invoice = academy1Db.prepare('SELECT net_amount, paid_amount, balance_amount, status FROM student_fees WHERE id = ?').get(invoiceId);
      assert.strictEqual(invoice.net_amount, 5000);
      assert.strictEqual(invoice.paid_amount, 2000);
      assert.strictEqual(invoice.balance_amount, 3000);
      assert.strictEqual(invoice.status, 'partial');

      // 4. Download / fetch printable receipt
      const receiptRes = await req('GET', `/api/academy/fees/receipt/${receiptNo}`, {
        token: a1FinanceToken,
        academyId: 1
      });
      assert.strictEqual(receiptRes.status, 200);
      assert.ok(receiptRes.body.receipt, 'Receipt record must be retrieved');
      assert.strictEqual(receiptRes.body.receipt.receipt_number, receiptNo);
    });
  });

  describe('6. Bulk CSV Import Validation & Roster Export', () => {
    it('rejects bulk import when rows contain invalid branch reference', async () => {
      const res = await req('POST', '/api/academy/students/import', {
        token: a1AdminToken,
        academyId: 1,
        body: {
          students: [
            {
              first_name: 'MultiStu BulkInvalid',
              last_name: 'Test',
              phone: '9876543210',
              gender: 'male',
              dob: '2011-01-01',
              branch_id: 888888 // Nonexistent
            }
          ]
        }
      });
      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /Row 1: Branch ID 888888 does not exist/i);
    });

    it('exports student roster in CSV format', async () => {
      const res = await req('GET', '/api/academy/students/export?format=csv', {
        token: a1AdminToken,
        academyId: 1
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('content-type').includes('text/csv') || typeof res.body === 'string');
    });
  });
});
