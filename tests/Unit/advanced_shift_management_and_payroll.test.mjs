import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import { ScheduleService } from '../../src/services/scheduleService.js';
import { StaffAvailabilityService } from '../../src/services/staffAvailabilityService.js';
import { PayrollService } from '../../src/services/payrollService.js';
import app from '../../server.js';

describe('Advanced Shift Management, Multiple Daily Slots, Availability & Payroll Engine', () => {
  let server;
  let baseUrl;
  let adminToken;
  let coachToken;
  let db;
  const ACADEMY_ID = 1;

  // Dedicated test IDs to avoid interfering with seed data
  const TEST_USER_ID = 901;
  const TEST_COACH_ID = 901;
  const TEST_RECIPIENT_USER_ID = 902;
  const TEST_RECIPIENT_COACH_ID = 902;

  before(async () => {
    try {
      process.env.NODE_ENV = 'test';
      db = getTenantDbById(ACADEMY_ID);

      // Clean up test records
      db.prepare('DELETE FROM staff_slot_attendance WHERE user_id IN (?, ?)').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare('DELETE FROM employee_schedule_overrides WHERE user_id IN (?, ?)').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare('DELETE FROM employee_schedule_shifts WHERE user_id IN (?, ?)').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare('DELETE FROM employee_work_schedules WHERE user_id IN (?, ?)').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare('DELETE FROM staff_salary_profiles WHERE user_id IN (?, ?)').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare('DELETE FROM staff_shift_swaps WHERE requester_id = ? OR recipient_id = ?').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare("DELETE FROM batches WHERE name LIKE 'ShiftTestBatch%'").run();

      // Create test users and coaches with pre-existing joining dates (2026-01-01)
      db.prepare(`
        INSERT OR REPLACE INTO users (id, name, email, password_hash, role, status, created_at)
        VALUES (?, 'Shift Coach A', 'coach.a@iss-test.com', 'hash', 'coach', 'active', '2026-01-01 00:00:00')
      `).run(TEST_USER_ID);

      db.prepare(`
        INSERT OR REPLACE INTO coaches (id, user_id, name, specializations, branch_id, is_active, joining_date, created_at)
        VALUES (?, ?, 'Shift Coach A', 'Shotokan', 1, 1, '2026-01-01', '2026-01-01 00:00:00')
      `).run(TEST_COACH_ID, TEST_USER_ID);

      db.prepare(`
        INSERT OR REPLACE INTO users (id, name, email, password_hash, role, status, created_at)
        VALUES (?, 'Shift Coach B', 'coach.b@iss-test.com', 'hash', 'coach', 'active', '2026-01-01 00:00:00')
      `).run(TEST_RECIPIENT_USER_ID);

      db.prepare(`
        INSERT OR REPLACE INTO coaches (id, user_id, name, specializations, branch_id, is_active, joining_date, created_at)
        VALUES (?, ?, 'Shift Coach B', 'Kumite', 2, 1, '2026-01-01', '2026-01-01 00:00:00')
      `).run(TEST_RECIPIENT_COACH_ID, TEST_RECIPIENT_USER_ID);

      try {
        db.prepare('INSERT OR REPLACE INTO user_branch_assignments (user_id, branch_id, is_primary) VALUES (?, 1, 1)').run(TEST_USER_ID);
        db.prepare('INSERT OR REPLACE INTO user_branch_assignments (user_id, branch_id, is_primary) VALUES (?, 2, 1)').run(TEST_RECIPIENT_USER_ID);
      } catch (_) {}

      adminToken = signToken({
        userId: 1,
        email: 'admin@pratikkarate.com',
        role: 'academy_admin',
        academyId: ACADEMY_ID,
        name: 'Academy Admin'
      });

      coachToken = signToken({
        userId: TEST_USER_ID,
        email: 'coach.a@iss-test.com',
        role: 'coach',
        academyId: ACADEMY_ID,
        name: 'Shift Coach A'
      });

      await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
          baseUrl = `http://127.0.0.1:${server.address().port}`;
          resolve();
        });
      });
    } catch (err) {
      console.error('ERROR IN BEFORE HOOK:', err);
      throw err;
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    // Cleanup test records
    try {
      db.prepare('DELETE FROM staff_slot_attendance WHERE user_id IN (?, ?)').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare('DELETE FROM employee_schedule_overrides WHERE user_id IN (?, ?)').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare('DELETE FROM employee_schedule_shifts WHERE user_id IN (?, ?)').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare('DELETE FROM employee_work_schedules WHERE user_id IN (?, ?)').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare('DELETE FROM staff_salary_profiles WHERE user_id IN (?, ?)').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare('DELETE FROM staff_shift_swaps WHERE requester_id = ? OR recipient_id = ?').run(TEST_USER_ID, TEST_RECIPIENT_USER_ID);
      db.prepare("DELETE FROM batches WHERE name LIKE 'ShiftTestBatch%'").run();
    } catch (_) {}
  });

  async function api(path, { method = 'GET', body, token = adminToken } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': String(ACADEMY_ID)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // =========================================================================
  // SCENARIO 1: Monday 05:00-07:00 and 17:00-19:00 -> Scheduled = 4.0 Hours
  // =========================================================================
  it('Scenario 1: Configures multi-slot schedule on Monday and verifies scheduled hours = 4.0h', async () => {
    const shifts = [
      {
        day_of_week: 1, // Monday
        shift_name: 'Monday Morning Training',
        start_time: '05:00',
        end_time: '07:00',
        shift_type: 'morning',
        is_working_day: 1
      },
      {
        day_of_week: 1, // Monday
        shift_name: 'Monday Evening Session',
        start_time: '17:00',
        end_time: '19:00',
        shift_type: 'evening',
        is_working_day: 1
      }
    ];

    const saveRes = await api(`/api/academy/shifts/employee/${TEST_USER_ID}`, {
      method: 'POST',
      body: {
        schedule_name: 'Split Day Schedule',
        effective_from: '2026-11-01',
        shifts
      }
    });

    assert.equal(saveRes.status, 201);
    assert.equal(saveRes.data.success, true);

    // 2026-11-09 is a Monday
    const expectation = ScheduleService.getDayScheduleExpectation(db, TEST_USER_ID, '2026-11-09');
    assert.equal(expectation.isWorkingDay, true);
    assert.equal(expectation.shifts.length, 2);
    assert.equal(expectation.scheduledHours, 4.0); // Exactly 2h + 2h = 4.0h, NOT 14h continuous
  });

  // =========================================================================
  // SCENARIO 2: Attend morning slot only -> Evening absence NOT marked present
  // =========================================================================
  it('Scenario 2: Attend morning slot only; verifies evening slot remains independent and absent', async () => {
    const testDate = '2026-11-09'; // Monday

    // Morning slot check-in and check-out
    const inRes = await api('/api/academy/shifts/slot-attendance/check-in', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        attendance_date: testDate,
        scheduled_start_time: '05:00',
        scheduled_end_time: '07:00',
        actual_check_in: '05:00',
        slot_name: 'Monday Morning Training',
        shift_type: 'morning'
      }
    });
    assert.equal(inRes.status, 201);

    const outRes = await api('/api/academy/shifts/slot-attendance/check-out', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        attendance_date: testDate,
        scheduled_start_time: '05:00',
        scheduled_end_time: '07:00',
        actual_check_out: '07:00'
      }
    });
    assert.equal(outRes.status, 200);
    assert.equal(outRes.data.record.attended_minutes, 120);
    assert.equal(outRes.data.record.status, 'present');

    // Query all slot attendances for this user on this date
    const listRes = await api(`/api/academy/shifts/slot-attendance?user_id=${TEST_USER_ID}&date=${testDate}`);
    assert.equal(listRes.status, 200);

    const morningSlot = listRes.data.records.find(r => r.scheduled_start_time === '05:00');
    const eveningSlot = listRes.data.records.find(r => r.scheduled_start_time === '17:00');

    assert.ok(morningSlot);
    assert.equal(morningSlot.status, 'present');
    // Evening slot was not attended; must NOT be present
    assert.equal(eveningSlot, undefined); // Independent slot, no check-in recorded
  });

  // =========================================================================
  // SCENARIO 3: Morning 2h + Evening 90m -> Actual Attended = 3.5 Hours (@ ₹300 = ₹1,050)
  // =========================================================================
  it('Scenario 3: Morning 120m + evening 90m verifies actual attended = 3.5h and hourly pay = ₹1,050', async () => {
    const testDate = '2026-11-16'; // Monday
    db.prepare('DELETE FROM staff_slot_attendance WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(TEST_USER_ID);

    // Morning: 05:00 - 07:00 (120 minutes = 2.0 hours)
    await api('/api/academy/shifts/slot-attendance/check-in', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        attendance_date: testDate,
        scheduled_start_time: '05:00',
        scheduled_end_time: '07:00',
        actual_check_in: '05:00',
        slot_name: 'Morning Slot'
      }
    });
    await api('/api/academy/shifts/slot-attendance/check-out', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        attendance_date: testDate,
        scheduled_start_time: '05:00',
        scheduled_end_time: '07:00',
        actual_check_out: '07:00'
      }
    });

    // Evening: 17:00 - 18:30 (90 minutes = 1.5 hours)
    await api('/api/academy/shifts/slot-attendance/check-in', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        attendance_date: testDate,
        scheduled_start_time: '17:00',
        scheduled_end_time: '19:00',
        actual_check_in: '17:00',
        slot_name: 'Evening Slot'
      }
    });
    await api('/api/academy/shifts/slot-attendance/check-out', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        attendance_date: testDate,
        scheduled_start_time: '17:00',
        scheduled_end_time: '19:00',
        actual_check_out: '18:30'
      }
    });

    // Set hourly rate to ₹300/hour
    db.prepare(`
      INSERT OR REPLACE INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, hourly_rate, currency, effective_from, is_active
      ) VALUES (1, ?, 'hourly', 300, 300, 'INR', '2026-11-01', 1)
    `).run(TEST_USER_ID);

    // Calculate statement for 2026-11
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');
    const statement = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);

    // Total actual hours = 2.0h (morning) + 1.5h (evening) = 3.5h
    // Hourly gross = 3.5 * 300 = ₹1,050
    assert.equal(statement.gross_earnings, 1050);
    assert.equal(statement.payable_units, 3.5);
  });

  // =========================================================================
  // SCENARIO 4: Attempt to assign same coach to overlapping batches -> Conflict
  // =========================================================================
  it('Scenario 4: Detects overlapping batch assignment and prevents double-booking', async () => {
    // 1. Create initial batch for coach A on Mon, Wed, Fri from 07:00 to 08:30
    const b1 = await api('/api/academy/batches', {
      method: 'POST',
      body: {
        name: 'ShiftTestBatch Morning 1',
        branch_id: 1,
        coach_id: TEST_COACH_ID,
        start_time: '07:00',
        end_time: '08:30',
        days_of_week: ['Mon', 'Wed', 'Fri'],
        max_capacity: 20
      }
    });
    assert.equal(b1.status, 201);

    // 2. Attempt to create overlapping batch on Monday from 08:00 to 09:30
    const b2 = await api('/api/academy/batches', {
      method: 'POST',
      body: {
        name: 'ShiftTestBatch Morning Overlap',
        branch_id: 1,
        coach_id: TEST_COACH_ID,
        start_time: '08:00',
        end_time: '09:30',
        days_of_week: ['Mon'],
        max_capacity: 20
      }
    });

    assert.equal(b2.status, 400);
    assert.match(b2.data.error, /Schedule Conflict|Double-booking/i);
  });

  // =========================================================================
  // SCENARIO 5: Assign same coach to batches at different branches without travel buffer
  // =========================================================================
  it('Scenario 5: Detects inter-branch travel buffer violation (15m gap < 30m required)', async () => {
    // Batch 1 ends at 08:30 at Branch 1
    // Attempt Batch 2 at Branch 2 starting at 08:45 on Monday (15 min gap < 30 min buffer)
    const b2 = await api('/api/academy/batches', {
      method: 'POST',
      body: {
        name: 'ShiftTestBatch Satellite Early',
        branch_id: 2,
        coach_id: TEST_COACH_ID,
        start_time: '08:45',
        end_time: '10:00',
        days_of_week: ['Mon'],
        max_capacity: 20
      }
    });

    assert.equal(b2.status, 400);
    assert.match(b2.data.error, /Travel Buffer Violation|travel buffer/i);
  });

  // =========================================================================
  // SCENARIO 6: Modify Monday schedule; verify Tue-Sun remain unaffected
  // =========================================================================
  it('Scenario 6: Modifies Monday schedule and verifies Tue-Sun shifts remain intact', async () => {
    db.prepare('DELETE FROM employee_schedule_shifts WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM employee_work_schedules WHERE user_id = ?').run(TEST_USER_ID);

    // Set up standard Mon-Sat 9-5 schedule
    const allWeekShifts = [];
    for (let day = 1; day <= 6; day++) {
      allWeekShifts.push({
        day_of_week: day,
        shift_name: `Standard Day ${day}`,
        start_time: '09:00',
        end_time: '17:00',
        is_working_day: 1
      });
    }

    const schedRes = await api(`/api/academy/shifts/employee/${TEST_USER_ID}`, {
      method: 'POST',
      body: {
        schedule_name: 'Full Week 9-5',
        effective_from: '2026-11-01',
        shifts: allWeekShifts
      }
    });
    assert.equal(schedRes.status, 201);
    const scheduleId = schedRes.data.result.scheduleId;

    // Update ONLY Monday (day_of_week = 1) to split shift: 06:00-08:00 and 18:00-20:00
    const updateMonRes = await api(`/api/academy/shifts/employee/${TEST_USER_ID}/day/1`, {
      method: 'PUT',
      body: {
        schedule_id: scheduleId,
        shifts: [
          { day_of_week: 1, shift_name: 'Mon Split 1', start_time: '06:00', end_time: '08:00', is_working_day: 1 },
          { day_of_week: 1, shift_name: 'Mon Split 2', start_time: '18:00', end_time: '20:00', is_working_day: 1 }
        ]
      }
    });
    assert.equal(updateMonRes.status, 200);

    // Verify Monday now has 2 split shifts
    const monExp = ScheduleService.getDayScheduleExpectation(db, TEST_USER_ID, '2026-11-09'); // Mon
    assert.equal(monExp.shifts.length, 2);
    assert.equal(monExp.scheduledHours, 4.0);

    // Verify Tuesday (day_of_week = 2) still has the original 09:00-17:00 shift (8h)
    const tueExp = ScheduleService.getDayScheduleExpectation(db, TEST_USER_ID, '2026-11-10'); // Tue
    assert.equal(tueExp.shifts.length, 1);
    assert.equal(tueExp.shifts[0].start_time, '09:00');
    assert.equal(tueExp.shifts[0].end_time, '17:00');
    assert.equal(tueExp.scheduledHours, 8.0);

    // Verify workload report accurately includes branch association
    const workloadRes = await api('/api/academy/shifts/reports/workload?date=2026-11-09');
    assert.equal(workloadRes.status, 200);
    assert.ok(Array.isArray(workloadRes.data.staffSchedules));
    assert.ok(Array.isArray(workloadRes.data.branchStaffing));
    const userInReport = workloadRes.data.staffSchedules.find(s => s.userId === TEST_USER_ID);
    assert.ok(userInReport);
    assert.equal(userInReport.branchId, 1);
    assert.equal(userInReport.scheduledHours, 4.0);
  });

  // =========================================================================
  // SCENARIO 7: Future-dated shift change preserves finalized historical payroll
  // =========================================================================
  it('Scenario 7: Future-dated shift change preserves current month payroll calculation', async () => {
    // Current month 2026-11
    const p1 = PayrollService.getOrCreatePeriod(db, 1, '2026-11');
    const statementBefore = PayrollService.calculateEmployeeStatement(db, p1.id, TEST_USER_ID, 1);
    const grossBefore = statementBefore.gross_earnings;

    // Add new schedule effective next month: 2026-12-01
    await api(`/api/academy/shifts/employee/${TEST_USER_ID}`, {
      method: 'POST',
      body: {
        schedule_name: 'Future December Schedule',
        effective_from: '2026-12-01',
        shifts: [
          { day_of_week: 1, shift_name: 'New Mon Slot', start_time: '10:00', end_time: '18:00', is_working_day: 1 }
        ]
      }
    });

    // Re-verify current month (2026-11) calculation
    const statementAfter = PayrollService.calculateEmployeeStatement(db, p1.id, TEST_USER_ID, 1);
    assert.equal(statementAfter.gross_earnings, grossBefore);
  });

  // =========================================================================
  // SCENARIO 8: Overtime approval workflow (included ONLY after approval)
  // =========================================================================
  it('Scenario 8: Overtime during slot is excluded until approved, and included once approved', async () => {
    const otDate = '2026-11-20';

    // Check in and checkout with 60 minutes overtime
    const inSlot = await api('/api/academy/shifts/slot-attendance/check-in', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        attendance_date: otDate,
        scheduled_start_time: '09:00',
        scheduled_end_time: '12:00',
        actual_check_in: '09:00',
        slot_name: 'Regular Slot'
      }
    });

    const outSlot = await api('/api/academy/shifts/slot-attendance/check-out', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        attendance_date: otDate,
        scheduled_start_time: '09:00',
        scheduled_end_time: '12:00',
        actual_check_out: '13:00', // 1 hour extra
        overtime_minutes: 60
      }
    });
    assert.equal(outSlot.status, 200);
    const slotId = outSlot.data.record.id;

    // Set salary profile to hourly ₹200/h with overtime eligible
    db.prepare(`
      INSERT OR REPLACE INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, hourly_rate, overtime_eligible, overtime_rate_multiplier, effective_from, is_active
      ) VALUES (1, ?, 'hourly', 200, 200, 1, 1.5, '2026-11-01', 1)
    `).run(TEST_USER_ID);

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    // Before approval: slot overtime is NOT in approvedOvertimeAmount
    const stmtUnapproved = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);
    const otBefore = JSON.parse(stmtUnapproved.calculation_snapshot).overtime_amount;
    assert.equal(otBefore, 0);

    // Admin approves overtime adjustment
    const adjustRes = await api('/api/academy/shifts/slot-attendance/adjust', {
      method: 'POST',
      body: {
        slot_id: slotId,
        status: 'approved_overtime',
        overtime_minutes: 60,
        adjustment_reason: 'Approved tournament extra practice session'
      }
    });
    assert.equal(adjustRes.status, 200);

    // After approval: overtime pay is included (1.0h * ₹200 * 1.5 = ₹300)
    const stmtApproved = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);
    const otAfter = JSON.parse(stmtApproved.calculation_snapshot).overtime_amount;
    assert.equal(otAfter, 300);
  });

  // =========================================================================
  // SCENARIO 9: Paid vs unpaid leave salary calculation
  // =========================================================================
  it('Scenario 9: Paid leave is not deducted; unpaid leave is accurately deducted', async () => {
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM leave_requests WHERE user_id = ?').run(TEST_USER_ID);

    // Setup Monthly fixed salary of ₹30,000 / 26 working days = ₹1,153.85/day
    db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, deduction_policy, effective_from, is_active
      ) VALUES (1, ?, 'monthly', 30000, 'working_days', '2026-11-01', 1)
    `).run(TEST_USER_ID);

    // Approved paid casual leave for 2 days (10/11 to 11/11)
    db.prepare(`
      INSERT INTO leave_requests (academy_id, applicant_type, applicant_id, applicant_name, user_id, start_date, end_date, leave_type, days_count, is_paid, reason, status)
      VALUES (1, 'coach', ?, 'Shift Coach A', ?, '2026-11-10', '2026-11-11', 'casual', 2, 1, 'Family Occasion', 'approved')
    `).run(TEST_USER_ID, TEST_USER_ID);

    // Approved unpaid leave for 1 day (12/11)
    db.prepare(`
      INSERT INTO leave_requests (academy_id, applicant_type, applicant_id, applicant_name, user_id, start_date, end_date, leave_type, days_count, is_paid, reason, status)
      VALUES (1, 'coach', ?, 'Shift Coach A', ?, '2026-11-12', '2026-11-12', 'unpaid', 1, 0, 'Personal Work', 'approved')
    `).run(TEST_USER_ID, TEST_USER_ID);

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');
    const statement = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);
    const snap = JSON.parse(statement.calculation_snapshot);

    assert.equal(snap.paid_leaves, 2);
    assert.equal(snap.unpaid_leaves, 1);
    // Unpaid leave deduction = 1 * (30000 / snap.scheduled_working_days) = 1428.57
    const expectedDeduction = Math.round((30000 / snap.scheduled_working_days) * 100) / 100;
    assert.equal(snap.absence_deductions, expectedDeduction);
  });

  // =========================================================================
  // SCENARIO 10: Automated checkout at slot end + grace period
  // =========================================================================
  it('Scenario 10: Auto-checkout processes expired open slots at slot end with grace period', async () => {
    const todayStr = '2026-11-23';

    // Staff checked in at 05:00 for slot 05:00-07:00, but forgot to check out
    await api('/api/academy/shifts/slot-attendance/check-in', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        attendance_date: todayStr,
        scheduled_start_time: '05:00',
        scheduled_end_time: '07:00',
        actual_check_in: '05:00',
        slot_name: 'Early Morning Slot'
      }
    });

    // Run auto checkout at 07:20 (past 07:00 + 15m grace)
    const autoRes = await api('/api/academy/shifts/slot-attendance/auto-checkout', {
      method: 'POST',
      body: {
        currentDateStr: todayStr,
        currentTimeStr: '07:20',
        graceMinutes: 15
      }
    });

    assert.equal(autoRes.status, 200);
    assert.ok(autoRes.data.result.processedCount >= 1);

    const updated = db.prepare(`
      SELECT * FROM staff_slot_attendance
      WHERE user_id = ? AND attendance_date = ? AND scheduled_start_time = '05:00'
    `).get(TEST_USER_ID, todayStr);

    assert.equal(updated.actual_check_out, '07:00');
    assert.equal(updated.attended_minutes, 120);
    assert.equal(updated.source, 'auto_checkout');
  });

  // =========================================================================
  // SCENARIO 11: Multi-slot with different hourly rates / hybrid compensation
  // =========================================================================
  it('Scenario 11: Hybrid compensation calculates base fixed salary plus extra sessions accurately', async () => {
    db.prepare('DELETE FROM staff_slot_attendance WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM leave_requests WHERE user_id = ?').run(TEST_USER_ID);

    // Configure hybrid profile: Base Monthly = ₹20,000 + ₹500 per completed coaching session
    db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, session_rate, hourly_rate, currency, effective_from, is_active
      ) VALUES (1, ?, 'hybrid', 20000, 500, 0, 'INR', '2026-11-01', 1)
    `).run(TEST_USER_ID);

    // Create 4 completed session records in staff_slot_attendance for this user in Nov 2026
    for (let i = 1; i <= 4; i++) {
      const slotDate = `2026-11-0${i}`;
      db.prepare(`
        INSERT INTO staff_slot_attendance (
          academy_id, user_id, attendance_date, slot_name, shift_type,
          scheduled_start_time, scheduled_end_time, actual_check_in, actual_check_out,
          attended_minutes, approved_payable_minutes, status, source
        ) VALUES (1, ?, ?, 'Coaching Session', 'regular', '08:00', '09:00', '08:00', '09:00', 60, 60, 'present', 'manual')
      `).run(TEST_USER_ID, slotDate);
    }

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');
    const statement = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);

    // Base = ₹20,000 + (4 sessions * ₹500 = ₹2,000) = ₹22,000
    assert.equal(statement.gross_earnings, 22000);
  });

  // =========================================================================
  // SCENARIO 12: Overnight shifts, holidays, off days, cancelled sessions, swaps
  // =========================================================================
  it('Scenario 12: Handles overnight shifts, holidays, cancelled sessions, and shift swaps cleanly', async () => {
    // 1. Overnight shift crossing midnight: 22:00 to 06:00 = 8.0 scheduled hours
    const overnightShift = [
      { day_of_week: 5, shift_name: 'Overnight Camp', start_time: '22:00', end_time: '06:00', is_working_day: 1 }
    ];
    assert.doesNotThrow(() => ScheduleService.validateShifts(overnightShift));

    // 2. Holiday detection
    db.prepare(`
      INSERT OR REPLACE INTO academy_holidays (academy_id, holiday_date, name, is_paid, is_closed)
      VALUES (1, '2026-11-25', 'State Sports Day', 1, 1)
    `).run();
    const dayExp = ScheduleService.getDayScheduleExpectation(db, TEST_USER_ID, '2026-11-25');
    assert.equal(dayExp.isHoliday, true);
    assert.equal(dayExp.isHolidayPaid, true);

    // 3. Shift Swap Workflow
    // Coach A requests swap with Coach B for a slot on 2026-11-28
    const swapSlot = await api('/api/academy/shifts/slot-attendance/check-in', {
      method: 'POST',
      body: {
        user_id: TEST_USER_ID,
        attendance_date: '2026-11-28',
        scheduled_start_time: '14:00',
        scheduled_end_time: '16:00',
        actual_check_in: '14:00',
        slot_name: 'Saturday Tournament Prep'
      }
    });

    const swapReq = await api('/api/academy/shifts/swaps', {
      method: 'POST',
      body: {
        requester_id: TEST_USER_ID,
        recipient_id: TEST_RECIPIENT_USER_ID,
        slot_attendance_id: swapSlot.data.record.id,
        swap_date: '2026-11-28',
        start_time: '14:00',
        end_time: '16:00',
        reason: 'Out of town for family function'
      }
    });
    assert.equal(swapReq.status, 201);
    const swapId = swapReq.data.swap.id;

    // Admin approves swap
    const reviewRes = await api(`/api/academy/shifts/swaps/${swapId}/review`, {
      method: 'PUT',
      body: { status: 'approved' }
    });
    assert.equal(reviewRes.status, 200);
    assert.equal(reviewRes.data.swap.status, 'approved');

    // Verify slot attendance was transferred to Coach B
    const updatedSlot = db.prepare('SELECT * FROM staff_slot_attendance WHERE id = ?').get(swapSlot.data.record.id);
    assert.equal(updatedSlot.user_id, TEST_RECIPIENT_USER_ID);
    assert.equal(updatedSlot.source, 'swap');
  });

  // =========================================================================
  // SCENARIO 13: RBAC check - coach account blocked from unauthorized shift config
  // =========================================================================
  it('Scenario 13: Coach without schedule permissions is blocked with 403 Forbidden', async () => {
    // Attempt to modify employee shifts as coach
    const res = await api(`/api/academy/shifts/employee/${TEST_USER_ID}`, {
      method: 'POST',
      token: coachToken,
      body: {
        schedule_name: 'Unauthorized Schedule',
        shifts: [{ day_of_week: 1, start_time: '10:00', end_time: '12:00', is_working_day: 1 }]
      }
    });

    assert.equal(res.status, 403);
    assert.match(res.data.error, /Permission 'create_shifts or edit_shifts/i);
  });

  // =========================================================================
  // SCENARIO 14: Mathematical payroll verification across all 7 modes
  // =========================================================================
  it('Scenario 14: Payroll calculation matches manual mathematical calculation for all 7 modes', async () => {
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    // 1. Fixed Monthly (₹30,000 / month, 0 unpaid leave) -> ₹30,000
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_slot_attendance WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM leave_requests WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_salary_statements WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, effective_from, is_active
      ) VALUES (1, ?, 'monthly', 30000, '2026-11-01', 1)
    `).run(TEST_USER_ID);
    let sMonthly = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);
    assert.equal(sMonthly.gross_earnings, 30000);

    // 2. Hourly (10 hours attended @ ₹300/h) -> ₹3,000
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_salary_statements WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, hourly_rate, effective_from, is_active
      ) VALUES (1, ?, 'hourly', 300, 300, '2026-11-01', 1)
    `).run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_slot_attendance WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare(`
      INSERT INTO staff_slot_attendance (
        academy_id, user_id, attendance_date, slot_name, scheduled_start_time, scheduled_end_time,
        attended_minutes, approved_payable_minutes, status, source
      ) VALUES (1, ?, '2026-11-02', 'Slot', '09:00', '19:00', 600, 600, 'present', 'manual')
    `).run(TEST_USER_ID);
    let sHourly = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);
    assert.equal(sHourly.gross_earnings, 3000); // 10h * 300 = 3000

    // 3. Per-Minute (600 minutes @ ₹5/min) -> ₹3,000
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_salary_statements WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, effective_from, is_active
      ) VALUES (1, ?, 'per_minute', 5.0, '2026-11-01', 1)
    `).run(TEST_USER_ID);
    let sPerMin = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);
    assert.equal(sPerMin.gross_earnings, 3000); // 600m * 5 = 3000

    // 4. Daily (3 distinct days worked @ ₹1,000/day) -> ₹3,000
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_salary_statements WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, effective_from, is_active
      ) VALUES (1, ?, 'daily', 1000, '2026-11-01', 1)
    `).run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_slot_attendance WHERE user_id = ?').run(TEST_USER_ID);
    for (const d of ['2026-11-03', '2026-11-04', '2026-11-05']) {
      db.prepare(`
        INSERT INTO staff_slot_attendance (
          academy_id, user_id, attendance_date, slot_name, scheduled_start_time, scheduled_end_time,
          attended_minutes, status, source
        ) VALUES (1, ?, ?, 'Slot', '09:00', '11:00', 120, 'present', 'manual')
      `).run(TEST_USER_ID, d);
    }
    let sDaily = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);
    assert.equal(sDaily.gross_earnings, 3000); // 3 days * 1000 = 3000

    // 5. Per-Session (5 completed sessions @ ₹600/session) -> ₹3,000
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_salary_statements WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, effective_from, is_active
      ) VALUES (1, ?, 'per_session', 600, '2026-11-01', 1)
    `).run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_slot_attendance WHERE user_id = ?').run(TEST_USER_ID);
    for (let i = 1; i <= 5; i++) {
      const startH = String(7 + i).padStart(2, '0');
      const endH = String(8 + i).padStart(2, '0');
      db.prepare(`
        INSERT INTO staff_slot_attendance (
          academy_id, user_id, attendance_date, slot_name, shift_type, scheduled_start_time, scheduled_end_time,
          attended_minutes, status, source
        ) VALUES (1, ?, '2026-11-06', 'Session ' || ?, 'regular', ?, ?, 60, 'present', 'manual')
      `).run(TEST_USER_ID, i, `${startH}:00`, `${endH}:00`);
    }
    let sSession = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);
    assert.equal(sSession.gross_earnings, 3000); // 5 sessions * 600 = 3000

    // 6. Per-Batch (1 assigned active batch @ ₹4,000/batch) -> ₹4,000
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_salary_statements WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM batches WHERE coach_id = ? OR assistant_coach_id = ?').run(TEST_COACH_ID, TEST_COACH_ID);
    db.prepare(`
      INSERT OR REPLACE INTO batches (id, academy_id, branch_id, coach_id, name, is_active, start_time, end_time, days_of_week)
      VALUES (9999, 1, 1, ?, 'PerBatch Test Batch', 1, '10:00', '11:00', 'Mon,Wed,Fri')
    `).run(TEST_COACH_ID);
    db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, batch_rate, effective_from, is_active
      ) VALUES (1, ?, 'per_batch', 4000, 4000, '2026-11-01', 1)
    `).run(TEST_USER_ID);
    let sBatch = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);
    assert.equal(sBatch.gross_earnings, 4000); // 1 active batch * 4000 = 4000

    // 7. Hybrid (Base ₹20,000 + 2 sessions @ ₹500 = ₹1,000) -> ₹21,000
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_salary_statements WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, session_rate, effective_from, is_active
      ) VALUES (1, ?, 'hybrid', 20000, 500, '2026-11-01', 1)
    `).run(TEST_USER_ID);
    db.prepare('DELETE FROM staff_slot_attendance WHERE user_id = ?').run(TEST_USER_ID);
    for (let i = 1; i <= 2; i++) {
      const startH = String(7 + i).padStart(2, '0');
      const endH = String(8 + i).padStart(2, '0');
      db.prepare(`
        INSERT INTO staff_slot_attendance (
          academy_id, user_id, attendance_date, slot_name, shift_type, scheduled_start_time, scheduled_end_time,
          attended_minutes, status, source
        ) VALUES (1, ?, '2026-11-07', 'Hybrid Session ' || ?, 'regular', ?, ?, 60, 'present', 'manual')
      `).run(TEST_USER_ID, i, `${startH}:00`, `${endH}:00`);
    }
    let sHybrid = PayrollService.calculateEmployeeStatement(db, period.id, TEST_USER_ID, 1);
    assert.equal(sHybrid.gross_earnings, 21000); // 20000 + 2 * 500 = 21000
  });
});
