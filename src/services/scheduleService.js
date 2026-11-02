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
      let endMin = this.timeToMinutes(s.end_time);

      if (endMin === startMin) {
        throw new Error(`Invalid shift times for day ${day}: End time cannot be identical to start time (${s.start_time}).`);
      }
      if (endMin < startMin) {
        endMin += 1440; // Overnight shift crossing midnight
      }

      for (const existing of shiftsByDay[day]) {
        const exStart = this.timeToMinutes(existing.start_time);
        let exEnd = this.timeToMinutes(existing.end_time);
        if (exEnd < exStart) exEnd += 1440;

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

      const emp = db.prepare("SELECT branch_id FROM employment_records WHERE user_id = ? AND status = 'active' LIMIT 1").get(userId);
      if (emp && emp.branch_id) return emp.branch_id;

      const coach = db.prepare('SELECT branch_id FROM coaches WHERE user_id = ? LIMIT 1').get(userId);
      if (coach && coach.branch_id) return coach.branch_id;

      const anyUba = db.prepare('SELECT branch_id FROM user_branch_assignments WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
      if (anyUba && anyUba.branch_id) return anyUba.branch_id;
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
      ORDER BY effective_from DESC, id DESC
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

    // 3.5 Check date-specific schedule overrides
    let overrides = [];
    try {
      overrides = db.prepare(`
        SELECT * FROM employee_schedule_overrides
        WHERE user_id = ? AND override_date = ?
      `).all(userId, dateStr);
    } catch (_) {}

    let dayShifts = [];
    let isDayCancelledOrOff = false;

    if (overrides.length > 0) {
      const cancelOverride = overrides.find(o => o.schedule_action === 'cancel' || o.schedule_action === 'off');
      if (cancelOverride && (!cancelOverride.start_time || !cancelOverride.end_time)) {
        isDayCancelledOrOff = true;
      }

      const replaceOverrides = overrides.filter(o => o.schedule_action === 'replace' && o.start_time && o.end_time);
      const addOverrides = overrides.filter(o => o.schedule_action === 'add' && o.start_time && o.end_time);

      if (replaceOverrides.length > 0) {
        dayShifts = replaceOverrides.map(o => ({
          day_of_week: dayOfWeek,
          shift_name: o.shift_name,
          start_time: o.start_time,
          end_time: o.end_time,
          shift_type: o.shift_type || 'regular',
          scheduled_hours: o.scheduled_hours,
          break_duration_minutes: 0,
          is_break_paid: 1,
          is_working_day: 1,
          is_override: true,
          override_id: o.id
        }));
      } else if (!isDayCancelledOrOff) {
        dayShifts = (schedule.shifts || []).filter(s => s.day_of_week === dayOfWeek && s.is_working_day === 1);
      }

      for (const ao of addOverrides) {
        dayShifts.push({
          day_of_week: dayOfWeek,
          shift_name: ao.shift_name,
          start_time: ao.start_time,
          end_time: ao.end_time,
          shift_type: ao.shift_type || 'regular',
          scheduled_hours: ao.scheduled_hours,
          break_duration_minutes: 0,
          is_break_paid: 1,
          is_working_day: 1,
          is_override: true,
          override_id: ao.id
        });
      }
    } else {
      dayShifts = (schedule.shifts || []).filter(s => s.day_of_week === dayOfWeek && s.is_working_day === 1);
    }

    let isWorkingDay = dayShifts.length > 0 && !isDayCancelledOrOff;
    let scheduledHours = 0;

    for (const shift of dayShifts) {
      let grossMinutes = this.timeToMinutes(shift.end_time) - this.timeToMinutes(shift.start_time);
      if (grossMinutes < 0) grossMinutes += 1440; // Overnight shift crossing midnight
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
          scheduled_hours, break_duration_minutes, is_break_paid, is_working_day,
          branch_id, shift_type, travel_buffer_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of shiftsData) {
        let grossMinutes = this.timeToMinutes(s.end_time) - this.timeToMinutes(s.start_time);
        if (grossMinutes < 0) grossMinutes += 1440;
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
          s.is_working_day ? 1 : 0,
          s.branch_id || scheduleData.branch_id || null,
          s.shift_type || 'regular',
          s.travel_buffer_minutes || 0
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
   * Updates only a specific weekday's shifts for an employee without affecting other weekdays
   */
  static updateEmployeeScheduleShiftsForDay(db, scheduleId, userId, dayOfWeek, shiftsForDay, actorId = null) {
    return db.transaction(() => {
      // 1. Delete existing shifts for this day_of_week
      db.prepare(`
        DELETE FROM employee_schedule_shifts
        WHERE schedule_id = ? AND user_id = ? AND day_of_week = ?
      `).run(scheduleId, userId, dayOfWeek);

      // 2. Validate new shifts for this day
      this.validateShifts(shiftsForDay);

      // 3. Insert new shifts
      const insertShift = db.prepare(`
        INSERT INTO employee_schedule_shifts (
          schedule_id, user_id, day_of_week, shift_name, start_time, end_time,
          scheduled_hours, break_duration_minutes, is_break_paid, is_working_day,
          branch_id, shift_type, travel_buffer_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of shiftsForDay) {
        let grossMinutes = this.timeToMinutes(s.end_time) - this.timeToMinutes(s.start_time);
        if (grossMinutes < 0) grossMinutes += 1440;
        const breakDeduct = s.is_break_paid ? 0 : (s.break_duration_minutes || 0);
        const netHours = Number((Math.max(0, grossMinutes - breakDeduct) / 60).toFixed(2));

        insertShift.run(
          scheduleId,
          userId,
          dayOfWeek,
          s.shift_name || `Shift Day ${dayOfWeek}`,
          s.start_time,
          s.end_time,
          s.is_working_day ? netHours : 0,
          s.break_duration_minutes || 0,
          s.is_break_paid ? 1 : 0,
          s.is_working_day ? 1 : 0,
          s.branch_id || null,
          s.shift_type || 'regular',
          s.travel_buffer_minutes || 0
        );
      }

      // 4. Recalculate schedule total weekly hours and daily expected hours
      const allShifts = db.prepare('SELECT * FROM employee_schedule_shifts WHERE schedule_id = ?').all(scheduleId);
      let totalWeeklyHours = 0;
      let workingDaysCount = 0;
      const seenDays = new Set();
      for (const ash of allShifts) {
        if (ash.is_working_day) {
          totalWeeklyHours += Number(ash.scheduled_hours || 0);
          if (!seenDays.has(ash.day_of_week)) {
            seenDays.add(ash.day_of_week);
            workingDaysCount++;
          }
        }
      }
      const avgDailyHours = workingDaysCount > 0 ? Number((totalWeeklyHours / workingDaysCount).toFixed(2)) : 0;
      totalWeeklyHours = Number(totalWeeklyHours.toFixed(2));

      db.prepare(`
        UPDATE employee_work_schedules
        SET expected_daily_hours = ?, expected_weekly_hours = ?, working_days_per_week = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(avgDailyHours, totalWeeklyHours, workingDaysCount, scheduleId);

      return { scheduleId, dayOfWeek, shiftsUpdated: shiftsForDay.length, totalWeeklyHours, avgDailyHours };
    })();
  }

  /**
   * Saves or creates a date-specific schedule override
   */
  static saveScheduleOverride(db, academyId, userId, overrideData, actorId = null) {
    const {
      override_date,
      schedule_action = 'replace',
      shift_name = 'Special Shift',
      start_time,
      end_time,
      shift_type = 'regular',
      reason,
      branch_id
    } = overrideData;

    const normDate = DateUtils.parseAndNormalizeDate(override_date, { fieldName: 'Override date', required: true });

    let scheduledHours = 0;
    if (start_time && end_time && schedule_action !== 'off' && schedule_action !== 'cancel') {
      let grossMinutes = this.timeToMinutes(end_time) - this.timeToMinutes(start_time);
      if (grossMinutes < 0) grossMinutes += 1440;
      scheduledHours = Number((grossMinutes / 60).toFixed(2));
    }

    return db.transaction(() => {
      const ins = db.prepare(`
        INSERT INTO employee_schedule_overrides (
          academy_id, branch_id, user_id, override_date, schedule_action, shift_name,
          start_time, end_time, scheduled_hours, shift_type, reason, approved_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        academyId,
        branch_id || this.getUserBranchId(db, userId),
        userId,
        normDate,
        schedule_action,
        shift_name,
        start_time || null,
        end_time || null,
        scheduledHours,
        shift_type,
        reason || 'Date schedule adjustment',
        actorId
      );

      return { id: ins.lastInsertRowid, userId, overrideDate: normDate, scheduledHours };
    })();
  }

  /**
   * Records check-in to a specific attendance slot
   */
  static recordSlotCheckIn(db, academyId, data, actorId = null) {
    const {
      user_id,
      attendance_date,
      scheduled_start_time,
      scheduled_end_time,
      slot_name = 'Slot',
      shift_type = 'regular',
      actual_check_in,
      branch_id,
      batch_id,
      schedule_id,
      schedule_shift_id,
      override_id,
      notes
    } = data;

    const normDate = DateUtils.parseAndNormalizeDate(attendance_date, { fieldName: 'Attendance date', required: true });
    const checkInTime = actual_check_in || new Date().toTimeString().slice(0, 5);

    let scheduledMinutes = this.timeToMinutes(scheduled_end_time) - this.timeToMinutes(scheduled_start_time);
    if (scheduledMinutes < 0) scheduledMinutes += 1440;

    const startMin = this.timeToMinutes(scheduled_start_time);
    const inMin = this.timeToMinutes(checkInTime);
    const lateMinutes = Math.max(0, inMin - startMin);
    const status = lateMinutes > 15 ? 'late' : 'present';

    return db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO staff_slot_attendance (
          academy_id, branch_id, user_id, schedule_id, schedule_shift_id, override_id, batch_id,
          attendance_date, slot_name, shift_type, scheduled_start_time, scheduled_end_time,
          actual_check_in, scheduled_minutes, late_arrival_minutes, status, source, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)
        ON CONFLICT(user_id, attendance_date, scheduled_start_time, scheduled_end_time) DO UPDATE SET
          actual_check_in = excluded.actual_check_in,
          late_arrival_minutes = excluded.late_arrival_minutes,
          status = excluded.status,
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(
        academyId,
        branch_id || this.getUserBranchId(db, user_id),
        user_id,
        schedule_id || null,
        schedule_shift_id || null,
        override_id || null,
        batch_id || null,
        normDate,
        slot_name,
        shift_type,
        scheduled_start_time,
        scheduled_end_time,
        checkInTime,
        scheduledMinutes,
        lateMinutes,
        status,
        notes || null
      );

      return db.prepare(`
        SELECT * FROM staff_slot_attendance
        WHERE user_id = ? AND attendance_date = ? AND scheduled_start_time = ? AND scheduled_end_time = ?
      `).get(user_id, normDate, scheduled_start_time, scheduled_end_time);
    })();
  }

  /**
   * Records check-out from a specific attendance slot
   */
  static recordSlotCheckOut(db, academyId, data, actorId = null) {
    const {
      user_id,
      attendance_date,
      scheduled_start_time,
      scheduled_end_time,
      actual_check_out,
      overtime_minutes = 0
    } = data;

    const normDate = DateUtils.parseAndNormalizeDate(attendance_date, { fieldName: 'Attendance date', required: true });
    const checkOutTime = actual_check_out || new Date().toTimeString().slice(0, 5);

    return db.transaction(() => {
      const slot = db.prepare(`
        SELECT * FROM staff_slot_attendance
        WHERE user_id = ? AND attendance_date = ? AND scheduled_start_time = ? AND scheduled_end_time = ?
      `).get(user_id, normDate, scheduled_start_time, scheduled_end_time);

      if (!slot) {
        throw new Error(`Slot attendance not found for ${normDate} [${scheduled_start_time}-${scheduled_end_time}]`);
      }

      const checkInMin = this.timeToMinutes(slot.actual_check_in || slot.scheduled_start_time);
      let checkOutMin = this.timeToMinutes(checkOutTime);
      if (checkOutMin < checkInMin) checkOutMin += 1440;

      const attendedMinutes = Math.max(0, checkOutMin - checkInMin);
      let endMin = this.timeToMinutes(scheduled_end_time);
      if (endMin < this.timeToMinutes(scheduled_start_time)) endMin += 1440;

      const earlyDeparture = Math.max(0, endMin - checkOutMin);
      const approvedMinutes = Math.min(attendedMinutes, slot.scheduled_minutes);

      let status = slot.status;
      if (attendedMinutes < slot.scheduled_minutes * 0.75) {
        status = 'partial';
      } else if (earlyDeparture > 15) {
        status = 'early_checkout';
      }

      db.prepare(`
        UPDATE staff_slot_attendance
        SET actual_check_out = ?,
            attended_minutes = ?,
            approved_payable_minutes = ?,
            early_departure_minutes = ?,
            overtime_minutes = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        checkOutTime,
        attendedMinutes,
        approvedMinutes,
        earlyDeparture,
        Number(overtime_minutes || 0),
        status,
        slot.id
      );

      return db.prepare('SELECT * FROM staff_slot_attendance WHERE id = ?').get(slot.id);
    })();
  }

  /**
   * Admin manual adjustment of slot attendance with reason, approval and audit log
   */
  static adjustSlotAttendance(db, academyId, data, actorId = null) {
    const {
      slot_id,
      actual_check_in,
      actual_check_out,
      attended_minutes,
      approved_payable_minutes,
      status,
      adjustment_reason,
      overtime_minutes = 0
    } = data;

    if (!slot_id) throw new Error('Slot ID is required for adjustment');
    if (!adjustment_reason) throw new Error('Adjustment reason is mandatory');

    return db.transaction(() => {
      const slot = db.prepare('SELECT * FROM staff_slot_attendance WHERE id = ?').get(slot_id);
      if (!slot) throw new Error(`Slot attendance with ID ${slot_id} not found`);

      const finalAttended = attended_minutes !== undefined ? Number(attended_minutes) : slot.attended_minutes;
      const finalPayable = approved_payable_minutes !== undefined ? Number(approved_payable_minutes) : finalAttended;
      const finalStatus = status || slot.status;

      db.prepare(`
        UPDATE staff_slot_attendance
        SET actual_check_in = COALESCE(?, actual_check_in),
            actual_check_out = COALESCE(?, actual_check_out),
            attended_minutes = ?,
            approved_payable_minutes = ?,
            overtime_minutes = ?,
            status = ?,
            source = 'admin_adjustment',
            adjustment_reason = ?,
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        actual_check_in || null,
        actual_check_out || null,
        finalAttended,
        finalPayable,
        Number(overtime_minutes),
        finalStatus,
        adjustment_reason,
        actorId,
        slot_id
      );

      // Audit log
      db.prepare(`
        INSERT INTO payroll_audit_logs (academy_id, entity_type, entity_id, action, actor_id, changes_summary, reason)
        VALUES (?, 'schedule', ?, 'update', ?, ?, ?)
      `).run(
        academyId,
        slot_id,
        actorId || 1,
        `Slot attendance #${slot_id} adjusted: status=${finalStatus}, attended=${finalAttended}m, payable=${finalPayable}m`,
        adjustment_reason
      );

      return db.prepare('SELECT * FROM staff_slot_attendance WHERE id = ?').get(slot_id);
    })();
  }

  /**
   * Automated slot checkout for expired slots past scheduled end time + grace period
   */
  static processAutomaticSlotCheckout(db, academyId, options = {}) {
    const graceMinutes = options.graceMinutes !== undefined ? options.graceMinutes : 15;
    const nowTimeStr = options.currentTimeStr || new Date().toTimeString().slice(0, 5);
    const todayDateStr = options.currentDateStr || DateUtils.getTodayDate();
    const nowMin = this.timeToMinutes(nowTimeStr);

    const openSlots = db.prepare(`
      SELECT * FROM staff_slot_attendance
      WHERE academy_id = ?
        AND attendance_date = ?
        AND actual_check_in IS NOT NULL
        AND actual_check_out IS NULL
        AND status IN ('present', 'late')
    `).all(academyId, todayDateStr);

    const checkedOut = [];

    for (const slot of openSlots) {
      let endMin = this.timeToMinutes(slot.scheduled_end_time);
      let startMin = this.timeToMinutes(slot.scheduled_start_time);
      if (endMin <= startMin) endMin += 1440;

      if (nowMin >= (endMin + graceMinutes) || options.force) {
        const checkInMin = this.timeToMinutes(slot.actual_check_in);
        let attendedMin = Math.max(0, endMin - checkInMin);
        if (slot.scheduled_minutes > 0) {
          attendedMin = Math.min(attendedMin, slot.scheduled_minutes);
        }

        db.prepare(`
          UPDATE staff_slot_attendance
          SET actual_check_out = ?,
              attended_minutes = ?,
              approved_payable_minutes = ?,
              source = 'auto_checkout',
              notes = COALESCE(notes, '') || ' [Auto checked out with ' || ? || 'm grace]',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(slot.scheduled_end_time, attendedMin, attendedMin, graceMinutes, slot.id);

        checkedOut.push({
          id: slot.id,
          userId: slot.user_id,
          slotName: slot.slot_name,
          actualCheckOut: slot.scheduled_end_time,
          attendedMinutes: attendedMin
        });
      }
    }

    return { processedCount: checkedOut.length, checkedOut };
  }

  /**
   * Submit shift swap request
   */
  static async requestShiftSwap(db, academyId, data, actorId = null) {
    const {
      requester_id,
      recipient_id,
      slot_attendance_id,
      swap_date,
      slot_name = 'Shift Slot',
      start_time,
      end_time,
      branch_id,
      batch_id,
      reason
    } = data;

    const normDate = DateUtils.parseAndNormalizeDate(swap_date, { fieldName: 'Swap date', required: true });

    // Validate recipient availability
    const { StaffAvailabilityService } = await import('./staffAvailabilityService.js');
    const conflictResult = StaffAvailabilityService.checkSlotConflict(db, {
      userId: recipient_id,
      date: normDate,
      startTime: start_time,
      endTime: end_time,
      branchId: branch_id
    });

    if (conflictResult.hasConflict) {
      throw new Error(`Cannot request swap: Recipient coach is unavailable on ${normDate} [${start_time}-${end_time}]. Reason: ${conflictResult.reason}`);
    }

    const ins = db.prepare(`
      INSERT INTO staff_shift_swaps (
        academy_id, requester_id, recipient_id, slot_attendance_id, swap_date,
        slot_name, start_time, end_time, branch_id, batch_id, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      academyId,
      requester_id,
      recipient_id,
      slot_attendance_id || null,
      normDate,
      slot_name,
      start_time,
      end_time,
      branch_id || null,
      batch_id || null,
      reason || 'Staff requested shift swap'
    );

    return db.prepare('SELECT * FROM staff_shift_swaps WHERE id = ?').get(ins.lastInsertRowid);
  }

  /**
   * Review (approve or reject) shift swap request
   */
  static async reviewShiftSwap(db, academyId, swapId, { status, rejectionReason }, actorId = null) {
    const swap = db.prepare('SELECT * FROM staff_shift_swaps WHERE id = ?').get(swapId);
    if (!swap) throw new Error(`Shift swap request #${swapId} not found`);

    if (status === 'approved') {
      // Re-verify recipient availability before approval
      const { StaffAvailabilityService } = await import('./staffAvailabilityService.js');
      const conflictResult = StaffAvailabilityService.checkSlotConflict(db, {
        userId: swap.recipient_id,
        date: swap.swap_date,
        startTime: swap.start_time,
        endTime: swap.end_time,
        branchId: swap.branch_id
      });

      if (conflictResult.hasConflict) {
        throw new Error(`Approval blocked: Recipient coach is now conflicting: ${conflictResult.reason}`);
      }

      return db.transaction(() => {
        // If tied to a slot attendance record, reassign to recipient
        if (swap.slot_attendance_id) {
          db.prepare(`
            UPDATE staff_slot_attendance
            SET user_id = ?,
                source = 'swap',
                notes = COALESCE(notes, '') || ' [Swapped from user #' || ? || ']',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(swap.recipient_id, swap.requester_id, swap.slot_attendance_id);
        }

        db.prepare(`
          UPDATE staff_shift_swaps
          SET status = 'approved',
              reviewed_by = ?,
              reviewed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(actorId, swapId);

        return db.prepare('SELECT * FROM staff_shift_swaps WHERE id = ?').get(swapId);
      })();
    } else {
      db.prepare(`
        UPDATE staff_shift_swaps
        SET status = 'rejected',
            rejection_reason = ?,
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(rejectionReason || 'Rejected by administrator', actorId, swapId);

      return db.prepare('SELECT * FROM staff_shift_swaps WHERE id = ?').get(swapId);
    }
  }
}
