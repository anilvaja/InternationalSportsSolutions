import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import { FeeService } from '../../src/services/feeService.js';
import app from '../../server.js';
import http from 'node:http';

describe('Student Fee Lifecycle, Financial Ledger & Flexible Periods', () => {
  let server;
  let baseUrl;
  let tenantDb;
  let adminToken;
  let coachToken;
  let testStudentId;
  let testBranchId;
  let testBatchId;
  let batchDefaultFee;

  const ACADEMY_ID = 1;

  before(async () => {
    try {
      process.env.NODE_ENV = 'test';
      tenantDb = getTenantDbById(ACADEMY_ID);

    // Setup Branch and Batch if not present
    let branch = tenantDb.prepare('SELECT id FROM branches LIMIT 1').get();
    if (!branch) {
      const res = tenantDb.prepare(`
        INSERT INTO branches (name, code, address, is_active, created_at, updated_at)
        VALUES ('Test Dojo Branch', 'TDB', '123 Dojo Street', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();
      branch = { id: res.lastInsertRowid };
    }
    testBranchId = branch.id;

    let batch = tenantDb.prepare('SELECT id, monthly_fee FROM batches WHERE branch_id = ? LIMIT 1').get(testBranchId);
    if (!batch) {
      const res = tenantDb.prepare(`
        INSERT INTO batches (branch_id, name, monthly_fee, max_capacity, start_time, end_time, is_active, created_at)
        VALUES (?, 'Karate Cadets', 1500, 30, '06:00', '07:30', 1, CURRENT_TIMESTAMP)
      `).run(testBranchId);
      batch = { id: res.lastInsertRowid, monthly_fee: 1500 };
    }
    testBatchId = batch.id;
    batchDefaultFee = batch.monthly_fee;

    // Create a dedicated test student with joining date '2026-08-10'
    const studentRes = tenantDb.prepare(`
      INSERT INTO students (
        student_code, first_name, last_name, email, phone, date_of_birth,
        gender, enrolled_at, branch_id, academy_id, status, created_at, updated_at
      ) VALUES (
        'STU-FEE-TEST-' || hex(randomblob(4)), 'Aarav', 'Patel',
        'aarav.fee.test.' || hex(randomblob(4)) || '@example.com', '9876543210', '2012-05-15',
        'male', '2026-08-10', ?, 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(testBranchId);
    testStudentId = studentRes.lastInsertRowid;

    // Enroll in batch
    tenantDb.prepare(`
      INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status, created_at, updated_at)
      VALUES (?, ?, '2026-08-10', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(testStudentId, testBatchId);

    // Auth Tokens
    adminToken = signToken({
      userId: 1,
      email: 'admin.fee.test@sports.com',
      role: 'academy_admin',
      academyId: ACADEMY_ID,
      name: 'Fee Admin',
      branchId: testBranchId,
    });

    coachToken = signToken({
      userId: 99,
      email: 'coach.fee.test@sports.com',
      role: 'coach',
      academyId: ACADEMY_ID,
      name: 'Head Coach Test',
      branchId: testBranchId,
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    } catch (err) {
      console.error('BEFORE HOOK ERROR:', err);
      throw err;
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function api(path, { method = 'GET', body, token = adminToken } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Academy-Id': String(ACADEMY_ID),
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
    return { status: res.status, data };
  }

  // =========================================================================
  // 1. CALENDAR DATE & PERIOD CALCULATION LOGIC
  // =========================================================================
  describe('Calendar Date Calculation & Clamping', () => {
    it('calculates 1-month period starting 10 Aug: ends 09 Sep, next installment 10 Sep', () => {
      const dates = FeeService.addCalendarMonths('2026-08-10', 1);
      assert.equal(dates.periodStart, '2026-08-10');
      assert.equal(dates.periodEnd, '2026-09-09');
      assert.equal(dates.nextInstallmentDate, '2026-09-10');
    });

    it('calculates 3-month period starting 10 Aug: ends 09 Nov, next installment 10 Nov', () => {
      const dates = FeeService.addCalendarMonths('2026-08-10', 3);
      assert.equal(dates.periodStart, '2026-08-10');
      assert.equal(dates.periodEnd, '2026-11-09');
      assert.equal(dates.nextInstallmentDate, '2026-11-10');
    });

    it('handles month-end clamping (Jan 31 + 1 month in non-leap year 2027 ends Feb 27, next installment Feb 28)', () => {
      const dates = FeeService.addCalendarMonths('2027-01-31', 1);
      assert.equal(dates.periodStart, '2027-01-31');
      assert.equal(dates.nextInstallmentDate, '2027-02-28');
      assert.equal(dates.periodEnd, '2027-02-27');
    });

    it('handles February in a leap year (Jan 31 + 1 month in 2028 ends Feb 28, next installment Feb 29)', () => {
      const dates = FeeService.addCalendarMonths('2028-01-31', 1);
      assert.equal(dates.periodStart, '2028-01-31');
      assert.equal(dates.nextInstallmentDate, '2028-02-29');
      assert.equal(dates.periodEnd, '2028-02-28');
    });

    it('handles August 31 + 1 month (September has 30 days: ends Sep 29, next installment Sep 30)', () => {
      const dates = FeeService.addCalendarMonths('2026-08-31', 1);
      assert.equal(dates.periodStart, '2026-08-31');
      assert.equal(dates.nextInstallmentDate, '2026-09-30');
      assert.equal(dates.periodEnd, '2026-09-29');
    });
  });

  // =========================================================================
  // 2. STUDENT-SPECIFIC FEE OVERRIDES
  // =========================================================================
  describe('Student-Specific Fee Overrides', () => {
    it('uses batch default fee when no override is set', () => {
      const feeInfo = FeeService.getStudentMonthlyFee(tenantDb, testStudentId, '2026-08-10');
      assert.equal(feeInfo.monthlyFee, batchDefaultFee);
      assert.equal(feeInfo.source, 'batch');
    });

    it('overrides batch default fee when a student override is created', () => {
      const overrideRes = FeeService.setStudentOverride(tenantDb, {
        student_id: testStudentId,
        custom_monthly_fee: 1200,
        reason: 'Sibling concession approved',
        effective_from: '2026-08-01',
        created_by: 1,
      });

      assert.equal(overrideRes.success, true);
      assert.equal(overrideRes.override.custom_monthly_fee, 1200);

      const feeInfo = FeeService.getStudentMonthlyFee(tenantDb, testStudentId, '2026-08-10');
      assert.equal(feeInfo.monthlyFee, 1200);
      assert.equal(feeInfo.source, 'student_override');
    });

    it('supports API POST /api/academy/fees/override to update custom fee', async () => {
      const res = await api('/api/academy/fees/override', {
        method: 'POST',
        body: {
          student_id: testStudentId,
          custom_monthly_fee: 1400,
          reason: 'Adjusted scholarship rate',
          effective_from: '2026-08-01',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.override.custom_monthly_fee, 1400);

      const feeInfo = FeeService.getStudentMonthlyFee(tenantDb, testStudentId, '2026-08-10');
      assert.equal(feeInfo.monthlyFee, 1400);
    });
  });

  // =========================================================================
  // 3. STRICT 20% DISCOUNT CEILING & CALCULATION MATH
  // =========================================================================
  describe('Discount Rules & 20% Maximum Cap Enforcement', () => {
    it('calculates valid percentage discount within 20% limit', () => {
      const calc = FeeService.calculateDiscount({
        baseFee: 1400,
        monthsCount: 1,
        discountType: 'percentage',
        discountValue: 10,
        db: tenantDb,
      });

      assert.equal(calc.baseFee, 1400);
      assert.equal(calc.totalDiscountAmount, 140);
      assert.equal(calc.maxAllowedDiscount, 280); // 20% of 1400
      assert.equal(calc.payableAmount, 1260);
    });

    it('calculates valid fixed amount discount within 20% limit', () => {
      const calc = FeeService.calculateDiscount({
        baseFee: 1400,
        monthsCount: 1,
        discountType: 'fixed',
        discountValue: 200,
        db: tenantDb,
      });

      assert.equal(calc.totalDiscountAmount, 200);
      assert.equal(calc.payableAmount, 1200);
    });

    it('rejects percentage discount greater than 20%', () => {
      assert.throws(() => {
        FeeService.calculateDiscount({
          baseFee: 1400,
          monthsCount: 1,
          discountType: 'percentage',
          discountValue: 25,
          db: tenantDb,
        });
      }, /exceeds the maximum permitted ceiling of 20%/);
    });

    it('rejects fixed discount greater than 20% of base fee', () => {
      assert.throws(() => {
        FeeService.calculateDiscount({
          baseFee: 1400,
          monthsCount: 1,
          discountType: 'fixed',
          discountValue: 350, // > 280 (20% of 1400)
          db: tenantDb,
        });
      }, /exceeds the maximum permitted ceiling of 20%/);
    });

    it('rejects negative discount amounts', () => {
      assert.throws(() => {
        FeeService.calculateDiscount({
          baseFee: 1400,
          monthsCount: 1,
          discountType: 'percentage',
          discountValue: -5,
          db: tenantDb,
        });
      }, /Discount percentage must be non-negative/);
    });

    it('applies multi-month preset discount (e.g. 3 months: 5%)', () => {
      const calc = FeeService.calculateDiscount({
        baseFee: 4200, // 3 * 1400
        monthsCount: 3,
        discountType: 'none',
        discountValue: 0,
        db: tenantDb,
      });

      assert.equal(calc.presetPercentage, 5);
      assert.equal(calc.totalDiscountAmount, 210); // 5% of 4200
      assert.equal(calc.payableAmount, 3990);
    });
  });

  // =========================================================================
  // 4. API PREVIEW CALCULATION (GET /api/academy/fees/calculate)
  // =========================================================================
  describe('API Fee Calculation Preview', () => {
    it('returns exact dates and payable preview for 1 month with 10% discount', async () => {
      const res = await api(
        `/api/academy/fees/calculate?student_id=${testStudentId}&months_count=1&start_date=2026-08-10&discount_type=percentage&discount_value=10`
      );

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      const c = res.data.calculation;
      assert.equal(c.periodStart, '2026-08-10');
      assert.equal(c.periodEnd, '2026-09-09');
      assert.equal(c.nextInstallmentDate, '2026-09-10');
      assert.equal(c.baseFee, 1400);
      assert.equal(c.totalDiscountAmount, 140);
      assert.equal(c.payableAmount, 1260);
      assert.equal(c.maxAllowedDiscount, 280);
    });

    it('returns HTTP 400 when preview discount exceeds 20%', async () => {
      const res = await api(
        `/api/academy/fees/calculate?student_id=${testStudentId}&months_count=1&start_date=2026-08-10&discount_type=percentage&discount_value=25`
      );

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      assert.match(res.data.error, /exceeds the maximum permitted ceiling of 20%/);
    });
  });

  // =========================================================================
  // 5. ATOMIC FEE COLLECTION & CHRONOLOGICAL AUDIT LEDGER
  // =========================================================================
  describe('Fee Collection, Invoicing & Chronological Ledger', () => {
    let collectedInvoiceNumber;
    let collectedReceiptNumber;

    it('collects fee atomically, creates invoice, payment, and writes chronological ledger', async () => {
      const res = await api('/api/academy/fees/collect', {
        method: 'POST',
        body: {
          student_id: testStudentId,
          months_count: 1,
          start_date: '2026-08-10',
          payment_amount: 1260,
          payment_mode: 'upi',
          transaction_reference: 'UPI/20260810/TEST99',
          discount_type: 'percentage',
          discount_value: 10,
          discount_reason: 'New session promotion',
          notes: 'Paid via PhonePe',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.periodStart, '2026-08-10');
      assert.equal(res.data.periodEnd, '2026-09-09');
      assert.equal(res.data.nextInstallmentDate, '2026-09-10');
      assert.equal(res.data.netPayable, 1260);
      assert.equal(res.data.remainingBalance, 0);

      collectedInvoiceNumber = res.data.invoiceNumber;
      collectedReceiptNumber = res.data.receiptNumber;
      assert.ok(collectedInvoiceNumber);
      assert.ok(collectedReceiptNumber);

      // Verify Student Fee Ledger has chronological entries
      const ledgerRes = await api(`/api/academy/fees/ledger/${testStudentId}`);
      assert.equal(ledgerRes.status, 200);
      assert.equal(ledgerRes.data.success, true);
      const ledger = ledgerRes.data.ledger;

      assert.ok(ledger.length >= 2);
      const chargeEntry = ledger.find((l) => l.entry_type === 'charge' && l.period_start === '2026-08-10');
      const paymentEntry = ledger.find((l) => l.entry_type === 'payment');

      assert.ok(chargeEntry);
      assert.equal(chargeEntry.debit, 1400);
      assert.equal(chargeEntry.period_start, '2026-08-10');
      assert.equal(chargeEntry.period_end, '2026-09-09');

      assert.ok(paymentEntry);
      assert.equal(paymentEntry.credit, 1260);
      assert.equal(paymentEntry.receipt_number, collectedReceiptNumber);

      // Timeline has advanced
      const timeline = ledgerRes.data.timeline;
      assert.equal(timeline.paidThroughDate, '2026-09-09');
      assert.equal(timeline.nextStartDate, '2026-09-10');
      assert.equal(timeline.unpaidBalance, 0);
    });

    it('supports printable receipt API GET /api/academy/fees/receipt/:receiptNumber', async () => {
      const res = await api(`/api/academy/fees/receipt/${collectedReceiptNumber}`);
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.receipt.receipt_number, collectedReceiptNumber);
      assert.equal(res.data.receipt.student_code, tenantDb.prepare('SELECT student_code FROM students WHERE id = ?').get(testStudentId).student_code);
      assert.equal(res.data.receipt.period_start, '2026-08-10');
      assert.equal(res.data.receipt.period_end, '2026-09-09');
    });

    it('collects subsequent multi-month fee starting from the previous paid-through date', async () => {
      // Collect for 2 months starting 2026-09-10 (the next installment date)
      const res = await api('/api/academy/fees/collect', {
        method: 'POST',
        body: {
          student_id: testStudentId,
          months_count: 2,
          // start_date omitted to test automatic derivation from timeline
          payment_amount: 2800, // 2 * 1400
          payment_mode: 'cash',
          discount_type: 'none',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.periodStart, '2026-09-10');
      assert.equal(res.data.periodEnd, '2026-11-09');
      assert.equal(res.data.nextInstallmentDate, '2026-11-10');

      // Timeline updated
      const timeline = FeeService.getStudentFeeTimeline(tenantDb, testStudentId);
      assert.equal(timeline.paidThroughDate, '2026-11-09');
      assert.equal(timeline.nextStartDate, '2026-11-10');
    });
  });

  // =========================================================================
  // 6. APPROVAL-CONTROLLED FEE PAUSES & MEMBERSHIP HOLDS
  // =========================================================================
  describe('Fee Pause Workflow & Branch Scoping', () => {
    let pauseId;

    it('submits a fee pause request in pending status', async () => {
      const res = await api('/api/academy/fees/pauses', {
        method: 'POST',
        body: {
          student_id: testStudentId,
          pause_type: 'fee_pause',
          requested_start_date: '2026-11-10',
          requested_end_date: '2026-11-24', // 15 days
          reason: 'Final school exams',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      pauseId = res.data.pause.id;
      assert.ok(pauseId);
      assert.equal(res.data.pause.status, 'pending');

      // Pending pause does not shift the active timeline
      const timeline = FeeService.getStudentFeeTimeline(tenantDb, testStudentId);
      assert.equal(timeline.nextStartDate, '2026-11-10');
    });

    it('enforces branch scoping: coach cannot approve pause for student in another branch', async () => {
      // Create another branch and another coach
      const otherBranchRes = tenantDb.prepare(`
        INSERT INTO branches (name, address, is_active, created_at)
        VALUES ('North City Dojo', '100 North Rd', 1, CURRENT_TIMESTAMP)
      `).run();
      const otherBranchId = otherBranchRes.lastInsertRowid;

      const otherCoachToken = signToken({
        userId: 105,
        email: 'other.coach@sports.com',
        role: 'coach',
        academyId: ACADEMY_ID,
        name: 'Other Branch Coach',
        branchId: otherBranchId,
      });

      const res = await api(`/api/academy/fees/pauses/${pauseId}/review`, {
        method: 'PUT',
        token: otherCoachToken,
        body: {
          decision: 'approved',
          approved_start_date: '2026-11-10',
          approved_end_date: '2026-11-24',
          approval_notes: 'Unauthorized attempt',
        },
      });

      assert.equal(res.status, 400);
      assert.match(res.data.error, /Branch Head Coaches may only approve fee pauses within their assigned branch/);
    });

    it('approving pause shifts the next installment date by approved pause window', async () => {
      const res = await api(`/api/academy/fees/pauses/${pauseId}/review`, {
        method: 'PUT',
        token: adminToken,
        body: {
          decision: 'approved',
          approved_start_date: '2026-11-10',
          approved_end_date: '2026-11-24',
          approval_notes: 'Approved with exam datesheet verified',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.pause.status, 'approved');

      // Next installment start date has shifted from 2026-11-10 to 2026-11-25
      const timeline = FeeService.getStudentFeeTimeline(tenantDb, testStudentId);
      assert.equal(timeline.nextStartDate, '2026-11-25');

      // Verify shift was audited in the chronological fee ledger
      const ledgerEntry = tenantDb.prepare(`
        SELECT * FROM student_fee_ledger
        WHERE student_id = ? AND entry_type IN ('pause_adjustment', 'pause_shift')
      `).get(testStudentId);

      assert.ok(ledgerEntry);
      assert.equal(ledgerEntry.period_start, '2026-11-10');
      assert.equal(ledgerEntry.period_end, '2026-11-24');
    });
  });

  // =========================================================================
  // 7. PARTIAL PAYMENTS & OUTSTANDING BALANCE TRACKING
  // =========================================================================
  describe('Partial Payments & Overdue Tracking', () => {
    it('records partial payment and maintains unpaid balance on invoice and ledger', async () => {
      // Collect 1 month starting 2026-11-25 (monthly fee 1400)
      // Pay only 600 now, leaving 800 balance
      const res = await api('/api/academy/fees/collect', {
        method: 'POST',
        body: {
          student_id: testStudentId,
          months_count: 1,
          start_date: '2026-11-25',
          payment_amount: 600,
          payment_mode: 'cash',
          discount_type: 'none',
          notes: 'Partial payment received',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.netPayable, 1400);
      assert.equal(res.data.paidAmount, 600);
      assert.equal(res.data.remainingBalance, 800);

      // Verify invoice status is 'partial'
      const inv = tenantDb.prepare('SELECT * FROM student_fees WHERE invoice_number = ?').get(res.data.invoiceNumber);
      assert.equal(inv.status, 'partial');
      assert.equal(inv.balance_amount, 800);

      // Subsequent payment clears the remaining 800 balance
      const payRes = await api('/api/academy/fees/pay', {
        method: 'POST',
        body: {
          student_fee_id: inv.id,
          amount: 800,
          payment_mode: 'upi',
          transaction_reference: 'UPI/BAL/CLEAR',
        },
      });

      assert.equal(payRes.status, 200);
      assert.equal(payRes.data.success, true);
      assert.equal(payRes.data.remainingBalance, 0);

      const updatedInv = tenantDb.prepare('SELECT * FROM student_fees WHERE id = ?').get(inv.id);
      assert.equal(updatedInv.status, 'paid');
      assert.equal(updatedInv.balance_amount, 0);
    });
  });

  // =========================================================================
  // 8. DASHBOARD ANALYTICS & AGEING BUCKETS
  // =========================================================================
  describe('Dashboard Analytics & Receivables Ageing', () => {
    it('aggregates metrics, ageing buckets and payment methods accurately', async () => {
      const res = await api('/api/academy/fees/dashboard');

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      const a = res.data.analytics;

      assert.ok(typeof a.thisMonthCollections === 'number');
      assert.ok(typeof a.allTimeCollections === 'number');
      assert.ok(a.allTimeCollections > 0);
      assert.ok(Array.isArray(a.methodsBreakdown));
      assert.ok(a.ageingBuckets);
      assert.ok('1-7 Days' in a.ageingBuckets);
      assert.ok('8-30 Days' in a.ageingBuckets);
      assert.ok('31-60 Days' in a.ageingBuckets);
      assert.ok('>60 Days' in a.ageingBuckets);
    });
  });
});
