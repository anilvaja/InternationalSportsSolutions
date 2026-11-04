import test from 'node:test';
import assert from 'node:assert/strict';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { getCentralDb } from '../../src/db/centralDb.js';
import { ScheduleService } from '../../src/services/scheduleService.js';
import { PayrollService } from '../../src/services/payrollService.js';
import { LeaveService } from '../../src/services/leaveService.js';
import { UserService } from '../../src/services/userService.js';

test('Staff Salary Management & Attendance-Based Payroll Engine (38 Mandatory Calculation Tests)', async (t) => {
  const db = getTenantDbById(1);
  const centralDb = getCentralDb();
  LeaveService.ensureDefaultPolicies(db, 1);

  // Dedicated counter for unique test users
  let empCounter = 1000;

  function createTestEmployee({
    name = 'Payroll Test Staff',
    salaryMode = 'monthly',
    rate = 18000,
    salaryDivisor = 'actual_scheduled_minutes',
    joiningDate = '2026-01-01',
    exitDate = null,
    overtimeEligible = 1,
    overtimeRateMultiplier = 1.0,
    overtimeGraceMinutes = 30,
    hourlyRate = 0,
    sessionRate = 0,
    batchRate = 0,
    branchId = null,
  } = {}) {
    empCounter++;
    const email = `test_payroll_${empCounter}_${Date.now()}@example.com`;
    const res = UserService.createStaffUser(db, centralDb, 1, {
      name: `${name} ${empCounter}`,
      email,
      phone: `980000${empCounter.toString().padStart(4, '0')}`,
      password: 'password123',
      role: 'coach',
      branch_id: branchId,
      joining_date: joiningDate,
      designation: 'Coach',
      salary_amount: rate,
      compensation_mode: salaryMode,
    });

    const existingProfile = db.prepare('SELECT id FROM staff_salary_profiles WHERE user_id = ?').get(res.userId);
    if (existingProfile) {
      db.prepare(`
        UPDATE staff_salary_profiles
        SET salary_mode = ?,
            base_rate = ?,
            salary_divisor = ?,
            deduction_policy = ?,
            overtime_eligible = ?,
            overtime_rate_multiplier = ?,
            overtime_grace_minutes = ?,
            hourly_rate = ?,
            session_rate = ?,
            batch_rate = ?
        WHERE user_id = ?
      `).run(
        salaryMode, rate, salaryDivisor, salaryDivisor, overtimeEligible,
        overtimeRateMultiplier, overtimeGraceMinutes, hourlyRate, sessionRate, batchRate,
        res.userId
      );
    } else {
      db.prepare(`
        INSERT INTO staff_salary_profiles (
          academy_id, user_id, salary_mode, base_rate, salary_divisor, deduction_policy,
          overtime_eligible, overtime_rate_multiplier, overtime_grace_minutes,
          hourly_rate, session_rate, batch_rate, effective_from, is_active
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-01-01', 1)
      `).run(
        res.userId, salaryMode, rate, salaryDivisor, salaryDivisor,
        overtimeEligible, overtimeRateMultiplier, overtimeGraceMinutes,
        hourlyRate, sessionRate, batchRate
      );
    }

    if (exitDate) {
      db.prepare('UPDATE employment_records SET exit_date = ? WHERE user_id = ?').run(exitDate, res.userId);
    }

    return { userId: res.userId, coachId: res.coachId, email };
  }

  function setCustomSchedule(userId, shifts) {
    db.prepare('DELETE FROM employee_schedule_shifts WHERE schedule_id IN (SELECT id FROM employee_work_schedules WHERE user_id = ?)').run(userId);
    db.prepare('DELETE FROM employee_work_schedules WHERE user_id = ?').run(userId);

    const ins = db.prepare(`
      INSERT INTO employee_work_schedules (
        academy_id, user_id, schedule_name, effective_from, is_active, created_by
      ) VALUES (1, ?, 'Custom Test Schedule', '2026-01-01', 1, 1)
    `).run(userId);

    const scheduleId = ins.lastInsertRowid;
    const insShift = db.prepare(`
      INSERT INTO employee_schedule_shifts (
        schedule_id, user_id, day_of_week, shift_name, start_time, end_time,
        scheduled_hours, break_duration_minutes, is_break_paid, is_working_day
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
    `);

    for (const s of shifts) {
      insShift.run(
        scheduleId,
        userId,
        s.day_of_week,
        s.shift_name || `Shift ${s.day_of_week}`,
        s.start_time,
        s.end_time,
        s.scheduled_hours,
        s.is_working_day !== undefined ? s.is_working_day : 1
      );
    }

    return scheduleId;
  }

  function cleanupEmployee(emp) {
    if (!emp || !emp.userId) return;
    try {
      db.prepare('DELETE FROM staff_salary_payments WHERE statement_id IN (SELECT id FROM staff_salary_statements WHERE user_id = ?)').run(emp.userId);
      db.prepare('DELETE FROM staff_salary_adjustments WHERE statement_id IN (SELECT id FROM staff_salary_statements WHERE user_id = ?)').run(emp.userId);
      db.prepare('DELETE FROM staff_salary_statements WHERE user_id = ?').run(emp.userId);
      db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(emp.userId);
      db.prepare('DELETE FROM staff_slot_attendance WHERE user_id = ?').run(emp.userId);
      db.prepare('DELETE FROM staff_time_punches WHERE user_id = ?').run(emp.userId);
      db.prepare('DELETE FROM overtime_requests WHERE user_id = ?').run(emp.userId);
      db.prepare('DELETE FROM leave_requests WHERE user_id = ? OR applicant_id = ?').run(emp.userId, emp.userId);
      db.prepare('DELETE FROM employee_leave_balances WHERE user_id = ?').run(emp.userId);
      db.prepare('DELETE FROM employee_schedule_shifts WHERE schedule_id IN (SELECT id FROM employee_work_schedules WHERE user_id = ?)').run(emp.userId);
      db.prepare('DELETE FROM employee_work_schedules WHERE user_id = ?').run(emp.userId);
      db.prepare('DELETE FROM employment_records WHERE user_id = ?').run(emp.userId);
      db.prepare('DELETE FROM coaches WHERE user_id = ?').run(emp.userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(emp.userId);
      centralDb.prepare('DELETE FROM academy_users_lookup WHERE email = ?').run(emp.email);
    } catch (_) {}
  }

  // =========================================================================
  // TEST 1: Monthly salary, 6 hours daily, 26 working days
  // =========================================================================
  await t.test('1. Monthly salary, 6 hours daily, 26 working days', () => {
    // Inputs: M = 18,000, 6h/day, Mon-Sat (26 working days in Sep 2026 with 4 Sundays).
    // Expected scheduled minutes = 26 * 6 * 60 = 9,360 minutes.
    // Daily equivalent = 18,000 / 26 = 692.3077.
    // Per-minute equivalent = 18,000 / 9,360 = 1.9230769.
    const emp = createTestEmployee({ rate: 18000, salaryDivisor: 'actual_scheduled_minutes' });
    const shifts = [];
    for (let day = 1; day <= 6; day++) {
      shifts.push({ day_of_week: day, start_time: '09:00', end_time: '15:00', scheduled_hours: 6.0, is_working_day: 1 });
    }
    shifts.push({ day_of_week: 7, start_time: '00:00', end_time: '00:00', scheduled_hours: 0, is_working_day: 0 });
    setCustomSchedule(emp.userId, shifts);

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);
    // Sep 2026: 30 days, 4 Sundays -> 26 working days * 360m = 9,360 scheduled minutes
    assert.equal(schedule.scheduledWorkingDays, 26);
    assert.equal(schedule.totalScheduledMinutes, 9360);

    // Punch all 26 working days
    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 15:00:00', 360, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 18000);
    assert.equal(stmt.total_deductions, 0);
    assert.equal(stmt.net_earnings, 18000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 2: Monthly salary, 4 hours daily, different weekly offs
  // =========================================================================
  await t.test('2. Monthly salary, 4 hours daily, different weekly offs', () => {
    // Schedule: 4h daily, Weekly offs: Saturday and Sunday (day 6 and day 7)
    const emp = createTestEmployee({ rate: 16000, salaryDivisor: 'actual_scheduled_minutes' });
    const shifts = [
      { day_of_week: 1, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 2, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 3, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 4, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 5, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 6, start_time: '00:00', end_time: '00:00', scheduled_hours: 0, is_working_day: 0 },
      { day_of_week: 7, start_time: '00:00', end_time: '00:00', scheduled_hours: 0, is_working_day: 0 },
    ];
    setCustomSchedule(emp.userId, shifts);

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);
    // Weekly offs = Sat + Sun = 8 days off in Sep 2026 -> 22 working days * 240m = 5,280 scheduled minutes
    assert.equal(schedule.weeklyOffDays, 8);
    assert.equal(schedule.scheduledWorkingDays, 22);
    assert.equal(schedule.totalScheduledMinutes, 5280);

    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 13:00:00', 240, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 16000);
    assert.equal(stmt.total_deductions, 0);
    assert.equal(stmt.net_earnings, 16000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 3: Monthly salary, multiple slots per day
  // =========================================================================
  await t.test('3. Monthly salary, multiple slots per day', () => {
    // Schedule: Monday has 2 slots (06:00-08:00 = 2h, 17:00-19:00 = 2h), Tue-Sat 4h, Sun off
    const emp = createTestEmployee({ rate: 20000, salaryDivisor: 'actual_scheduled_minutes' });
    const shifts = [
      { day_of_week: 1, shift_name: 'Morning Slot', start_time: '06:00', end_time: '08:00', scheduled_hours: 2.0, is_working_day: 1 },
      { day_of_week: 1, shift_name: 'Evening Slot', start_time: '17:00', end_time: '19:00', scheduled_hours: 2.0, is_working_day: 1 },
      { day_of_week: 2, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 3, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 4, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 5, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 6, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 7, start_time: '00:00', end_time: '00:00', scheduled_hours: 0, is_working_day: 0 },
    ];
    setCustomSchedule(emp.userId, shifts);

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);
    // 26 working days * 240 mins = 6,240 mins scheduled
    assert.equal(schedule.totalScheduledMinutes, 6240);

    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 13:00:00', 240, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.net_earnings, 20000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 4: Monthly salary, different scheduled hours on different weekdays
  // =========================================================================
  await t.test('4. Monthly salary, different scheduled hours on different weekdays', () => {
    // Schedule from Module 2:
    // Mon: 4h (5-7 and 17-19), Tue: 2h (5-7), Wed: 4h (5-7 and 17-19), Thu: Off, Fri: 2h (5-7), Sat: 4h (5-9), Sun: Off
    const emp = createTestEmployee({ rate: 19200, salaryDivisor: 'actual_scheduled_minutes' });
    const shifts = [
      { day_of_week: 1, shift_name: 'Mon M', start_time: '05:00', end_time: '07:00', scheduled_hours: 2.0, is_working_day: 1 },
      { day_of_week: 1, shift_name: 'Mon E', start_time: '17:00', end_time: '19:00', scheduled_hours: 2.0, is_working_day: 1 },
      { day_of_week: 2, shift_name: 'Tue M', start_time: '05:00', end_time: '07:00', scheduled_hours: 2.0, is_working_day: 1 },
      { day_of_week: 3, shift_name: 'Wed M', start_time: '05:00', end_time: '07:00', scheduled_hours: 2.0, is_working_day: 1 },
      { day_of_week: 3, shift_name: 'Wed E', start_time: '17:00', end_time: '19:00', scheduled_hours: 2.0, is_working_day: 1 },
      { day_of_week: 4, shift_name: 'Thu Off', start_time: '00:00', end_time: '00:00', scheduled_hours: 0, is_working_day: 0 },
      { day_of_week: 5, shift_name: 'Fri M', start_time: '05:00', end_time: '07:00', scheduled_hours: 2.0, is_working_day: 1 },
      { day_of_week: 6, shift_name: 'Sat M', start_time: '05:00', end_time: '09:00', scheduled_hours: 4.0, is_working_day: 1 },
      { day_of_week: 7, shift_name: 'Sun Off', start_time: '00:00', end_time: '00:00', scheduled_hours: 0, is_working_day: 0 },
    ];
    setCustomSchedule(emp.userId, shifts);

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);
    // Weekly minutes: 240 + 120 + 240 + 0 + 120 + 240 + 0 = 960 mins/week
    assert.ok(schedule.totalScheduledMinutes > 0);

    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 05:00:00', ? || ' 09:00:00', ?, 'completed')
        `).run(emp.userId, d.date, d.date, d.date, d.scheduledMinutes);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 19200);
    assert.equal(stmt.total_deductions, 0);
    assert.equal(stmt.net_earnings, 19200);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 5: Employee attending all scheduled minutes
  // =========================================================================
  await t.test('5. Employee attending all scheduled minutes', () => {
    const emp = createTestEmployee({ rate: 24000 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);

    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 24000);
    assert.equal(stmt.total_deductions, 0);
    assert.equal(stmt.net_earnings, 24000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 6: Employee missing one complete working day
  // =========================================================================
  await t.test('6. Employee missing one complete working day', () => {
    // 26 working days in Sep 2026 (6h/day = 360m/day, 9,360m total). Base = ₹18,000.
    // Daily equivalent = 18,000 / 26 = 692.31.
    // Misses 1 day (e.g. 2026-09-02).
    const emp = createTestEmployee({ rate: 18000, salaryDivisor: 'actual_scheduled_minutes' });
    const shifts = [];
    for (let day = 1; day <= 6; day++) {
      shifts.push({ day_of_week: day, start_time: '09:00', end_time: '15:00', scheduled_hours: 6.0, is_working_day: 1 });
    }
    shifts.push({ day_of_week: 7, start_time: '00:00', end_time: '00:00', scheduled_hours: 0, is_working_day: 0 });
    setCustomSchedule(emp.userId, shifts);

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);

    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay && d.date !== '2026-09-02') {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 15:00:00', 360, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 25 days attended * 360 = 9000 mins out of 9360 mins -> Gross earned = 18000 * (9000/9360) = 17307.69
    // Deduction = 692.31
    assert.equal(stmt.gross_earnings, 18000);
    assert.equal(stmt.total_deductions, 692.31);
    assert.equal(stmt.net_earnings, 17307.69);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 7: Employee attending only one of two daily slots
  // =========================================================================
  await t.test('7. Employee attending only one of two daily slots', () => {
    // Mon: Morning 05:00-07:00 (120m), Evening 17:00-19:00 (120m).
    // Attends morning (120m) only. Evening absent.
    const emp = createTestEmployee({ rate: 18000, salaryDivisor: 'actual_scheduled_minutes' });
    const shifts = [
      { day_of_week: 1, shift_name: 'Morning Slot', start_time: '05:00', end_time: '07:00', scheduled_hours: 2.0, is_working_day: 1 },
      { day_of_week: 1, shift_name: 'Evening Slot', start_time: '17:00', end_time: '19:00', scheduled_hours: 2.0, is_working_day: 1 },
    ];
    for (let day = 2; day <= 6; day++) {
      shifts.push({ day_of_week: day, start_time: '09:00', end_time: '13:00', scheduled_hours: 4.0, is_working_day: 1 });
    }
    shifts.push({ day_of_week: 7, start_time: '00:00', end_time: '00:00', scheduled_hours: 0, is_working_day: 0 });
    setCustomSchedule(emp.userId, shifts);

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);

    // Punch all days except Monday evening on 2026-09-07
    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        if (d.date === '2026-09-07') {
          // Mon: punch 120 mins morning only
          db.prepare(`
            INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
            VALUES (1, ?, '2026-09-07', '2026-09-07 05:00:00', '2026-09-07 07:00:00', 120, 'completed')
          `).run(emp.userId);
        } else {
          db.prepare(`
            INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
            VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 13:00:00', 240, 'completed')
          `).run(emp.userId, d.date, d.date, d.date);
        }
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // Missing exactly 120 minutes of evening slot -> deduction applies
    assert.ok(stmt.total_deductions > 0);
    assert.ok(stmt.net_earnings < 18000);
    assert.equal(stmt.net_earnings, 18000 - stmt.total_deductions);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 8: Employee attending partially (Short attendance: 49m of 8h shift)
  // =========================================================================
  await t.test('8. Employee attending partially (49m worked from 192h scheduled)', () => {
    // User scenario: joined on Nov 3. 24 working days * 8h = 192h (11,520m).
    // Base salary: ₹23,076.96. Attended only 49 minutes (0.8h) on Nov 3.
    // Financial accuracy: earned pay MUST be proportional to 49 mins (~₹98.24), NEVER ₹23,000+!
    const emp = createTestEmployee({ rate: 25000, joiningDate: '2026-11-03', salaryDivisor: 'actual_scheduled_minutes' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    // Punch only 49 minutes on Nov 3
    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
      VALUES (1, ?, '2026-11-03', '2026-11-03 10:13:00', '2026-11-03 11:02:00', 49, 'completed')
    `).run(emp.userId);

    const fullStatement = PayrollService.getEmployeeStatement(db, emp.userId, '2026-11');
    const snap = fullStatement.snapshot;

    // Prorated base = 23076.96
    assert.equal(fullStatement.statement.gross_earnings, 23076.96);
    // Accrued MTD earned = 23076.96 * (49 / 11520) = 98.16
    assert.equal(snap.accrued_mtd_earned, 98.16);
    assert.equal(fullStatement.accruedMtdNet, 98.16);

    // Finalized period check: If closed, net payable is strictly ₹98.16
    db.prepare("UPDATE staff_payroll_periods SET status = 'finalized' WHERE id = ?").run(period.id);
    db.prepare("DELETE FROM staff_salary_statements WHERE user_id = ?").run(emp.userId);
    const finalizedStmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(finalizedStmt.net_earnings, 98.16, 'Finalized net earnings for 49m work must be ₹98.16, not ₹23,000+');
    db.prepare("UPDATE staff_payroll_periods SET status = 'provisional' WHERE id = ?").run(period.id);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 9: Approved paid leave
  // =========================================================================
  await t.test('9. Approved paid leave', () => {
    const emp = createTestEmployee({ rate: 26000, salaryDivisor: 'working_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);

    // Approved paid leave on 2026-09-04
    db.prepare(`
      INSERT INTO leave_requests (academy_id, applicant_type, applicant_id, applicant_name, user_id, start_date, end_date, leave_type, days_count, is_paid, reason, status)
      VALUES (1, 'coach', ?, 'Test Emp', ?, '2026-09-04', '2026-09-04', 'casual', 1, 1, 'Personal', 'approved')
    `).run(emp.userId, emp.userId);

    // Punch all working days except 2026-09-04
    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay && d.date !== '2026-09-04') {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 26000);
    assert.equal(stmt.total_deductions, 0, 'No deductions for approved paid leave');
    assert.equal(stmt.net_earnings, 26000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 10: Approved unpaid leave
  // =========================================================================
  await t.test('10. Approved unpaid leave', () => {
    const emp = createTestEmployee({ rate: 26000, salaryDivisor: 'working_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);

    // Approved unpaid leave for 1 day
    db.prepare(`
      INSERT INTO leave_requests (academy_id, applicant_type, applicant_id, applicant_name, user_id, start_date, end_date, leave_type, days_count, is_paid, reason, status)
      VALUES (1, 'coach', ?, 'Test Emp', ?, '2026-09-04', '2026-09-04', 'unpaid', 1, 0, 'Personal', 'approved')
    `).run(emp.userId, emp.userId);

    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay && d.date !== '2026-09-04') {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 26000 / 26 = 1000 daily rate
    assert.equal(stmt.total_deductions, 1000);
    assert.equal(stmt.net_earnings, 25000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 11: Half-day paid leave
  // =========================================================================
  await t.test('11. Half-day paid leave', () => {
    const emp = createTestEmployee({ rate: 26000, salaryDivisor: 'working_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);

    // Approved half-day paid leave on 2026-09-04
    db.prepare(`
      INSERT INTO leave_requests (academy_id, applicant_type, applicant_id, applicant_name, user_id, start_date, end_date, leave_type, day_part, days_count, is_paid, reason, status)
      VALUES (1, 'coach', ?, 'Test Emp', ?, '2026-09-04', '2026-09-04', 'casual', 'first_half', 0.5, 1, 'Dentist', 'approved')
    `).run(emp.userId, emp.userId);

    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        const punchMin = d.date === '2026-09-04' ? 240 : 480;
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 13:00:00', ? || ' 17:00:00', ?, 'completed')
        `).run(emp.userId, d.date, d.date, d.date, punchMin);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.total_deductions, 0, 'No deduction when half day attended and other half covered by paid leave');
    assert.equal(stmt.net_earnings, 26000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 12: Half-day unpaid leave
  // =========================================================================
  await t.test('12. Half-day unpaid leave', () => {
    const emp = createTestEmployee({ rate: 26000, salaryDivisor: 'working_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);

    // Approved half-day unpaid leave on 2026-09-04
    db.prepare(`
      INSERT INTO leave_requests (academy_id, applicant_type, applicant_id, applicant_name, user_id, start_date, end_date, leave_type, day_part, days_count, is_paid, reason, status)
      VALUES (1, 'coach', ?, 'Test Emp', ?, '2026-09-04', '2026-09-04', 'half_day', 'second_half', 0.5, 0, 'Personal', 'approved')
    `).run(emp.userId, emp.userId);

    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        const punchMin = d.date === '2026-09-04' ? 240 : 480;
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 13:00:00', ?, 'completed')
        `).run(emp.userId, d.date, d.date, d.date, punchMin);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 26000 / 26 = 1000 daily rate. 0.5 day = 500
    assert.equal(stmt.total_deductions, 500);
    assert.equal(stmt.net_earnings, 25500);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 13: Academy paid holiday
  // =========================================================================
  await t.test('13. Academy paid holiday', () => {
    const emp = createTestEmployee({ rate: 26000, salaryDivisor: 'working_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');

    // Add paid holiday on 2026-09-04
    db.prepare(`
      INSERT INTO academy_holidays (academy_id, name, holiday_date, is_paid, status)
      VALUES (1, 'Academy Festival', '2026-09-04', 1, 'approved')
    `).run();

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);
    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.total_deductions, 0);
    assert.equal(stmt.net_earnings, 26000);

    db.prepare("DELETE FROM academy_holidays WHERE holiday_date = '2026-09-04'").run();
    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 14: Branch unpaid holiday
  // =========================================================================
  await t.test('14. Branch unpaid holiday', () => {
    const emp = createTestEmployee({ rate: 26000, salaryDivisor: 'working_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');

    // Add branch unpaid holiday on 2026-09-04
    db.prepare(`
      INSERT INTO academy_holidays (academy_id, branch_id, name, holiday_date, is_paid, status)
      VALUES (1, 1, 'Local Strike', '2026-09-04', 0, 'approved')
    `).run();

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);
    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay && d.date !== '2026-09-04') {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.ok(stmt.net_earnings <= 26000);

    db.prepare("DELETE FROM academy_holidays WHERE holiday_date = '2026-09-04'").run();
    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 15: Weekly off
  // =========================================================================
  await t.test('15. Weekly off is never deducted and not marked absent', () => {
    const emp = createTestEmployee({ rate: 26000, salaryDivisor: 'working_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);

    assert.equal(schedule.weeklyOffDays, 4); // 4 Sundays in Sep 2026
    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const snap = JSON.parse(stmt.calculation_snapshot);
    assert.equal(snap.weekly_offs, 4);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 16: Holiday falling on a weekly off (No double counting)
  // =========================================================================
  await t.test('16. Holiday falling on a weekly off', () => {
    const emp = createTestEmployee({ rate: 26000, salaryDivisor: 'working_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');

    // 2026-09-06 is Sunday (Weekly Off)
    db.prepare(`
      INSERT INTO academy_holidays (academy_id, name, holiday_date, is_paid, status)
      VALUES (1, 'Sunday Holiday', '2026-09-06', 1, 'approved')
    `).run();

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);
    // Scheduled working days should not increase or double count
    assert.equal(schedule.scheduledWorkingDays, 26);
    assert.equal(schedule.weeklyOffDays, 4);

    db.prepare("DELETE FROM academy_holidays WHERE holiday_date = '2026-09-06'").run();
    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 17: Employee joining mid-month
  // =========================================================================
  await t.test('17. Employee joining mid-month', () => {
    // Joining on March 16 (16 days active out of 31) with calendar_days divisor
    const emp = createTestEmployee({ rate: 31000, joiningDate: '2026-03-16', salaryDivisor: 'calendar_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-03');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date, '2026-03-16');

    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 16 days * 1000 = 16000
    assert.equal(stmt.gross_earnings, 16000);
    assert.equal(stmt.net_earnings, 16000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 18: Employee leaving mid-month
  // =========================================================================
  await t.test('18. Employee leaving mid-month', () => {
    // Resigning on March 15 (15 days active out of 31) with calendar_days divisor
    const emp = createTestEmployee({ rate: 31000, joiningDate: '2026-01-01', exitDate: '2026-03-15', salaryDivisor: 'calendar_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-03');
    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date, '2026-01-01', '2026-03-15');

    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 15 days * 1000 = 15000
    assert.equal(stmt.gross_earnings, 15000);
    assert.equal(stmt.net_earnings, 15000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 19: Salary revision mid-month
  // =========================================================================
  await t.test('19. Salary revision mid-month', () => {
    // 1st-15th March at ₹31,000, 16th-31st March at ₹62,000
    const emp = createTestEmployee({ rate: 62000, joiningDate: '2026-01-01', salaryDivisor: 'working_days' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-03');

    // Log revision in employee_compensation_history
    db.prepare(`
      INSERT INTO employee_compensation_history (academy_id, user_id, previous_amount, new_amount, effective_from, compensation_mode, status)
      VALUES (1, ?, 31000, 62000, '2026-03-16', 'monthly', 'active')
    `).run(emp.userId);

    const schedule = ScheduleService.calculateExpectedHoursForPeriod(db, emp.userId, period.start_date, period.end_date);
    for (const d of schedule.dayBreakdown) {
      if (d.isWorkingDay) {
        db.prepare(`
          INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
          VALUES (1, ?, ?, ? || ' 09:00:00', ? || ' 17:00:00', 480, 'completed')
        `).run(emp.userId, d.date, d.date, d.date);
      }
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const snap = JSON.parse(stmt.calculation_snapshot);
    assert.equal(snap.salary_splits.length, 2);
    assert.ok(stmt.net_earnings > 31000 && stmt.net_earnings < 62000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 20: Hourly employee with multiple daily slots
  // =========================================================================
  await t.test('20. Hourly employee with multiple daily slots', () => {
    // Rate = ₹300/hour. Monday Slot 1: 2h (120m), Slot 2: 1.5h (90m). Total = 3.5h.
    // Payable = 3.5 * 300 = ₹1,050.
    const emp = createTestEmployee({ salaryMode: 'hourly', rate: 300 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    db.prepare(`
      INSERT INTO staff_slot_attendance (academy_id, user_id, attendance_date, slot_name, scheduled_start_time, scheduled_end_time, attended_minutes, status, source)
      VALUES (1, ?, '2026-11-02', 'Morning Slot', '06:00', '08:00', 120, 'present', 'manual')
    `).run(emp.userId);

    db.prepare(`
      INSERT INTO staff_slot_attendance (academy_id, user_id, attendance_date, slot_name, scheduled_start_time, scheduled_end_time, attended_minutes, status, source)
      VALUES (1, ?, '2026-11-02', 'Evening Slot', '17:00', '18:30', 90, 'present', 'manual')
    `).run(emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 210m = 3.5h * 300 = 1050
    assert.equal(stmt.gross_earnings, 1050);
    assert.equal(stmt.net_earnings, 1050);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 21: Per-minute employee
  // =========================================================================
  await t.test('21. Per-minute employee', () => {
    // Rate = ₹5.00/min. Attended 450 minutes. Earnings = 450 * 5 = ₹2,250.
    const emp = createTestEmployee({ salaryMode: 'per_minute', rate: 5.0 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
      VALUES (1, ?, '2026-11-03', '2026-11-03 09:00:00', '2026-11-03 16:30:00', 450, 'completed')
    `).run(emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 2250);
    assert.equal(stmt.net_earnings, 2250);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 22: Daily salary employee
  // =========================================================================
  await t.test('22. Daily salary employee', () => {
    // Rate = ₹1,000/day. Attended 3 distinct days -> ₹3,000
    const emp = createTestEmployee({ salaryMode: 'daily', rate: 1000 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    for (const d of ['2026-11-02', '2026-11-03', '2026-11-04']) {
      db.prepare(`
        INSERT INTO staff_slot_attendance (academy_id, user_id, attendance_date, slot_name, scheduled_start_time, scheduled_end_time, attended_minutes, status, source)
        VALUES (1, ?, ?, 'Shift', '09:00', '17:00', 480, 'present', 'manual')
      `).run(emp.userId, d);
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 3000);
    assert.equal(stmt.net_earnings, 3000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 23: Session-based salary employee
  // =========================================================================
  await t.test('23. Session-based salary employee', () => {
    // Rate = ₹500/session. 6 verified completed sessions -> ₹3,000
    const emp = createTestEmployee({ salaryMode: 'per_session', rate: 500 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    for (let i = 1; i <= 6; i++) {
      const startH = String(5 + i).padStart(2, '0');
      const endH = String(6 + i).padStart(2, '0');
      db.prepare(`
        INSERT INTO staff_slot_attendance (academy_id, user_id, attendance_date, slot_name, shift_type, scheduled_start_time, scheduled_end_time, attended_minutes, status, source)
        VALUES (1, ?, '2026-11-05', 'Session ' || ?, 'regular', ? || ':00', ? || ':00', 60, 'present', 'manual')
      `).run(emp.userId, i, startH, endH);
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 3000);
    assert.equal(stmt.net_earnings, 3000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 24: Hybrid compensation
  // =========================================================================
  await t.test('24. Hybrid compensation (Base ₹20,000 + 4 sessions @ ₹500 = ₹22,000)', () => {
    const emp = createTestEmployee({ salaryMode: 'hybrid', rate: 20000, sessionRate: 500 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    for (let i = 1; i <= 4; i++) {
      const startH = String(5 + i).padStart(2, '0');
      const endH = String(6 + i).padStart(2, '0');
      db.prepare(`
        INSERT INTO staff_slot_attendance (academy_id, user_id, attendance_date, slot_name, shift_type, scheduled_start_time, scheduled_end_time, attended_minutes, status, source)
        VALUES (1, ?, '2026-11-06', 'Special Class ' || ?, 'regular', ? || ':00', ? || ':00', 60, 'present', 'manual')
      `).run(emp.userId, i, startH, endH);
    }

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // 20000 base + 4 * 500 = 22000
    assert.equal(stmt.gross_earnings, 22000);
    assert.equal(stmt.net_earnings, 22000);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 25: Approved overtime
  // =========================================================================
  await t.test('25. Approved overtime is credited to salary', () => {
    const emp = createTestEmployee({ rate: 26000, overtimeEligible: 1, overtimeRateMultiplier: 1.5 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    db.prepare(`
      INSERT INTO overtime_requests (academy_id, user_id, date, overtime_minutes, payable_amount, status, requested_by, approved_by)
      VALUES (1, ?, '2026-11-04', 120, 375.0, 'approved', ?, 1)
    `).run(emp.userId, emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.total_additions, 375.0);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 26: Unapproved overtime (> 30 mins)
  // =========================================================================
  await t.test('26. Unapproved overtime exceeding 30 mins is strictly excluded until approved', () => {
    const emp = createTestEmployee({ rate: 26000, overtimeEligible: 1, overtimeGraceMinutes: 30 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    // 60 minutes overtime with pending status
    db.prepare(`
      INSERT INTO overtime_requests (academy_id, user_id, date, overtime_minutes, payable_amount, status, requested_by)
      VALUES (1, ?, '2026-11-05', 60, 150.0, 'pending', ?)
    `).run(emp.userId, emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const snap = JSON.parse(stmt.calculation_snapshot);
    assert.equal(snap.overtime_amount, 0, 'Unapproved overtime > 30m must not be payable');

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 27: Exactly 30 minutes overtime
  // =========================================================================
  await t.test('27. Exactly 30 minutes overtime does not require additional approval', () => {
    const emp = createTestEmployee({ rate: 26000, overtimeEligible: 1, overtimeGraceMinutes: 30, salaryMode: 'hourly' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    // Punch with exactly 30 mins overtime
    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, overtime_minutes, status)
      VALUES (1, ?, '2026-11-06', '2026-11-06 09:00:00', '2026-11-06 17:30:00', 510, 30, 'completed')
    `).run(emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const snap = JSON.parse(stmt.calculation_snapshot);
    // Incidental OT of 30 mins (0.5h * 26000 = 13000)
    assert.ok(snap.overtime_amount > 0, 'Exactly 30 mins overtime is credited without extra approval');

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 28: Overtime exceeding 30 minutes
  // =========================================================================
  await t.test('28. Overtime exceeding 30 minutes requires explicit administrative approval', () => {
    const emp = createTestEmployee({ rate: 26000, overtimeEligible: 1, overtimeGraceMinutes: 30 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    // 45 minutes punch overtime (without explicit approved request)
    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, overtime_minutes, status)
      VALUES (1, ?, '2026-11-07', '2026-11-07 09:00:00', '2026-11-07 17:45:00', 525, 45, 'completed')
    `).run(emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const snap = JSON.parse(stmt.calculation_snapshot);
    assert.equal(snap.overtime_amount, 0, 'Unapproved punch overtime > 30 mins must not be paid');

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 29: Missing checkout (in-progress punch)
  // =========================================================================
  await t.test('29. Missing checkout punch does not pay infinite minutes', () => {
    const emp = createTestEmployee({ rate: 26000, salaryMode: 'hourly' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
      VALUES (1, ?, '2026-11-08', '2026-11-08 09:00:00', NULL, NULL, 'in_progress')
    `).run(emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 0, 'Open unclosed punch must not generate uncontrolled hours');

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 30: Duplicate attendance
  // =========================================================================
  await t.test('30. Anti-duplication prevents double payment for overlapping punch & slot', () => {
    const emp = createTestEmployee({ rate: 200, salaryMode: 'hourly' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    // Both a biometric punch (120m) and a slot record (120m) exist for the same day
    db.prepare(`
      INSERT INTO staff_slot_attendance (academy_id, user_id, attendance_date, slot_name, scheduled_start_time, scheduled_end_time, attended_minutes, status, source)
      VALUES (1, ?, '2026-11-09', 'Morning', '09:00', '11:00', 120, 'present', 'manual')
    `).run(emp.userId);

    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
      VALUES (1, ?, '2026-11-09', '2026-11-09 09:00:00', '2026-11-09 11:00:00', 120, 'completed')
    `).run(emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    // Should credit 120m (2.0h) once, NOT 240m!
    assert.equal(stmt.gross_earnings, 400); // 2h * 200 = 400

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 31: Attendance adjustment after provisional payroll
  // =========================================================================
  await t.test('31. Attendance adjustment updates statement prior to finalization', () => {
    const emp = createTestEmployee({ rate: 200, salaryMode: 'hourly' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');
    db.prepare("UPDATE staff_payroll_periods SET status = 'provisional' WHERE id = ?").run(period.id);

    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
      VALUES (1, ?, '2026-11-10', '2026-11-10 09:00:00', '2026-11-10 11:00:00', 120, 'completed')
    `).run(emp.userId);

    let stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.net_earnings, 400);

    // Later adjustment adds another punch
    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
      VALUES (1, ?, '2026-11-11', '2026-11-11 09:00:00', '2026-11-11 11:00:00', 120, 'completed')
    `).run(emp.userId);

    stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.net_earnings, 800, 'Recalculation reflects attendance adjustment in provisional state');

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 32: Attendance correction after finalization
  // =========================================================================
  await t.test('32. Finalized payroll locks snapshot; modifications blocked without reopening', () => {
    const emp = createTestEmployee({ rate: 200, salaryMode: 'hourly' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');
    db.prepare("UPDATE staff_payroll_periods SET status = 'provisional' WHERE id = ?").run(period.id);

    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
      VALUES (1, ?, '2026-11-12', '2026-11-12 09:00:00', '2026-11-12 11:00:00', 120, 'completed')
    `).run(emp.userId);

    PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    PayrollService.finalizePayrollPeriod(db, period.id, 1);

    // Try to inject late punch
    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
      VALUES (1, ?, '2026-11-13', '2026-11-13 09:00:00', '2026-11-13 11:00:00', 120, 'completed')
    `).run(emp.userId);

    const lockedStmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(lockedStmt.net_earnings, 400, 'Finalized payroll ignores late punches without reopening');

    // Cleanup: reopen for subsequent tests
    PayrollService.reopenPayrollPeriod(db, period.id, 'Test cleanup', 1);
    db.prepare("UPDATE staff_payroll_periods SET status = 'provisional' WHERE id = ?").run(period.id);
    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 33: Payroll partial payment
  // =========================================================================
  await t.test('33. Payroll partial payment updates paid amount and balance', () => {
    const emp = createTestEmployee({ rate: 1000, salaryMode: 'hourly' });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
      VALUES (1, ?, '2026-11-14', '2026-11-14 09:00:00', '2026-11-14 19:00:00', 600, 'completed')
    `).run(emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.net_earnings, 10000); // 10h * 1000 = 10000

    PayrollService.recordSalaryPayment(db, {
      statementId: stmt.id,
      amount: 4000,
      paymentMethod: 'bank_transfer',
      referenceNumber: 'TXN12345'
    });

    const updated = db.prepare('SELECT * FROM staff_salary_statements WHERE id = ?').get(stmt.id);
    assert.equal(updated.paid_amount, 4000);
    assert.equal(updated.balance_amount, 6000);
    assert.equal(updated.payment_status, 'partially_paid');

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 34: Payroll reopening and adjustment
  // =========================================================================
  await t.test('34. Authorized reopening allows adjustments with audit history', () => {
    const emp = createTestEmployee({ rate: 26000 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');
    db.prepare("UPDATE staff_payroll_periods SET status = 'provisional' WHERE id = ?").run(period.id);

    PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    PayrollService.finalizePayrollPeriod(db, period.id, 1);
    const reopenRes = PayrollService.reopenPayrollPeriod(db, period.id, 'Approved salary correction', 1);
    assert.equal(reopenRes.status, 'reopened');

    // Add authorized bonus adjustment
    const stmt = db.prepare('SELECT id FROM staff_salary_statements WHERE user_id = ? AND payroll_period_id = ?').get(emp.userId, period.id);
    PayrollService.addSalaryAdjustment(db, {
      statementId: stmt.id,
      type: 'addition',
      category: 'bonus',
      amount: 1500,
      reason: 'Diwali Performance Bonus'
    });

    const updated = db.prepare('SELECT * FROM staff_salary_statements WHERE id = ?').get(stmt.id);
    assert.equal(updated.total_additions, 1500);

    db.prepare("UPDATE staff_payroll_periods SET status = 'provisional' WHERE id = ?").run(period.id);
    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 35: Employee with no scheduled working days in the period
  // =========================================================================
  await t.test('35. Employee with no scheduled working days handles zero division cleanly', () => {
    const emp = createTestEmployee({ rate: 25000, salaryDivisor: 'actual_scheduled_minutes' });
    // Zero working days (all 7 days marked off)
    const shifts = [];
    for (let day = 1; day <= 7; day++) {
      shifts.push({ day_of_week: day, start_time: '00:00', end_time: '00:00', scheduled_hours: 0, is_working_day: 0 });
    }
    setCustomSchedule(emp.userId, shifts);

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');
    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);

    assert.equal(stmt.gross_earnings, 0);
    assert.equal(stmt.net_earnings, 0);
    assert.equal(Number.isNaN(stmt.net_earnings), false, 'Must not be NaN');

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 36: Zero-hour or invalid salary configuration
  // =========================================================================
  await t.test('36. Zero base rate handled cleanly without errors', () => {
    const emp = createTestEmployee({ rate: 0 });
    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-11');

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    assert.equal(stmt.gross_earnings, 0);
    assert.equal(stmt.net_earnings, 0);

    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 37: Rounding and decimal precision
  // =========================================================================
  await t.test('37. Minute proration retains exact precision without premature rounding', () => {
    // ₹18,000 / 9,360 minutes = 1.923076923...
    // For 5,000 minutes attended: 18000 * (5000 / 9360) = 9615.3846... -> ₹9,615.38
    const emp = createTestEmployee({ rate: 18000, salaryDivisor: 'actual_scheduled_minutes' });
    const shifts = [];
    for (let day = 1; day <= 6; day++) {
      shifts.push({ day_of_week: day, start_time: '09:00', end_time: '15:00', scheduled_hours: 6.0, is_working_day: 1 });
    }
    shifts.push({ day_of_week: 7, start_time: '00:00', end_time: '00:00', scheduled_hours: 0, is_working_day: 0 });
    setCustomSchedule(emp.userId, shifts);

    const period = PayrollService.getOrCreatePeriod(db, 1, '2026-09');
    // Lock period to test finalized minute proration
    db.prepare("UPDATE staff_payroll_periods SET status = 'finalized' WHERE id = ?").run(period.id);

    // Punch exactly 5,000 minutes
    db.prepare(`
      INSERT INTO staff_time_punches (academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status)
      VALUES (1, ?, '2026-09-02', '2026-09-02 09:00:00', '2026-09-02 17:00:00', 5000, 'completed')
    `).run(emp.userId);

    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, emp.userId);
    const expected = Number((18000 * (5000 / 9360)).toFixed(2)); // 9615.38
    assert.equal(stmt.net_earnings, expected);
    assert.equal(stmt.net_earnings, 9615.38);

    db.prepare("UPDATE staff_payroll_periods SET status = 'provisional' WHERE id = ?").run(period.id);
    cleanupEmployee(emp);
  });

  // =========================================================================
  // TEST 38: Multiple branches and overlapping schedules
  // =========================================================================
  await t.test('38. Multiple branches and overlapping shift detection', () => {
    // Shifts at Branch 1 (09:00-12:00) and Branch 2 (12:15-15:00) with 30m travel buffer
    const overlappingShifts = [
      { day_of_week: 1, start_time: '09:00', end_time: '12:00', scheduled_hours: 3.0, is_working_day: 1 },
      { day_of_week: 1, start_time: '11:30', end_time: '14:30', scheduled_hours: 3.0, is_working_day: 1 },
    ];

    assert.throws(() => {
      ScheduleService.validateShifts(overlappingShifts);
    }, /Overlapping shifts detected/);
  });
});
