import { DateUtils } from '../utils/dateUtils.js';
import { ScheduleService } from './scheduleService.js';

export class AttendanceAdjustmentService {

  /**
   * Helper: Resolves today in ISO format YYYY-MM-DD
   */
  static getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Detects the original attendance status for student or employee
   */
  static detectOriginalStatus(db, { personType, studentId, userId, batchId, date }) {
    if (personType === 'student' && studentId) {
      if (batchId) {
        const row = db.prepare(`
          SELECT sa.status
          FROM student_attendance sa
          JOIN attendance a ON sa.attendance_id = a.id
          WHERE a.batch_id = ? AND a.date = ? AND sa.student_id = ?
          LIMIT 1
        `).get(batchId, date, studentId);
        if (row && row.status) return row.status;
      }
      const anyRow = db.prepare(`
        SELECT sa.status
        FROM student_attendance sa
        JOIN attendance a ON sa.attendance_id = a.id
        WHERE a.date = ? AND sa.student_id = ?
        ORDER BY sa.id DESC LIMIT 1
      `).get(date, studentId);
      if (anyRow && anyRow.status) return anyRow.status;
      return 'absent';
    }

    if (personType === 'employee' && userId) {
      const punch = db.prepare(`
        SELECT status, duration_minutes
        FROM staff_time_punches
        WHERE user_id = ? AND punch_date = ?
        ORDER BY id DESC LIMIT 1
      `).get(userId, date);

      if (punch) {
        if (punch.status === 'completed' || punch.duration_minutes > 0) return 'present';
        return punch.status || 'absent';
      }

      // Check session attendance for coaches
      const session = db.prepare(`
        SELECT bs.attendance_status
        FROM batch_sessions bs
        JOIN coaches c ON bs.coach_id = c.id
        WHERE c.user_id = ? AND bs.scheduled_date = ?
        ORDER BY bs.id DESC LIMIT 1
      `).get(userId, date);

      if (session && session.attendance_status === 'completed') return 'present';
      return 'absent';
    }

    return 'unmarked';
  }

  /**
   * Creates an attendance adjustment/correction request
   */
  static createAdjustment(db, academyId, data, actorUserId) {
    const rawDate = data.date;
    const date = DateUtils.parseAndNormalizeDate(rawDate, { fieldName: 'Attendance Date', required: true });
    const today = this.getToday();

    // Check future date
    if (DateUtils.compareDates(date, today) > 0) {
      throw new Error(`Cannot submit attendance adjustments for future dates (${DateUtils.formatDisplayDate(date)}).`);
    }

    const reason = (data.reason || '').trim();
    if (!reason) {
      throw new Error('A detailed reason is mandatory for attendance adjustment requests.');
    }

    let personType = data.person_type || (data.user_id ? 'employee' : 'student');
    const studentId = data.student_id ? Number(data.student_id) : null;
    const userId = data.user_id ? Number(data.user_id) : null;

    if (personType === 'student' && !studentId) {
      throw new Error('Student ID is required for student attendance adjustment.');
    }
    if (personType === 'employee' && !userId) {
      throw new Error('Employee / Staff User ID is required for staff attendance adjustment.');
    }

    let batchId = data.batch_id ? Number(data.batch_id) : null;
    if (personType === 'student' && !batchId && studentId) {
      const enrollment = db.prepare(`
        SELECT batch_id FROM student_batch_enrollments
        WHERE student_id = ? AND status = 'active'
        LIMIT 1
      `).get(studentId);
      if (enrollment) batchId = enrollment.batch_id;
    }

    let branchId = data.branch_id ? Number(data.branch_id) : null;
    if (!branchId && batchId) {
      const b = db.prepare('SELECT branch_id FROM batches WHERE id = ?').get(batchId);
      if (b) branchId = b.branch_id;
    }
    if (!branchId && userId) {
      branchId = ScheduleService.getUserBranchId(db, userId);
    }

    if (personType === 'employee' && !batchId) {
      if (branchId) {
        const b = db.prepare('SELECT id FROM batches WHERE branch_id = ? LIMIT 1').get(branchId);
        if (b) batchId = b.id;
      }
      if (!batchId) {
        const b = db.prepare('SELECT id FROM batches LIMIT 1').get();
        if (b) batchId = b.id;
      }
    }

    // 2-Day Late Rule: If attendance date is > 2 days in the past from today, flag for admin approval
    const twoDaysAgo = DateUtils.addDays(today, -2);
    const isOlderThanTwoDays = DateUtils.compareDates(date, twoDaysAgo) < 0;
    const requiresAdminApproval = isOlderThanTwoDays ? 1 : 0;

    // Check duplicate pending adjustment
    const existingPending = db.prepare(`
      SELECT id FROM attendance_corrections
      WHERE academy_id = ?
        AND person_type = ?
        AND date = ?
        AND (
          (person_type = 'student' AND student_id = ?) OR
          (person_type = 'employee' AND user_id = ?)
        )
        AND status = 'pending'
    `).get(academyId, personType, date, studentId, userId);

    const requestedStatus = data.requested_status || 'present';

    if (existingPending) {
      if (data.prevent_duplicate) {
        throw new Error(`A pending attendance adjustment already exists for this ${personType} on ${DateUtils.formatDisplayDate(date)} (Request #${existingPending.id}).`);
      }
      db.prepare(`
        UPDATE attendance_corrections
        SET requested_status = ?, reason = ?, requested_by = ?, original_status = COALESCE(original_status, ?), requires_admin_approval = ?
        WHERE id = ?
      `).run(requestedStatus, reason, actorUserId || 1, data.original_status || 'absent', requiresAdminApproval, existingPending.id);
      return db.prepare('SELECT * FROM attendance_corrections WHERE id = ?').get(existingPending.id);
    }

    const originalStatus = data.original_status || this.detectOriginalStatus(db, {
      personType, studentId, userId, batchId, date
    });

    const ins = db.prepare(`
      INSERT INTO attendance_corrections (
        academy_id, session_id, batch_id, branch_id, date,
        student_id, user_id, person_type, original_status, requested_status,
        reason, requested_by, status, requires_admin_approval
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      academyId,
      data.session_id ? Number(data.session_id) : null,
      batchId,
      branchId,
      date,
      studentId,
      userId,
      personType,
      originalStatus,
      requestedStatus,
      reason,
      actorUserId || 1,
      requiresAdminApproval
    );

    const adjustmentId = ins.lastInsertRowid;

    // Audit log
    try {
      db.prepare(`
        INSERT INTO audit_logs (academy_id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, 'create_attendance_adjustment', 'attendance_corrections', ?, ?)
      `).run(
        academyId,
        actorUserId || 1,
        adjustmentId,
        JSON.stringify({
          personType,
          personId: personType === 'student' ? studentId : userId,
          date,
          originalStatus,
          requestedStatus,
          reason,
          requiresAdminApproval: Boolean(requiresAdminApproval)
        })
      );
    } catch (_) {}

    return db.prepare('SELECT * FROM attendance_corrections WHERE id = ?').get(adjustmentId);
  }

  /**
   * Reviews (Approves or Rejects) an attendance adjustment request
   * When approved: updates effective attendance records (student_attendance or staff_time_punches)
   */
  static reviewAdjustment(db, academyId, adjustmentId, { status, reviewerNotes }, reviewerUserId) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new Error("Review status must be either 'approved' or 'rejected'.");
    }

    const corr = db.prepare('SELECT * FROM attendance_corrections WHERE id = ?').get(adjustmentId);
    if (!corr) {
      throw new Error(`Attendance adjustment request #${adjustmentId} not found.`);
    }

    if (corr.status !== 'pending') {
      throw new Error(`Adjustment request #${adjustmentId} has already been reviewed (${corr.status}).`);
    }

    return db.transaction(() => {
      // If approved, update effective downstream attendance
      if (status === 'approved') {
        const isStudent = corr.person_type === 'student' || Boolean(corr.student_id);
        const isEmployee = corr.person_type === 'employee' || Boolean(corr.user_id);

        if (isStudent && corr.student_id) {
          let batchId = corr.batch_id;
          if (!batchId) {
            const enr = db.prepare('SELECT batch_id FROM student_batch_enrollments WHERE student_id = ? AND status = "active" LIMIT 1').get(corr.student_id);
            if (enr) batchId = enr.batch_id;
          }

          if (batchId) {
            let att = db.prepare('SELECT id FROM attendance WHERE batch_id = ? AND date = ?').get(batchId, corr.date);
            if (!att) {
              const insAtt = db.prepare(`
                INSERT INTO attendance (batch_id, date, taken_by_user_id, notes)
                VALUES (?, ?, ?, ?)
              `).run(batchId, corr.date, reviewerUserId, 'Created via approved attendance correction');
              att = { id: insAtt.lastInsertRowid };
            }

            const existingStudentAtt = db.prepare(`
              SELECT id FROM student_attendance WHERE attendance_id = ? AND student_id = ?
            `).get(att.id, corr.student_id);

            if (existingStudentAtt) {
              db.prepare(`
                UPDATE student_attendance
                SET status = ?, remarks = ?
                WHERE id = ?
              `).run(
                corr.requested_status || 'present',
                corr.reason ? `Correction approved: ${corr.reason}` : 'Correction approved',
                existingStudentAtt.id
              );
            } else {
              db.prepare(`
                INSERT INTO student_attendance (attendance_id, student_id, status, remarks)
                VALUES (?, ?, ?, ?)
              `).run(
                att.id,
                corr.student_id,
                corr.requested_status || 'present',
                corr.reason ? `Correction approved: ${corr.reason}` : 'Correction approved'
              );
            }
          }
        }

        if (isEmployee && corr.user_id) {
          const desired = corr.requested_status;
          let punch = db.prepare(`
            SELECT id FROM staff_time_punches
            WHERE user_id = ? AND punch_date = ?
            ORDER BY id DESC LIMIT 1
          `).get(corr.user_id, corr.date);

          const sched = ScheduleService.getEffectiveSchedule(db, corr.user_id, corr.date);
          const dailyHours = sched.expected_daily_hours || 8.0;
          let durationMinutes = 0;
          let punchStatus = 'absent';

          if (desired === 'present' || desired === 'completed') {
            punchStatus = 'completed';
            durationMinutes = Math.round(dailyHours * 60);
          } else if (desired === 'half_day') {
            punchStatus = 'completed';
            durationMinutes = Math.round((dailyHours * 60) / 2);
          } else if (desired === 'absent') {
            punchStatus = 'absent';
            durationMinutes = 0;
          } else if (desired === 'late') {
            punchStatus = 'completed';
            durationMinutes = Math.round(dailyHours * 60) - 30; // 30 min grace deduction
          }

          if (punch) {
            db.prepare(`
              UPDATE staff_time_punches
              SET status = ?,
                  duration_minutes = ?,
                  notes = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(
              punchStatus,
              durationMinutes,
              `Adjusted via approved correction #${corr.id}: ${corr.reason || ''}`.trim(),
              punch.id
            );
          } else {
            db.prepare(`
              INSERT INTO staff_time_punches (
                academy_id, user_id, punch_date, punch_in_time, punch_out_time,
                duration_minutes, status, punch_type, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'duty', ?)
            `).run(
              academyId,
              corr.user_id,
              corr.date,
              `${corr.date} 09:00:00`,
              `${corr.date} ${String(9 + Math.floor(durationMinutes / 60)).padStart(2, '0')}:${String(durationMinutes % 60).padStart(2, '0')}:00`,
              durationMinutes,
              punchStatus,
              `Created via approved correction #${corr.id}: ${corr.reason || ''}`.trim()
            );
          }
        }
      }

      // Update the correction record with audit details
      db.prepare(`
        UPDATE attendance_corrections
        SET status = ?,
            reviewer_notes = ?,
            approved_by = ?,
            reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, reviewerNotes || null, reviewerUserId || 1, adjustmentId);

      // Record in audit_logs
      try {
        db.prepare(`
          INSERT INTO audit_logs (academy_id, user_id, action, entity_type, entity_id, details)
          VALUES (?, ?, 'review_attendance_adjustment', 'attendance_corrections', ?, ?)
        `).run(
          academyId,
          reviewerUserId || 1,
          adjustmentId,
          JSON.stringify({
            status,
            reviewerNotes: reviewerNotes || null,
            effectiveAttendanceUpdated: status === 'approved'
          })
        );
      } catch (_) {}

      return db.prepare('SELECT * FROM attendance_corrections WHERE id = ?').get(adjustmentId);
    })();
  }

  /**
   * Lists adjustment requests with rich joined entity info
   */
  static listAdjustments(db, academyId, filters = {}) {
    let sql = `
      SELECT ac.*,
             b.name as batch_name,
             br.name as branch_name,
             s.first_name, s.last_name, s.student_code,
             u.name as requester_name,
             appr.name as approver_name,
             emp.name as employee_name, emp.email as employee_email
      FROM attendance_corrections ac
      LEFT JOIN batches b ON ac.batch_id = b.id
      LEFT JOIN branches br ON ac.branch_id = br.id
      LEFT JOIN students s ON ac.student_id = s.id
      LEFT JOIN users u ON ac.requested_by = u.id
      LEFT JOIN users appr ON ac.approved_by = appr.id
      LEFT JOIN users emp ON ac.user_id = emp.id
      WHERE ac.academy_id = ?
    `;
    const params = [academyId];

    if (filters.status) {
      sql += ' AND ac.status = ?';
      params.push(filters.status);
    }
    if (filters.person_type) {
      sql += ' AND ac.person_type = ?';
      params.push(filters.person_type);
    }
    if (filters.branch_id) {
      sql += ' AND ac.branch_id = ?';
      params.push(Number(filters.branch_id));
    }

    sql += ' ORDER BY ac.created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(Number(filters.limit));
    }

    return db.prepare(sql).all(...params);
  }
}
