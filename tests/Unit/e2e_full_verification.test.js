import http from 'http';
import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import app from '../../server.js';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';

describe('Comprehensive End-to-End System Verification (CRUD, Import, Export, Print, Multi-Tenancy)', () => {
  let server;
  let baseUrl;

  const superAdminToken = signToken({
    userId: 999,
    email: 'superadmin@iss.com',
    role: 'super_admin',
    isSuperAdmin: true,
    name: 'Super Admin',
  });

  const academy1AdminToken = signToken({
    userId: 1,
    email: 'admin@mahaviracademy.com',
    role: 'academy_admin',
    academyId: 1,
    name: 'Mahavir Admin',
  });

  const academy2AdminToken = signToken({
    userId: 2,
    email: 'admin@sardar-martial-arts.com',
    role: 'academy_admin',
    academyId: 2,
    name: 'Sardar Admin',
  });

  before(async () => {
    process.env.NODE_ENV = 'test';
    try {
      const db = getTenantDbById(1);
      db.prepare("DELETE FROM branches WHERE name LIKE 'E2E%'").run();
      db.prepare("DELETE FROM batches WHERE name LIKE 'E2E%'").run();
      db.prepare("DELETE FROM coaches WHERE name LIKE 'Sensei Vikram%'").run();
      db.prepare("DELETE FROM students WHERE first_name IN ('Aditya', 'Karan', 'Ananya')").run();
      db.prepare("DELETE FROM events WHERE title LIKE 'State Karate Championship%'").run();
    } catch (e) {}

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      const db = getTenantDbById(1);
      db.prepare("DELETE FROM branches WHERE name LIKE 'E2E%'").run();
      db.prepare("DELETE FROM batches WHERE name LIKE 'E2E%'").run();
      db.prepare("DELETE FROM coaches WHERE name LIKE 'Sensei Vikram%'").run();
      db.prepare("DELETE FROM students WHERE first_name IN ('Aditya', 'Karan', 'Ananya')").run();
      db.prepare("DELETE FROM events WHERE title LIKE 'State Karate Championship%'").run();
    } catch (e) {}
  });

  async function api(path, { method = 'GET', body, token, academyId = 1 } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': String(academyId),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  let branchId, batchId, coachId, studentId, invoiceId, receiptNumber, eventId;

  // 1. Central Admin
  it('1. Central Admin can view platform metrics, academies, plans, and audit trail', async () => {
    const academiesRes = await api('/api/central/academies', { token: superAdminToken });
    assert.equal(academiesRes.status, 200);
    assert.ok(academiesRes.data.academies.length >= 2);

    const plansRes = await api('/api/central/plans', { token: superAdminToken });
    assert.equal(plansRes.status, 200);
    assert.ok(plansRes.data.plans.length >= 3);

    const statsRes = await api('/api/central/stats', { token: superAdminToken });
    assert.equal(statsRes.status, 200);
    assert.ok(statsRes.data.stats.totalAcademies >= 2);

    const auditRes = await api('/api/central/audit-logs', { token: superAdminToken });
    assert.equal(auditRes.status, 200);
  });

  // 2. Academy Operations CRUD
  it('2. Academy Admin can perform Branch and Coach CRUD', async () => {
    // Branch
    const createBranchRes = await api('/api/academy/branches', {
      method: 'POST',
      token: academy1AdminToken,
      body: { name: `E2E Dojo Satellite ${Date.now()}`, address: '42 Sports Avenue', contact_phone: '9876540001' },
    });
    assert.equal(createBranchRes.status, 201);
    branchId = createBranchRes.data.branch?.id || createBranchRes.data.branchId;

    // Coach
    const createCoachRes = await api('/api/academy/coaches', {
      method: 'POST',
      token: academy1AdminToken,
      body: {
        name: 'Sensei Vikram Malhotra',
        email: `vikram_${Date.now()}@mahavircoach.com`,
        phone: '9876540002',
        specializations: 'Shotokan Kata & Kumite',
        experience_years: 12,
        salary_type: 'monthly',
        salary_amount: 35000,
        branch_id: branchId,
      },
    });
    assert.equal(createCoachRes.status, 201);
    coachId = createCoachRes.data.coachId;

    // Batch
    const createBatchRes = await api('/api/academy/batches', {
      method: 'POST',
      token: academy1AdminToken,
      body: {
        name: `E2E Advanced Karate Batch ${Date.now()}`,
        branch_id: branchId,
        coach_id: coachId,
        start_time: '07:00',
        end_time: '08:30',
        days_of_week: ['Mon', 'Wed', 'Fri'],
        max_capacity: 25,
        monthly_fee: 2500,
      },
    });
    assert.equal(createBatchRes.status, 201);
    batchId = createBatchRes.data.batchId || createBatchRes.data.batch?.id;
  });

  it('3. Academy Admin can enroll individual student and perform bulk CSV/Excel import', async () => {
    // Single Enroll
    const createStudentRes = await api('/api/academy/students', {
      method: 'POST',
      token: academy1AdminToken,
      body: {
        first_name: 'Aditya',
        last_name: 'Deshmukh',
        email: `aditya_${Date.now()}@example.com`,
        phone: '9876540003',
        date_of_birth: '2010-06-15',
        gender: 'male',
        branch_id: branchId,
        batch_id: batchId,
      },
    });
    assert.equal(createStudentRes.status, 201);
    studentId = createStudentRes.data.studentId || createStudentRes.data.student?.id;

    // Bulk Import
    const importRes = await api('/api/academy/students/import', {
      method: 'POST',
      token: academy1AdminToken,
      body: {
        students: [
          {
            first_name: 'Karan',
            last_name: 'Mehta',
            email: `karan_${Date.now()}@example.com`,
            phone: '9876540004',
            date_of_birth: '2011-03-20',
            gender: 'male',
            branch_id: branchId,
            batch_id: batchId,
          },
          {
            first_name: 'Ananya',
            last_name: 'Iyer',
            email: `ananya_${Date.now()}@example.com`,
            phone: '9876540005',
            date_of_birth: '2012-07-11',
            gender: 'female',
            branch_id: branchId,
            batch_id: batchId,
          },
        ],
      },
    });
    assert.equal(importRes.status, 201);
    assert.equal(importRes.data.importedCount, 2);
  });

  it('4. Syllabus progression and idempotent attendance tracking work accurately', async () => {
    const categoriesRes = await api('/api/academy/syllabus-categories', { token: academy1AdminToken });
    assert.equal(categoriesRes.status, 200);
    const catId = categoriesRes.data.categories[0].id;

    const createTechRes = await api('/api/academy/syllabus-techniques', {
      method: 'POST',
      token: academy1AdminToken,
      body: {
        category_id: catId,
        name: `E2E Mawashi Geri ${Date.now()}`,
        level: 2,
        belt_level: 'Orange Belt',
      },
    });
    assert.equal(createTechRes.status, 201);
    const techId = createTechRes.data.technique.id;

    // Assign technique
    const assignTechRes = await api(`/api/academy/students/${studentId}/assign-technique`, {
      method: 'POST',
      token: academy1AdminToken,
      body: { technique_id: techId, action: 'initial' },
    });
    assert.equal(assignTechRes.status, 200);

    // Mark attendance
    const today = new Date().toISOString().split('T')[0];
    const markAttRes1 = await api('/api/academy/attendance', {
      method: 'POST',
      token: academy1AdminToken,
      body: {
        batch_id: batchId,
        date: today,
        entries: [
          { student_id: studentId, status: 'present', technique_id: techId, technique_status: 'keep' },
        ],
      },
    });
    assert.equal(markAttRes1.status, 200);

    // Idempotent resubmission
    const markAttRes2 = await api('/api/academy/attendance', {
      method: 'POST',
      token: academy1AdminToken,
      body: {
        batch_id: batchId,
        date: today,
        entries: [
          { student_id: studentId, status: 'present', technique_id: techId, technique_status: 'keep' },
        ],
      },
    });
    assert.equal(markAttRes2.status, 200);
  });

  it('5. Flexible fee calculation, collection, ledger, and printable receipt', async () => {
    const calcRes = await api(`/api/academy/fees/calculate?student_id=${studentId}&months_count=2&discount_type=percentage&discount_value=10`, {
      token: academy1AdminToken,
    });
    assert.equal(calcRes.status, 200);
    assert.ok(calcRes.data.calculation.payableAmount > 0);

    // Collect fee
    const collectRes = await api('/api/academy/fees/collect', {
      method: 'POST',
      token: academy1AdminToken,
      body: {
        student_id: studentId,
        months_count: 2,
        discount_type: 'percentage',
        discount_value: 10,
        amount_paid: calcRes.data.calculation.payableAmount,
        payment_mode: 'upi',
        transaction_reference: 'UPI-E2E-TEST-001',
      },
    });
    assert.equal(collectRes.status, 201);
    invoiceId = collectRes.data.feeId;
    receiptNumber = collectRes.data.receiptNumber;

    // Printable receipt API
    const receiptRes = await api(`/api/academy/fees/receipt/${receiptNumber}`, { token: academy1AdminToken });
    assert.equal(receiptRes.status, 200);
    assert.equal(receiptRes.data.receipt.receipt_number, receiptNumber);

    // Ledger
    const ledgerRes = await api(`/api/academy/fees/ledger/${studentId}`, { token: academy1AdminToken });
    assert.equal(ledgerRes.status, 200);
    assert.ok(ledgerRes.data.ledger.length >= 2);
  });

  it('6. Event lifecycle and CSV roster stream export', async () => {
    const createEventRes = await api('/api/academy/events', {
      method: 'POST',
      token: academy1AdminToken,
      body: {
        title: 'State Karate Championship 2026',
        event_date: '2026-11-20',
        event_time: '09:00',
        event_type: 'tournament',
        venue: 'Indira Gandhi Indoor Stadium, Ring 1',
        description: 'Annual championship and belt advancement showcase',
        rsvp_deadline: '2026-11-15',
        capacity: 100,
        eligible_category: 'all',
      },
    });
    assert.equal(createEventRes.status, 201);
    eventId = createEventRes.data.eventId || createEventRes.data.event?.id;

    // Publish
    const publishRes = await api(`/api/academy/events/${eventId}/publish`, {
      method: 'POST',
      token: academy1AdminToken,
    });
    assert.equal(publishRes.status, 200);

    // Export CSV
    const exportEventRes = await fetch(`${baseUrl}/api/academy/events/${eventId}/export`, {
      headers: { 'Authorization': `Bearer ${academy1AdminToken}`, 'X-Tenant-Id': '1' },
    });
    assert.equal(exportEventRes.status, 200);
    const csvData = await exportEventRes.text();
    assert.ok(csvData.includes('Student Code') || csvData.includes('Student Name'));
  });

  it('7. Multi-Tenant isolation prevents cross-tenant access between Academy 1 and Academy 2', async () => {
    const crossBranchRes = await api(`/api/academy/batches?branch_id=${branchId}`, {
      token: academy2AdminToken,
      academyId: 2,
    });
    assert.equal(crossBranchRes.data.batches.length, 0);

    const crossEventRes = await api(`/api/academy/events/${eventId}`, {
      token: academy2AdminToken,
      academyId: 2,
    });
    assert.equal(crossEventRes.status, 404);
  });

  it('8. Student portal self-service endpoints work accurately', async () => {
    const studentToken = signToken({
      userId: studentId,
      studentId: studentId,
      email: 'aditya.student@example.com',
      role: 'student',
      academyId: 1,
      name: 'Aditya Deshmukh',
    });

    const dashRes = await api('/api/student/dashboard', { token: studentToken });
    assert.equal(dashRes.status, 200);

    const techRes = await api('/api/student/technique-history', { token: studentToken });
    assert.equal(techRes.status, 200);

    const attRes = await api('/api/student/attendance', { token: studentToken });
    assert.equal(attRes.status, 200);
    assert.ok(attRes.data.records.length >= 1);

    const feesRes = await api('/api/student/fees', { token: studentToken });
    assert.equal(feesRes.status, 200);
    assert.ok(feesRes.data.invoices.length >= 1);

    const eventsRes = await api('/api/student/events', { token: studentToken });
    assert.equal(eventsRes.status, 200);
  });
});
