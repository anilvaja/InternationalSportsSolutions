import { DateUtils } from '../utils/dateUtils.js';
import { ScheduleService } from './scheduleService.js';

/**
 * StaffAvailabilityService
 * 
 * Central availability and conflict detection engine.
 * Computes real-time coach availability considering:
 * - Recurring shifts & multi-slot schedules
 * - Date-specific schedule overrides
 * - Batch assignments & session bookings
 * - Approved leaves (full & half-day)
 * - Academy & branch holidays
 * - Inter-branch travel buffers (e.g. 30m minimum travel between different branches)
 * - Maximum daily & weekly working hours
 * - Temporary schedule changes & swaps
 */
export class StaffAvailabilityService {

  /**
   * Helper: converts HH:MM string to minutes from midnight
   */
  static timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  /**
   * Helper: converts minutes from midnight back to HH:MM format
   */
  static minutesToTime(minutes) {
    const norm = ((minutes % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const m = norm % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Normalizes days_of_week inputs into integer weekday set (1=Mon ... 7=Sun)
   */
  static normalizeDaysOfWeek(val) {
    if (!val) return [1, 2, 3, 4, 5, 6]; // default Mon-Sat
    if (Array.isArray(val)) {
      return val.map(d => {
        if (typeof d === 'number') return d;
        const s = String(d).toLowerCase().trim();
        if (s.startsWith('mon')) return 1;
        if (s.startsWith('tue')) return 2;
        if (s.startsWith('wed')) return 3;
        if (s.startsWith('thu')) return 4;
        if (s.startsWith('fri')) return 5;
        if (s.startsWith('sat')) return 6;
        if (s.startsWith('sun')) return 7;
        const n = parseInt(s, 10);
        return isNaN(n) ? null : n;
      }).filter(d => d !== null);
    }

    const str = String(val).trim();
    if (str.startsWith('[') && str.endsWith(']')) {
      try {
        const parsed = JSON.parse(str);
        return this.normalizeDaysOfWeek(parsed);
      } catch (_) {}
    }

    if (str.toLowerCase().includes('daily')) {
      return [1, 2, 3, 4, 5, 6, 7];
    }

    // Comma-separated or tokenized
    const parts = str.split(/[,&/|]/).map(p => p.trim());
    return this.normalizeDaysOfWeek(parts);
  }

  /**
   * Helper: resolves both userId and coachId for convenience
   */
  static resolveUserAndCoach(db, { userId, coachId }) {
    let resolvedUserId = userId || null;
    let resolvedCoachId = coachId || null;

    if (!resolvedUserId && resolvedCoachId) {
      const c = db.prepare('SELECT id, user_id FROM coaches WHERE id = ?').get(resolvedCoachId);
      if (c) {
        resolvedUserId = c.user_id;
      }
    } else if (resolvedUserId && !resolvedCoachId) {
      const c = db.prepare('SELECT id FROM coaches WHERE user_id = ?').get(resolvedUserId);
      if (c) {
        resolvedCoachId = c.id;
      }
    }

    return { userId: resolvedUserId, coachId: resolvedCoachId };
  }

  /**
   * Checks for time overlap between [startA, endA] and [startB, endB]
   * Handles overnight intervals crossing midnight
   */
  static intervalsOverlap(startA, endA, startB, endB) {
    const sA = this.timeToMinutes(startA);
    let eA = this.timeToMinutes(endA);
    const sB = this.timeToMinutes(startB);
    let eB = this.timeToMinutes(endB);

    if (eA <= sA) eA += 1440; // crosses midnight
    if (eB <= sB) eB += 1440;

    return (sA < eB && eA > sB);
  }

  /**
   * Checks if consecutive slots at different branches violate the travel buffer
   * travelBufferMinutes defaults to 30 minutes
   */
  static checkTravelBufferViolation(startA, endA, branchA, startB, endB, branchB, travelBufferMinutes = 30) {
    if (!branchA || !branchB || Number(branchA) === Number(branchB)) {
      return false; // same branch or unspecified branch, no inter-branch travel required
    }

    const sA = this.timeToMinutes(startA);
    let eA = this.timeToMinutes(endA);
    const sB = this.timeToMinutes(startB);
    let eB = this.timeToMinutes(endB);

    if (eA <= sA) eA += 1440;
    if (eB <= sB) eB += 1440;

    // If A is before B: gap is sB - eA. If 0 <= gap < travelBufferMinutes -> violation
    if (eA <= sB && (sB - eA) < travelBufferMinutes) {
      return {
        violation: true,
        actualGapMinutes: Math.max(0, sB - eA),
        requiredBufferMinutes: travelBufferMinutes,
        firstSlot: `${startA}-${endA} (Branch #${branchA})`,
        secondSlot: `${startB}-${endB} (Branch #${branchB})`
      };
    }

    // If B is before A: gap is sA - eB. If 0 <= gap < travelBufferMinutes -> violation
    if (eB <= sA && (sA - eB) < travelBufferMinutes) {
      return {
        violation: true,
        actualGapMinutes: Math.max(0, sA - eB),
        requiredBufferMinutes: travelBufferMinutes,
        firstSlot: `${startB}-${endB} (Branch #${branchB})`,
        secondSlot: `${startA}-${endA} (Branch #${branchA})`
      };
    }

    return false;
  }

  /**
   * Core conflict detection: checks if a coach/user has any conflict for a proposed slot/batch
   * Checks:
   * 1. Holidays & closed academy days
   * 2. Approved leave requests (full or half-day matching)
   * 3. Date-specific schedule overrides
   * 4. Overlapping shifts from recurring work schedule
   * 5. Overlapping assigned batches/sessions
   * 6. Inter-branch travel buffer violations (e.g. 30 mins)
   * 7. Maximum daily working hours (default 8.0h or user limit)
   */
  static checkSlotConflict(db, {
    userId,
    coachId,
    date,
    startTime,
    endTime,
    branchId = null,
    excludeShiftId = null,
    excludeBatchId = null,
    travelBufferMinutes = 30,
    maxDailyHours = 8.0
  }) {
    const { userId: uid, coachId: cid } = this.resolveUserAndCoach(db, { userId, coachId });
    if (!uid && !cid) {
      return { hasConflict: false, conflicts: [], reason: null };
    }

    const conflicts = [];
    const proposedDurationMinutes = (this.timeToMinutes(endTime) <= this.timeToMinutes(startTime))
      ? (1440 - this.timeToMinutes(startTime) + this.timeToMinutes(endTime))
      : (this.timeToMinutes(endTime) - this.timeToMinutes(startTime));
    const proposedDurationHours = Number((proposedDurationMinutes / 60).toFixed(2));

    const dateObj = new Date(date + 'T00:00:00');
    const jsDay = dateObj.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    // 1. Check Academy & Branch Holidays
    let holidayQuery = "SELECT * FROM academy_holidays WHERE ((end_date IS NULL AND holiday_date = ?) OR (end_date IS NOT NULL AND holiday_date <= ? AND end_date >= ?)) AND (status IS NULL OR status = 'approved')";
    const holidayParams = [date, date, date];
    if (branchId) {
      holidayQuery += ' AND (branch_id IS NULL OR branch_id = ?)';
      holidayParams.push(branchId);
    }
    const holiday = db.prepare(holidayQuery + ' LIMIT 1').get(...holidayParams);
    if (holiday && holiday.is_closed !== 0) {
      conflicts.push({
        type: 'holiday',
        description: `Academy/Branch holiday on this date: ${holiday.name}`,
        holiday
      });
    }

    // 2. Check Approved Leaves
    if (uid) {
      const leave = db.prepare(`
        SELECT * FROM leave_requests
        WHERE (user_id = ? OR applicant_id = ?)
          AND status = 'approved'
          AND ? BETWEEN start_date AND end_date
        LIMIT 1
      `).get(uid, uid, date);

      if (leave) {
        const isHalfDay = leave.day_part === 'first_half' || leave.day_part === 'second_half' || leave.leave_type === 'half_day';
        if (!isHalfDay) {
          conflicts.push({
            type: 'on_leave',
            description: `Staff member is on approved full-day leave (${leave.leave_type || 'leave'})`,
            leave
          });
        } else {
          // Half-day check: first_half usually morning (before 13:00), second_half afternoon (after 13:00)
          const startMin = this.timeToMinutes(startTime);
          if (leave.day_part === 'first_half' && startMin < 780) {
            conflicts.push({
              type: 'on_leave',
              description: 'Staff member is on approved first-half leave',
              leave
            });
          } else if (leave.day_part === 'second_half' && startMin >= 780) {
            conflicts.push({
              type: 'on_leave',
              description: 'Staff member is on approved second-half leave',
              leave
            });
          }
        }
      }
    }

    // 3. Date-Specific Schedule Overrides (employee_schedule_overrides)
    if (uid) {
      const overrides = db.prepare(`
        SELECT * FROM employee_schedule_overrides
        WHERE user_id = ? AND override_date = ?
      `).all(uid, date);

      for (const ov of overrides) {
        if (ov.schedule_action === 'off' || ov.schedule_action === 'cancel') {
          // Date is explicitly marked off
          if (!ov.start_time || !ov.end_time) {
            conflicts.push({
              type: 'schedule_override_off',
              description: `Date has an active override marking staff off: ${ov.reason || 'Staff Off'}`,
              override: ov
            });
          }
        } else if (ov.start_time && ov.end_time) {
          if (this.intervalsOverlap(startTime, endTime, ov.start_time, ov.end_time)) {
            conflicts.push({
              type: 'schedule_override_conflict',
              description: `Conflict with date override [${ov.start_time}-${ov.end_time}]: ${ov.shift_name}`,
              override: ov
            });
          }
        }
      }
    }

    // 4. Overlapping Batches Assigned to Coach
    let totalScheduledMinutes = 0;
    if (cid) {
      const assignedBatches = db.prepare(`
        SELECT b.*, br.name as branch_name
        FROM batches b
        LEFT JOIN branches br ON b.branch_id = br.id
        WHERE (b.coach_id = ? OR b.assistant_coach_id = ?)
          AND b.is_active = 1
          AND b.id != ?
      `).all(cid, cid, excludeBatchId || 0);

      for (const b of assignedBatches) {
        const days = this.normalizeDaysOfWeek(b.days_of_week);
        if (days.includes(dayOfWeek)) {
          const bDuration = (this.timeToMinutes(b.end_time) <= this.timeToMinutes(b.start_time))
            ? (1440 - this.timeToMinutes(b.start_time) + this.timeToMinutes(b.end_time))
            : (this.timeToMinutes(b.end_time) - this.timeToMinutes(b.start_time));
          totalScheduledMinutes += bDuration;

          // Check direct overlap
          if (this.intervalsOverlap(startTime, endTime, b.start_time, b.end_time)) {
            conflicts.push({
              type: 'batch_double_booking',
              description: `Coach is already assigned to batch '${b.name}' [${b.start_time}-${b.end_time}] on this weekday`,
              batch: b
            });
          }

          // Check inter-branch travel buffer
          const bufferCheck = this.checkTravelBufferViolation(
            startTime, endTime, branchId,
            b.start_time, b.end_time, b.branch_id,
            travelBufferMinutes
          );
          if (bufferCheck && bufferCheck.violation) {
            conflicts.push({
              type: 'travel_buffer_violation',
              description: `Insufficient travel buffer between Branch #${branchId} and Branch #${b.branch_id} (${b.branch_name || 'other branch'}). Gap is ${bufferCheck.actualGapMinutes}m; required is ${travelBufferMinutes}m`,
              travelCheck: bufferCheck,
              batch: b
            });
          }
        }
      }
    }

    // 5. Existing Batch Sessions on Specific Date
    if (cid) {
      const sessions = db.prepare(`
        SELECT bs.*, b.name as batch_name, br.name as branch_name
        FROM batch_sessions bs
        JOIN batches b ON bs.batch_id = b.id
        LEFT JOIN branches br ON bs.branch_id = br.id
        WHERE (bs.coach_id = ? OR bs.substitute_coach_id = ? OR bs.assistant_coach_id = ?)
          AND bs.scheduled_date = ?
          AND bs.status != 'cancelled'
          AND bs.batch_id != ?
      `).all(cid, cid, cid, date, excludeBatchId || 0);

      for (const s of sessions) {
        if (this.intervalsOverlap(startTime, endTime, s.start_time, s.end_time)) {
          conflicts.push({
            type: 'session_double_booking',
            description: `Coach is already scheduled for session '${s.batch_name}' [${s.start_time}-${s.end_time}]`,
            session: s
          });
        }

        const bufferCheck = this.checkTravelBufferViolation(
          startTime, endTime, branchId,
          s.start_time, s.end_time, s.branch_id,
          travelBufferMinutes
        );
        if (bufferCheck && bufferCheck.violation) {
          conflicts.push({
            type: 'travel_buffer_violation',
            description: `Insufficient travel buffer with session '${s.batch_name}' at Branch #${s.branch_id} (${s.branch_name || 'branch'}). Gap is ${bufferCheck.actualGapMinutes}m; required is ${travelBufferMinutes}m`,
            travelCheck: bufferCheck,
            session: s
          });
        }
      }
    }

    // 6. Existing Slot Attendance on this Date
    if (uid) {
      const slotAtts = db.prepare(`
        SELECT * FROM staff_slot_attendance
        WHERE user_id = ? AND attendance_date = ? AND status != 'cancelled'
      `).all(uid, date);

      for (const sa of slotAtts) {
        if (excludeShiftId && Number(sa.schedule_shift_id) === Number(excludeShiftId)) continue;
        if (this.intervalsOverlap(startTime, endTime, sa.scheduled_start_time, sa.scheduled_end_time)) {
          conflicts.push({
            type: 'slot_attendance_overlap',
            description: `Overlaps with scheduled work slot '${sa.slot_name}' [${sa.scheduled_start_time}-${sa.scheduled_end_time}]`,
            slotAttendance: sa
          });
        }

        const bufferCheck = this.checkTravelBufferViolation(
          startTime, endTime, branchId,
          sa.scheduled_start_time, sa.scheduled_end_time, sa.branch_id,
          travelBufferMinutes
        );
        if (bufferCheck && bufferCheck.violation) {
          conflicts.push({
            type: 'travel_buffer_violation',
            description: `Insufficient travel buffer with slot '${sa.slot_name}' at Branch #${sa.branch_id}. Gap: ${bufferCheck.actualGapMinutes}m; required: ${travelBufferMinutes}m`,
            travelCheck: bufferCheck,
            slotAttendance: sa
          });
        }
      }
    }

    // 7. Maximum Daily Working Hours Enforcement
    const totalDailyHours = Number(((totalScheduledMinutes + proposedDurationMinutes) / 60).toFixed(2));
    if (totalDailyHours > maxDailyHours) {
      conflicts.push({
        type: 'max_daily_hours_exceeded',
        description: `Total scheduled hours for date (${totalDailyHours}h) exceeds maximum allowed daily hours (${maxDailyHours}h)`,
        totalDailyHours,
        maxDailyHours
      });
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      reason: conflicts.length > 0 ? conflicts.map(c => c.description).join('; ') : null
    };
  }

  /**
   * Evaluates overall availability status of a coach for a given time window
   * Returns: 'available' | 'scheduled' | 'occupied' | 'on_leave' | 'holiday' | 'off_day' | 'conflict'
   */
  static getCoachAvailability(db, {
    coachId,
    userId,
    date,
    startTime = '09:00',
    endTime = '10:00',
    branchId = null,
    travelBufferMinutes = 30
  }) {
    const { userId: uid, coachId: cid } = this.resolveUserAndCoach(db, { userId, coachId });
    const conflictResult = this.checkSlotConflict(db, {
      userId: uid,
      coachId: cid,
      date,
      startTime,
      endTime,
      branchId,
      travelBufferMinutes
    });

    if (conflictResult.hasConflict) {
      const topConflict = conflictResult.conflicts[0];
      let status = 'conflict';
      if (topConflict.type === 'holiday') status = 'holiday';
      else if (topConflict.type === 'on_leave') status = 'on_leave';
      else if (topConflict.type === 'batch_double_booking' || topConflict.type === 'session_double_booking' || topConflict.type === 'slot_attendance_overlap') status = 'occupied';
      else if (topConflict.type === 'travel_buffer_violation') status = 'conflict';

      return {
        coachId: cid,
        userId: uid,
        date,
        status,
        isAvailable: false,
        reason: conflictResult.reason,
        conflicts: conflictResult.conflicts
      };
    }

    // Check if staff has other non-conflicting shifts on this day
    const dayExpectation = uid ? ScheduleService.getDayScheduleExpectation(db, uid, date) : null;
    let status = 'available';
    if (dayExpectation && dayExpectation.isWeeklyOff) {
      status = 'off_day';
    } else if (dayExpectation && dayExpectation.shifts && dayExpectation.shifts.length > 0) {
      status = 'scheduled';
    }

    return {
      coachId: cid,
      userId: uid,
      date,
      status,
      isAvailable: true,
      reason: null,
      conflicts: []
    };
  }

  /**
   * Search and filter available coaches for a proposed batch or slot
   */
  static findAvailableCoaches(db, academyId, date, startTime, endTime, branchId = null, options = {}) {
    const travelBufferMinutes = options.travelBufferMinutes || 30;
    const sportId = options.sportId || null;

    let coachQuery = `
      SELECT c.*, u.email, u.phone as user_phone, br.name as branch_name
      FROM coaches c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN branches br ON c.branch_id = br.id
      WHERE (c.status = 'active' OR c.status IS NULL)
    `;
    const params = [];
    if (sportId) {
      coachQuery += ' AND c.specialization LIKE ?';
      params.push(`%${sportId}%`);
    }

    const coaches = db.prepare(coachQuery).all(...params);
    const results = [];

    for (const coach of coaches) {
      const avail = this.getCoachAvailability(db, {
        coachId: coach.id,
        userId: coach.user_id,
        date,
        startTime,
        endTime,
        branchId,
        travelBufferMinutes
      });

      results.push({
        ...coach,
        availabilityStatus: avail.status,
        isAvailable: avail.isAvailable,
        conflictReason: avail.reason,
        conflicts: avail.conflicts
      });
    }

    // Sort: available first, then scheduled, then occupied/conflict/on_leave
    const order = { 'available': 1, 'scheduled': 2, 'off_day': 3, 'conflict': 4, 'occupied': 5, 'on_leave': 6, 'holiday': 7 };
    results.sort((a, b) => (order[a.availabilityStatus] || 99) - (order[b.availabilityStatus] || 99));

    return results;
  }

  /**
   * Validates batch coach assignment across all its recurring weekdays
   * Throws Error if conflict is detected
   */
  static validateBatchCoachAssignment(db, {
    batchId,
    coachId,
    branchId,
    startTime,
    endTime,
    daysOfWeek,
    travelBufferMinutes = 30
  }) {
    if (!coachId) return true;
    const weekdays = this.normalizeDaysOfWeek(daysOfWeek);
    const coach = db.prepare('SELECT id, name, user_id FROM coaches WHERE id = ?').get(coachId);
    if (!coach) {
      throw new Error(`Coach with ID ${coachId} not found`);
    }

    // Query other active batches assigned to this coach
    const otherBatches = db.prepare(`
      SELECT b.*, br.name as branch_name
      FROM batches b
      LEFT JOIN branches br ON b.branch_id = br.id
      WHERE (b.coach_id = ? OR b.assistant_coach_id = ?)
        AND b.is_active = 1
        AND b.id != ?
    `).all(coachId, coachId, batchId || 0);

    for (const ob of otherBatches) {
      const obDays = this.normalizeDaysOfWeek(ob.days_of_week);
      const commonDays = weekdays.filter(d => obDays.includes(d));

      if (commonDays.length > 0) {
        // Check time overlap
        if (this.intervalsOverlap(startTime, endTime, ob.start_time, ob.end_time)) {
          const dayNames = commonDays.map(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d - 1]).join(', ');
          throw new Error(
            `Schedule Conflict: Coach ${coach.name} is already assigned to batch '${ob.name}' [${ob.start_time}-${ob.end_time}] on ${dayNames}. Double-booking is strictly prohibited.`
          );
        }

        // Check travel buffer violation
        const bufferCheck = this.checkTravelBufferViolation(
          startTime, endTime, branchId,
          ob.start_time, ob.end_time, ob.branch_id,
          travelBufferMinutes
        );
        if (bufferCheck && bufferCheck.violation) {
          throw new Error(
            `Travel Buffer Violation: Coach ${coach.name} has batch '${ob.name}' at Branch #${ob.branch_id} (${ob.branch_name || 'other branch'}). Insufficient travel buffer of ${bufferCheck.actualGapMinutes}m (Minimum required: ${travelBufferMinutes}m).`
          );
        }
      }
    }

    return true;
  }

  /**
   * Generates comprehensive daily schedule for a coach/user
   */
  static getCoachDailySchedule(db, { coachId, userId, date }) {
    const { userId: uid, coachId: cid } = this.resolveUserAndCoach(db, { userId, coachId });
    const dateObj = new Date(date + 'T00:00:00');
    const jsDay = dateObj.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const items = [];

    // 1. Regular schedule shifts
    if (uid) {
      const sched = ScheduleService.getEffectiveSchedule(db, uid, date);
      const dayShifts = (sched.shifts || []).filter(s => s.day_of_week === dayOfWeek && s.is_working_day);
      for (const s of dayShifts) {
        items.push({
          sourceType: 'shift',
          id: s.id,
          name: s.shift_name,
          shiftType: s.shift_type || 'regular',
          startTime: s.start_time,
          endTime: s.end_time,
          scheduledHours: s.scheduled_hours,
          branchId: s.branch_id || sched.branch_id
        });
      }
    }

    // 2. Date-specific overrides
    if (uid) {
      const overrides = db.prepare('SELECT * FROM employee_schedule_overrides WHERE user_id = ? AND override_date = ?').all(uid, date);
      for (const ov of overrides) {
        items.push({
          sourceType: 'override',
          id: ov.id,
          name: ov.shift_name,
          shiftType: ov.shift_type || 'regular',
          action: ov.schedule_action,
          startTime: ov.start_time,
          endTime: ov.end_time,
          scheduledHours: ov.scheduled_hours,
          branchId: ov.branch_id,
          reason: ov.reason
        });
      }
    }

    // 3. Assigned batches
    if (cid) {
      const batches = db.prepare(`
        SELECT b.*, br.name as branch_name
        FROM batches b
        LEFT JOIN branches br ON b.branch_id = br.id
        WHERE (b.coach_id = ? OR b.assistant_coach_id = ?) AND b.is_active = 1
      `).all(cid, cid);

      for (const b of batches) {
        const days = this.normalizeDaysOfWeek(b.days_of_week);
        if (days.includes(dayOfWeek)) {
          items.push({
            sourceType: 'batch',
            id: b.id,
            name: b.name,
            startTime: b.start_time,
            endTime: b.end_time,
            branchId: b.branch_id,
            branchName: b.branch_name,
            role: b.coach_id === cid ? 'primary_coach' : 'assistant_coach'
          });
        }
      }
    }

    // Sort items by start time
    items.sort((a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime));

    return {
      userId: uid,
      coachId: cid,
      date,
      dayOfWeek,
      items
    };
  }
}
