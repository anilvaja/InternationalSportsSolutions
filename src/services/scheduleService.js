import { DateUtils } from '../utils/dateUtils.js';

export class ScheduleService {

  /**
   * Helper: parses HH:MM time into minutes from midnight
   */
  static timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  /**
   * Helper: formats duration in hours rounded to 2 decimals
   */
  static formatHours(minutes) {
    return Number((Math.max(0, minutes) / 60).toFixed(2));
  }

  /**
   * Validates shift list for overlaps on the same day
   */
  static validateShifts(shifts) {
    const shiftsByDay = {};
    for (const s of shifts) {
      if (!s.is_working_day) continue;
      const day = s.day_of_week;
      if (!shiftsByDay[day]) shiftsByDay[day] = [];
      
      const startMin = this.timeToMinutes(s.start_time);
      const endMin = this.timeToMinutes(s.end_time);

      if (endMin <= startMin) {
        throw new Error(`Invalid shift times for day ${day}: End time (${s.end_time}) must be after start time (${s.start_time}).`);
      }

      for (const existing of shiftsByDay[day]) {
        const exStart = this.timeToMinutes(existing.start_time);
        const exEnd = this.timeToMinutes(existing.end_time);

        // Check overlap: (StartA < EndB) and (EndA > StartB)
        if (startMin < exEnd && endMin > exStart) {
          throw new Error(`Overlapping shifts detected on day ${day}: [${s.start_time}-${s.end_time}] conflicts with [${existing.start_time}-${existing.end_time}].`);
        }
      }

      shiftsByDay[day].push(s);
    }
    return true;
  }

  /**
   * Helper: Resolves the branch ID for a user
   */
  static getUserBranchId(db, userId) {
    try {
      const uba = db.prepare(`
        SELECT branch_id FROM user_branch_assignments
        WHERE user_id = ? AND is_primary = 1
        ORDER BY effective_from DESC LIMIT 1
      `).get(userId);
      if (uba && uba.branch_id) return uba.branch_id;

      const emp = db.prepare('SELECT branch_id FROM employment_records WHERE user_id = ? AND status = "active" LIMIT 1').get(userId);
      if (emp && emp.branch_id) return emp.branch_id;

      const coach = db.prepare('SELECT branch_id FROM coaches WHERE user_id = ? LIMIT 1').get(userId);
      if (coach && coach.branch_id) return coach.branch_id;

      const user = db.prepare('SELECT branch_id FROM users WHERE id = ? LIMIT 1').get(userId);
      if (user && user.branch_id) return user.branch_id;
    } catch (_) {}
    return null;
  }

  /**
   * Retrieves active work schedule and shifts for a user on a given date
   * Hierarchy:
   * 1. Employee-specific custom schedule (employee_work_schedules)
   * 2. Branch-specific general schedule (branch_work_schedules)
   * 3. Standard fallback schedule (Mon-Sat 9-5, Sun off)
   */
  static getEffectiveSchedule(db, userId, dateStr = new Date().toISOString().split('T')[0]) {
    // 1. Employee-specific custom schedule
    const empSchedule = db.prepare(`
      SELECT * FROM employee_work_schedules
      WHERE user_id = ?
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
        AND is_active = 1
      ORDER BY effective_from DESC
      LIMIT 1
    `).get(userId, dateStr, dateStr);

    if (empSchedule) {
      const shifts = db.prepare(`
        SELECT * FROM employee_schedule_shifts
        WHERE schedule_id = ?
        ORDER BY day_of_week ASC, start_time ASC
      `).all(empSchedule.id);

      return {
        ...empSchedule,
        shifts,
        is_custom: true,
        source: 'employee_override'
      };
    }

    // 2. Branch-level schedule inheritance
    const branchId = this.getUserBranchId(db, userId);
    if (branchId) {
      const branchSchedule = db.prepare(`
        SELECT * FROM branch_work_schedules
        WHERE branch_id = ?
          AND effective_from <= ?
          AND (effective_to IS NULL OR effective_to >= ?)
          AND is_active = 1
        ORDER BY effective_from DESC
        LIMIT 1
      `).get(branchId, dateStr, dateStr);

      if (branchSchedule) {
        const shifts = db.prepare(`
          SELECT * FROM branch_schedule_days
          WHERE branch_schedule_id = ?
          ORDER BY day_of_week ASC, start_time ASC
        `).all(branchSchedule.id);

        let totalWeeklyHours = 0;
        let workingDaysCount = 0;
        for (const s of shifts) {
          if (s.is_working_day) {
            totalWeeklyHours += Number(s.scheduled_hours || 0);
            workingDaysCount++;
          }
        }
        const avgDailyHours = workingDaysCount > 0 ? Number((totalWeeklyHours / workingDaysCount).toFixed(2)) : 0;

        return {
          id: branchSchedule.id,
          user_id: userId,
          branch_id: branchId,
          schedule_name: branchSchedule.schedule_name || 'Branch Inherited Schedule',
          effective_from: branchSchedule.effective_from,
          effective_to: branchSchedule.effective_to,
          expected_daily_hours: avgDailyHours,
          expected_weekly_hours: Number(totalWeeklyHours.toFixed(2)),
          working_days_per_week: workingDaysCount,
          shifts,
          is_custom: false,
          source: 'branch_inherited'
        };
      }
    }

    // 3. Default Fallback Schedule: Monday to Saturday, 9:00 to 17:00 (8h, 6 days, Sun off)
    const fallbackShifts = [];
    for (let day = 1; day <= 6; day++) {
      fallbackShifts.push({
        day_of_week: day,
        shift_name: 'Regular Shift',
        start_time: '09:00',
        end_time: '17:00',
        scheduled_hours: 8.0,
        break_duration_minutes: 60,
        is_break_paid: 1,
        is_working_day: 1,
      });
    }
    // Sunday weekly off
    fallbackShifts.push({
      day_of_week: 7,
      shift_name: 'Weekly Off',
      start_time: '00:00',
      end_time: '00:00',
      scheduled_hours: 0,
      break_duration_minutes: 0,
      is_break_paid: 0,
      is_working_day: 0,
    });

    return {
      user_id: userId,
      branch_id: branchId,
      schedule_name: 'Standard Academy Default (Fallback)',
      effective_from: '2026-01-01',
      effective_to: null,
      expected_daily_hours: 8.0,
      expected_weekly_hours: 48.0,
      working_days_per_week: 6,
      shifts: fallbackShifts,
      is_custom: false,
      source: 'academy_fallback'
    };
  }

  /**
   * Retrieves active branch schedule
   */
  static getBranchSchedule(db, branchId, dateStr = new Date().toISOString().split('T')[0]) {
    const schedule = db.prepare(`
      SELECT * FROM branch_work_schedules
      WHERE branch_id = ?
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
        AND is_active = 1
      ORDER BY effective_from DESC
      LIMIT 1
    `).get(branchId, dateStr, dateStr);

    if (schedule) {
      const days = db.prepare(`
        SELECT * FROM branch_schedule_days
        WHERE branch_schedule_id = ?
        ORDER BY day_of_week ASC, start_time ASC
      `).all(schedule.id);

      return { ...schedule, days };
    }

    // Fallback branch days
    const fallbackDays = [];
    for (let day = 1; day <= 6; day++) {
      fallbackDays.push({
        day_of_week: day,
        shift_name: 'Regular Shift',
        start_time: '09:00',
        end_time: '17:00',
        scheduled_hours: 8.0,
        break_duration_minutes: 60,
        is_break_paid: 1,
        is_working_day: 1
      });
    }
    fallbackDays.push({
      day_of_week: 7,
      shift_name: 'Weekly Off',
      start_time: '00:00',
      end_time: '00:00',
      scheduled_hours: 0,
      break_duration_minutes: 0,
      is_break_paid: 0,
      is_working_day: 0
    });

    return {
      branch_id: branchId,
      schedule_name: 'Standard Branch Working Schedule',
      effective_from: '2026-01-01',
      days: fallbackDays
    };
  }

  /**
   * Saves or updates a branch work schedule
   */
  static saveBranchSchedule(db, academyId, branchId, scheduleData, shiftsData, actorId = null) {
    return db.transaction(() => {
      this.validateShifts(shiftsData);

      const effectiveFrom = DateUtils.parseAndNormalizeDate(scheduleData.effective_from, { fieldName: 'Effective from date' }) || new Date().toISOString().split('T')[0];
      const effectiveTo = scheduleData.effective_to ? DateUtils.parseAndNormalizeDate(scheduleData.effective_to, { fieldName: 'Effective to date' }) : null;

      // Close previous ongoing branch schedule
      if (!effectiveTo) {
        const prev = db.prepare(`
          SELECT id FROM branch_work_schedules
          WHERE branch_id = ? AND effective_to IS NULL AND effective_from < ?
        `).all(branchId, effectiveFrom);

        const dayBefore = DateUtils.addDays(effectiveFrom, -1);
        for (const p of prev) {
          db.prepare('UPDATE branch_work_schedules SET effective_to = ? WHERE id = ?').run(dayBefore, p.id);
        }
      }

      const ins = db.prepare(`
        INSERT INTO branch_work_schedules (
          academy_id, branch_id, schedule_name, effective_from, effective_to, is_active, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        academyId,
        branchId,
        scheduleData.schedule_name || 'Branch Working Schedule',
        effectiveFrom,
        effectiveTo,
        scheduleData.notes || null,
        actorId
      );

      const scheduleId = ins.lastInsertRowid;

      const insertShift = db.prepare(`
        INSERT INTO branch_schedule_days (
          branch_schedule_id, day_of_week, shift_name, start_time, end_time,
          scheduled_hours, break_duration_minutes, is_break_paid, is_working_day
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of shiftsData) {
        const grossMinutes = this.timeToMinutes(s.end_time) - this.timeToMinutes(s.start_time);
        const breakDeduct = s.is_break_paid ? 0 : (s.break_duration_minutes || 0);
        const netHours = Number((Math.max(0, grossMinutes - breakDeduct) / 60).toFixed(2));

        insertShift.run(
          scheduleId,
          s.day_of_week,
          s.shift_name || `Shift Day ${s.day_of_week}`,
          s.start_time,
          s.end_time,
          s.is_working_day ? netHours : 0,
          s.break_duration_minutes || 0,
          s.is_break_paid ? 1 : 0,
          s.is_working_day ? 1 : 0
        );
      }

      // Record audit log
      db.prepare(`
        INSERT INTO payroll_audit_logs (academy_id, entity_type, entity_id, action, actor_id, changes_summary, reason)
        VALUES (?, 'schedule', ?, 'create', ?, ?, ?)
      `).run(
        academyId,
        scheduleId,
        actorId || 1,
        `Branch #${branchId} working schedule created with ${shiftsData.length} shifts`,
        scheduleData.notes || 'Configured branch working days and weekly offs'
      );

      return { scheduleId, branchId, effectiveFrom };
    })();
  }

  /**
   * Evaluates employee schedule expectation for a single date
   */
  static getDayScheduleExpectation(db, userId, dateStr) {
    const dateObj = new Date(dateStr + 'T00:00:00');
    // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat -> Convert to 1=Mon, ..., 7=Sun
    const jsDay = dateObj.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const schedule = this.getEffectiveSchedule(db, userId, dateStr);
    const branchId = schedule.branch_id || this.getUserBranchId(db, userId);

    // 1. Check if date is an academy or branch holiday (supporting date ranges & categories)
    let holiday = null;
    if (branchId) {
      holiday = db.prepare(`
        SELECT * FROM academy_holidays 
        WHERE (
          (end_date IS NULL AND holiday_date = ?) OR
          (end_date IS NOT NULL AND holiday_date <= ? AND end_date >= ?)
        )
          AND (branch_id IS NULL OR branch_id = ?)
          AND (status IS NULL OR status = 'approved')
        ORDER BY branch_id DESC, holiday_date DESC
        LIMIT 1
      `).get(dateStr, dateStr, dateStr, branchId);
    } else {
      holiday = db.prepare(`
        SELECT * FROM academy_holidays 
        WHERE (
          (end_date IS NULL AND holiday_date = ?) OR
          (end_date IS NOT NULL AND holiday_date <= ? AND end_date >= ?)
        )
          AND (status IS NULL OR status = 'approved')
        ORDER BY holiday_date DESC
        LIMIT 1
      `).get(dateStr, dateStr, dateStr);
    }

    // 2. Check approved leave requests (supporting half-day leaves)
    const leave = db.prepare(`
      SELECT * FROM leave_requests
      WHERE (user_id = ? OR applicant_id = ?)
        AND status = 'approved'
        AND ? BETWEEN start_date AND end_date
      LIMIT 1
    `).get(userId, userId, dateStr);

    // 3. Check for approved work exceptions (working on weekly off or holiday)
    const workException = db.prepare(`
      SELECT * FROM employee_work_exceptions
      WHERE user_id = ? AND date = ? AND status = 'approved'
      LIMIT 1
    `).get(userId, dateStr);

    // 4. Find shifts scheduled for this weekday
    const dayShifts = (schedule.shifts || []).filter(s => s.day_of_week === dayOfWeek && s.is_working_day === 1);

    let isWorkingDay = dayShifts.length > 0;
    let scheduledHours = 0;

    for (const shift of dayShifts) {
      const grossMinutes = this.timeToMinutes(shift.end_time) - this.timeToMinutes(shift.start_time);
      const breakDeduct = shift.is_break_paid ? 0 : (shift.break_duration_minutes || 0);
      const netMinutes = Math.max(0, grossMinutes - breakDeduct);
      scheduledHours += (netMinutes / 60);
    }

    scheduledHours = Number(scheduledHours.toFixed(2));

    const isHalfDay = leave && (leave.day_part === 'first_half' || leave.day_part === 'second_half' || leave.leave_type === 'half_day');
    if (isHalfDay) {
      scheduledHours = Number((scheduledHours / 2).toFixed(2));
    }

    let dayType = 'working_day';
    if (!isWorkingDay) {
      dayType = workException ? 'weekly_off_worked' : 'weekly_off';
    } else if (holiday) {
      dayType = workException ? 'holiday_worked' : (holiday.is_paid ? 'paid_holiday' : 'unpaid_holiday');
    } else if (leave) {
      if (isHalfDay) {
        dayType = 'half_day_leave';
      } else {
        dayType = (leave.is_paid === 0 || leave.leave_type === 'unpaid') ? 'unpaid_leave' : 'paid_leave';
      }
    }

    return {
      date: dateStr,
      dayOfWeek,
      dayType,
      isWorkingDay: (isWorkingDay && !holiday && (!leave || isHalfDay)) || !!workException,
      isWeeklyOff: !isWorkingDay,
      isHoliday: !!holiday,
      holidayName: holiday ? holiday.name : null,
      holidayCategory: holiday ? (holiday.category || 'public') : null,
      isHolidayPaid: holiday ? (holiday.is_paid !== 0) : false,
      isLeave: !!leave,
      leaveType: leave ? (leave.leave_type || 'casual') : null,
      isHalfDay: !!isHalfDay,
      halfDayPart: isHalfDay ? leave.day_part : null,
      hasWorkException: !!workException,
      workExceptionType: workException ? workException.exception_type : null,
      scheduledHours: (!isWorkingDay && !workException) ? 0 : scheduledHours,
      shifts: dayShifts,
      scheduleId: schedule.id || null,
      scheduleName: schedule.schedule_name,
      scheduleSource: schedule.source || 'default'
    };
  }

  /**
   * Calculates total scheduled hours and days across an entire payroll period
   */
  static calculateExpectedHoursForPeriod(db, userId, startDate, endDate, joiningDate = null, exitDate = null) {
    let totalScheduledHours = 0;
    let scheduledWorkingDays = 0;
    let weeklyOffDays = 0;
    let holidayDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let halfDayLeaveDays = 0;
    let offDaysWorked = 0;
    const dayBreakdown = [];

    let effectiveJoining = joiningDate;
    let effectiveExit = exitDate;

    if (!effectiveJoining || !effectiveExit) {
      try {
        const emp = db.prepare('SELECT joining_date, exit_date FROM employment_records WHERE user_id = ? AND effective_to IS NULL ORDER BY effective_from DESC LIMIT 1').get(userId);
        const coach = db.prepare('SELECT joining_date, created_at FROM coaches WHERE user_id = ?').get(userId);
        const u = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);
        
        if (!effectiveJoining) {
          effectiveJoining = (emp && emp.joining_date)
            || (coach && coach.joining_date)
            || (coach && coach.created_at ? coach.created_at.slice(0, 10) : null)
            || (u && u.created_at ? u.created_at.slice(0, 10) : null);
        }
        if (!effectiveExit && emp && emp.exit_date) {
          effectiveExit = emp.exit_date;
        }
      } catch (e) {}
    }

    const normStart = DateUtils.parseAndNormalizeDate(startDate, { fieldName: 'Start date', required: true });
    const normEnd = DateUtils.parseAndNormalizeDate(endDate, { fieldName: 'End date', required: true });

    const daysRange = DateUtils.getDateRange(normStart, normEnd);

    for (const dateStr of daysRange) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const dayOfWeek = jsDay === 0 ? 7 : jsDay;

      // 1. Check if date is prior to employee's official joining date
      if (effectiveJoining && dateStr < effectiveJoining) {
        dayBreakdown.push({
          date: dateStr,
          dayOfWeek,
          dayType: 'not_employed',
          isWorkingDay: false,
          isWeeklyOff: false,
          isHoliday: false,
          isLeave: false,
          isPriorToJoining: true,
          scheduledHours: 0,
          shifts: [],
          scheduleName: 'Not Employed (Prior to Joining)'
        });
        continue;
      }

      // 2. Check if date is after employee's official exit date
      if (effectiveExit && dateStr > effectiveExit) {
        dayBreakdown.push({
          date: dateStr,
          dayOfWeek,
          dayType: 'resigned',
          isWorkingDay: false,
          isWeeklyOff: false,
          isHoliday: false,
          isLeave: false,
          isPostExit: true,
          scheduledHours: 0,
          shifts: [],
          scheduleName: 'Relieved / Resigned'
        });
        continue;
      }

      const dayExp = this.getDayScheduleExpectation(db, userId, dateStr);
      dayBreakdown.push(dayExp);

      if (dayExp.dayType === 'weekly_off') {
        weeklyOffDays++;
      } else if (dayExp.dayType === 'weekly_off_worked' || dayExp.dayType === 'holiday_worked') {
        offDaysWorked++;
        scheduledWorkingDays++;
        totalScheduledHours += dayExp.scheduledHours;
      } else if (dayExp.dayType === 'paid_holiday') {
        holidayDays++;
      } else if (dayExp.dayType === 'paid_leave') {
        paidLeaveDays++;
      } else if (dayExp.dayType === 'half_day_leave') {
        halfDayLeaveDays++;
        scheduledWorkingDays += 0.5;
        totalScheduledHours += dayExp.scheduledHours;
      } else if (dayExp.dayType === 'unpaid_leave') {
        unpaidLeaveDays++;
      } else {
        scheduledWorkingDays++;
        totalScheduledHours += dayExp.scheduledHours;
      }
    }

    totalScheduledHours = Number(totalScheduledHours.toFixed(2));

    return {
      totalScheduledHours,
      scheduledWorkingDays,
      weeklyOffDays,
      holidayDays,
      paidLeaveDays,
      unpaidLeaveDays,
      halfDayLeaveDays,
      offDaysWorked,
      totalCalendarDays: dayBreakdown.length,
      joiningDate: effectiveJoining || null,
      exitDate: effectiveExit || null,
      dayBreakdown,
    };
  }

  /**
   * Saves or updates an employee-specific work schedule override
   */
  static saveEmployeeSchedule(db, academyId, userId, scheduleData, shiftsData, actorId = null) {
    return db.transaction(() => {
      this.validateShifts(shiftsData);

      const effectiveFrom = DateUtils.parseAndNormalizeDate(scheduleData.effective_from, { fieldName: 'Effective from date' }) || new Date().toISOString().split('T')[0];
      const effectiveTo = scheduleData.effective_to ? DateUtils.parseAndNormalizeDate(scheduleData.effective_to, { fieldName: 'Effective to date' }) : null;

      let workingDaysCount = 0;
      let totalWeeklyHours = 0;
      const dailyHoursMap = {};

      for (const s of shiftsData) {
        if (s.is_working_day) {
          const grossMinutes = this.timeToMinutes(s.end_time) - this.timeToMinutes(s.start_time);
          const breakDeduct = s.is_break_paid ? 0 : (s.break_duration_minutes || 0);
          const netHours = Math.max(0, (grossMinutes - breakDeduct) / 60);

          if (!dailyHoursMap[s.day_of_week]) {
            dailyHoursMap[s.day_of_week] = 0;
            workingDaysCount++;
          }
          dailyHoursMap[s.day_of_week] += netHours;
          totalWeeklyHours += netHours;
        }
      }

      const avgDailyHours = workingDaysCount > 0 ? Number((totalWeeklyHours / workingDaysCount).toFixed(2)) : 0;
      totalWeeklyHours = Number(totalWeeklyHours.toFixed(2));

      // Close previous ongoing schedule if overlapping
      if (!effectiveTo) {
        const prev = db.prepare(`
          SELECT id FROM employee_work_schedules
          WHERE user_id = ? AND effective_to IS NULL AND effective_from < ?
        `).all(userId, effectiveFrom);

        const dayBefore = DateUtils.addDays(effectiveFrom, -1);
        for (const p of prev) {
          db.prepare('UPDATE employee_work_schedules SET effective_to = ? WHERE id = ?').run(dayBefore, p.id);
        }
      }

      const ins = db.prepare(`
        INSERT INTO employee_work_schedules (
          academy_id, branch_id, user_id, schedule_name, effective_from, effective_to,
          expected_daily_hours, expected_weekly_hours, working_days_per_week, is_active,
          notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        academyId,
        scheduleData.branch_id || this.getUserBranchId(db, userId),
        userId,
        scheduleData.schedule_name || 'Employee Custom Schedule',
        effectiveFrom,
        effectiveTo,
        avgDailyHours,
        totalWeeklyHours,
        workingDaysCount,
        scheduleData.notes || null,
        actorId
      );

      const scheduleId = ins.lastInsertRowid;

      const insertShift = db.prepare(`
        INSERT INTO employee_schedule_shifts (
          schedule_id, user_id, day_of_week, shift_name, start_time, end_time,
          scheduled_hours, break_duration_minutes, is_break_paid, is_working_day
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of shiftsData) {
        const grossMinutes = this.timeToMinutes(s.end_time) - this.timeToMinutes(s.start_time);
        const breakDeduct = s.is_break_paid ? 0 : (s.break_duration_minutes || 0);
        const netHours = Number((Math.max(0, grossMinutes - breakDeduct) / 60).toFixed(2));

        insertShift.run(
          scheduleId,
          userId,
          s.day_of_week,
          s.shift_name || `Shift on Day ${s.day_of_week}`,
          s.start_time,
          s.end_time,
          s.is_working_day ? netHours : 0,
          s.break_duration_minutes || 0,
          s.is_break_paid ? 1 : 0,
          s.is_working_day ? 1 : 0
        );
      }

      return {
        scheduleId,
        expectedDailyHours: avgDailyHours,
        expectedWeeklyHours: totalWeeklyHours,
        workingDaysCount,
      };
    })();
  }

  /**
   * Records an approved work exception (e.g. employee worked on weekly off or holiday)
   */
  static recordWorkException(db, academyId, data, actorId = null) {
    const {
      user_id,
      date,
      exception_type = 'weekly_off_work',
      compensation_type = 'comp_off',
      hours_worked = 8.0,
      comp_off_days = 1.0,
      reason,
      status = 'approved'
    } = data;

    if (!user_id || !date) {
      throw new Error('User ID and date are required for work exception');
    }

    const normDate = DateUtils.parseAndNormalizeDate(date, { fieldName: 'Work exception date', required: true });
    const branchId = data.branch_id || this.getUserBranchId(db, user_id);

    return db.transaction(() => {
      const ins = db.prepare(`
        INSERT INTO employee_work_exceptions (
          academy_id, branch_id, user_id, date, exception_type, compensation_type,
          hours_worked, comp_off_days, reason, status, approved_by, reviewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        academyId,
        branchId,
        user_id,
        normDate,
        exception_type,
        compensation_type,
        Number(hours_worked),
        Number(comp_off_days),
        reason || 'Authorized work on scheduled off-day/holiday',
        status,
        actorId
      );

      // If compensatory off earned, credit to employee leave balance
      if (status === 'approved' && compensation_type === 'comp_off' && exception_type.includes('work')) {
        const year = Number(normDate.split('-')[0]);
        // Credit earned leave or comp-off
        db.prepare(`
          INSERT INTO employee_leave_balances (
            academy_id, user_id, leave_type, year, opening_balance, accrued, used, remaining
          ) VALUES (?, ?, 'earned', ?, 0, ?, 0, ?)
          ON CONFLICT(user_id, leave_type, year) DO UPDATE SET
            accrued = accrued + excluded.accrued,
            remaining = remaining + excluded.remaining,
            updated_at = CURRENT_TIMESTAMP
        `).run(academyId, user_id, year, Number(comp_off_days), Number(comp_off_days));
      }

      return { id: ins.lastInsertRowid, status };
    })();
  }

  /**
   * Retrieves active working schedule and day-by-day rules for a branch
   */
  static getBranchSchedule(db, branchId, dateStr = new Date().toISOString().split('T')[0]) {
    const schedule = db.prepare(`
      SELECT * FROM branch_work_schedules
      WHERE branch_id = ?
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
        AND is_active = 1
      ORDER BY effective_from DESC
      LIMIT 1
    `).get(branchId, dateStr, dateStr);

    if (schedule) {
      const days = db.prepare(`
        SELECT * FROM branch_schedule_days
        WHERE branch_schedule_id = ?
        ORDER BY day_of_week ASC
      `).all(schedule.id);

      return {
        ...schedule,
        days,
        is_configured: true,
      };
    }

    // Default 6 working days (Mon-Sat), Sunday off
    const defaultDays = [];
    for (let day = 1; day <= 6; day++) {
      defaultDays.push({
        day_of_week: day,
        is_working_day: 1,
        is_half_day: 0,
        shift_name: 'General Shift',
        start_time: '09:00',
        end_time: '17:00',
        scheduled_hours: 8.0,
      });
    }
    defaultDays.push({
      day_of_week: 0, // Sunday
      is_working_day: 0,
      is_half_day: 0,
      shift_name: 'Weekly Off',
      start_time: '00:00',
      end_time: '00:00',
      scheduled_hours: 0,
    });

    return {
      branch_id: branchId,
      schedule_name: 'Default 6-Day Schedule (Sunday Off)',
      working_days_per_week: 6,
      default_daily_hours: 8.0,
      effective_from: '2026-01-01',
      effective_to: null,
      days: defaultDays,
      is_configured: false,
    };
  }

  /**
   * Saves or updates a branch working schedule with weekly off configuration
   */
  static saveBranchSchedule(db, academyId, branchId, scheduleData, daysData, actorId = null) {
    if (!Array.isArray(daysData) || daysData.length === 0) {
      throw new Error('Day-wise schedule configuration is required.');
    }

    return db.transaction(() => {
      const effectiveFrom = scheduleData.effective_from || new Date().toISOString().split('T')[0];
      const effectiveTo = scheduleData.effective_to || null;

      // Close previous ongoing schedule if overlapping
      if (!effectiveTo) {
        const prev = db.prepare(`
          SELECT id FROM branch_work_schedules
          WHERE branch_id = ? AND effective_to IS NULL AND effective_from < ?
        `).all(branchId, effectiveFrom);

        const dayBefore = new Date(new Date(effectiveFrom + 'T00:00:00').getTime() - 86400000).toISOString().split('T')[0];
        for (const p of prev) {
          db.prepare('UPDATE branch_work_schedules SET effective_to = ? WHERE id = ?').run(dayBefore, p.id);
        }
      }

      let workingDaysCount = 0;
      let totalWeeklyHours = 0;
      for (const d of daysData) {
        if (d.is_working_day) {
          workingDaysCount++;
          totalWeeklyHours += Number(d.scheduled_hours || 8.0);
        }
      }
      const avgDailyHours = workingDaysCount > 0 ? Number((totalWeeklyHours / workingDaysCount).toFixed(2)) : 8.0;

      const ins = db.prepare(`
        INSERT INTO branch_work_schedules (
          academy_id, branch_id, schedule_name, effective_from, effective_to,
          working_days_per_week, default_daily_hours, is_active, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        academyId,
        branchId,
        scheduleData.schedule_name || 'Branch Working Schedule',
        effectiveFrom,
        effectiveTo,
        workingDaysCount,
        avgDailyHours,
        scheduleData.notes || null
      );

      const branchScheduleId = ins.lastInsertRowid;

      const insDay = db.prepare(`
        INSERT INTO branch_schedule_days (
          branch_schedule_id, day_of_week, is_working_day, is_half_day,
          shift_name, start_time, end_time, scheduled_hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const d of daysData) {
        insDay.run(
          branchScheduleId,
          Number(d.day_of_week),
          d.is_working_day ? 1 : 0,
          d.is_half_day ? 1 : 0,
          d.shift_name || (d.is_working_day ? 'General Shift' : 'Weekly Off'),
          d.start_time || '09:00',
          d.end_time || '17:00',
          d.is_working_day ? Number(d.scheduled_hours || 8.0) : 0
        );
      }

      return {
        branchScheduleId,
        workingDaysCount,
        defaultDailyHours: avgDailyHours,
      };
    })();
  }
}
