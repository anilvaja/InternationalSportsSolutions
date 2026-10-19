import { ScheduleService } from './scheduleService.js';

/**
 * PayrollService
 * Centralized attendance-based staff salary calculation engine.
 * Supports Monthly, Hourly, Per-Day, Per-Minute, and Per-Session salary modes.
 * Implements provisional statements visible from the 25th of each month,
 * explicit payroll finalization snapshots, itemized adjustments, and disbursements.
 */
export class PayrollService {

  /**
   * Helper: calculates duration in minutes between two HH:MM time strings
   */
  static getDurationMinutes(startTime, endTime) {
    if (!startTime || !endTime) return 60; // default 1 hour
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

    // Check if user has an assigned work schedule to read expected hours
    const sched = ScheduleService.getEffectiveSchedule(db, userId, dateStr);

    // Fallback: check coach table
    const coach = db.prepare('SELECT * FROM coaches WHERE user_id = ?').get(userId);
    if (coach) {
      const mode = coach.salary_type === 'per_session' ? 'per_session' : 'monthly';
      return {
        user_id: userId,
        salary_mode: mode,
        base_rate: coach.salary_amount || (mode === 'monthly' ? 30000 : 500),
        currency: 'INR',
        scheduled_daily_hours: sched.expected_daily_hours || 4.0,
        scheduled_days_per_week: sched.working_days_per_week || 6,
        overtime_eligible: 1,
        overtime_rate_multiplier: 1.0,
        deduction_policy: 'working_days',
        effective_from: '2026-01-01',
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

    // If period is finalized, do not silently recalculate - preserve snapshot!
    const existingStatement = db.prepare(`
      SELECT * FROM staff_salary_statements
      WHERE payroll_period_id = ? AND user_id = ?
    `).get(periodId, userId);

    if (period.status === 'finalized' && existingStatement) {
      return existingStatement;
    }

    const profile = this.getEffectiveSalaryProfile(db, userId, period.end_date);
    const mode = profile.salary_mode;
    const rate = profile.base_rate;
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

    const actualHoursWorked = Number((totalActualMinutes / 60).toFixed(2));

    // 4. Compute compensation according to mode (separating schedule from salary!)
    let payableUnits = 0;
    let grossEarnings = 0;
    let unitLabel = '';
    let absenceDeductions = 0;

    if (mode === 'hourly') {
      unitLabel = 'hours';
      // Option A: Hourly salary based on approved payable hours and rate
      payableUnits = actualHoursWorked > 0 ? actualHoursWorked : (punches.length > 0 ? Number((punchMinutes / 60).toFixed(2)) : Number((sessionMinutes / 60).toFixed(2)));
      grossEarnings = Number((payableUnits * rate).toFixed(2));

    } else if (mode === 'monthly') {
      unitLabel = 'month';
      // Option B & C: Fixed monthly salary (whether 4-hour duty or 8-hour duty)
      // DO NOT multiply monthly salary by actual hours worked!
      // The employee receives full monthly salary, deducting only approved unpaid leaves & unauthorized absences.
      const scheduledWorkDays = Math.max(1, scheduleSummary.scheduledWorkingDays);
      const deductionBasis = profile.deduction_policy === 'calendar_days' 
        ? Math.max(1, scheduleSummary.totalCalendarDays) 
        : scheduledWorkDays;
      const perDayRate = Number((rate / deductionBasis).toFixed(2));

      // Calculate unpaid leaves
      const unpaidLeaveCount = scheduleSummary.unpaidLeaveDays;
      const unpaidLeaveDeduction = Number((unpaidLeaveCount * perDayRate).toFixed(2));

      // Calculate unauthorized absences:
      // If employee worked fewer days than scheduled (excluding weekly offs, holidays, paid leaves, and unpaid leaves)
      let unauthorizedAbsences = 0;
      if (actualDaysWorked > 0 && actualDaysWorked < scheduledWorkDays) {
        unauthorizedAbsences = Math.max(0, scheduledWorkDays - actualDaysWorked - unpaidLeaveCount);
      }
      const unauthorizedDeduction = Number((unauthorizedAbsences * perDayRate).toFixed(2));

      absenceDeductions = Number((unpaidLeaveDeduction + unauthorizedDeduction).toFixed(2));
      grossEarnings = Number(Math.max(0, rate - absenceDeductions).toFixed(2));
      payableUnits = 1; // 1 month

    } else if (mode === 'per_day') {
      unitLabel = 'days';
      // Option D: Per working day compensation
      payableUnits = actualDaysWorked > 0 ? actualDaysWorked : scheduleSummary.scheduledWorkingDays;
      grossEarnings = Number((payableUnits * rate).toFixed(2));

    } else if (mode === 'per_session') {
      unitLabel = 'sessions';
      payableUnits = sessions.length;
      grossEarnings = Number((payableUnits * rate).toFixed(2));

    } else if (mode === 'per_minute') {
      unitLabel = 'minutes';
      payableUnits = totalActualMinutes;
      grossEarnings = Number((payableUnits * rate).toFixed(2));
    }

    // 5. Query approved overtime
    const approvedOvertime = db.prepare(`
      SELECT * FROM overtime_requests
      WHERE user_id = ? AND date BETWEEN ? AND ? AND status IN ('approved', 'auto_approved')
    `).all(userId, period.start_date, period.end_date);

    let approvedOvertimeAmount = 0;
    for (const ot of approvedOvertime) {
      approvedOvertimeAmount += (ot.payable_amount || 0);
    }

    // Also include punch overtime if overtime_eligible
    if (profile.overtime_eligible && punchOvertimeMinutes > 0 && approvedOvertime.length === 0) {
      const otHours = punchOvertimeMinutes / 60;
      const otMultiplier = profile.overtime_rate_multiplier || 1.0;
      const baseHourlyRate = mode === 'hourly' 
        ? rate 
        : (scheduleSummary.totalScheduledHours > 0 ? (rate / scheduleSummary.totalScheduledHours) : 150);
      approvedOvertimeAmount += Number((otHours * baseHourlyRate * otMultiplier).toFixed(2));
    }

    // 6. Query manual adjustments
    let totalAdditions = Number(approvedOvertimeAmount.toFixed(2));
    let totalDeductions = 0;

    let statementId = existingStatement ? existingStatement.id : null;
    let paidAmount = existingStatement ? (existingStatement.paid_amount || 0) : 0;

    if (statementId) {
      const adjustments = db.prepare('SELECT * FROM staff_salary_adjustments WHERE statement_id = ?').all(statementId);
      for (const adj of adjustments) {
        if (adj.type === 'addition') totalAdditions += adj.amount;
        if (adj.type === 'deduction') totalDeductions += adj.amount;
      }
    }

    const netEarnings = Number((grossEarnings + totalAdditions - totalDeductions).toFixed(2));
    const balanceAmount = Number(Math.max(0, netEarnings - paidAmount).toFixed(2));
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
      absence_deductions: absenceDeductions,
      actual_hours_worked: actualHoursWorked,
      actual_days_worked: actualDaysWorked,
      verified_sessions_count: sessions.length,
      overtime_amount: approvedOvertimeAmount,
      calculated_at: new Date().toISOString(),
      period_start: period.start_date,
      period_end: period.end_date,
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
   * Calculates provisional statements for all coaches & staff in an academy for a period
   */
  static calculatePeriod(db, periodId, academyId = 1) {
    const period = db.prepare('SELECT * FROM staff_payroll_periods WHERE id = ?').get(periodId);
    if (!period) {
      throw new Error(`Payroll period ${periodId} not found`);
    }

    // Get all coaches and staff
    const staffUsers = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.email, u.role
      FROM users u
      WHERE u.role IN ('coach', 'academy_staff', 'academy_admin')
        AND u.status = 'active'
    `).all();

    const statements = [];
    const tx = db.transaction(() => {
      for (const user of staffUsers) {
        const stmt = this.calculateEmployeeStatement(db, periodId, user.id, academyId);
        statements.push(stmt);
      }
    });

    tx();
    return { periodId, statementsCount: statements.length };
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
      INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
      VALUES (?, 'FINALIZE_PAYROLL', 'staff_payroll_periods', ?, ?)
    `).run(finalizedByUserId || 1, String(periodId), `Finalized payroll for period ${period.year_month}`);

    return {
      success: true,
      periodId,
      status: 'finalized',
      yearMonth: period.year_month,
    };
  }

  /**
   * Adds an itemized adjustment (bonus, overtime, unpaid leave deduction, penalty)
   */
  static addSalaryAdjustment(db, { statementId, type, category, amount, reason, createdBy = 1 }) {
    if (!statementId || !type || !amount || !reason) {
      throw new Error('Statement ID, type, amount, and reason are required');
    }
    if (amount <= 0) {
      throw new Error('Adjustment amount must be greater than zero');
    }

    const statement = db.prepare('SELECT * FROM staff_salary_statements WHERE id = ?').get(statementId);
    if (!statement) {
      throw new Error('Salary statement not found');
    }

    let adjustmentId;
    const tx = db.transaction(() => {
      const ins = db.prepare(`
        INSERT INTO staff_salary_adjustments (statement_id, type, category, amount, reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(statementId, type, category || 'general', amount, reason.trim(), createdBy);
      adjustmentId = ins.lastInsertRowid;

      // Recalculate totals
      const adjustments = db.prepare('SELECT * FROM staff_salary_adjustments WHERE statement_id = ?').all(statementId);
      let totalAdditions = 0;
      let totalDeductions = 0;
      for (const a of adjustments) {
        if (a.type === 'addition') totalAdditions += a.amount;
        if (a.type === 'deduction') totalDeductions += a.amount;
      }

      const netEarnings = Number((statement.gross_earnings + totalAdditions - totalDeductions).toFixed(2));
      const balanceAmount = Number(Math.max(0, netEarnings - statement.paid_amount).toFixed(2));
      const paymentStatus = balanceAmount === 0 && statement.paid_amount > 0 ? 'paid' : (statement.paid_amount > 0 ? 'partially_paid' : 'unpaid');

      db.prepare(`
        UPDATE staff_salary_statements
        SET total_additions = ?, total_deductions = ?, net_earnings = ?, balance_amount = ?, payment_status = ?
        WHERE id = ?
      `).run(totalAdditions, totalDeductions, netEarnings, balanceAmount, paymentStatus, statementId);
    });

    tx();
    return { success: true, adjustmentId };
  }

  /**
   * Records a salary payout / disbursement
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
    if (!statementId || !amount || amount <= 0 || !paymentMethod) {
      throw new Error('Valid Statement ID, positive amount, and payment method are required');
    }

    const statement = db.prepare('SELECT * FROM staff_salary_statements WHERE id = ?').get(statementId);
    if (!statement) {
      throw new Error('Salary statement not found');
    }

    let paymentId;
    const tx = db.transaction(() => {
      const ins = db.prepare(`
        INSERT INTO staff_salary_payments (
          statement_id, payment_date, amount, payment_method, reference_number, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        statementId,
        paymentDate || new Date().toISOString().split('T')[0],
        amount,
        paymentMethod,
        referenceNumber || null,
        notes || null,
        createdBy
      );
      paymentId = ins.lastInsertRowid;

      const newPaid = Number((statement.paid_amount + amount).toFixed(2));
      const newBalance = Number(Math.max(0, statement.net_earnings - newPaid).toFixed(2));
      const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

      db.prepare(`
        UPDATE staff_salary_statements
        SET paid_amount = ?, balance_amount = ?, payment_status = ?
        WHERE id = ?
      `).run(newPaid, newBalance, newStatus, statementId);
    });

    tx();
    return { success: true, paymentId };
  }

  /**
   * Retrieves an employee's salary statement respecting the 25th-of-month visibility rule
   */
  static getEmployeeStatement(db, userId, yearMonth) {
    const today = new Date();
    const currentDay = today.getDate();
    const period = this.getOrCreatePeriod(db, 1, yearMonth);

    // Calculate or fetch statement
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
      ? Number(((statement.applicable_rate || 0) / scheduledWorkDays).toFixed(2))
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
        otAmount = dayOt.reduce((sum, o) => sum + (o.payable_amount || 0), 0);
        if (dayOt[0].overtime_minutes > dayOtMinutes) {
          dayOtMinutes = dayOt[0].overtime_minutes;
        }
      }
      totalOvertimeAmount += otAmount;

      // Determine day attendance status
      let status = 'upcoming';
      let statusLabel = 'Scheduled';
      let badgeClass = 'badge-neutral';
      let financialImpact = 'Scheduled';

      if (hasActivePunch) {
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
            ? `₹${((workedMinutes / 60) * (statement?.applicable_rate || 0)).toFixed(2)}`
            : `Half Day (-₹${(perDayDeduction * 0.5).toFixed(2)})`;
        } else {
          status = 'present';
          statusLabel = 'Present';
          badgeClass = 'badge-success';
          daysPresent++;
          if (otAmount > 0) {
            financialImpact = `Full Day (+₹${otAmount.toFixed(2)} OT)`;
          } else if (statement?.salary_mode === 'hourly') {
            financialImpact = `₹${((workedMinutes / 60) * (statement?.applicable_rate || 0)).toFixed(2)}`;
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
          financialImpact = `-₹${perDayDeduction.toFixed(2)} (Leave)`;
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
        financialImpact = 'Paid Holiday';
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
      } else {
        status = 'absent';
        statusLabel = 'Absent';
        badgeClass = 'badge-danger';
        absentDays++;
        financialImpact = `-₹${perDayDeduction.toFixed(2)} (Absent)`;
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
        actualWorkedHours: Number((workedMinutes / 60).toFixed(2)),
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
        totalActualWorkedHours: Number((totalActualWorkedMinutes / 60).toFixed(2)),
        totalOvertimeHours: Number((totalOvertimeMinutes / 60).toFixed(2)),
        totalOvertimeAmount: Number(totalOvertimeAmount.toFixed(2)),
      },
    };
  }
}
