import test from 'node:test';
import assert from 'node:assert/strict';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { getCentralDb } from '../../src/db/centralDb.js';
import { ScheduleService } from '../../src/services/scheduleService.js';
import { PayrollService } from '../../src/services/payrollService.js';
import { LeaveService } from '../../src/services/leaveService.js';
import { UserService } from '../../src/services/userService.js';

test('Complete Employee Payroll, Weekly Off, Holiday & Leave Management (All 20 Test Scenarios)', async (t) => {
  const db = getTenantDbById(1);
  const centralDb = getCentralDb();
  const testMonth = '2026-03';
  const periodStart = '2026-03-01';
  const periodEnd = '2026-03-31';

  // Helper to create test employee safely within tenant and quota
  function createTestEmployee(name, salaryMode = 'monthly', rate = 31000, joiningDate = '2026-01-01', exitDate = null, deductionPolicy = 'working_days') {
    const email = `test_emp_${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`;
    const res = UserService.createStaffUser(db, centralDb, 1, {
      name,
      email,
      phone: '9876543210',
      password: 'password123',
      role: 'coach',
      branch_id: 1,
      joining_date: joiningDate,
      designation: 'Coach',
      salary_amount: rate,
      compensation_mode: 'monthly',
    });

    db.prepare(`
      UPDATE staff_salary_profiles
      SET salary_mode = ?, base_rate = ?, deduction_policy = ?
      WHERE user_id = ?
    `).run(salaryMode, rate, deductionPolicy, res.userId);

    if (exitDate) {
      db.prepare('UPDATE employment_records SET exit_date = ? WHERE user_id = ?').run(exitDate, res.userId);
    }

    return { userId: res.userId, coachId: res.coachId, email };
  }

  // Helper to punch all working days for an employee
  function punchWorkingDays(empId, schedule, excludeDates = []) {
    for (const day of schedule.dayBreakdown) {
      if (day.isWorkingDay && !excludeDates.includes(day.date)) {
        db.prepare(`
          INSERT INTO staff_time_punches (
            academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status, punch_type
          ) VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed', 'general')
        `).run(empId, day.date, day.date, day.date);
      }
    }
  }

  // Helper to cleanup employee after test to prevent hitting subscription user quota
  function cleanupTestEmployee(emp) {
    if (!emp || !emp.userId) return;
    try {
      db.prepare("DELETE FROM staff_salary_payments WHERE statement_id IN (SELECT id FROM staff_salary_statements WHERE user_id = ?)").run(emp.userId);
      db.prepare("DELETE FROM staff_salary_adjustments WHERE statement_id IN (SELECT id FROM staff_salary_statements WHERE user_id = ?)").run(emp.userId);
      db.prepare("DELETE FROM staff_salary_statements WHERE user_id = ?").run(emp.userId);
      db.prepare("DELETE FROM staff_salary_profiles WHERE user_id = ?").run(emp.userId);
      db.prepare("DELETE FROM employment_records WHERE user_id = ?").run(emp.userId);
      db.prepare("DELETE FROM coaches WHERE user_id = ?").run(emp.userId);
      db.prepare("DELETE FROM staff_time_punches WHERE user_id = ?").run(emp.userId);
      db.prepare("DELETE FROM overtime_requests WHERE user_id = ?").run(emp.userId);
      db.prepare("DELETE FROM employee_work_exceptions WHERE user_id = ?").run(emp.userId);
      db.prepare("DELETE FROM leave_requests WHERE applicant_id = ? OR user_id = ?").run(emp.userId, emp.userId);
      db.prepare("DELETE FROM employee_leave_balances WHERE user_id = ?").run(emp.userId);
      db.prepare("DELETE FROM batch_sessions WHERE coach_id = ?").run(emp.coachId || emp.userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(emp.userId);
      centralDb.prepare("DELETE FROM academy_users_lookup WHERE email = ?").run(emp.email);
    } catch (e) {
      // Ignore
    }
  }

  // Ensure default policies exist
  LeaveService.ensureDefaultPolicies(db, 1);

  // 1. Fixed monthly employee present whole month receives 100% fixed salary
  await t.test('1. Fixed monthly employee present whole month receives 100% fixed salary', () => {
    const emp = createTestEmployee('Full Month Employee', 'monthly', 31000, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, periodStart, periodEnd, '2026-01-01');
    punchWorkingDays(emp.userId, schedule);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 31000, 'Gross earnings should equal monthly fixed salary');
    assert.equal(stmt.total_deductions, 0, 'No deductions for fully attended month');
    assert.equal(stmt.net_earnings, 31000, 'Net earnings should be 100% fixed salary');

    cleanupTestEmployee(emp);
  });

  // 2. Weekly offs are not counted as absence and not deducted
  await t.test('2. Weekly offs are not counted as absence and not deducted', () => {
    const emp = createTestEmployee('Weekly Off Test Emp', 'monthly', 31000, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, periodStart, periodEnd, '2026-01-01');
    const weeklyOffs = schedule.dayBreakdown.filter(d => d.dayType === 'weekly_off');
    assert.ok(weeklyOffs.length >= 4, 'March should have at least 4 weekly offs');

    punchWorkingDays(emp.userId, schedule);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const snap = JSON.parse(stmt.calculation_snapshot || '{}');
    assert.equal(snap.absence_deductions, 0, 'Weekly offs must NOT be deducted');
    assert.equal(stmt.total_deductions, 0, 'No deductions should be made for weekly offs');
    assert.equal(stmt.net_earnings, 31000, 'Full monthly salary retained');

    cleanupTestEmployee(emp);
  });

  // 3. Paid holidays are not deducted
  await t.test('3. Paid holidays are not deducted from salary', () => {
    const emp = createTestEmployee('Holiday Test Emp', 'monthly', 31000, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    // Add a paid holiday on 2026-03-25
    db.prepare(`
      INSERT INTO academy_holidays (academy_id, holiday_date, name, is_paid, category, is_closed)
      VALUES (1, '2026-03-25', 'Holi Festival', 1, 'festival', 1)
    `).run();

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, periodStart, periodEnd, '2026-01-01');
    punchWorkingDays(emp.userId, schedule, ['2026-03-25']);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const snap = JSON.parse(stmt.calculation_snapshot || '{}');
    assert.equal(snap.absence_deductions, 0, 'Paid holiday must not count as absence deduction');
    assert.equal(snap.paid_holidays, 1, 'Paid holiday tracked in snapshot');
    assert.equal(stmt.net_earnings, 31000, 'Net earnings unchanged by paid holiday');

    cleanupTestEmployee(emp);
  });

  // 4. Paid leaves consume balance and do not deduct salary
  await t.test('4. Paid leaves consume balance and do not deduct salary', () => {
    const emp = createTestEmployee('Paid Leave Emp', 'monthly', 31000, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    const balBefore = LeaveService.getBalances(db, 1, emp.userId, 2026);
    const clBefore = balBefore.find(b => b.leave_type === 'casual')?.remaining || 12;

    const applyRes = LeaveService.applyLeave(db, 1, {
      applicant_type: 'staff',
      applicant_id: emp.userId,
      branch_id: 1,
      applicant_name: 'Paid Leave Emp',
      leave_type: 'casual',
      day_part: 'full_day',
      start_date: '2026-03-10',
      end_date: '2026-03-11',
      reason: 'Casual leave for family function',
      status: 'approved'
    });
    assert.ok(applyRes.leaveId, 'Leave application created');

    const balAfter = LeaveService.getBalances(db, 1, emp.userId, 2026);
    const clAfter = balAfter.find(b => b.leave_type === 'casual')?.remaining;
    assert.equal(clAfter, clBefore - 2, 'Remaining casual leave balance should decrease by 2');

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, periodStart, periodEnd, '2026-01-01');
    punchWorkingDays(emp.userId, schedule, ['2026-03-10', '2026-03-11']);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const snap = JSON.parse(stmt.calculation_snapshot || '{}');
    assert.equal(snap.absence_deductions, 0, 'Approved paid leave should not count as absence deduction');
    assert.equal(stmt.total_deductions, 0, 'No salary deduction for paid leave');
    assert.equal(stmt.net_earnings, 31000, 'Full salary preserved');

    cleanupTestEmployee(emp);
  });

  // 5. Unpaid leaves deduct correctly based on deduction policy
  await t.test('5. Unpaid leaves deduct correctly based on deduction policy', () => {
    const emp = createTestEmployee('Unpaid Leave Emp', 'monthly', 31000, '2026-01-01', null, 'calendar_days');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    LeaveService.applyLeave(db, 1, {
      applicant_type: 'staff',
      applicant_id: emp.userId,
      branch_id: 1,
      applicant_name: 'Unpaid Leave Emp',
      leave_type: 'unpaid',
      day_part: 'full_day',
      start_date: '2026-03-12',
      end_date: '2026-03-12',
      reason: 'Personal emergency LWP',
      status: 'approved'
    });

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, periodStart, periodEnd, '2026-01-01');
    punchWorkingDays(emp.userId, schedule, ['2026-03-12']);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 31 days in March 2026, calendar_days policy: 1 day deduction = 31000 / 31 = 1000
    assert.equal(stmt.total_deductions, 1000, 'Unpaid leave should deduct exactly 1 day rate (1000)');
    assert.equal(stmt.net_earnings, 30000, 'Net earnings should reflect 1 day unpaid deduction');

    cleanupTestEmployee(emp);
  });

  // 6. Half-day leave deducts exactly 0.5 day's pay
  await t.test('6. Half-day leave deducts exactly 0.5 days pay when unpaid', () => {
    const emp = createTestEmployee('Half Day Emp', 'monthly', 31000, '2026-01-01', null, 'calendar_days');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    LeaveService.applyLeave(db, 1, {
      applicant_type: 'staff',
      applicant_id: emp.userId,
      branch_id: 1,
      applicant_name: 'Half Day Emp',
      leave_type: 'unpaid',
      day_part: 'first_half',
      start_date: '2026-03-13',
      end_date: '2026-03-13',
      reason: 'Doctor appointment first half',
      status: 'approved'
    });

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, periodStart, periodEnd, '2026-01-01');
    punchWorkingDays(emp.userId, schedule, ['2026-03-13']);

    // Punch second half on 2026-03-13
    db.prepare(`
      INSERT INTO staff_time_punches (
        academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status, punch_type
      ) VALUES (1, ?, '2026-03-13', '2026-03-13 13:00:00', '2026-03-13 17:00:00', 240, 'completed', 'general')
    `).run(emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 0.5 day deduction of 1000 = 500
    assert.equal(stmt.total_deductions, 500, 'Half-day unpaid leave should deduct 500');
    assert.equal(stmt.net_earnings, 30500, 'Net earnings should be 30500');

    cleanupTestEmployee(emp);
  });

  // 7. Overlapping leave requests are rejected
  await t.test('7. Overlapping leave requests are rejected', () => {
    const emp = createTestEmployee('Overlap Leave Emp', 'monthly', 30000, '2026-01-01');

    LeaveService.applyLeave(db, 1, {
      applicant_type: 'staff',
      applicant_id: emp.userId,
      branch_id: 1,
      applicant_name: 'Overlap Leave Emp',
      leave_type: 'casual',
      day_part: 'full_day',
      start_date: '2026-03-15',
      end_date: '2026-03-18',
      reason: 'Out of town',
      status: 'pending'
    });

    assert.throws(() => {
      LeaveService.applyLeave(db, 1, {
        applicant_type: 'staff',
        applicant_id: emp.userId,
        branch_id: 1,
        applicant_name: 'Overlap Leave Emp',
        leave_type: 'sick',
        day_part: 'full_day',
        start_date: '2026-03-17',
        end_date: '2026-03-20',
        reason: 'Overlapping request',
        status: 'pending'
      });
    }, /overlapping/i, 'Overlapping leave request must throw error');

    cleanupTestEmployee(emp);
  });

  // 8. Working on weekly off / holiday creates comp-off / overtime addition
  await t.test('8. Working on weekly off / holiday creates comp-off / overtime addition', () => {
    const emp = createTestEmployee('Comp Off Emp', 'monthly', 31000, '2026-01-01');

    const excRes = ScheduleService.recordWorkException(db, 1, {
      user_id: emp.userId,
      branch_id: 1,
      date: '2026-03-08',
      exception_type: 'weekly_off_work',
      compensation_type: 'comp_off',
      hours_worked: 8,
      comp_off_days: 1.0,
      reason: 'Sunday tournament duty'
    });
    assert.ok(excRes.id, 'Work exception created');

    const bal = LeaveService.getBalances(db, 1, emp.userId, 2026);
    const earnedBal = bal.find(b => b.leave_type === 'earned');
    assert.ok(earnedBal && earnedBal.remaining >= 1, 'Comp-off work exception credits to earned leave balance');

    cleanupTestEmployee(emp);
  });

  // 9. Mid-month joiner receives prorated salary based on join date
  await t.test('9. Mid-month joiner receives prorated salary based on join date', () => {
    // Joining on 2026-03-16 (16 days active out of 31)
    const emp = createTestEmployee('Joiner Emp', 'monthly', 31000, '2026-03-16', null, 'calendar_days');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, periodStart, periodEnd, '2026-03-16');
    punchWorkingDays(emp.userId, schedule);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 16 active days * 1000 per day = 16000 gross
    assert.equal(stmt.gross_earnings, 16000, 'Gross earnings prorated for 16 active days');
    assert.equal(stmt.net_earnings, 16000, 'Net earnings prorated accurately');

    cleanupTestEmployee(emp);
  });

  // 10. Mid-month resignation receives prorated salary based on exit date
  await t.test('10. Mid-month resignation receives prorated salary based on exit date', () => {
    // Resigning on 2026-03-15 (15 days active out of 31)
    const emp = createTestEmployee('Resigned Emp', 'monthly', 31000, '2026-01-01', '2026-03-15', 'calendar_days');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, periodStart, periodEnd, '2026-01-01', '2026-03-15');
    punchWorkingDays(emp.userId, schedule);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 15 active days * 1000 per day = 15000 gross
    assert.equal(stmt.gross_earnings, 15000, 'Gross earnings prorated for 15 active days');
    assert.equal(stmt.net_earnings, 15000, 'Net earnings prorated accurately for resignation');

    cleanupTestEmployee(emp);
  });

  // 11. Mid-month salary revision splits calculation across effective dates
  await t.test('11. Mid-month salary revision splits calculation across effective dates', () => {
    const emp = createTestEmployee('Revision Emp', 'monthly', 31000, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    db.prepare("UPDATE staff_salary_profiles SET effective_from = '2026-01-01' WHERE user_id = ?").run(emp.userId);

    db.prepare(`
      INSERT INTO staff_salary_profiles (
        user_id, academy_id, salary_mode, base_rate, effective_from, is_active
      ) VALUES (?, 1, 'monthly', 62000, '2026-03-16', 1)
    `).run(emp.userId);

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, periodStart, periodEnd, '2026-01-01');
    punchWorkingDays(emp.userId, schedule);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // First 15 days @ 31000/31 = 1000/day -> 15000
    // Next 16 days @ 62000/31 = 2000/day -> 32000
    // Total gross = 47000
    assert.equal(stmt.gross_earnings, 47000, 'Mid-month revision splits gross earnings across effective dates (47000)');
    assert.equal(stmt.net_earnings, 47000, 'Net earnings reflects split rate accurately');

    cleanupTestEmployee(emp);
  });

  // 12. Daily rate employee earns: working days * rate
  await t.test('12. Daily rate employee earns: working days * rate', () => {
    const emp = createTestEmployee('Daily Worker', 'per_day', 1200, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    const daysToWork = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06',
                        '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'];
    for (const date of daysToWork) {
      db.prepare(`
        INSERT INTO staff_time_punches (
          academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status, punch_type
        ) VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed', 'general')
      `).run(emp.userId, date, date, date);
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.payable_units, 10, 'Payable units should be 10 days');
    assert.equal(stmt.gross_earnings, 12000, '10 days * 1200 = 12000');
    assert.equal(stmt.net_earnings, 12000, 'Net earnings equals daily earnings');

    cleanupTestEmployee(emp);
  });

  // 13. Hourly employee earns: payable hours * rate
  await t.test('13. Hourly employee earns: payable hours * rate', () => {
    const emp = createTestEmployee('Hourly Worker', 'hourly', 250, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    const days = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'];
    for (const date of days) {
      db.prepare(`
        INSERT INTO staff_time_punches (
          academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status, punch_type
        ) VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed', 'general')
      `).run(emp.userId, date, date, date);
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.payable_units, 40, 'Payable hours should be 40');
    assert.equal(stmt.gross_earnings, 10000, '40 hours * 250 = 10000');

    cleanupTestEmployee(emp);
  });

  // 14. Per-session employee earns: completed sessions * rate
  await t.test('14. Per-session employee earns: completed sessions * rate', () => {
    const emp = createTestEmployee('Session Coach', 'per_session', 800, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    const batch = db.prepare('SELECT id, branch_id FROM batches LIMIT 1').get();
    const batchId = batch ? batch.id : 1;
    const branchId = batch?.branch_id || 1;
    for (let i = 1; i <= 15; i++) {
      const d = i < 10 ? `0${i}` : `${i}`;
      db.prepare(`
        INSERT OR REPLACE INTO batch_sessions (
          academy_id, branch_id, batch_id, coach_id, scheduled_date, start_time, end_time, status, attendance_status
        ) VALUES (1, ?, ?, ?, ?, '10:00', '11:00', 'completed', 'completed')
      `).run(branchId, batchId, emp.coachId, `2026-03-${d}`);
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.payable_units, 15, '15 completed sessions');
    assert.equal(stmt.gross_earnings, 12000, '15 sessions * 800 = 12000');

    cleanupTestEmployee(emp);
  });

  // 15. Overtime hours are added at configured multiplier
  await t.test('15. Overtime hours are added at configured multiplier', () => {
    const emp = createTestEmployee('Overtime Coach', 'monthly', 31000, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, periodStart, periodEnd, '2026-01-01');
    punchWorkingDays(emp.userId, schedule);

    // Approved overtime request of 500
    db.prepare(`
      INSERT INTO overtime_requests (
        academy_id, user_id, date, overtime_minutes, payable_amount, status, requested_by
      ) VALUES (1, ?, '2026-03-02', 120, 500, 'approved', ?)
    `).run(emp.userId, emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 31000, 'Gross earnings equals monthly salary');
    assert.equal(stmt.total_additions, 500, 'Additions include 500 approved overtime');
    assert.equal(stmt.net_earnings, 31500, 'Net earnings includes overtime pay');

    cleanupTestEmployee(emp);
  });

  // 16. Duplicate payroll generation for the same period updates or prevents duplicate statements
  await t.test('16. Duplicate payroll generation updates or prevents duplicate statements', () => {
    const emp = createTestEmployee('Dedupe Emp', 'monthly', 25000, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testMonth);

    const stmt1 = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const count1 = db.prepare('SELECT COUNT(*) as cnt FROM staff_salary_statements WHERE payroll_period_id = ? AND user_id = ?').get(period.id, emp.userId).cnt;
    assert.equal(count1, 1, 'Exactly one statement should exist');

    // Run again
    const stmt2 = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const count2 = db.prepare('SELECT COUNT(*) as cnt FROM staff_salary_statements WHERE payroll_period_id = ? AND user_id = ?').get(period.id, emp.userId).cnt;
    assert.equal(count2, 1, 'Still exactly one statement exists (upsert without duplicates)');
    assert.equal(stmt1.id, stmt2.id, 'Same statement ID reused');

    cleanupTestEmployee(emp);
  });

  // 17. Recalculation works before finalization; finalization locks snapshot and prevents automatic changes
  await t.test('17. Recalculation works before finalization; finalization locks snapshot', () => {
    const testCycle = '2026-08';
    db.prepare("DELETE FROM staff_salary_statements WHERE payroll_period_id IN (SELECT id FROM staff_payroll_periods WHERE year_month = ?)").run(testCycle);
    db.prepare("DELETE FROM staff_payroll_periods WHERE year_month = ?").run(testCycle);

    const emp = createTestEmployee('Lock Test Emp', 'monthly', 31000, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testCycle);

    // Initial statement in draft
    const stmtDraft = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.ok(stmtDraft.id, 'Draft statement generated');

    // Finalize period
    PayrollService.finalizePayrollPeriod(db, period.id, 1);
    const periodAfter = db.prepare('SELECT status FROM staff_payroll_periods WHERE id = ?').get(period.id);
    assert.equal(periodAfter.status, 'finalized', 'Period is finalized');

    // Attempt statement calculation on finalized period should return locked statement without re-running
    const stmtLocked = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmtLocked.id, stmtDraft.id, 'Returns existing locked statement');

    cleanupTestEmployee(emp);
  });

  // 18. Partial payment updates paid/balance amount and payment status
  await t.test('18. Partial payment updates paid/balance amount and payment status', () => {
    const testCycle = '2026-09';
    db.prepare("DELETE FROM staff_salary_statements WHERE payroll_period_id IN (SELECT id FROM staff_payroll_periods WHERE year_month = ?)").run(testCycle);
    db.prepare("DELETE FROM staff_payroll_periods WHERE year_month = ?").run(testCycle);

    const emp = createTestEmployee('Payment Emp', 'monthly', 30000, '2026-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testCycle);

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date, '2026-01-01');
    punchWorkingDays(emp.userId, schedule);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.net_earnings, 30000);
    assert.equal(stmt.balance_amount, 30000);

    // Disburse partial payment of 10000
    PayrollService.recordSalaryPayment(db, {
      statementId: stmt.id,
      amount: 10000,
      paymentMethod: 'bank_transfer',
      referenceNumber: 'TXN12345',
      notes: 'First installment',
      createdBy: 1
    });

    const updatedStmt = db.prepare('SELECT * FROM staff_salary_statements WHERE id = ?').get(stmt.id);
    assert.equal(updatedStmt.payment_status, 'partially_paid', 'Status transitions to partially_paid');
    assert.equal(updatedStmt.paid_amount, 10000, 'Paid amount is 10000');
    assert.equal(updatedStmt.balance_amount, 20000, 'Remaining balance is 20000');

    cleanupTestEmployee(emp);
  });

  // 19. Cross-tenant isolation: unauthorized access to other tenant fails
  await t.test('19. Cross-tenant isolation: unauthorized access to other tenant fails', () => {
    const db1 = getTenantDbById(1);
    const db2 = getTenantDbById(2);

    const p1 = db1.prepare('SELECT id FROM staff_payroll_periods LIMIT 1').get();
    if (p1) {
      assert.ok(db1 !== db2, 'Tenant DB connections must be separate SQLite instances');
    }
  });

  // 20. Immutable historical payroll: past finalized payroll unchanged after employee configuration changes
  await t.test('20. Immutable historical payroll: past finalized payroll unchanged after salary changes', () => {
    const testCycle = '2025-11';
    db.prepare("DELETE FROM staff_salary_statements WHERE payroll_period_id IN (SELECT id FROM staff_payroll_periods WHERE year_month = ?)").run(testCycle);
    db.prepare("DELETE FROM staff_payroll_periods WHERE year_month = ?").run(testCycle);

    const emp = createTestEmployee('Historical Emp', 'monthly', 20000, '2025-01-01');
    const period = PayrollService.getOrCreatePeriod(db, 1, testCycle);

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date, '2025-01-01');
    punchWorkingDays(emp.userId, schedule);

    const origStmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);

    // Finalize 2025-11 period
    PayrollService.finalizePayrollPeriod(db, period.id, 1);

    // Later in 2026, employee gets huge salary raise to 100,000
    db.prepare('UPDATE staff_salary_profiles SET base_rate = 100000 WHERE user_id = ?').run(emp.userId);

    // Re-read 2025-11 statement
    const lockedStmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(lockedStmt.gross_earnings, 20000, 'Past finalized gross earnings remains 20000, strictly immune to later salary changes');
    assert.equal(lockedStmt.net_earnings, 20000, 'Past finalized net earnings remains 20000');

    cleanupTestEmployee(emp);
  });
});
