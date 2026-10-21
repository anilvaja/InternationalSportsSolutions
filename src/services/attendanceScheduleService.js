import { getTenantDbById } from '../db/connectionManager.js';

/**
 * AttendanceScheduleService
 * Enforces coach attendance date restrictions, recurring session generation,
 * automatic next-session selection, and controlled session switching.
 */
export class AttendanceScheduleService {

  /**
   * Returns the current date in academy timezone (YYYY-MM-DD)
   */
  static getTodayDate(timezoneOrDb = 'Asia/Kolkata') {
    let timezone = typeof timezoneOrDb === 'string' ? timezoneOrDb : 'Asia/Kolkata';
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(new Date());
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  }

  /**
   * Helper: returns date N calendar days in past (YYYY-MM-DD)
   */
  static getPastDate(baseDateStr, days = 1) {
    const d = new Date(baseDateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().split('T')[0];
  }

  /**
   * Helper: returns date N calendar days in future (YYYY-MM-DD)
   */
  static getFutureDate(baseDateStr, days = 1) {
    const d = new Date(baseDateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  }

  /**
   * Validates if an attendance date is within the allowed window:
   * Today or previous N calendar days (default 2 days), inclusive.
   * Future dates are rejected.
   */
  static validateAttendanceDate(db, dateStr, timezone = 'Asia/Kolkata') {
    const today = this.getTodayDate(timezone);
    const todayObj = new Date(today + 'T00:00:00Z');
    const targetObj = new Date(dateStr + 'T00:00:00Z');

    if (isNaN(targetObj.getTime())) {
      return { allowed: false, reason: 'Invalid date format. Expected YYYY-MM-DD.' };
    }

    // Configurable allowed past days (default 2)
    let allowedPastDays = 2;
    let allowFuture = false;
    try {
      const policy = db.prepare('SELECT attendance_cutoff_days, allow_future_attendance FROM academy_policy_settings LIMIT 1').get();
      if (policy) {
        if (policy.attendance_cutoff_days !== null && !isNaN(Number(policy.attendance_cutoff_days))) {
          allowedPastDays = Number(policy.attendance_cutoff_days);
        }
        if (policy.allow_future_attendance) {
          allowFuture = true;
        }
      }
    } catch (e) {}

    try {
      const setting = db.prepare("SELECT value FROM tenant_settings WHERE key = 'attendance_allowed_past_days'").get();
      if (setting && !isNaN(Number(setting.value))) {
        allowedPastDays = Math.max(allowedPastDays, Number(setting.value));
      }
    } catch (e) {}

    const diffDays = Math.round((todayObj.getTime() - targetObj.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 && !allowFuture) {
      return {
        allowed: false,
        reason: `Future attendance is prohibited. Current date is ${today}.`,
        code: 'FUTURE_DATE_REJECTED',
      };
    }

    if (diffDays > allowedPastDays) {
      return {
        allowed: false,
        reason: `Attendance can only be recorded for today or the previous ${allowedPastDays} calendar days (${this.formatAllowedWindow(todayObj, allowedPastDays)}). Older dates require an authorized correction request.`,
        code: 'PAST_CUTOFF_EXCEEDED',
        diffDays,
        allowedPastDays,
      };
    }

    return { allowed: true, diffDays, today };
  }

  static formatAllowedWindow(todayObj, days) {
    const minDate = new Date(todayObj.getTime() - days * 24 * 60 * 60 * 1000);
    return `${minDate.toISOString().split('T')[0]} to ${todayObj.toISOString().split('T')[0]}`;
  }

  /**
   * Generates batch sessions from batch recurring timetable
   * @param {import('better-sqlite3').Database} db 
   * @param {Object} options
   */
  static generateSessionsForBatch(db, batchId, startDate, endDate) {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
    if (!batch) {
      throw new Error(`Batch ID ${batchId} not found`);
    }

    let daysOfWeek = ['Mon', 'Wed', 'Fri'];
    try {
      if (typeof batch.days_of_week === 'string') {
        const trimmed = batch.days_of_week.trim();
        if (trimmed.startsWith('[')) {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            daysOfWeek = parsed.map(d => String(d).trim().slice(0, 3));
          }
        } else {
          daysOfWeek = trimmed.split(',').map(d => d.trim().slice(0, 3));
        }
      } else if (Array.isArray(batch.days_of_week)) {
        daysOfWeek = batch.days_of_week.map(d => String(d).trim().slice(0, 3));
      }
    } catch (e) {}

    // Capitalize first letter, lowercase rest (e.g. "Mon", "Tue")
    daysOfWeek = daysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());

    const dayNameMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
    const insertSession = db.prepare(`
      INSERT OR IGNORE INTO batch_sessions (
        academy_id, branch_id, batch_id, scheduled_date, start_time, end_time,
        coach_id, status, attendance_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', 'pending')
    `);

    let cur = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');
    let generatedCount = 0;

    const tx = db.transaction(() => {
      while (cur <= end) {
        const dayOfWeek = dayNameMap[cur.getUTCDay()];
        if (daysOfWeek.includes(dayOfWeek)) {
          const dateStr = cur.toISOString().split('T')[0];
          let validCoachId = null;
          if (batch.coach_id) {
            const coachExists = db.prepare('SELECT id FROM coaches WHERE id = ?').get(batch.coach_id);
            if (coachExists) validCoachId = coachExists.id;
          }
          const res = insertSession.run(
            batch.academy_id || 1,
            batch.branch_id,
            batch.id,
            dateStr,
            batch.start_time || '07:00',
            batch.end_time || '08:30',
            validCoachId
          );
          if (res.changes > 0) {
            generatedCount++;
          }
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    });

    tx();
    return { batchId, generatedCount };
  }

  /**
   * Automatically selects the next eligible batch session for a coach/batch
   * Rules:
   * 1. Retrieve eligible sessions within allowed window (Today - 2 days to Today).
   * 2. Exclude cancelled sessions.
   * 3. Prioritize earliest session where attendance is pending.
   * 4. If all are completed, return existing completed session for view/correction.
   */
  static getNextEligibleSession(db, { batchId, coachId, timezone = 'Asia/Kolkata' }) {
    const today = this.getTodayDate(timezone);
    const todayObj = new Date(today + 'T00:00:00Z');

    let allowedPastDays = 2;
    try {
      const setting = db.prepare("SELECT value FROM tenant_settings WHERE key = 'attendance_allowed_past_days'").get();
      if (setting && !isNaN(Number(setting.value))) {
        allowedPastDays = Number(setting.value);
      }
    } catch (e) {}

    const minDateObj = new Date(todayObj.getTime() - allowedPastDays * 24 * 60 * 60 * 1000);
    const minDateStr = minDateObj.toISOString().split('T')[0];

    const futureEndObj = new Date(todayObj.getTime() + 14 * 24 * 60 * 60 * 1000);
    const futureEndStr = futureEndObj.toISOString().split('T')[0];

    // Ensure sessions exist in this window (past window through next 14 days)
    if (batchId) {
      this.generateSessionsForBatch(db, batchId, minDateStr, futureEndStr);
    }

    let query = `
      SELECT bs.*, b.name as batch_name, br.name as branch_name, c.name as coach_name
      FROM batch_sessions bs
      JOIN batches b ON bs.batch_id = b.id
      JOIN branches br ON bs.branch_id = br.id
      LEFT JOIN coaches c ON bs.coach_id = c.id
      WHERE bs.scheduled_date BETWEEN ? AND ?
        AND bs.status != 'cancelled'
    `;
    const params = [minDateStr, today];

    if (batchId) {
      query += ' AND bs.batch_id = ?';
      params.push(batchId);
    }
    if (coachId) {
      query += ' AND (bs.coach_id = ? OR bs.substitute_coach_id = ?)';
      params.push(coachId, coachId);
    }

    query += ' ORDER BY bs.scheduled_date ASC, bs.start_time ASC';

    const sessions = db.prepare(query).all(...params);

    if (sessions.length === 0) {
      return {
        hasSession: false,
        message: `No training sessions scheduled within the eligible attendance window (${minDateStr} to ${today}).`,
        allowedWindow: { minDate: minDateStr, maxDate: today },
      };
    }

    // 1. Pick the earliest pending session
    const pendingSession = sessions.find(s => s.attendance_status === 'pending');
    if (pendingSession) {
      return {
        hasSession: true,
        isCompleted: false,
        mode: 'entry',
        session: pendingSession,
        allowedWindow: { minDate: minDateStr, maxDate: today },
      };
    }

    // 2. All sessions in window completed -> query next upcoming scheduled session (> today)
    let nextUpcoming = null;
    try {
      let nextQuery = `
        SELECT bs.*, b.name as batch_name, bs.branch_id
        FROM batch_sessions bs
        JOIN batches b ON bs.batch_id = b.id
        WHERE bs.scheduled_date > ?
      `;
      const nextParams = [today];
      if (batchId) {
        nextQuery += ' AND bs.batch_id = ?';
        nextParams.push(batchId);
      }
      if (coachId) {
        nextQuery += ' AND (bs.coach_id = ? OR bs.substitute_coach_id = ?)';
        nextParams.push(coachId, coachId);
      }
      nextQuery += ' ORDER BY bs.scheduled_date ASC, bs.start_time ASC LIMIT 1';
      nextUpcoming = db.prepare(nextQuery).get(...nextParams);
    } catch (e) {
      console.warn('Could not query next upcoming session:', e.message);
    }

    const lastCompleted = sessions[sessions.length - 1];
    return {
      hasSession: true,
      isCompleted: true,
      mode: 'view',
      session: lastCompleted,
      nextUpcomingSession: nextUpcoming || null,
      allowedWindow: { minDate: minDateStr, maxDate: today },
      message: `All sessions in the eligible window are completed. Showing session for ${lastCompleted.scheduled_date} in review mode.`,
    };
  }

  /**
   * Controlled temporary batch/session switching without altering permanent batch
   */
  static switchSessionForStudent(db, {
    academyId = 1,
    studentId,
    originalSessionId,
    replacementSessionId,
    reason,
    userId,
  }) {
    if (!studentId || !originalSessionId || !replacementSessionId) {
      throw new Error('Student ID, Original Session ID, and Replacement Session ID are required');
    }
    if (!reason || !reason.trim()) {
      throw new Error('A reason is required for switching sessions');
    }

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!student) {
      throw new Error(`Student ${studentId} not found`);
    }

    const origSession = db.prepare('SELECT * FROM batch_sessions WHERE id = ?').get(originalSessionId);
    const replSession = db.prepare('SELECT * FROM batch_sessions WHERE id = ?').get(replacementSessionId);

    if (!origSession || !replSession) {
      throw new Error('One or both training sessions were not found');
    }

    if (replSession.status === 'cancelled') {
      throw new Error('Cannot switch to a cancelled session');
    }

    // Ensure no duplicate attendance already exists in replacement session
    const existingAtt = db.prepare(`
      SELECT sa.id FROM student_attendance sa
      JOIN attendance a ON sa.attendance_id = a.id
      WHERE a.batch_id = ? AND a.date = ? AND sa.student_id = ?
    `).get(replSession.batch_id, replSession.scheduled_date, studentId);

    if (existingAtt) {
      throw new Error('Student already has an attendance record in the target session date');
    }

    let swapId;
    const tx = db.transaction(() => {
      const res = db.prepare(`
        INSERT INTO session_swaps (
          academy_id, student_id, original_session_id, replacement_session_id,
          reason, requested_by, approved_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')
      `).run(academyId, studentId, originalSessionId, replacementSessionId, reason.trim(), userId || 1, userId || 1);
      swapId = res.lastInsertRowid;
    });

    tx();

    return {
      success: true,
      swapId,
      message: `Temporary session switch recorded for ${student.first_name} ${student.last_name}`,
      studentId,
      originalSessionId,
      replacementSessionId,
    };
  }

  /**
   * Records student attendance with date validation and session completion tracking
   */
  static recordSessionAttendance(db, {
    academyId = 1,
    batchId,
    date,
    records, // [{ studentId, status, remarks }]
    takenByUserId = 1,
    notes = '',
    timezone = 'Asia/Kolkata',
  }) {
    // 1. Date Validation
    const dateCheck = this.validateAttendanceDate(db, date, timezone);
    if (!dateCheck.allowed) {
      throw new Error(dateCheck.reason);
    }

    // 2. Locate or auto-create batch session
    let session = db.prepare('SELECT * FROM batch_sessions WHERE batch_id = ? AND scheduled_date = ?').get(batchId, date);
    if (!session) {
      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
      if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
      }
      let validCoachId = null;
      if (batch.coach_id) {
        const coachExists = db.prepare('SELECT id FROM coaches WHERE id = ?').get(batch.coach_id);
        if (coachExists) validCoachId = coachExists.id;
      }
      const ins = db.prepare(`
        INSERT INTO batch_sessions (
          academy_id, branch_id, batch_id, scheduled_date, start_time, end_time, coach_id, status, attendance_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', 'pending')
      `).run(
        academyId,
        batch.branch_id,
        batchId,
        date,
        batch.start_time || '07:00',
        batch.end_time || '08:30',
        validCoachId
      );
      session = db.prepare('SELECT * FROM batch_sessions WHERE id = ?').get(ins.lastInsertRowid);
    }

    if (session.status === 'cancelled') {
      throw new Error('Cannot submit attendance for a cancelled session');
    }

    let attendanceId;

    const tx = db.transaction(() => {
      // Create or update attendance master record
      const existingAtt = db.prepare('SELECT id FROM attendance WHERE batch_id = ? AND date = ?').get(batchId, date);
      if (existingAtt) {
        attendanceId = existingAtt.id;
        db.prepare('UPDATE attendance SET taken_by_user_id = ?, notes = ? WHERE id = ?').run(takenByUserId, notes, attendanceId);
      } else {
        const ins = db.prepare('INSERT INTO attendance (batch_id, date, taken_by_user_id, notes) VALUES (?, ?, ?, ?)')
          .run(batchId, date, takenByUserId, notes);
        attendanceId = ins.lastInsertRowid;
      }

      // Upsert individual student attendance
      const upsertStudent = db.prepare(`
        INSERT INTO student_attendance (attendance_id, student_id, status, remarks)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(attendance_id, student_id) DO UPDATE SET
          status = excluded.status,
          remarks = excluded.remarks
      `);

      for (const rec of records) {
        upsertStudent.run(attendanceId, rec.studentId, rec.status || 'present', rec.remarks || null);
      }

      // Mark session as completed
      db.prepare(`
        UPDATE batch_sessions
        SET status = 'completed',
            attendance_status = 'completed',
            attendance_taken_at = CURRENT_TIMESTAMP,
            attendance_taken_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(takenByUserId, session.id);
    });

    tx();

    return {
      success: true,
      attendanceId,
      sessionId: session.id,
      date,
      count: records.length,
    };
  }
}
