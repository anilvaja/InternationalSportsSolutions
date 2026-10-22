import { ScheduleService } from './scheduleService.js';
import { DateUtils } from '../utils/dateUtils.js';

/**
 * PayrollService
 * Centralized attendance-based staff salary calculation engine.
 * Supports Monthly, Hourly, Per-Day, Per-Minute, and Per-Session salary modes.
 * Implements provisional statements visible from the 25th of each month,
 * explicit payroll review, approval, finalization, authorized reopening with audit trail,
 * itemized additions/deductions, mid-month joining/resignation/salary revision proration,
 * weekly off & holiday non-deduction, half-day unpaid leave deductions, and disbursements.
 */
export class PayrollService {

  /**
   * Helper: decimal-safe rounding to 2 decimal places
   */
  static round(val) {
    return Number((Math.round((Number(val) || 0) * 100) / 100).toFixed(2));
  }

  /**
   * Helper: calculates duration in minutes between two HH:MM time strings
   */
  static getDurationMinutes(startTime, endTime) {
    if (!startTime || !endTime) return 60;
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
  }

  /**
   * Retrieves effective salary profile for a staff user on a given date
   */
  static getEffectiveSalaryProfile(db, userId, dateStr = new Date().toISOString().split('T')[0]) {
    const profile = db.prepare(`
      SELECT * FROM staff_salary_profiles
      WHERE user_id = ?
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
        AND is_active = 1
      ORDER BY effective_from DESC
      LIMIT 1
    `).get(userId, dateStr, dateStr);

    if (profile) {
      return profile;
    }

    // Check recent compensation history
    try {
      const comp = db.prepare(`
        SELECT * FROM employee_compensation_history
        WHERE user_id = ?
          AND effective_from <= ?
          AND (effective_to IS NULL OR effective_to >= ?)
          AND (status IS NULL OR status = 'active')
        ORDER BY effective_from DESC
        LIMIT 1
      `).get(userId, dateStr, dateStr);

      if (comp) {
        return {
          user_id: userId,
          salary_mode: comp.compensation_mode || 'monthly',
          base_rate: Number(comp.new_amount || 30000),
          currency: comp.currency || 'INR',
          scheduled_daily_hours: 8.0,
          scheduled_days_per_week: 6,
          overtime_eligible: 1,
          overtime_rate_multiplier: 1.0,
          deduction_policy: 'working_days',
          effective_from: comp.effective_from,
          effective_to: comp.effective_to,
          payment_frequency: 'monthly',
          scheduled_payday: 1,
        };
      }
    } catch (_) {}

    const sched = ScheduleService.getEffectiveSchedule(db, userId, dateStr);

    // Fallback: check coach table
    const coach = db.prepare('SELECT * FROM coaches WHERE user_id = ?').get(userId);
    if (coach) {
      const mode = coach.salary_type === 'per_session' ? 'per_session' : 'monthly';
      return {
        user_id: userId,
        salary_mode: mode,
        base_rate: Number(coach.salary_amount || (mode === 'monthly' ? 30000 : 500)),
        currency: 'INR',
        scheduled_daily_hours: sched.expected_daily_hours || 4.0,
        scheduled_days_per_week: sched.working_days_per_week || 6,
        overtime_eligible: 1,
        overtime_rate_multiplier: 1.0,
        deduction_policy: 'working_days',
        effective_from: '2026-01-01',
        payment_frequency: 'monthly',
        scheduled_payday: 1,
        is_fallback: true,
      };
    }

    // Default staff fallback
    return {
      user_id: userId,
      salary_mode: 'monthly',
      base_rate: 25000,
      currency: 'INR',
      scheduled_daily_hours: sched.expected_daily_hours || 8.0,
      scheduled_days_per_week: sched.working_days_per_week || 6,
      overtime_eligible: 1,
      overtime_rate_multiplier: 1.0,
      deduction_policy: 'working_days',
      effective_from: '2026-01-01',
      payment_frequency: 'monthly',
      scheduled_payday: 1,
      is_fallback: true,
    };
  }

  /**
   * Gets or creates a monthly payroll period
   */
  static getOrCreatePeriod(db, academyId, yearMonth) {
    let period = db.prepare('SELECT * FROM staff_payroll_periods WHERE academy_id = ? AND year_month = ?')
      .get(academyId, yearMonth);

    if (!period) {
      const [year, month] = yearMonth.split('-').map(Number);
      const startDate = `${yearMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
      const defaultPaymentDate = `${yearMonth}-28`;

      const ins = db.prepare(`
        INSERT INTO staff_payroll_periods (
          academy_id, year_month, start_date, end_date, statement_visibility_day,
          status, expected_payment_date
        ) VALUES (?, ?, ?, ?, 25, 'provisional', ?)
      `).run(academyId, yearMonth, startDate, endDate, defaultPaymentDate);

      period = db.prepare('SELECT * FROM staff_payroll_periods WHERE id = ?').get(ins.lastInsertRowid);
    }

    return period;
  }

  /**
   * Calculates statement for an individual employee for a given period
   */
  static calculateEmployeeStatement(db, periodId, userId, academyId = 1) {
    const period = db.prepare('SELECT * FROM staff_payroll_periods WHERE id = ?').get(periodId);
    if (!period) {
      throw new Error(`Payroll period ${periodId} not found`);
    }

    const existingStatement = db.prepare(`
      SELECT * FROM staff_salary_statements
      WHERE payroll_period_id = ? AND user_id = ?
    `).get(periodId, userId);

    // If period is finalized, preserve immutable calculation snapshot!
    if (period.status === 'finalized' && existingStatement) {
      return existingStatement;
    }

    const profile = this.getEffectiveSalaryProfile(db, userId, period.end_date);
    const mode = profile.salary_mode;
    const rate = this.round(profile.base_rate);
    const currency = profile.currency || 'INR';

    // 1. Calculate Expected Hours & Schedule from employee's assigned schedule
    const scheduleSummary = ScheduleService.calculateExpectedHoursForPeriod(
      db, userId, period.start_date, period.end_date
    );

    // 2. Query verified batch sessions in this period (for coaches / session pay)
    const coach = db.prepare('SELECT id FROM coaches WHERE user_id = ?').get(userId);
    const coachId = coach ? coach.id : null;

    let sessions = [];
    if (coachId) {
      sessions = db.prepare(`
        SELECT bs.*, b.name as batch_name
        FROM batch_sessions bs
        JOIN batches b ON bs.batch_id = b.id
        WHERE (bs.coach_id = ? OR bs.substitute_coach_id = ?)
          AND bs.scheduled_date BETWEEN ? AND ?
          AND bs.status != 'cancelled'
          AND bs.attendance_status = 'completed'
        ORDER BY bs.scheduled_date ASC
      `).all(coachId, coachId, period.start_date, period.end_date);
    }

    // 3. Query staff time punches in this period
    const punches = db.prepare(`
      SELECT * FROM staff_time_punches
      WHERE user_id = ?
        AND punch_date BETWEEN ? AND ?
        AND status = 'completed'
      ORDER BY punch_date ASC
    `).all(userId, period.start_date, period.end_date);

    let punchMinutes = 0;
    let punchOvertimeMinutes = 0;
    const punchDates = new Set();
    for (const p of punches) {
      punchMinutes += (p.duration_minutes || 0);
      punchOvertimeMinutes += (p.overtime_minutes || 0);
      if (p.punch_date) punchDates.add(p.punch_date);
    }

    let sessionMinutes = 0;
    const sessionDates = new Set();
    for (const s of sessions) {
      sessionMinutes += this.getDurationMinutes(s.start_time, s.end_time);
      if (s.scheduled_date) sessionDates.add(s.scheduled_date);
    }

    const allWorkedDates = new Set([...punchDates, ...sessionDates]);
    const actualDaysWorked = allWorkedDates.size;

    const totalActualMinutes = Math.max(punchMinutes, sessionMinutes) > 0 
      ? (punchMinutes > 0 ? punchMinutes : sessionMinutes)
      : (scheduleSummary.scheduledWorkingDays > 0 && punches.length === 0 && sessions.length === 0 ? 0 : 0);

    const actualHoursWorked = this.round(totalActualMinutes / 60);

    // 4. Compute compensation according to mode
    let payableUnits = 0;
    let grossEarnings = 0;
    let unitLabel = '';
    let absenceDeductions = 0;
    let salarySplits = [];

    if (mode === 'hourly') {
      unitLabel = 'hours';
      payableUnits = actualHoursWorked > 0 ? actualHoursWorked : (punches.length > 0 ? this.round(punchMinutes / 60) : this.round(sessionMinutes / 60));
      grossEarnings = this.round(payableUnits * rate);

    } else if (mode === 'monthly') {
      unitLabel = 'month';
      payableUnits = 1;

      // Deduction basis policy: 'working_days' (default), 'calendar_days', or 'fixed_30'
      const deductionPolicy = profile.deduction_policy || 'working_days';
      let deductionBasis = Math.max(1, scheduleSummary.scheduledWorkingDays);
      if (deductionPolicy === 'calendar_days') {
        deductionBasis = Math.max(1, scheduleSummary.totalCalendarDays);
      } else if (deductionPolicy === 'fixed_30') {
        deductionBasis = 30;
      }
      const perDayRate = this.round(rate / deductionBasis);

      // Check for mid-month salary revision
      let hasMidMonthRevision = false;
      try {
        const revisions = db.prepare(`
          SELECT * FROM employee_compensation_history
          WHERE user_id = ?
            AND effective_from > ?
            AND effective_from <= ?
            AND (status IS NULL OR status = 'active')
          ORDER BY effective_from ASC
        `).all(userId, period.start_date, period.end_date);

        const profileRevisions = db.prepare(`
          SELECT * FROM staff_salary_profiles
          WHERE user_id = ?
            AND effective_from > ?
            AND effective_from <= ?
            AND is_active = 1
          ORDER BY effective_from ASC
        `).all(userId, period.start_date, period.end_date);

        if (revisions.length > 0 && Number(revisions[0].previous_amount || 0) > 0) {
          hasMidMonthRevision = true;
          const rev = revisions[0];
          const splitDate = rev.effective_from;
          const oldRate = this.round(rev.previous_amount || rate);
          const newRate = this.round(rev.new_amount);

          const daysBefore = (scheduleSummary.dayBreakdown || []).filter(d => d.date < splitDate && d.dayType !== 'not_employed').length;
          const daysAfter = (scheduleSummary.dayBreakdown || []).filter(d => d.date >= splitDate && d.dayType !== 'not_employed').length;
          const totalEmpDays = Math.max(1, daysBefore + daysAfter);

          const part1 = this.round((oldRate / totalEmpDays) * daysBefore);
          const part2 = this.round((newRate / totalEmpDays) * daysAfter);
          grossEarnings = this.round(part1 + part2);

          salarySplits.push({
            period: `${period.start_date} to ${splitDate}`,
            rate: oldRate,
            days: daysBefore,
            amount: part1
          });
          salarySplits.push({
            period: `${splitDate} to ${period.end_date}`,
            rate: newRate,
            days: daysAfter,
            amount: part2
          });
        } else if (profileRevisions.length > 0) {
          const rev = profileRevisions[0];
          const splitDate = rev.effective_from;
          const prevProfile = db.prepare(`
            SELECT * FROM staff_salary_profiles
            WHERE user_id = ? AND effective_from < ?
            ORDER BY effective_from DESC LIMIT 1
          `).get(userId, splitDate);

          if (prevProfile) {
            hasMidMonthRevision = true;
            const oldRate = this.round(prevProfile.base_rate);
            const newRate = this.round(rev.base_rate);

            const daysBefore = (scheduleSummary.dayBreakdown || []).filter(d => d.date < splitDate && d.dayType !== 'not_employed').length;
            const daysAfter = (scheduleSummary.dayBreakdown || []).filter(d => d.date >= splitDate && d.dayType !== 'not_employed').length;
            const totalEmpDays = Math.max(1, scheduleSummary.totalCalendarDays || (daysBefore + daysAfter));

            const part1 = this.round((oldRate / totalEmpDays) * daysBefore);
            const part2 = this.round((newRate / totalEmpDays) * daysAfter);
            grossEarnings = this.round(part1 + part2);

            salarySplits.push({
              period: `${period.start_date} to ${splitDate}`,
              rate: oldRate,
              days: daysBefore,
              amount: part1
            });
            salarySplits.push({
              period: `${splitDate} to ${period.end_date}`,
              rate: newRate,
              days: daysAfter,
              amount: part2
            });
          }
        }
      } catch (_) {}

      if (!hasMidMonthRevision) {
        // Prorate base salary if employee joined mid-month or resigned mid-month
        const isMidMonthJoiner = scheduleSummary.joiningDate && scheduleSummary.joiningDate > period.start_date;
        const isMidMonthExit = scheduleSummary.exitDate && scheduleSummary.exitDate < period.end_date;

        if (isMidMonthJoiner || isMidMonthExit) {
          const effectiveStart = isMidMonthJoiner ? scheduleSummary.joiningDate : period.start_date;
          const effectiveEnd = isMidMonthExit ? scheduleSummary.exitDate : period.end_date;

          if (deductionPolicy === 'calendar_days') {
            const activeCalendarDays = DateUtils.getDateRange(effectiveStart, effectiveEnd).length;
            grossEarnings = this.round(activeCalendarDays * perDayRate);
          } else {
            const fullMonthDays = (scheduleSummary.dayBreakdown || []).filter(d => d.dayType !== 'weekly_off' && !d.isWeeklyOff).length || 26;
            const fullMonthDayRate = this.round(rate / fullMonthDays);
            grossEarnings = this.round(scheduleSummary.scheduledWorkingDays * fullMonthDayRate);
          }
        } else {
          grossEarnings = rate;
        }
      }

      // Compute unpaid leave deductions (Full day + Half day)
      const fullUnpaidDays = scheduleSummary.unpaidLeaveDays || 0;
      const halfUnpaidDays = (scheduleSummary.halfDayLeaveDays || 0) * 0.5;
      const totalUnpaidDays = fullUnpaidDays + halfUnpaidDays;
      const unpaidLeaveDeduction = this.round(totalUnpaidDays * perDayRate);

      // Unauthorized absences calculation
      const todayStr = new Date().toISOString().slice(0, 10);
      const isPeriodPast = period.end_date < todayStr;
      const scheduledWorkDays = Math.max(1, scheduleSummary.scheduledWorkingDays);

      const pastScheduledWorkDays = isPeriodPast
        ? scheduledWorkDays
        : (scheduleSummary.dayBreakdown || []).filter(d => 
            !d.isPriorToJoining && 
            !d.isPostExit &&
            d.dayType !== 'not_employed' && 
            d.dayType !== 'resigned' &&
            d.isWorkingDay && 
            d.date < todayStr && 
            !d.isLeave && 
            !d.isHoliday && 
            !d.isWeeklyOff
          ).length;

      let unauthorizedAbsences = 0;
      if (actualDaysWorked < pastScheduledWorkDays) {
        unauthorizedAbsences = Math.max(0, pastScheduledWorkDays - actualDaysWorked - fullUnpaidDays);
      }
      const unauthorizedDeduction = this.round(unauthorizedAbsences * perDayRate);

      absenceDeductions = this.round(unpaidLeaveDeduction + unauthorizedDeduction);

    } else if (mode === 'per_day') {
      unitLabel = 'days';
      // Payable units = actual days worked
      payableUnits = actualDaysWorked > 0 ? actualDaysWorked : scheduleSummary.scheduledWorkingDays;
      grossEarnings = this.round(payableUnits * rate);

    } else if (mode === 'per_session') {
      unitLabel = 'sessions';
      payableUnits = sessions.length;
      grossEarnings = this.round(payableUnits * rate);

    } else if (mode === 'per_minute') {
      unitLabel = 'minutes';
      payableUnits = totalActualMinutes;
      grossEarnings = this.round(payableUnits * rate);
    }

    // 5. Query approved overtime
    const approvedOvertime = db.prepare(`
      SELECT * FROM overtime_requests
      WHERE user_id = ? AND date BETWEEN ? AND ? AND status IN ('approved', 'auto_approved')
    `).all(userId, period.start_date, period.end_date);

    let approvedOvertimeAmount = 0;
    for (const ot of approvedOvertime) {
      approvedOvertimeAmount += Number(ot.payable_amount || 0);
    }

    if (profile.overtime_eligible && punchOvertimeMinutes > 0 && approvedOvertime.length === 0) {
      const otHours = punchOvertimeMinutes / 60;
      const otMultiplier = Number(profile.overtime_rate_multiplier || 1.0);
      const baseHourlyRate = mode === 'hourly' 
        ? rate 
        : (scheduleSummary.totalScheduledHours > 0 ? (rate / scheduleSummary.totalScheduledHours) : 150);
      approvedOvertimeAmount += this.round(otHours * baseHourlyRate * otMultiplier);
    }
    approvedOvertimeAmount = this.round(approvedOvertimeAmount);

    // 6. Query work exceptions for weekly-off or holiday work with overtime_pay compensation
    let workExceptionAmount = 0;
    try {
      const exceptions = db.prepare(`
        SELECT * FROM employee_work_exceptions
        WHERE user_id = ? AND date BETWEEN ? AND ?
          AND status = 'approved'
          AND compensation_type = 'overtime_pay'
      `).all(userId, period.start_date, period.end_date);

      for (const ex of exceptions) {
        const perDay = mode === 'monthly' ? this.round(rate / Math.max(1, scheduleSummary.scheduledWorkingDays)) : rate;
        workExceptionAmount += this.round(perDay * Number(ex.comp_off_days || 1.0));
      }
    } catch (_) {}

    // 7. Configured Allowances & Deductions from profile
    let profileAllowances = 0;
    let profileDeductions = 0;
    try {
      if (profile.allowances) {
        const arr = JSON.parse(profile.allowances);
        if (Array.isArray(arr)) {
          for (const item of arr) profileAllowances += Number(item.amount || 0);
        }
      }
      if (profile.deductions) {
        const arr = JSON.parse(profile.deductions);
        if (Array.isArray(arr)) {
          for (const item of arr) profileDeductions += Number(item.amount || 0);
        }
      }
    } catch (_) {}

    profileAllowances = this.round(profileAllowances);
    profileDeductions = this.round(profileDeductions);

    // 8. Manual additions and deductions
    let totalAdditions = this.round(approvedOvertimeAmount + workExceptionAmount + profileAllowances);
    let totalDeductions = this.round(profileDeductions + (absenceDeductions || 0));

    let statementId = existingStatement ? existingStatement.id : null;
    let paidAmount = existingStatement ? this.round(existingStatement.paid_amount || 0) : 0;

    if (statementId) {
      const adjustments = db.prepare('SELECT * FROM staff_salary_adjustments WHERE statement_id = ?').all(statementId);
      for (const adj of adjustments) {
        if (adj.type === 'addition') totalAdditions += Number(adj.amount || 0);
        if (adj.type === 'deduction') totalDeductions += Number(adj.amount || 0);
      }
    }

    totalAdditions = this.round(totalAdditions);
    totalDeductions = this.round(totalDeductions);

    const netEarnings = this.round(Math.max(0, grossEarnings + totalAdditions - totalDeductions));
    const balanceAmount = this.round(Math.max(0, netEarnings - paidAmount));
    const paymentStatus = balanceAmount === 0 && paidAmount > 0 ? 'paid' : (paidAmount > 0 ? 'partially_paid' : 'unpaid');

    const calculationSnapshot = JSON.stringify({
      salary_mode: mode,
      base_rate: rate,
      currency,
      unit_label: unitLabel,
      payable_units: payableUnits,
      scheduled_hours: scheduleSummary.totalScheduledHours,
      scheduled_working_days: scheduleSummary.scheduledWorkingDays,
      weekly_offs: scheduleSummary.weeklyOffDays,
      paid_holidays: scheduleSummary.holidayDays,
      paid_leaves: scheduleSummary.paidLeaveDays,
      unpaid_leaves: scheduleSummary.unpaidLeaveDays,
      half_day_leaves: scheduleSummary.halfDayLeaveDays || 0,
      absence_deductions: absenceDeductions,
      actual_hours_worked: actualHoursWorked,
      actual_days_worked: actualDaysWorked,
      verified_sessions_count: sessions.length,
      overtime_amount: approvedOvertimeAmount,
      work_exception_amount: workExceptionAmount,
      profile_allowances: profileAllowances,
      profile_deductions: profileDeductions,
      salary_splits: salarySplits,
      calculated_at: new Date().toISOString(),
      period_start: period.start_date,
      period_end: period.end_date,
      deduction_policy: profile.deduction_policy || 'working_days',
    });

    if (existingStatement) {
      db.prepare(`
        UPDATE staff_salary_statements
        SET salary_mode = ?, applicable_rate = ?, payable_units = ?, gross_earnings = ?,
            total_additions = ?, total_deductions = ?, net_earnings = ?, balance_amount = ?,
            payment_status = ?, calculation_snapshot = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        mode, rate, payableUnits, grossEarnings, totalAdditions, totalDeductions,
        netEarnings, balanceAmount, paymentStatus, calculationSnapshot, statementId
      );
    } else {
      const ins = db.prepare(`
        INSERT INTO staff_salary_statements (
          payroll_period_id, academy_id, user_id, salary_mode, applicable_rate,
          payable_units, gross_earnings, total_additions, total_deductions,
          net_earnings, paid_amount, balance_amount, payment_status, calculation_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', ?)
      `).run(
        periodId, academyId, userId, mode, rate, payableUnits, grossEarnings,
        totalAdditions, totalDeductions, netEarnings, netEarnings, calculationSnapshot
      );
      statementId = ins.lastInsertRowid;
    }

    return db.prepare('SELECT * FROM staff_salary_statements WHERE id = ?').get(statementId);
  }

  /**
   * Calculates statements for all coaches & staff in an academy for a period
   */
  static calculatePeriod(db, periodId, academyId = 1) {
    const period = db.prepare('SELECT * FROM staff_payroll_periods WHERE id = ?').get(periodId);
    if (!period) {
      throw new Error(`Payroll period ${periodId} not found`);
    }

    const staffUsers = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.email, u.role
      FROM users u
      WHERE u.role IN ('coach', 'academy_staff', 'academy_admin')
        AND u.status = 'active'
    `).all();

    const statements = [];
    db.transaction(() => {
      for (const user of staffUsers) {
        const stmt = this.calculateEmployeeStatement(db, periodId, user.id, academyId);
        statements.push(stmt);
      }
    })();

    return { periodId, statementsCount: statements.length };
  }

  /**
   * Approves a payroll period (workflow stage before finalization)
   */
  static approvePayrollPeriod(db, periodId, approvedByUserId) {
    const period = db.prepare('SELECT * FROM staff_payroll_periods WHERE id = ?').get(periodId);
    if (!period) {
      throw new Error(`Payroll period ${periodId} not found`);
    }
    if (period.status === 'finalized') {
      throw new Error(`Payroll period ${period.year_month} is already finalized.`);
    }

    // Auto-calculate any uncalculated statements first
    this.calculatePeriod(db, periodId, period.academy_id);

    db.prepare(`
      UPDATE staff_payroll_periods
      SET status = 'approved',
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(approvedByUserId || 1, periodId);

    // Audit log
    db.prepare(`
      INSERT INTO payroll_audit_logs (academy_id, entity_type, entity_id, action, actor_id, changes_summary, reason)
      VALUES (?, 'payroll_period', ?, 'approve', ?, ?, ?)
    `).run(
      period.academy_id,
      periodId,
      approvedByUserId || 1,
      `Payroll approved for cycle ${period.year_month}`,
      'Administrative payroll verification passed'
    );

    return { success: true, periodId, status: 'approved', yearMonth: period.year_month };
  }

  /**
   * Finalizes payroll period, locking statement inputs and calculations
   */
  static finalizePayrollPeriod(db, periodId, finalizedByUserId) {
    const period = db.prepare('SELECT * FROM staff_payroll_periods WHERE id = ?').get(periodId);
    if (!period) {
      throw new Error(`Payroll period ${periodId} not found`);
    }
    if (period.status === 'finalized') {
      throw new Error(`Payroll period ${period.year_month} is already finalized.`);
    }

    // Ensure all statements are calculated
    this.calculatePeriod(db, periodId, period.academy_id);

    db.prepare(`
      UPDATE staff_payroll_periods
      SET status = 'finalized',
          finalized_by = ?,
          finalized_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(finalizedByUserId || 1, periodId);

    // Audit log
    db.prepare(`
      INSERT INTO payroll_audit_logs (academy_id, entity_type, entity_id, action, actor_id, changes_summary, reason)
      VALUES (?, 'payroll_period', ?, 'finalize', ?, ?, ?)
    `).run(
      period.academy_id,
      periodId,
      finalizedByUserId || 1,
      `Locked payroll period ${period.year_month}`,
      'Monthly payroll finalized; immutable calculation snapshot created'
    );

    return {
      success: true,
      periodId,
      status: 'finalized',
      yearMonth: period.year_month,
    };
  }

  /**
   * Reopens a finalized payroll period through an authorized correction workflow
   */
  static reopenPayrollPeriod(db, periodId, reason, reopenedByUserId) {
    if (!reason || !reason.trim()) {
      throw new Error('A detailed reason is mandatory to reopen a finalized payroll period.');
    }

    const period = db.prepare('SELECT * FROM staff_payroll_periods WHERE id = ?').get(periodId);
    if (!period) {
      throw new Error(`Payroll period ${periodId} not found`);
    }

    db.prepare(`
      UPDATE staff_payroll_periods
      SET status = 'reopened',
          reopened_by = ?,
          reopened_at = CURRENT_TIMESTAMP,
          reopen_reason = ?
      WHERE id = ?
    `).run(reopenedByUserId || 1, reason.trim(), periodId);

    // Audit log
    db.prepare(`
      INSERT INTO payroll_audit_logs (academy_id, entity_type, entity_id, action, actor_id, changes_summary, reason)
      VALUES (?, 'payroll_period', ?, 'reopen', ?, ?, ?)
    `).run(
      period.academy_id,
      periodId,
      reopenedByUserId || 1,
      `Reopened finalized payroll period ${period.year_month}`,
      reason.trim()
    );

    return {
      success: true,
      periodId,
      status: 'reopened',
      yearMonth: period.year_month,
      reason: reason.trim()
    };
  }

  /**
   * Adds an itemized adjustment (bonus, overtime, unpaid leave deduction, penalty)
   */
  static addSalaryAdjustment(db, { statementId, type, category, amount, reason, createdBy = 1 }) {
    if (!statementId || !type || !amount || !reason) {
      throw new Error('Statement ID, type, amount, and reason are required');
    }
    const numAmount = this.round(amount);
    if (numAmount <= 0) {
      throw new Error('Adjustment amount must be greater than zero');
    }

    const statement = db.prepare('SELECT * FROM staff_salary_statements WHERE id = ?').get(statementId);
    if (!statement) {
      throw new Error('Salary statement not found');
    }

    let adjustmentId;
    db.transaction(() => {
      const ins = db.prepare(`
        INSERT INTO staff_salary_adjustments (statement_id, type, category, amount, reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(statementId, type, category || 'general', numAmount, reason.trim(), createdBy);
      adjustmentId = ins.lastInsertRowid;

      // Recalculate totals
      const adjustments = db.prepare('SELECT * FROM staff_salary_adjustments WHERE statement_id = ?').all(statementId);
      let totalAdditions = 0;
      let totalDeductions = 0;
      for (const a of adjustments) {
        if (a.type === 'addition') totalAdditions += Number(a.amount || 0);
        if (a.type === 'deduction') totalDeductions += Number(a.amount || 0);
      }

      totalAdditions = this.round(totalAdditions);
      totalDeductions = this.round(totalDeductions);

      const netEarnings = this.round(Math.max(0, statement.gross_earnings + totalAdditions - totalDeductions));
      const balanceAmount = this.round(Math.max(0, netEarnings - statement.paid_amount));
      const paymentStatus = balanceAmount === 0 && statement.paid_amount > 0 ? 'paid' : (statement.paid_amount > 0 ? 'partially_paid' : 'unpaid');

      db.prepare(`
        UPDATE staff_salary_statements
        SET total_additions = ?, total_deductions = ?, net_earnings = ?, balance_amount = ?, payment_status = ?
        WHERE id = ?
      `).run(totalAdditions, totalDeductions, netEarnings, balanceAmount, paymentStatus, statementId);

      // Audit log
      db.prepare(`
        INSERT INTO payroll_audit_logs (academy_id, entity_type, entity_id, action, actor_id, changes_summary, reason)
        VALUES (?, 'statement', ?, 'update', ?, ?, ?)
      `).run(
        statement.academy_id,
        statementId,
        createdBy,
        `Added ${type} of ₹${numAmount} (${category})`,
        reason.trim()
      );
    })();

    return { success: true, adjustmentId };
  }

  /**
   * Records a salary payout / disbursement (partial or full)
   */
  static recordSalaryPayment(db, {
    statementId,
    paymentDate,
    amount,
    paymentMethod,
    referenceNumber,
    notes,
    createdBy = 1,
  }) {
    if (!statementId || !amount || !paymentMethod) {
      throw new Error('Valid Statement ID, positive amount, and payment method are required');
    }
    const numAmount = this.round(amount);
    if (numAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const statement = db.prepare('SELECT * FROM staff_salary_statements WHERE id = ?').get(statementId);
    if (!statement) {
      throw new Error('Salary statement not found');
    }

    let paymentId;
    db.transaction(() => {
      const ins = db.prepare(`
        INSERT INTO staff_salary_payments (
          statement_id, payment_date, amount, payment_method, reference_number, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        statementId,
        paymentDate ? (DateUtils.parseAndNormalizeDate(paymentDate, { fieldName: 'Payment date' }) || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
        numAmount,
        paymentMethod,
        referenceNumber || null,
        notes || null,
        createdBy
      );
      paymentId = ins.lastInsertRowid;

      const newPaid = this.round(statement.paid_amount + numAmount);
      const newBalance = this.round(Math.max(0, statement.net_earnings - newPaid));
      const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

      db.prepare(`
        UPDATE staff_salary_statements
        SET paid_amount = ?, balance_amount = ?, payment_status = ?
        WHERE id = ?
      `).run(newPaid, newBalance, newStatus, statementId);

      // Audit log
      db.prepare(`
        INSERT INTO payroll_audit_logs (academy_id, entity_type, entity_id, action, actor_id, changes_summary, reason)
        VALUES (?, 'payment', ?, 'disburse', ?, ?, ?)
      `).run(
        statement.academy_id,
        paymentId,
        createdBy,
        `Disbursed ₹${numAmount} via ${paymentMethod} (Ref: ${referenceNumber || 'N/A'})`,
        notes || 'Salary disbursement'
      );
    })();

    return { success: true, paymentId };
  }

  /**
   * Retrieves an employee's salary statement respecting the 25th-of-month visibility rule
   */
  static getEmployeeStatement(db, userId, yearMonth) {
    const today = new Date();
    const currentDay = today.getDate();
    const period = this.getOrCreatePeriod(db, 1, yearMonth);

    const statement = this.calculateEmployeeStatement(db, period.id, userId, 1);
    const adjustments = db.prepare('SELECT * FROM staff_salary_adjustments WHERE statement_id = ?').all(statement.id);
    const payments = db.prepare('SELECT * FROM staff_salary_payments WHERE statement_id = ?').all(statement.id);

    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId);

    const visibilityDay = period.statement_visibility_day || 25;
    const isPastVisibilityDay = currentDay >= visibilityDay;
    const isFinalized = period.status === 'finalized';

    const approvedOvertime = db.prepare(`
      SELECT * FROM overtime_requests
      WHERE user_id = ? AND date BETWEEN ? AND ? AND status IN ('approved', 'auto_approved')
      ORDER BY date ASC
    `).all(userId, period.start_date, period.end_date);

    const pendingOvertime = db.prepare(`
      SELECT * FROM overtime_requests
      WHERE user_id = ? AND date BETWEEN ? AND ? AND status = 'pending'
      ORDER BY date ASC
    `).all(userId, period.start_date, period.end_date);

    const { calendarDays, attendanceSummary } = this.getEmployeeAttendanceCalendar(db, userId, period, statement);

    return {
      statement,
      user,
      period,
      adjustments,
      payments,
      approvedOvertime,
      pendingOvertime,
      calendarDays,
      attendanceSummary,
      visibility: {
        currentDay,
        visibilityDay,
        isPastVisibilityDay,
        isProvisional: !isFinalized,
        displayLabel: isFinalized
          ? 'Finalized Monthly Salary Statement'
          : (isPastVisibilityDay
            ? 'Provisional Salary Statement (Available from 25th)'
            : 'Estimated Earnings (Provisional statement available on the 25th)'),
      },
    };
  }

  /**
   * Builds day-by-day attendance calendar and itemized log with shift comparisons
   */
  static getEmployeeAttendanceCalendar(db, userId, period, statement) {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const scheduleSummary = ScheduleService.calculateExpectedHoursForPeriod(
      db, userId, period.start_date, period.end_date
    );

    const punches = db.prepare(`
      SELECT * FROM staff_time_punches
      WHERE user_id = ?
        AND punch_date BETWEEN ? AND ?
      ORDER BY punch_in_time ASC
    `).all(userId, period.start_date, period.end_date);

    const coach = db.prepare('SELECT id FROM coaches WHERE user_id = ?').get(userId);
    const coachId = coach ? coach.id : null;
    let sessions = [];
    if (coachId) {
      sessions = db.prepare(`
        SELECT bs.*, b.name as batch_name
        FROM batch_sessions bs
        JOIN batches b ON bs.batch_id = b.id
        WHERE (bs.coach_id = ? OR bs.substitute_coach_id = ?)
          AND bs.scheduled_date BETWEEN ? AND ?
          AND bs.status != 'cancelled'
        ORDER BY bs.start_time ASC
      `).all(coachId, coachId, period.start_date, period.end_date);
    }

    const allOvertime = db.prepare(`
      SELECT * FROM overtime_requests
      WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `).all(userId, period.start_date, period.end_date);

    const scheduledWorkDays = Math.max(1, scheduleSummary.scheduledWorkingDays || 26);
    const perDayDeduction = statement && statement.salary_mode === 'monthly'
      ? this.round((statement.applicable_rate || 0) / scheduledWorkDays)
      : 0;

    let daysPresent = 0;
    let halfDays = 0;
    let absentDays = 0;
    let weeklyOffs = 0;
    let holidays = 0;
    let paidLeaves = 0;
    let unpaidLeaves = 0;
    let totalActualWorkedMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalOvertimeAmount = 0;

    const calendarDays = (scheduleSummary.dayBreakdown || []).map((dayExp) => {
      const dateStr = dayExp.date;
      const dayDate = new Date(dateStr + 'T00:00:00');
      const dayNumber = dayDate.getDate();
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayNames[dayDate.getDay()];

      const dayPunches = punches.filter(p => p.punch_date === dateStr);
      const daySessions = sessions.filter(s => s.scheduled_date === dateStr);
      const dayOt = allOvertime.filter(o => o.date === dateStr);

      let workedMinutes = 0;
      let dayOtMinutes = 0;
      let firstIn = null;
      let lastOut = null;
      let hasActivePunch = false;

      for (const p of dayPunches) {
        if (p.status === 'in_progress') hasActivePunch = true;
        workedMinutes += (p.duration_minutes || 0);
        dayOtMinutes += (p.overtime_minutes || 0);
        if (!firstIn && p.punch_in_time) firstIn = p.punch_in_time;
        if (p.punch_out_time) lastOut = p.punch_out_time;
      }

      if (workedMinutes === 0 && daySessions.length > 0) {
        for (const s of daySessions) {
          workedMinutes += (ScheduleService.timeToMinutes(s.end_time) - ScheduleService.timeToMinutes(s.start_time));
          if (!firstIn && s.start_time) firstIn = s.start_time;
          if (s.end_time) lastOut = s.end_time;
        }
      }

      totalActualWorkedMinutes += workedMinutes;
      totalOvertimeMinutes += dayOtMinutes;

      const scheduledMinutes = Math.round((dayExp.scheduledHours || 0) * 60);
      const timeDiffMinutes = workedMinutes - scheduledMinutes;

      let otStatus = 'none';
      let otAmount = 0;
      if (dayOt.length > 0) {
        otStatus = dayOt[0].status;
        otAmount = this.round(dayOt.reduce((sum, o) => sum + (o.payable_amount || 0), 0));
        if (dayOt[0].overtime_minutes > dayOtMinutes) {
          dayOtMinutes = dayOt[0].overtime_minutes;
        }
      }
      totalOvertimeAmount += otAmount;

      let status = 'upcoming';
      let statusLabel = 'Scheduled';
      let badgeClass = 'badge-neutral';
      let financialImpact = 'Scheduled';

      if (dayExp.dayType === 'not_employed' || dayExp.isPriorToJoining) {
        status = 'not_employed';
        statusLabel = 'Not Employed';
        badgeClass = 'badge-neutral';
        financialImpact = 'Prior to Joining';
      } else if (dayExp.dayType === 'resigned' || dayExp.isPostExit) {
        status = 'resigned';
        statusLabel = 'Relieved / Resigned';
        badgeClass = 'badge-neutral';
        financialImpact = 'Post Resignation';
      } else if (hasActivePunch) {
        status = 'active_now';
        statusLabel = 'Punched In (Active)';
        badgeClass = 'badge-primary';
        financialImpact = 'Duty Active';
      } else if (workedMinutes > 0) {
        if (scheduledMinutes > 0 && workedMinutes < scheduledMinutes * 0.5) {
          status = 'half_day';
          statusLabel = 'Half Day';
          badgeClass = 'badge-warning';
          halfDays++;
          financialImpact = statement?.salary_mode === 'hourly'
            ? `₹${this.round((workedMinutes / 60) * (statement?.applicable_rate || 0))}`
            : `Half Day (-₹${this.round(perDayDeduction * 0.5)})`;
        } else {
          status = 'present';
          statusLabel = 'Present';
          badgeClass = 'badge-success';
          daysPresent++;
          if (otAmount > 0) {
            financialImpact = `Full Day (+₹${otAmount} OT)`;
          } else if (statement?.salary_mode === 'hourly') {
            financialImpact = `₹${this.round((workedMinutes / 60) * (statement?.applicable_rate || 0))}`;
          } else {
            financialImpact = 'Full Pay (Present)';
          }
        }
      } else if (dayExp.isLeave) {
        if (dayExp.dayType === 'unpaid_leave') {
          status = 'unpaid_leave';
          statusLabel = 'Unpaid Leave';
          badgeClass = 'badge-danger';
          unpaidLeaves++;
          financialImpact = `-₹${perDayDeduction} (Leave)`;
        } else if (dayExp.dayType === 'half_day_leave') {
          status = 'half_day_leave';
          statusLabel = 'Half-Day Leave';
          badgeClass = 'badge-warning';
          financialImpact = 'Half-Day Approved';
        } else {
          status = 'paid_leave';
          statusLabel = 'Paid Leave';
          badgeClass = 'badge-info';
          paidLeaves++;
          financialImpact = 'Full Pay (Leave)';
        }
      } else if (dayExp.isHoliday) {
        status = 'holiday';
        statusLabel = dayExp.holidayName ? `Holiday: ${dayExp.holidayName}` : 'Paid Holiday';
        badgeClass = 'badge-purple';
        holidays++;
        financialImpact = dayExp.isHolidayPaid ? 'Paid Holiday' : 'Unpaid Holiday';
      } else if (dayExp.isWeeklyOff) {
        status = 'weekly_off';
        statusLabel = 'Weekly Off';
        badgeClass = 'badge-secondary';
        weeklyOffs++;
        financialImpact = 'Weekly Off';
      } else if (dateStr > todayStr) {
        status = 'upcoming';
        statusLabel = 'Scheduled';
        badgeClass = 'badge-neutral';
        financialImpact = 'Upcoming';
      } else if (dateStr === todayStr) {
        status = 'shift_pending';
        statusLabel = 'Shift Pending';
        badgeClass = 'badge-info';
        financialImpact = 'Shift in Progress';
      } else {
        status = 'absent';
        statusLabel = 'Absent';
        badgeClass = 'badge-danger';
        absentDays++;
        financialImpact = `-₹${perDayDeduction} (Absent)`;
      }

      return {
        date: dateStr,
        dayNumber,
        dayName,
        isToday: dateStr === todayStr,
        isWorkingDay: dayExp.isWorkingDay,
        isWeeklyOff: dayExp.isWeeklyOff,
        isHoliday: dayExp.isHoliday,
        holidayName: dayExp.holidayName,
        isLeave: dayExp.isLeave,
        leaveType: dayExp.leaveType,
        scheduledHours: dayExp.scheduledHours,
        shifts: dayExp.shifts || [],
        punches: dayPunches,
        sessions: daySessions,
        firstPunchIn: firstIn,
        lastPunchOut: lastOut,
        durationMinutes: workedMinutes,
        actualWorkedHours: this.round(workedMinutes / 60),
        scheduledMinutes,
        timeDiffMinutes,
        overtimeMinutes: dayOtMinutes,
        overtimeStatus: otStatus,
        overtimeAmount: otAmount,
        status,
        statusLabel,
        badgeClass,
        financialImpact,
      };
    });

    return {
      calendarDays,
      attendanceSummary: {
        totalCalendarDays: calendarDays.length,
        scheduledWorkingDays: scheduleSummary.scheduledWorkingDays,
        daysPresent,
        halfDays,
        weeklyOffs,
        holidays,
        paidLeaves,
        unpaidLeaves,
        absentDays,
        totalScheduledHours: scheduleSummary.totalScheduledHours,
        totalActualWorkedHours: this.round(totalActualWorkedMinutes / 60),
        totalOvertimeHours: this.round(totalOvertimeMinutes / 60),
        totalOvertimeAmount: this.round(totalOvertimeAmount),
      },
    };
  }
}
