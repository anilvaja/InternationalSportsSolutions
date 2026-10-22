/**
 * ScheduleService
 * Manages employee-specific work schedules, weekday shifts, multiple shifts per day,
 * break rules, weekly offs, holidays, and expected working hours calculation.
 */
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
   * Retrieves active work schedule and shifts for a user on a given date
   */
  static getEffectiveSchedule(db, userId, dateStr = new Date().toISOString().split('T')[0]) {
    const schedule = db.prepare(`
      SELECT * FROM employee_work_schedules
      WHERE user_id = ?
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
        AND is_active = 1
      ORDER BY effective_from DESC
      LIMIT 1
    `).get(userId, dateStr, dateStr);

    if (schedule) {
      const shifts = db.prepare(`
        SELECT * FROM employee_schedule_shifts
        WHERE schedule_id = ?
        ORDER BY day_of_week ASC, start_time ASC
      `).all(schedule.id);

      return {
        ...schedule,
        shifts,
        is_custom: true,
      };
    }

    // Default Fallback Schedule: Monday to Saturday, 9:00 to 17:00 (8h, 6 days, Sun off)
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
    // Sunday off
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
      schedule_name: 'Standard Academy Default (Fallback)',
      effective_from: '2026-01-01',
      effective_to: null,
      expected_daily_hours: 8.0,
      expected_weekly_hours: 48.0,
      working_days_per_week: 6,
      shifts: fallbackShifts,
      is_custom: false,
    };
  }

  /**
   * Evaluates employee schedule expectation for a single date
   */
  static getDayScheduleExpectation(db, userId, dateStr) {
    const dateObj = new Date(dateStr + 'T00:00:00');
    // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    // Convert to 1=Mon, 2=Tue, ..., 7=Sun
    const jsDay = dateObj.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const schedule = this.getEffectiveSchedule(db, userId, dateStr);

    // 1. Check if date is an academy or branch holiday
    const branchId = schedule.branch_id || null;
    let holiday = null;
    if (branchId) {
      holiday = db.prepare(`
        SELECT * FROM academy_holidays 
        WHERE holiday_date = ? AND (branch_id IS NULL OR branch_id = ?)
        LIMIT 1
      `).get(dateStr, branchId);
    } else {
      holiday = db.prepare(`
        SELECT * FROM academy_holidays 
        WHERE holiday_date = ?
        LIMIT 1
      `).get(dateStr);
    }

    // 2. Check approved leave requests
    const leave = db.prepare(`
      SELECT * FROM leave_requests
      WHERE applicant_id = ?
        AND status = 'approved'
        AND ? BETWEEN start_date AND end_date
      LIMIT 1
    `).get(userId, dateStr);

    // 3. Find shifts scheduled for this weekday
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

    let dayType = 'working_day';
    if (!isWorkingDay) {
      dayType = 'weekly_off';
    } else if (holiday) {
      dayType = holiday.is_paid ? 'paid_holiday' : 'unpaid_holiday';
    } else if (leave) {
      dayType = (leave.leave_type === 'unpaid') ? 'unpaid_leave' : 'paid_leave';
    }

    return {
      date: dateStr,
      dayOfWeek,
      dayType,
      isWorkingDay: isWorkingDay && !holiday && !leave,
      isWeeklyOff: !isWorkingDay,
      isHoliday: !!holiday,
      holidayName: holiday ? holiday.name : null,
      isLeave: !!leave,
      leaveType: leave ? (leave.leave_type || 'paid') : null,
      scheduledHours,
      shifts: dayShifts,
      scheduleId: schedule.id || null,
      scheduleName: schedule.schedule_name,
    };
  }

  /**
   * Calculates total scheduled hours and days across an entire payroll period
   */
  static calculateExpectedHoursForPeriod(db, userId, startDate, endDate, joiningDate = null) {
    let totalScheduledHours = 0;
    let scheduledWorkingDays = 0;
    let weeklyOffDays = 0;
    let holidayDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    const dayBreakdown = [];

    let effectiveJoining = joiningDate;
    if (!effectiveJoining) {
      try {
        const emp = db.prepare('SELECT joining_date FROM employment_records WHERE user_id = ? AND effective_to IS NULL ORDER BY effective_from DESC LIMIT 1').get(userId);
        const coach = db.prepare('SELECT joining_date, created_at FROM coaches WHERE user_id = ?').get(userId);
        const u = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);
        effectiveJoining = (emp && emp.joining_date)
          || (coach && coach.joining_date)
          || (coach && coach.created_at ? coach.created_at.slice(0, 10) : null)
          || (u && u.created_at ? u.created_at.slice(0, 10) : null);
      } catch (e) {}
    }

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayNum}`;

      const dayDateObj = new Date(dateStr + 'T00:00:00');
      const jsDay = dayDateObj.getDay();
      const dayOfWeek = jsDay === 0 ? 7 : jsDay;

      // Check if this date is prior to employee's official joining date
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
          scheduleName: 'Not Employed',
        });
        continue;
      }

      const dayExp = this.getDayScheduleExpectation(db, userId, dateStr);
      dayBreakdown.push(dayExp);

      if (dayExp.dayType === 'weekly_off') {
        weeklyOffDays++;
      } else if (dayExp.dayType === 'paid_holiday') {
        holidayDays++;
      } else if (dayExp.dayType === 'paid_leave') {
        paidLeaveDays++;
      } else if (dayExp.dayType === 'unpaid_leave') {
        unpaidLeaveDays++;
      } else {
        // Active expected working day
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
      totalCalendarDays: dayBreakdown.length,
      joiningDate: effectiveJoining || null,
      dayBreakdown,
    };
  }

  /**
   * Saves or updates an employee's work schedule with shifts
   */
  static saveEmployeeSchedule(db, academyId, userId, scheduleData, shiftsData, actorId = null) {
    return db.transaction(() => {
      // 1. Validate shifts for overlaps
      this.validateShifts(shiftsData);

      const effectiveFrom = scheduleData.effective_from || new Date().toISOString().split('T')[0];
      const effectiveTo = scheduleData.effective_to || null;

      // Calculate total expected daily and weekly hours from shifts
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

      // Average daily hours on working days
      const avgDailyHours = workingDaysCount > 0 ? Number((totalWeeklyHours / workingDaysCount).toFixed(2)) : 0;
      totalWeeklyHours = Number(totalWeeklyHours.toFixed(2));

      // Close previous ongoing schedule if overlapping effective dates
      if (!effectiveTo) {
        const prev = db.prepare(`
          SELECT id FROM employee_work_schedules
          WHERE user_id = ? AND effective_to IS NULL AND effective_from < ?
        `).all(userId, effectiveFrom);

        const dayBefore = new Date(new Date(effectiveFrom + 'T00:00:00').getTime() - 86400000).toISOString().split('T')[0];
        for (const p of prev) {
          db.prepare('UPDATE employee_work_schedules SET effective_to = ? WHERE id = ?').run(dayBefore, p.id);
        }
      }

      // Insert new schedule
      const ins = db.prepare(`
        INSERT INTO employee_work_schedules (
          academy_id, branch_id, user_id, schedule_name, effective_from, effective_to,
          expected_daily_hours, expected_weekly_hours, working_days_per_week, is_active,
          notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        academyId,
        scheduleData.branch_id || null,
        userId,
        scheduleData.schedule_name || 'Standard Work Schedule',
        effectiveFrom,
        effectiveTo,
        avgDailyHours,
        totalWeeklyHours,
        workingDaysCount,
        scheduleData.notes || null,
        actorId
      );

      const scheduleId = ins.lastInsertRowid;

      // Insert shift rows
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
          netHours,
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
}
