import express from 'express';
import { getCentralDb } from '../db/centralDb.js';
import { resolveTenant } from '../middleware/tenantResolver.js';
import { requireAuth, requireAcademyStaff } from '../middleware/auth.js';
import { streamAcademyBackup } from '../services/backupService.js';
import { SyllabusService } from '../services/syllabusService.js';
import { AttendanceScheduleService } from '../services/attendanceScheduleService.js';
import { PayrollService } from '../services/payrollService.js';
import { OvertimeService } from '../services/overtimeService.js';
import { EventService } from '../services/eventService.js';
import { QuotaService } from '../services/quotaService.js';
import { FeeService } from '../services/feeService.js';
import { ScheduleService } from '../services/scheduleService.js';
import { UserService } from '../services/userService.js';
import { InquiryService } from '../services/inquiryService.js';
import bcrypt from 'bcryptjs';

export const academyRouter = express.Router();

// All routes here require valid auth, academy staff access, and tenant DB resolution
academyRouter.use(requireAuth, requireAcademyStaff, resolveTenant);

/**
 * Helper to resolve coach profile for logged-in user
 */
function getCoachContext(db, user) {
  if (!user) return null;
  if (user.role === 'coach') {
    return db.prepare('SELECT * FROM coaches WHERE user_id = ? OR email = ? COLLATE NOCASE').get(user.userId, user.email) || null;
  }
  return null;
}

/**
 * GET /api/academy/dashboard
 * Aggregates role-scoped summary analytics from the tenant's isolated database
 */
academyRouter.get('/dashboard', (req, res) => {
  try {
    const db = req.tenantDb;
    const isCoach = req.user.role === 'coach';
    const isBranchAdmin = req.user.role === 'branch_admin';
    const coach = isCoach ? getCoachContext(db, req.user) : null;
    const coachId = coach ? coach.id : null;

    // Current local date components (avoiding UTC rollbacks)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const curDayShort = dayNamesShort[now.getDay()];
    const curDayFull = dayNamesFull[now.getDay()];

    if (isCoach) {
      // Coach View: Strictly scoped to coach's batches and students. Financial data omitted!
      const coachBatches = coachId ? db.prepare(`
        SELECT id, name, days_of_week
        FROM batches
        WHERE coach_id = ? AND is_active = 1
      `).all(coachId) : [];

      const todayBatches = coachBatches.filter(b => {
        const days = b.days_of_week || '';
        return days.includes(curDayShort) || days.includes(curDayFull) || days.toLowerCase().includes('daily') || days.toLowerCase().includes('all');
      });

      const todayBatchIds = todayBatches.map(b => b.id);

      let studentsToTrainToday = 0;
      let totalEnrolledStudents = 0;
      if (todayBatchIds.length > 0) {
        studentsToTrainToday = db.prepare(`
          SELECT COUNT(DISTINCT student_id) as c
          FROM student_batch_enrollments
          WHERE batch_id IN (${todayBatchIds.map(() => '?').join(',')}) AND status = 'active'
        `).get(...todayBatchIds).c;
      }

      if (coachBatches.length > 0) {
        const allBatchIds = coachBatches.map(b => b.id);
        totalEnrolledStudents = db.prepare(`
          SELECT COUNT(DISTINCT student_id) as c
          FROM student_batch_enrollments
          WHERE batch_id IN (${allBatchIds.map(() => '?').join(',')}) AND status = 'active'
        `).get(...allBatchIds).c;
      }

      let markedBatchesCount = 0;
      if (todayBatchIds.length > 0) {
        markedBatchesCount = db.prepare(`
          SELECT COUNT(DISTINCT batch_id) as c
          FROM attendance
          WHERE batch_id IN (${todayBatchIds.map(() => '?').join(',')}) AND date = ?
        `).get(...todayBatchIds, today).c;
      }

      const pendingBatchesCount = Math.max(0, todayBatches.length - markedBatchesCount);

      return res.json({
        success: true,
        userRole: 'coach',
        coachId,
        coachName: coach ? coach.name : req.user.name,
        academy: {
          id: req.academy.id,
          name: req.academy.name,
          slug: req.academy.slug,
          plan: req.academy.plan,
        },
        metrics: {
          isCoach: true,
          todayBatchesCount: todayBatches.length,
          studentsToTrainToday,
          totalMyStudents: totalEnrolledStudents,
          myBatchesCount: coachBatches.length,
          todayAttendance: {
            date: today,
            scheduledBatches: todayBatches.length,
            markedBatches: markedBatchesCount,
            pendingBatches: pendingBatchesCount,
            completionRate: todayBatches.length > 0 ? Math.round((markedBatchesCount / todayBatches.length) * 100) : 100,
          },
        },
      });
    }

    // Branch Admin Scoping
    let branchIds = [];
    if (isBranchAdmin) {
      branchIds = db.prepare('SELECT branch_id FROM user_branch_assignments WHERE user_id = ?').all(req.user.userId).map(b => b.branch_id);
    }

    let studentCountQuery = "SELECT COUNT(*) as c FROM students WHERE status = 'active'";
    let coachCountQuery = "SELECT COUNT(*) as c FROM coaches WHERE is_active = 1";
    let batchCountQuery = "SELECT COUNT(*) as c FROM batches WHERE is_active = 1";
    const studentParams = [];
    const batchParams = [];

    if (isBranchAdmin && branchIds.length > 0) {
      studentCountQuery += ` AND branch_id IN (${branchIds.map(() => '?').join(',')})`;
      studentParams.push(...branchIds);
      batchCountQuery += ` AND branch_id IN (${branchIds.map(() => '?').join(',')})`;
      batchParams.push(...branchIds);
    }

    const totalStudents = db.prepare(studentCountQuery).get(...studentParams).c;
    const totalCoaches = db.prepare(coachCountQuery).get().c;
    const totalBatches = db.prepare(batchCountQuery).get(...batchParams).c;

    const todayAttendance = db.prepare(`
      SELECT 
        COUNT(sa.id) as total_marked,
        SUM(CASE WHEN sa.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN sa.status = 'absent' THEN 1 ELSE 0 END) as absent_count
      FROM attendance a
      JOIN student_attendance sa ON sa.attendance_id = a.id
      WHERE a.date = ?
    `).get(today);

    const feeStats = db.prepare(`
      SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
        COALESCE(SUM(balance_amount), 0) as total_outstanding,
        COALESCE(SUM(paid_amount), 0) as total_collected
      FROM student_fees
    `).get();

    const pendingLeaves = db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status = 'pending'").get().c;
    const recentActivity = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5').all();

    res.json({
      success: true,
      role: req.user.role,
      userRole: req.user.role,
      academy: {
        id: req.academy.id,
        name: req.academy.name,
        slug: req.academy.slug,
        plan: req.academy.plan,
        limits: {
          max_branches: req.academy.max_branches,
          max_students: req.academy.max_students,
          max_coaches: req.academy.max_coaches,
        },
      },
      metrics: {
        totalStudents,
        totalCoaches,
        totalBatches,
        todayAttendance: {
          date: today,
          marked: todayAttendance.total_marked || 0,
          present: todayAttendance.present_count || 0,
          absent: todayAttendance.absent_count || 0,
        },
        fees: feeStats,
        pendingLeaves,
      },
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/dashboard/today-batches
 * Returns batches scheduled for today scoped by user role with live attendance completion status
 */
academyRouter.get('/dashboard/today-batches', (req, res) => {
  try {
    const db = req.tenantDb;
    const isCoach = req.user.role === 'coach';
    const isBranchAdmin = req.user.role === 'branch_admin';
    const coach = isCoach ? getCoachContext(db, req.user) : null;
    const coachId = coach ? coach.id : null;

    const dateParam = req.query.date || null;
    const now = dateParam ? new Date(dateParam + 'T12:00:00') : new Date();
    const todayStr = dateParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const curDayShort = dayNamesShort[now.getDay()];
    const curDayFull = dayNamesFull[now.getDay()];

    let query = `
      SELECT bt.*, s.name as sport_name, b.name as branch_name, c.name as coach_name,
             (SELECT COUNT(*) FROM student_batch_enrollments sbe WHERE sbe.batch_id = bt.id AND sbe.status = 'active') as enrolled_count
      FROM batches bt
      LEFT JOIN sports s ON s.id = bt.sport_id
      LEFT JOIN branches b ON b.id = bt.branch_id
      LEFT JOIN coaches c ON c.id = bt.coach_id
      WHERE bt.is_active = 1
    `;
    const params = [];

    if (isCoach) {
      if (!coachId) {
        return res.json({ success: true, today: todayStr, dayOfWeek: curDayShort, batches: [] });
      }
      query += ` AND bt.coach_id = ?`;
      params.push(coachId);
    } else if (isBranchAdmin) {
      const branches = db.prepare('SELECT branch_id FROM user_branch_assignments WHERE user_id = ?').all(req.user.userId).map(b => b.branch_id);
      if (branches.length > 0) {
        query += ` AND bt.branch_id IN (${branches.map(() => '?').join(',')})`;
        params.push(...branches);
      }
    }

    if (req.query.branch_id) {
      query += ` AND bt.branch_id = ?`;
      params.push(Number(req.query.branch_id));
    }

    query += ` ORDER BY bt.start_time ASC`;

    const allBatches = db.prepare(query).all(...params);

    // Filter by recurrence matching today
    const scheduledBatches = allBatches.filter(b => {
      const d = b.days_of_week || '';
      return d.includes(curDayShort) || d.includes(curDayFull) || d.toLowerCase().includes('daily') || d.toLowerCase().includes('all');
    });

    const currentTimeStr = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

    const enriched = scheduledBatches.map(batch => {
      const attRecord = db.prepare('SELECT id, taken_by_user_id, notes, created_at FROM attendance WHERE batch_id = ? AND date = ?').get(batch.id, todayStr);
      let markedCount = 0;
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;

      if (attRecord) {
        const counts = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
            SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
            SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave
          FROM student_attendance
          WHERE attendance_id = ?
        `).get(attRecord.id);

        markedCount = counts ? counts.total : 0;
        presentCount = counts ? counts.present : 0;
        absentCount = counts ? counts.absent : 0;
        lateCount = counts ? counts.late : 0;
        leaveCount = counts ? counts.leave : 0;
      }

      let attendanceStatus = 'not_started';
      if (attRecord && markedCount >= (batch.enrolled_count || 1) && batch.enrolled_count > 0) {
        attendanceStatus = 'completed';
      } else if (attRecord && markedCount > 0) {
        attendanceStatus = 'partially_marked';
      } else {
        if (batch.start_time && batch.end_time) {
          if (currentTimeStr >= batch.start_time && currentTimeStr <= batch.end_time) {
            attendanceStatus = 'in_progress';
          } else if (currentTimeStr < batch.start_time) {
            attendanceStatus = 'upcoming';
          } else {
            attendanceStatus = 'not_started';
          }
        }
      }

      return {
        ...batch,
        student_count: batch.enrolled_count || 0,
        attendance_id: attRecord ? attRecord.id : null,
        attendance_status: attendanceStatus,
        marked_count: markedCount,
        present_count: presentCount,
        absent_count: absentCount,
        late_count: lateCount,
        leave_count: leaveCount,
      };
    });

    res.json({
      success: true,
      today: todayStr,
      dayOfWeek: curDayShort,
      batches: enriched,
      todayBatches: enriched,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ==========================================
// STUDENTS
// ==========================================

/**
 * GET /api/academy/students
 */
academyRouter.get('/students', (req, res) => {
  try {
    const db = req.tenantDb;
    const { search, branch_id, batch_id, status, page, limit } = req.query;

    let baseQuery = `
      FROM students s
      LEFT JOIN branches b ON b.id = s.branch_id
      LEFT JOIN student_batch_enrollments sbe ON sbe.student_id = s.id AND sbe.status = 'active'
      LEFT JOIN batches bt ON bt.id = sbe.batch_id
      LEFT JOIN sports sp ON sp.id = bt.sport_id
      LEFT JOIN student_technique_assignments sta ON sta.student_id = s.id AND sta.status = 'active'
      LEFT JOIN syllabus_techniques st ON st.id = sta.technique_id
      LEFT JOIN syllabus_categories sc ON sc.id = st.category_id
      WHERE 1=1
    `;
    const params = [];

    // Role-based scoping: Coach can only access students enrolled in their assigned batches!
    if (req.user.role === 'coach') {
      const coach = getCoachContext(db, req.user);
      if (coach) {
        baseQuery += ` AND bt.coach_id = ?`;
        params.push(coach.id);
      } else {
        baseQuery += ` AND 1=0`;
      }
    } else if (req.user.role === 'branch_admin') {
      const branches = db.prepare('SELECT branch_id FROM user_branch_assignments WHERE user_id = ?').all(req.user.userId).map(b => b.branch_id);
      if (branches.length > 0) {
        baseQuery += ` AND s.branch_id IN (${branches.map(() => '?').join(',')})`;
        params.push(...branches);
      }
    }

    if (search) {
      baseQuery += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_code LIKE ? OR s.admission_number LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }
    if (branch_id) {
      baseQuery += ` AND s.branch_id = ?`;
      params.push(Number(branch_id));
    }
    if (batch_id) {
      baseQuery += ` AND bt.id = ?`;
      params.push(Number(batch_id));
    }
    if (status) {
      baseQuery += ` AND s.status = ?`;
      params.push(status);
    }

    // Get total count
    const countRow = db.prepare(`SELECT COUNT(DISTINCT s.id) as total ${baseQuery}`).get(...params);
    const total = countRow ? countRow.total : 0;

    let selectQuery = `
      SELECT s.*, b.name as branch_name,
             bt.id as active_batch_id,
             bt.name as active_batch_name,
             bt.start_time as batch_start_time,
             bt.end_time as batch_end_time,
             sp.name as sport_name,
             sbe.start_date as batch_enrolled_date,
             st.id as active_technique_id,
             st.name as active_technique_name,
             st.level as active_technique_level,
             st.belt_level as active_technique_belt_level,
             sc.name as active_technique_category_name,
             sta.sessions_attended as active_technique_sessions
      ${baseQuery}
      GROUP BY s.id
      ORDER BY s.id DESC
    `;

    let students;
    if (page || limit) {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.max(1, parseInt(limit) || 20);
      const offset = (p - 1) * l;
      selectQuery += ` LIMIT ? OFFSET ?`;
      students = db.prepare(selectQuery).all(...params, l, offset);
      return res.json({
        success: true,
        students,
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
      });
    } else {
      students = db.prepare(selectQuery).all(...params);
      return res.json({ success: true, students, total, page: 1, limit: total, totalPages: 1 });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/students
 */
academyRouter.post('/students', (req, res) => {
  try {
    const db = req.tenantDb;
    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      gender,
      guardian_name,
      guardian_phone,
      guardian_email,
      address,
      branch_id,
      blood_group,
      batch_id,
    } = req.body;

    // Rule A & Cross-academy rejection
    if (req.body.academy_id && Number(req.body.academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy student creation is strictly forbidden' });
    }

    if (!first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'First name and last name are required' });
    }

    // Validate branch exists in this tenant DB (Rule B & C)
    if (branch_id) {
      const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(Number(branch_id));
      if (!branch) {
        return res.status(400).json({ success: false, error: 'Specified branch does not exist in this academy' });
      }
    }

    // Enforce student quota via QuotaService
    QuotaService.assertCanCreate(req.academy.id, 'students', 1);

    // Generate unique student code: STU-XXXX
    const studentCode = req.body.student_code || `STU-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const insert = db.prepare(`
      INSERT INTO students (
        student_code, first_name, last_name, email, phone, date_of_birth,
        gender, guardian_name, guardian_phone, guardian_email, address,
        branch_id, academy_id, blood_group, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = insert.run(
      studentCode,
      first_name.trim(),
      last_name.trim(),
      email ? email.trim() : null,
      phone || null,
      date_of_birth || null,
      gender || null,
      guardian_name || null,
      guardian_phone || null,
      guardian_email || null,
      address || null,
      branch_id ? Number(branch_id) : null,
      req.academy.id,
      blood_group || null
    );

    const newStudentId = result.lastInsertRowid;

    // Optional initial batch enrollment (enforcing single active batch rule)
    if (batch_id) {
      const batch = db.prepare('SELECT id, branch_id FROM batches WHERE id = ?').get(Number(batch_id));
      if (!batch) {
        throw new Error('Selected training batch does not exist in this academy');
      }

      // If student has a branch specified, ensure the batch belongs to that branch (Rule C & D)
      if (branch_id && Number(branch_id) !== batch.branch_id) {
        throw new Error('Batch does not belong to the selected branch');
      }

      // If student didn't specify branch, set branch from batch
      if (!branch_id && batch.branch_id) {
        db.prepare('UPDATE students SET branch_id = ? WHERE id = ?').run(batch.branch_id, newStudentId);
      }

      // Enforce students_per_batch quota
      QuotaService.assertCanCreate(req.academy.id, 'students_per_batch', 1, { batchId: batch.id });

      db.prepare(`
        INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status, assigned_by)
        VALUES (?, ?, DATE('now'), 'active', ?)
      `).run(newStudentId, batch.id, req.user.userId);
    }

    // Assign initial syllabus technique (Rule 3)
    if (req.body.technique_id) {
      try {
        SyllabusService.assignStudentTechnique(db, req.academy.id, newStudentId, {
          technique_id: Number(req.body.technique_id),
          assigned_by: req.user.userId,
          action: 'initial',
          remarks: req.body.technique_remarks || 'Initial technique assignment on enrollment',
        });
      } catch (techErr) {
        console.warn('Initial technique assignment notice:', techErr.message);
      }
    } else {
      SyllabusService.autoAssignDefaultTechniqueIfNone(db, req.academy.id, newStudentId, req.user.userId);
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, ?, 'CREATE', 'students', ?, ?, ?)
    `).run(req.user.userId, req.user.name, req.user.role, String(newStudentId), `Added student ${first_name} ${last_name} (${studentCode})`, req.ip);

    res.status(201).json({
      success: true,
      message: 'Student enrolled successfully',
      studentId: newStudentId,
      studentCode,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/students/:id/transfer-batch
 * Atomic batch transfer: deactivates current active batch, preserves history, and activates new batch
 */
academyRouter.post('/students/:id/transfer-batch', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);
    const { new_batch_id, transfer_reason, effective_date, academy_id } = req.body;

    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy batch transfer is strictly forbidden' });
    }

    if (!new_batch_id) {
      return res.status(400).json({ success: false, error: 'new_batch_id is required' });
    }

    const student = db.prepare('SELECT id, first_name, last_name, branch_id FROM students WHERE id = ?').get(studentId);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in this academy' });
    }

    const targetBatch = db.prepare(`
      SELECT b.id, b.name, b.branch_id, br.name as branch_name 
      FROM batches b 
      LEFT JOIN branches br ON br.id = b.branch_id 
      WHERE b.id = ? AND b.is_active = 1
    `).get(Number(new_batch_id));

    if (!targetBatch) {
      return res.status(404).json({ success: false, error: 'Target training batch does not exist or is inactive' });
    }

    // Check if student is already actively enrolled in this exact batch
    const currentActive = db.prepare(`
      SELECT sbe.*, b.name as batch_name 
      FROM student_batch_enrollments sbe 
      JOIN batches b ON b.id = sbe.batch_id 
      WHERE sbe.student_id = ? AND sbe.status = 'active'
    `).get(studentId);

    if (currentActive && currentActive.batch_id === targetBatch.id) {
      return res.status(400).json({ success: false, error: `Student is already actively enrolled in '${targetBatch.name}'` });
    }

    // Enforce students_per_batch quota on destination batch
    QuotaService.assertCanCreate(req.academy.id, 'students_per_batch', 1, { batchId: targetBatch.id });

    const effDate = effective_date || new Date().toISOString().split('T')[0];

    // Atomic Transaction to execute transfer
    const executeTransfer = db.transaction(() => {
      // 1. Close/deactivate existing active enrollment (preserving history)
      if (currentActive) {
        db.prepare(`
          UPDATE student_batch_enrollments
          SET status = 'transferred',
              end_date = ?,
              transferred_to_batch_id = ?,
              transfer_reason = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(effDate, targetBatch.id, transfer_reason || 'Batch transfer', currentActive.id);
      }

      // 2. Insert new active enrollment (enforces idx_student_single_active_batch constraint)
      db.prepare(`
        INSERT INTO student_batch_enrollments (
          student_id, batch_id, start_date, status, assigned_by
        ) VALUES (?, ?, ?, 'active', ?)
      `).run(studentId, targetBatch.id, effDate, req.user.userId);

      // 3. Update student's branch if the new batch belongs to a different branch
      if (targetBatch.branch_id && targetBatch.branch_id !== student.branch_id) {
        db.prepare('UPDATE students SET branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(targetBatch.branch_id, studentId);
      }

      // 4. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details, ip_address)
        VALUES (?, ?, ?, 'BATCH_TRANSFER', 'students', ?, ?, ?)
      `).run(
        req.user.userId,
        req.user.name,
        req.user.role,
        String(studentId),
        `Transferred student from '${currentActive ? currentActive.batch_name : 'None'}' to '${targetBatch.name}'. Reason: ${transfer_reason || 'None'}`,
        req.ip
      );
    });

    executeTransfer();

    res.json({
      success: true,
      message: `Successfully transferred student to '${targetBatch.name}'`,
      previousBatch: currentActive ? currentActive.batch_name : null,
      newBatch: targetBatch.name,
      effectiveDate: effDate,
    });
  } catch (err) {
    console.error('[Batch Transfer Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/students/bulk-enroll
 * Bulk assign students to a batch; strictly enforces single active batch rule
 */
academyRouter.post('/students/bulk-enroll', (req, res) => {
  try {
    const db = req.tenantDb;
    const { batch_id, student_ids, force_transfer = false, transfer_reason, academy_id } = req.body;

    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy operations are strictly forbidden' });
    }

    if (!batch_id || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'batch_id and non-empty student_ids array are required' });
    }

    const batch = db.prepare('SELECT id, name, branch_id FROM batches WHERE id = ? AND is_active = 1').get(Number(batch_id));
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Specified batch does not exist in this academy or is inactive' });
    }

    const results = {
      enrolled: [],
      transferred: [],
      rejected: [],
    };

    const tx = db.transaction(() => {
      for (const sId of student_ids) {
        const student = db.prepare('SELECT id, first_name, last_name, branch_id FROM students WHERE id = ?').get(Number(sId));
        if (!student) {
          results.rejected.push({ studentId: sId, error: 'Student not found in this academy' });
          continue;
        }

        const currentActive = db.prepare("SELECT id, batch_id FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'").get(student.id);

        if (currentActive) {
          if (currentActive.batch_id === batch.id) {
            results.rejected.push({ studentId: student.id, error: 'Student is already actively enrolled in this batch' });
            continue;
          }

          if (!force_transfer) {
            results.rejected.push({ studentId: student.id, error: 'Student already has an active batch. Explicit transfer required.' });
            continue;
          }

          // Force transfer atomically
          db.prepare(`
            UPDATE student_batch_enrollments
            SET status = 'transferred', end_date = DATE('now'), transferred_to_batch_id = ?, transfer_reason = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(batch.id, transfer_reason || 'Bulk transfer', currentActive.id);

          db.prepare(`
            INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status, assigned_by)
            VALUES (?, ?, DATE('now'), 'active', ?)
          `).run(student.id, batch.id, req.user.userId);

          if (batch.branch_id && batch.branch_id !== student.branch_id) {
            db.prepare('UPDATE students SET branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(batch.branch_id, student.id);
          }

          results.transferred.push(student.id);
        } else {
          // No current active batch, enroll directly
          db.prepare(`
            INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status, assigned_by)
            VALUES (?, ?, DATE('now'), 'active', ?)
          `).run(student.id, batch.id, req.user.userId);

          if (batch.branch_id && !student.branch_id) {
            db.prepare('UPDATE students SET branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(batch.branch_id, student.id);
          }

          results.enrolled.push(student.id);
        }
      }
    });

    tx();

    res.json({
      success: true,
      message: `Bulk enrollment completed: ${results.enrolled.length} enrolled, ${results.transferred.length} transferred, ${results.rejected.length} rejected`,
      results,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/students/import
 * CSV / Batch student import with full validation of branch and batch relationships
 */
academyRouter.post('/students/import', (req, res) => {
  try {
    const db = req.tenantDb;
    const { students, academy_id } = req.body;

    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy student import is strictly forbidden' });
    }

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, error: 'students array is required' });
    }

    // Enforce student quota for bulk import
    QuotaService.assertCanCreate(req.academy.id, 'students', students.length);

    const imported = [];
    const errors = [];

    const tx = db.transaction(() => {
      for (let i = 0; i < students.length; i++) {
        const item = students[i];
        if (!item.first_name || !item.last_name) {
          errors.push({ row: i + 1, error: 'First name and last name required' });
          continue;
        }

        // Cross-academy check on individual record
        if (item.academy_id && Number(item.academy_id) !== req.academy.id) {
          errors.push({ row: i + 1, error: 'Cross-academy ID rejected' });
          continue;
        }

        let branchId = item.branch_id ? Number(item.branch_id) : null;
        if (branchId) {
          const br = db.prepare('SELECT id FROM branches WHERE id = ?').get(branchId);
          if (!br) {
            errors.push({ row: i + 1, error: `Branch ID ${branchId} does not exist in this academy` });
            continue;
          }
        }

        let batchId = item.batch_id ? Number(item.batch_id) : null;
        if (batchId) {
          const bt = db.prepare('SELECT id, branch_id FROM batches WHERE id = ?').get(batchId);
          if (!bt) {
            errors.push({ row: i + 1, error: `Batch ID ${batchId} does not exist in this academy` });
            continue;
          }
          if (branchId && bt.branch_id && bt.branch_id !== branchId) {
            errors.push({ row: i + 1, error: `Batch ID ${batchId} does not belong to branch ID ${branchId}` });
            continue;
          }
          if (!branchId && bt.branch_id) {
            branchId = bt.branch_id;
          }
        }

        const studentCode = item.student_code || `STU-IMP-${Date.now()}-${i}-${Math.floor(1000 + Math.random() * 9000)}`;

        const ins = db.prepare(`
          INSERT INTO students (
            student_code, first_name, last_name, email, phone, date_of_birth,
            gender, guardian_name, guardian_phone, guardian_email, address,
            branch_id, academy_id, blood_group, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `);

        const res = ins.run(
          studentCode,
          item.first_name.trim(),
          item.last_name.trim(),
          item.email ? item.email.trim() : null,
          item.phone || null,
          item.date_of_birth || null,
          item.gender || null,
          item.guardian_name || null,
          item.guardian_phone || null,
          item.guardian_email || null,
          item.address || null,
          branchId,
          req.academy.id,
          item.blood_group || null
        );

        const newId = res.lastInsertRowid;

        if (batchId) {
          db.prepare(`
            INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status, assigned_by)
            VALUES (?, ?, DATE('now'), 'active', ?)
          `).run(newId, batchId, req.user.userId);
        }

        imported.push({ id: newId, student_code: studentCode, name: `${item.first_name} ${item.last_name}` });
      }
    });

    tx();

    res.status(201).json({
      success: true,
      message: `Imported ${imported.length} students. ${errors.length} failed.`,
      importedCount: imported.length,
      imported,
      errors,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/students/:id/enrollment-history
 * Returns the complete batch assignment audit trail for a student
 */
academyRouter.get('/students/:id/enrollment-history', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);

    const history = db.prepare(`
      SELECT 
        sbe.*,
        b.name as batch_name,
        sp.name as sport_name,
        br.name as branch_name,
        tb.name as transferred_to_batch_name,
        u.name as assigned_by_name
      FROM student_batch_enrollments sbe
      JOIN batches b ON b.id = sbe.batch_id
      LEFT JOIN sports sp ON sp.id = b.sport_id
      LEFT JOIN branches br ON br.id = b.branch_id
      LEFT JOIN batches tb ON tb.id = sbe.transferred_to_batch_id
      LEFT JOIN users u ON u.id = sbe.assigned_by
      WHERE sbe.student_id = ?
      ORDER BY sbe.id DESC
    `).all(studentId);

    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/students/:id
 */
academyRouter.put('/students/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const id = Number(req.params.id);
    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      gender,
      guardian_name,
      guardian_phone,
      guardian_email,
      address,
      branch_id,
      blood_group,
      status,
      academy_id,
      batch_id,
    } = req.body;

    // Rule A & Cross-academy check
    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy student modification or ownership change is strictly forbidden' });
    }

    // Direct batch assignment prohibited on student update to preserve audit history
    if (batch_id !== undefined) {
      return res.status(400).json({
        success: false,
        error: 'Batch assignment cannot be changed directly on student update. Use POST /api/academy/students/:id/transfer-batch to preserve complete audit history.',
      });
    }

    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(id);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in this academy' });
    }

    if (branch_id) {
      const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(Number(branch_id));
      if (!branch) {
        return res.status(400).json({ success: false, error: 'Specified branch does not exist in this academy' });
      }
    }

    db.prepare(`
      UPDATE students
      SET first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          date_of_birth = COALESCE(?, date_of_birth),
          gender = COALESCE(?, gender),
          guardian_name = COALESCE(?, guardian_name),
          guardian_phone = COALESCE(?, guardian_phone),
          guardian_email = COALESCE(?, guardian_email),
          address = COALESCE(?, address),
          branch_id = COALESCE(?, branch_id),
          blood_group = COALESCE(?, blood_group),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      first_name || null,
      last_name || null,
      email || null,
      phone || null,
      date_of_birth || null,
      gender || null,
      guardian_name || null,
      guardian_phone || null,
      guardian_email || null,
      address || null,
      branch_id ? Number(branch_id) : null,
      blood_group || null,
      status || null,
      id
    );

    res.json({ success: true, message: 'Student updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// COACHES & STAFF
// ==========================================

/**
 * GET /api/academy/coaches
 */
academyRouter.get('/coaches', (req, res) => {
  try {
    const db = req.tenantDb;
    const { search, branch_id, sport_id, status, page, limit } = req.query;

    let baseQuery = `
      FROM coaches c
      LEFT JOIN sports s ON s.id = c.sport_id
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      baseQuery += ` AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.specializations LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (branch_id) {
      baseQuery += ` AND c.branch_id = ?`;
      params.push(Number(branch_id));
    }
    if (sport_id) {
      baseQuery += ` AND c.sport_id = ?`;
      params.push(Number(sport_id));
    }
    if (status !== undefined && status !== '') {
      baseQuery += ` AND c.is_active = ?`;
      params.push(status === 'active' || status === '1' ? 1 : 0);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params);
    const total = countRow ? countRow.total : 0;

    let selectQuery = `
      SELECT c.*, s.name as sport_name, b.name as branch_name,
             (SELECT COUNT(*) FROM batches bt WHERE bt.coach_id = c.id AND bt.is_active = 1) as active_batches
      ${baseQuery}
      ORDER BY c.id DESC
    `;

    if (page || limit) {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.max(1, parseInt(limit) || 20);
      const offset = (p - 1) * l;
      selectQuery += ` LIMIT ? OFFSET ?`;
      const coaches = db.prepare(selectQuery).all(...params, l, offset);
      return res.json({
        success: true,
        coaches,
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
      });
    } else {
      const coaches = db.prepare(selectQuery).all(...params);
      return res.json({ success: true, coaches, total, page: 1, limit: total, totalPages: 1 });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/coaches
 */
academyRouter.post('/coaches', (req, res) => {
  try {
    const db = req.tenantDb;
    const centralDb = getCentralDb();
    const {
      name, email, phone, password, role, sport_id, branch_id, specializations,
      experience_years, salary_type, salary_amount, designation, employment_type, joining_date
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Coach / Staff name is required' });
    }

    // Auto-generate email if not provided for seamless onboarding
    const userEmail = email && email.trim() 
      ? email.trim() 
      : `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@academy.internal`;

    const userRole = role || 'coach';

    const result = UserService.createStaffUser(db, centralDb, req.academy.id, {
      name,
      email: userEmail,
      phone,
      password: password || 'password123',
      role: userRole,
      branch_id: branch_id ? Number(branch_id) : null,
      designation,
      employment_type,
      joining_date,
      sport_id: sport_id ? Number(sport_id) : null,
      specializations,
      experience_years: experience_years ? Number(experience_years) : 0,
      compensation_mode: salary_type || 'monthly',
      salary_amount: Number(salary_amount) || 0,
    }, req.user?.userId || null);

    res.status(201).json({
      success: true,
      userId: result.userId,
      coachId: result.coachId,
      message: `${name} onboarded successfully with role ${result.role}`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/users/:id/profile
 * Centralized profile for User, Role, Employment, Schedule, Compensation & History
 */
academyRouter.get('/users/:id/profile', (req, res) => {
  try {
    const db = req.tenantDb;
    const profile = UserService.getUserProfile(db, Number(req.params.id), req.academy.id);
    if (!profile) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, ...profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/users/:id/role-revision
 * Promotes, transfers or updates role with effective dating & audit trail
 */
academyRouter.post('/users/:id/role-revision', (req, res) => {
  try {
    const db = req.tenantDb;
    const centralDb = getCentralDb();
    const { new_role, effective_from, reason } = req.body;
    const result = UserService.updateUserRole(
      db, centralDb, req.academy.id, Number(req.params.id), new_role, reason, req.user?.userId, effective_from
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/users/:id/salary-revision
 * Modifies compensation policy with effective dating & audit trail
 */
academyRouter.post('/users/:id/salary-revision', (req, res) => {
  try {
    const db = req.tenantDb;
    const { compensation_mode, new_amount, effective_from, reason } = req.body;
    const result = UserService.createSalaryRevision(
      db, req.academy.id, Number(req.params.id), {
        compensation_mode,
        new_amount: Number(new_amount),
        effective_from,
        reason,
        created_by: req.user?.userId,
      }
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/users/:id/branch-transfer
 * Reassigns employee branch with effective dating & history
 */
academyRouter.post('/users/:id/branch-transfer', (req, res) => {
  try {
    const db = req.tenantDb;
    const { new_branch_id, effective_from, reason } = req.body;
    const result = UserService.transferBranch(
      db, req.academy.id, Number(req.params.id), Number(new_branch_id), reason, req.user?.userId, effective_from
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/coaches/:id
 */
academyRouter.get('/coaches/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const coachId = Number(req.params.id);
    const coach = db.prepare(`
      SELECT c.*, s.name as sport_name, b.name as branch_name,
             (SELECT COUNT(*) FROM batches bt WHERE bt.coach_id = c.id AND bt.is_active = 1) as active_batches
      FROM coaches c
      LEFT JOIN sports s ON s.id = c.sport_id
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE c.id = ?
    `).get(coachId);

    if (!coach) {
      return res.status(404).json({ success: false, error: 'Coach not found' });
    }

    res.json({ success: true, coach });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/coaches/:id
 */
academyRouter.put('/coaches/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const coachId = Number(req.params.id);
    const {
      name,
      email,
      phone,
      sport_id,
      branch_id,
      specializations,
      experience_years,
      salary_type,
      salary_amount,
      is_active,
      academy_id,
    } = req.body;

    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy coach modification is strictly forbidden' });
    }

    const current = db.prepare('SELECT * FROM coaches WHERE id = ?').get(coachId);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Coach not found in this academy' });
    }

    if (branch_id) {
      const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(Number(branch_id));
      if (!branch) {
        return res.status(400).json({ success: false, error: 'Selected branch does not exist in this academy' });
      }
    }

    if (sport_id) {
      const sport = db.prepare('SELECT id FROM sports WHERE id = ?').get(Number(sport_id));
      if (!sport) {
        return res.status(400).json({ success: false, error: 'Selected sport does not exist' });
      }
    }

    const allowedSalaryTypes = ['monthly', 'per_session', 'contract'];
    if (salary_type && !allowedSalaryTypes.includes(salary_type)) {
      return res.status(400).json({ success: false, error: `Invalid salary type. Allowed: ${allowedSalaryTypes.join(', ')}` });
    }

    const updatedName = name !== undefined ? name.trim() : current.name;
    if (!updatedName) {
      return res.status(400).json({ success: false, error: 'Coach name cannot be empty' });
    }

    const updatedEmail = email !== undefined ? (email ? email.trim() : null) : current.email;
    const updatedPhone = phone !== undefined ? (phone ? phone.trim() : null) : current.phone;
    const updatedSportId = sport_id !== undefined ? (sport_id ? Number(sport_id) : null) : current.sport_id;
    const updatedBranchId = branch_id !== undefined ? (branch_id ? Number(branch_id) : null) : current.branch_id;
    const updatedSpecializations = specializations !== undefined ? specializations : current.specializations;
    const updatedExperience = experience_years !== undefined ? Number(experience_years) : current.experience_years;
    const updatedSalaryType = salary_type !== undefined ? salary_type : current.salary_type;
    const updatedSalaryAmount = salary_amount !== undefined ? Number(salary_amount) : current.salary_amount;
    const updatedIsActive = is_active !== undefined ? Number(is_active) : current.is_active;

    db.prepare(`
      UPDATE coaches
      SET name = ?,
          email = ?,
          phone = ?,
          sport_id = ?,
          branch_id = ?,
          specializations = ?,
          experience_years = ?,
          salary_type = ?,
          salary_amount = ?,
          is_active = ?
      WHERE id = ?
    `).run(
      updatedName,
      updatedEmail,
      updatedPhone,
      updatedSportId,
      updatedBranchId,
      updatedSpecializations,
      updatedExperience,
      updatedSalaryType,
      updatedSalaryAmount,
      updatedIsActive,
      coachId
    );

    res.json({ success: true, message: 'Coach updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/academy/coaches/:id
 */
academyRouter.delete('/coaches/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const coachId = Number(req.params.id);

    const coach = db.prepare('SELECT id, name FROM coaches WHERE id = ?').get(coachId);
    if (!coach) {
      return res.status(404).json({ success: false, error: 'Coach not found' });
    }

    const activeBatches = db.prepare('SELECT COUNT(*) as c FROM batches WHERE coach_id = ? AND is_active = 1').get(coachId).c;
    if (activeBatches > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete coach "${coach.name}" because they are currently assigned to ${activeBatches} active batch(es). Please reassign batches or deactivate the coach instead.`,
      });
    }

    const sessionCount = db.prepare('SELECT COUNT(*) as c FROM batch_sessions WHERE coach_id = ?').get(coachId).c;
    if (sessionCount > 0) {
      db.prepare('UPDATE coaches SET is_active = 0 WHERE id = ?').run(coachId);
      return res.json({
        success: true,
        message: `Coach "${coach.name}" has historical training sessions on record and was deactivated to preserve audit and attendance history.`,
      });
    }

    db.prepare('DELETE FROM coaches WHERE id = ?').run(coachId);
    res.json({ success: true, message: `Coach "${coach.name}" removed successfully` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// BATCHES & SCHEDULES
// ==========================================

/**
 * GET /api/academy/batches
 */
academyRouter.get('/batches', (req, res) => {
  try {
    const db = req.tenantDb;
    const { search, branch_id, sport_id, day, status, page, limit } = req.query;

    let baseQuery = `
      FROM batches bt
      LEFT JOIN sports s ON s.id = bt.sport_id
      LEFT JOIN branches b ON b.id = bt.branch_id
      LEFT JOIN coaches c ON c.id = bt.coach_id
      WHERE 1=1
    `;
    const params = [];

    // Role scoping: Coach can only view batches assigned to them
    if (req.user.role === 'coach') {
      const coach = getCoachContext(db, req.user);
      if (coach) {
        baseQuery += ` AND bt.coach_id = ?`;
        params.push(coach.id);
      } else {
        baseQuery += ` AND 1=0`;
      }
    } else if (req.user.role === 'branch_admin') {
      const branches = db.prepare('SELECT branch_id FROM user_branch_assignments WHERE user_id = ?').all(req.user.userId).map(b => b.branch_id);
      if (branches.length > 0) {
        baseQuery += ` AND bt.branch_id IN (${branches.map(() => '?').join(',')})`;
        params.push(...branches);
      }
    }

    if (search) {
      baseQuery += ` AND (bt.name LIKE ? OR s.name LIKE ? OR c.name LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (branch_id) {
      baseQuery += ` AND bt.branch_id = ?`;
      params.push(Number(branch_id));
    }
    if (sport_id) {
      baseQuery += ` AND bt.sport_id = ?`;
      params.push(Number(sport_id));
    }
    if (day) {
      baseQuery += ` AND (bt.days_of_week LIKE ? OR bt.days_of_week LIKE '%Daily%' OR bt.days_of_week LIKE '%All%')`;
      params.push(`%${day}%`);
    }
    if (status !== undefined && status !== '') {
      baseQuery += ` AND bt.is_active = ?`;
      params.push(status === 'active' || status === '1' ? 1 : 0);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params);
    const total = countRow ? countRow.total : 0;

    let selectQuery = `
      SELECT bt.*, s.name as sport_name, b.name as branch_name, c.name as coach_name,
             (SELECT COUNT(*) FROM student_batch_enrollments sbe WHERE sbe.batch_id = bt.id AND sbe.status = 'active') as enrolled_count
      ${baseQuery}
      ORDER BY bt.id DESC
    `;

    if (page || limit) {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.max(1, parseInt(limit) || 20);
      const offset = (p - 1) * l;
      selectQuery += ` LIMIT ? OFFSET ?`;
      const batches = db.prepare(selectQuery).all(...params, l, offset);
      return res.json({
        success: true,
        batches,
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
      });
    } else {
      const batches = db.prepare(selectQuery).all(...params);
      return res.json({ success: true, batches, total, page: 1, limit: total, totalPages: 1 });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/batches
 */
academyRouter.post('/batches', (req, res) => {
  try {
    const db = req.tenantDb;
    const { name, sport_id, branch_id, coach_id, start_time, end_time, days_of_week, max_capacity, monthly_fee, academy_id } = req.body;

    // Rule C & Cross-academy check
    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy batch creation is strictly forbidden' });
    }

    if (!name || !start_time || !end_time) {
      return res.status(400).json({ success: false, error: 'Batch name, start time, and end time are required' });
    }

    // Rule C: Every batch must belong to exactly one branch
    if (!branch_id) {
      return res.status(400).json({ success: false, error: 'Every batch must belong to a branch (branch_id is required)' });
    }

    const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(Number(branch_id));
    if (!branch) {
      return res.status(400).json({ success: false, error: 'The specified branch does not exist in this academy' });
    }

    // Enforce batches quota via QuotaService
    QuotaService.assertCanCreate(req.academy.id, 'batches', 1);

    const insert = db.prepare(`
      INSERT INTO batches (
        name, sport_id, branch_id, coach_id, start_time, end_time,
        days_of_week, max_capacity, monthly_fee, academy_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const formattedDays = Array.isArray(days_of_week)
      ? days_of_week.join(', ')
      : (typeof days_of_week === 'string' ? days_of_week.trim() : 'Mon, Wed, Fri');

    const result = insert.run(
      name.trim(),
      sport_id ? Number(sport_id) : null,
      Number(branch_id),
      coach_id ? Number(coach_id) : null,
      start_time,
      end_time,
      formattedDays,
      max_capacity ? Number(max_capacity) : 30,
      monthly_fee ? Number(monthly_fee) : 0,
      req.academy.id
    );

    res.status(201).json({ success: true, batchId: result.lastInsertRowid, message: 'Batch created successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/batches/:id
 */
academyRouter.put('/batches/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const batchId = Number(req.params.id);
    const { name, sport_id, branch_id, coach_id, start_time, end_time, days_of_week, max_capacity, monthly_fee, is_active, academy_id } = req.body;

    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy batch modification is strictly forbidden' });
    }

    const batch = db.prepare('SELECT id, branch_id FROM batches WHERE id = ?').get(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this academy' });
    }

    if (branch_id !== undefined) {
      if (!branch_id) {
        return res.status(400).json({ success: false, error: 'Batch must belong to a branch (branch_id cannot be null)' });
      }
      const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(Number(branch_id));
      if (!branch) {
        return res.status(400).json({ success: false, error: 'The specified branch does not exist in this academy' });
      }
    }

    db.prepare(`
      UPDATE batches
      SET name = COALESCE(?, name),
          sport_id = COALESCE(?, sport_id),
          branch_id = COALESCE(?, branch_id),
          coach_id = COALESCE(?, coach_id),
          start_time = COALESCE(?, start_time),
          end_time = COALESCE(?, end_time),
          days_of_week = COALESCE(?, days_of_week),
          max_capacity = COALESCE(?, max_capacity),
          monthly_fee = COALESCE(?, monthly_fee),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      sport_id ? Number(sport_id) : null,
      branch_id ? Number(branch_id) : null,
      coach_id ? Number(coach_id) : null,
      start_time || null,
      end_time || null,
      days_of_week !== undefined
        ? (Array.isArray(days_of_week) ? days_of_week.join(', ') : (typeof days_of_week === 'string' ? days_of_week.trim() : null))
        : null,
      max_capacity ? Number(max_capacity) : null,
      monthly_fee !== undefined ? Number(monthly_fee) : null,
      is_active !== undefined ? Number(is_active) : null,
      batchId
    );

    res.json({ success: true, message: 'Batch updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/batches/:id/students
 */
academyRouter.get('/batches/:id/students', (req, res) => {
  try {
    const db = req.tenantDb;
    const batchId = Number(req.params.id);

    const students = db.prepare(`
      SELECT s.id, s.student_code, s.first_name, s.last_name, s.phone, s.guardian_phone, sbe.start_date as joined_at
      FROM students s
      JOIN student_batch_enrollments sbe ON sbe.student_id = s.id
      WHERE sbe.batch_id = ? AND sbe.status = 'active'
      ORDER BY s.first_name ASC
    `).all(batchId);

    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/academy/batches/:id
 */
academyRouter.delete('/batches/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const batchId = Number(req.params.id);

    const batch = db.prepare('SELECT id, name FROM batches WHERE id = ?').get(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    const activeEnrollments = db.prepare("SELECT COUNT(*) as c FROM student_batch_enrollments WHERE batch_id = ? AND status = 'active'").get(batchId).c;
    if (activeEnrollments > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete batch "${batch.name}" because it currently has ${activeEnrollments} actively enrolled student(s). Please transfer them first.`,
      });
    }

    db.prepare('DELETE FROM batches WHERE id = ?').run(batchId);

    res.json({ success: true, message: `Batch "${batch.name}" deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ATTENDANCE
// ==========================================

// ==========================================
// ATTENDANCE & SESSION SCHEDULING
// ==========================================

/**
 * GET /api/academy/attendance/eligible-session
 * Returns the automatically selected next eligible session for a coach or batch
 */
academyRouter.get('/attendance/eligible-session', (req, res) => {
  try {
    const db = req.tenantDb;
    const { batch_id, coach_id } = req.query;

    let targetCoachId = coach_id ? Number(coach_id) : null;
    if (!targetCoachId && req.user.role === 'coach') {
      const coach = db.prepare('SELECT id FROM coaches WHERE user_id = ?').get(req.user.userId);
      if (coach) targetCoachId = coach.id;
    }

    const result = AttendanceScheduleService.getNextEligibleSession(db, {
      batchId: batch_id ? Number(batch_id) : null,
      coachId: targetCoachId,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/attendance/sessions
 * Lists scheduled and completed training sessions
 */
academyRouter.get('/attendance/sessions', (req, res) => {
  try {
    const db = req.tenantDb;
    const { batch_id, start_date, end_date } = req.query;

    let query = `
      SELECT bs.*, b.name as batch_name, br.name as branch_name, c.name as coach_name
      FROM batch_sessions bs
      JOIN batches b ON bs.batch_id = b.id
      JOIN branches br ON bs.branch_id = br.id
      LEFT JOIN coaches c ON bs.coach_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (batch_id) {
      query += ' AND bs.batch_id = ?';
      params.push(Number(batch_id));
    }
    if (start_date) {
      query += ' AND bs.scheduled_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND bs.scheduled_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY bs.scheduled_date DESC, bs.start_time ASC LIMIT 100';
    const sessions = db.prepare(query).all(...params);

    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/attendance/switch-session
 * Controlled temporary session switch for a student
 */
academyRouter.post('/attendance/switch-session', (req, res) => {
  try {
    const db = req.tenantDb;
    const { student_id, original_session_id, replacement_session_id, reason } = req.body;

    const result = AttendanceScheduleService.switchSessionForStudent(db, {
      academyId: req.academy.id,
      studentId: Number(student_id),
      originalSessionId: Number(original_session_id),
      replacementSessionId: Number(replacement_session_id),
      reason,
      userId: req.user.userId,
    });

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details)
      VALUES (?, ?, ?, 'SWITCH_SESSION', 'session_swaps', ?, ?)
    `).run(req.user.userId, req.user.name || 'User', req.user.role, String(result.swapId), `Switched session for student ${student_id}: ${reason}`);

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/attendance/corrections
 * Request attendance correction for older dates or amendments
 */
academyRouter.post('/attendance/corrections', (req, res) => {
  try {
    const db = req.tenantDb;
    const { session_id, batch_id, date, student_id, original_status, requested_status, reason } = req.body;

    if (!batch_id || !date || !reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'batch_id, date, and reason are required' });
    }

    const ins = db.prepare(`
      INSERT INTO attendance_corrections (
        academy_id, session_id, batch_id, date, student_id, original_status, requested_status, reason, requested_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.academy.id,
      session_id ? Number(session_id) : null,
      Number(batch_id),
      date,
      student_id ? Number(student_id) : null,
      original_status || 'absent',
      requested_status || 'present',
      reason.trim(),
      req.user.userId
    );

    res.status(201).json({
      success: true,
      message: 'Attendance correction request submitted for administrative review',
      correctionId: ins.lastInsertRowid,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/attendance/corrections
 */
academyRouter.get('/attendance/corrections', (req, res) => {
  try {
    const db = req.tenantDb;
    const corrections = db.prepare(`
      SELECT ac.*, b.name as batch_name, s.first_name, s.last_name, u.name as requester_name
      FROM attendance_corrections ac
      JOIN batches b ON ac.batch_id = b.id
      LEFT JOIN students s ON ac.student_id = s.id
      JOIN users u ON ac.requested_by = u.id
      ORDER BY ac.created_at DESC
    `).all();

    res.json({ success: true, corrections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/attendance/corrections/:id
 */
academyRouter.put('/attendance/corrections/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const id = Number(req.params.id);
    const { status, reviewer_notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status must be approved or rejected' });
    }

    const corr = db.prepare('SELECT * FROM attendance_corrections WHERE id = ?').get(id);
    if (!corr) {
      return res.status(404).json({ success: false, error: 'Correction request not found' });
    }

    db.prepare(`
      UPDATE attendance_corrections
      SET status = ?, reviewer_notes = ?, approved_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, reviewer_notes || null, req.user.userId, id);

    res.json({ success: true, message: `Correction request marked as ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/attendance
 */
academyRouter.get('/attendance', (req, res) => {
  try {
    const db = req.tenantDb;
    const { batch_id, date } = req.query;

    if (!batch_id || !date) {
      return res.status(400).json({ success: false, error: 'batch_id and date query parameters are required' });
    }

    // Role Security: Coach can only view attendance for their assigned batch
    if (req.user.role === 'coach') {
      const coach = getCoachContext(db, req.user);
      if (!coach) {
        return res.status(403).json({ success: false, error: 'Access denied: Coach profile not found' });
      }
      const targetBatch = db.prepare('SELECT coach_id FROM batches WHERE id = ?').get(Number(batch_id));
      if (!targetBatch || targetBatch.coach_id !== coach.id) {
        return res.status(403).json({ success: false, error: 'Access denied: You are only authorized to view attendance for your assigned batches' });
      }
    }

    const attendanceRecord = db.prepare('SELECT * FROM attendance WHERE batch_id = ? AND date = ?').get(Number(batch_id), date);

    // List all actively enrolled students in this batch, along with marked attendance & active technique
    const roster = db.prepare(`
      SELECT 
        s.id as student_id,
        s.student_code,
        s.first_name,
        s.last_name,
        sa.status,
        sa.remarks,
        sa.technique_id as marked_technique_id,
        sa.technique_level as marked_technique_level,
        sa.technique_status as marked_technique_status,
        sa.technique_remarks as marked_technique_remarks,
        sa.attended_sessions_snapshot,
        st.id as active_technique_id,
        st.name as active_technique_name,
        st.level as active_technique_level,
        st.belt_level as active_technique_belt_level,
        sc.name as active_category_name,
        sta.sessions_attended as active_sessions_attended,
        (
          SELECT COUNT(DISTINCT a_tot.id)
          FROM student_attendance sa_tot
          JOIN attendance a_tot ON a_tot.id = sa_tot.attendance_id
          WHERE sa_tot.student_id = s.id AND sa_tot.status IN ('present', 'late')
        ) as total_attended_sessions,
        (
          SELECT COUNT(DISTINCT a_tot.id)
          FROM student_attendance sa_tot
          JOIN attendance a_tot ON a_tot.id = sa_tot.attendance_id
          WHERE sa_tot.student_id = s.id AND a_tot.batch_id = ? AND sa_tot.status IN ('present', 'late')
        ) as batch_attended_sessions
      FROM students s
      JOIN student_batch_enrollments sbe ON sbe.student_id = s.id AND sbe.batch_id = ? AND sbe.status = 'active'
      LEFT JOIN student_attendance sa ON sa.student_id = s.id AND sa.attendance_id = ?
      LEFT JOIN student_technique_assignments sta ON sta.student_id = s.id AND sta.status = 'active'
      LEFT JOIN syllabus_techniques st ON st.id = sta.technique_id
      LEFT JOIN syllabus_categories sc ON sc.id = st.category_id
      ORDER BY s.first_name ASC
    `).all(Number(batch_id), Number(batch_id), attendanceRecord ? attendanceRecord.id : -1);

    const availableTechniques = SyllabusService.listTechniques(db, req.academy.id);
    const dateValidation = AttendanceScheduleService.validateAttendanceDate(db, date);

    res.json({
      success: true,
      attendanceRecord: attendanceRecord || null,
      roster,
      availableTechniques,
      dateValidation,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/attendance
 * Marks or updates attendance with strict date cutoff rules, session sync, and technique progression
 */
academyRouter.post('/attendance', (req, res) => {
  try {
    const db = req.tenantDb;
    const { batch_id, date, entries, notes, override_token } = req.body;

    if (!batch_id || !date || !Array.isArray(entries)) {
      return res.status(400).json({ success: false, error: 'batch_id, date, and entries array are required' });
    }

    // Role Security: Coach can only submit attendance for their assigned batch
    if (req.user.role === 'coach') {
      const coach = getCoachContext(db, req.user);
      if (!coach) {
        return res.status(403).json({ success: false, error: 'Access denied: Coach profile not found' });
      }
      const targetBatch = db.prepare('SELECT coach_id FROM batches WHERE id = ?').get(Number(batch_id));
      if (!targetBatch || targetBatch.coach_id !== coach.id) {
        return res.status(403).json({ success: false, error: 'Access denied: You are only authorized to mark attendance for your assigned batches' });
      }
    }

    // 1. Backend-Enforced Date Validation
    const dateCheck = AttendanceScheduleService.validateAttendanceDate(db, date);
    if (!dateCheck.allowed) {
      if (dateCheck.code === 'FUTURE_DATE_REJECTED') {
        const policy = OvertimeService.getAcademyPolicy(db, req.academy.id);
        if (!policy.allow_future_attendance) {
          return res.status(400).json({
            success: false,
            error: 'Future attendance is prohibited by academy policy. Attendance cannot be recorded before a session takes place.',
            code: 'FUTURE_DATE_REJECTED',
          });
        }
      }

      if (dateCheck.code === 'PAST_CUTOFF_EXCEEDED') {
        // Check if an approved correction exists for this batch and date
        const approvedCorrection = db.prepare(`
          SELECT id FROM attendance_corrections
          WHERE batch_id = ? AND date = ? AND status = 'approved'
        `).get(Number(batch_id), date);

        const isAdmin = req.user.isSuperAdmin || req.user.role === 'academy_admin';
        if (!approvedCorrection && !isAdmin) {
          return res.status(403).json({
            success: false,
            error: dateCheck.reason,
            code: dateCheck.code,
            allowedPastDays: dateCheck.allowedPastDays,
            requiresCorrection: true,
          });
        }
      }
    }

    let isUpdate = false;
    const tx = db.transaction(() => {
      // Find or create attendance header
      let att = db.prepare('SELECT id FROM attendance WHERE batch_id = ? AND date = ?').get(Number(batch_id), date);
      isUpdate = !!att;
      let attId;

      if (att) {
        attId = att.id;
        db.prepare('UPDATE attendance SET notes = COALESCE(?, notes) WHERE id = ?').run(notes || null, attId);
      } else {
        const ins = db.prepare('INSERT INTO attendance (batch_id, date, taken_by_user_id, notes) VALUES (?, ?, ?, ?)');
        const r = ins.run(Number(batch_id), date, req.user.userId, notes || null);
        attId = r.lastInsertRowid;
      }

      // Process technique progression with idempotency check
      SyllabusService.processAttendanceProgression(db, req.academy.id, attId, entries, req.user.userId);

      // (Student attendance records, technique progression, session counts, and snapshots are atomically upserted above)

      // Sync batch session status
      const batch = db.prepare('SELECT branch_id, coach_id, start_time, end_time FROM batches WHERE id = ?').get(Number(batch_id));
      let session = db.prepare('SELECT id FROM batch_sessions WHERE batch_id = ? AND scheduled_date = ?').get(Number(batch_id), date);

      if (!session && batch) {
        let validCoachId = null;
        if (batch.coach_id) {
          const coachExists = db.prepare('SELECT id FROM coaches WHERE id = ?').get(batch.coach_id);
          if (coachExists) validCoachId = coachExists.id;
        }
        if (!validCoachId) {
          const firstCoach = db.prepare('SELECT id FROM coaches LIMIT 1').get();
          if (firstCoach) validCoachId = firstCoach.id;
        }

        const insSession = db.prepare(`
          INSERT INTO batch_sessions (
            academy_id, branch_id, batch_id, scheduled_date, start_time, end_time, coach_id, status, attendance_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', 'pending')
        `).run(req.academy.id, batch.branch_id, Number(batch_id), date, batch.start_time || '07:00', batch.end_time || '08:30', validCoachId);
        session = { id: insSession.lastInsertRowid };
      }

      if (session) {
        db.prepare(`
          UPDATE batch_sessions
          SET status = 'completed',
              attendance_status = 'completed',
              attendance_taken_at = CURRENT_TIMESTAMP,
              attendance_taken_by = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(req.user.userId, session.id);
      }

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details)
        VALUES (?, ?, ?, 'SUBMIT_ATTENDANCE', 'attendance', ?, ?)
      `).run(req.user.userId, req.user.name || 'User', req.user.role, String(attId), `${isUpdate ? 'Updated' : 'Submitted'} attendance for batch ${batch_id} on ${date} (${entries.length} students)`);
    });

    tx();

    res.json({
      success: true,
      isUpdate,
      message: isUpdate
        ? `Attendance updated successfully for ${entries.length} students on ${date}`
        : `Attendance marked successfully for ${entries.length} students on ${date}`,
      date,
      batchId: Number(batch_id),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// FEES & PAYMENTS
// ==========================================

/**
 * GET /api/academy/fees/dashboard
 * Summary financial analytics, collection metrics, and ageing buckets
 */
academyRouter.get('/fees/dashboard', (req, res) => {
  try {
    const db = req.tenantDb;
    const analytics = FeeService.getFeeDashboardAnalytics(db);
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/fees/timeline/:studentId
 * Resolves current paid-through date, next installment start date, and applicable rate
 */
academyRouter.get('/fees/timeline/:studentId', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Valid student ID is required' });
    }

    const timeline = FeeService.getStudentFeeTimeline(db, studentId);
    res.json({ success: true, timeline });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/fees/calculate
 * Independent server-side preview calculation for dates, base fees, discounts, and payable amounts
 */
academyRouter.get('/fees/calculate', (req, res) => {
  try {
    const db = req.tenantDb;
    const { student_id, months_count = 1, start_date, discount_type = 'none', discount_value = 0 } = req.query;

    if (!student_id) {
      return res.status(400).json({ success: false, error: 'student_id is required' });
    }

    const months = Number(months_count);
    const timeline = FeeService.getStudentFeeTimeline(db, Number(student_id));
    const effectiveStart = start_date || timeline.nextStartDate;

    const dates = FeeService.addCalendarMonths(effectiveStart, months);
    const feeInfo = FeeService.getStudentMonthlyFee(db, Number(student_id), effectiveStart);
    const baseFee = FeeService.round2(feeInfo.monthlyFee * months);

    const discount = FeeService.calculateDiscount({
      baseFee,
      monthsCount: months,
      discountType: discount_type,
      discountValue: Number(discount_value) || 0,
      db,
    });

    res.json({
      success: true,
      calculation: {
        studentId: Number(student_id),
        monthsCount: months,
        periodStart: dates.periodStart,
        periodEnd: dates.periodEnd,
        nextInstallmentDate: dates.nextInstallmentDate,
        monthlyRate: feeInfo.monthlyFee,
        rateSource: feeInfo.source,
        batchName: feeInfo.batchName || null,
        baseFee,
        presetPercentage: discount.presetPercentage,
        manualPercentage: discount.manualPercentage,
        manualFixedAmount: discount.manualFixedAmount,
        totalDiscountAmount: discount.totalDiscountAmount,
        maxAllowedDiscount: discount.maxAllowedDiscount,
        payableAmount: discount.payableAmount,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/fees/collect
 * Collects student fees, generates invoice & receipt, and writes to student fee ledger
 */
academyRouter.post('/fees/collect', (req, res) => {
  try {
    const db = req.tenantDb;
    const {
      student_id,
      months_count = 1,
      start_date,
      payment_amount,
      payment_mode = 'cash',
      transaction_reference,
      notes,
      discount_type = 'none',
      discount_value = 0,
      discount_reason,
      title,
    } = req.body;

    if (!student_id) {
      return res.status(400).json({ success: false, error: 'student_id is required' });
    }

    const result = FeeService.collectFee(db, {
      student_id: Number(student_id),
      months_count: Number(months_count) || 1,
      start_date,
      payment_amount,
      payment_mode,
      transaction_reference,
      notes,
      discount_type,
      discount_value,
      discount_reason,
      collected_by: req.user.userId,
      title,
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/fees/ledger/:studentId
 * Returns chronological ledger history for a student
 */
academyRouter.get('/fees/ledger/:studentId', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Valid student ID is required' });
    }

    const ledger = db.prepare(`
      SELECT sfl.*, sf.invoice_number, fp.receipt_number, u.name as created_by_name
      FROM student_fee_ledger sfl
      LEFT JOIN student_fees sf ON sf.id = sfl.student_fee_id
      LEFT JOIN fee_payments fp ON fp.id = sfl.fee_payment_id
      LEFT JOIN users u ON u.id = sfl.created_by
      WHERE sfl.student_id = ?
      ORDER BY sfl.id ASC
    `).all(studentId);

    const timeline = FeeService.getStudentFeeTimeline(db, studentId);

    res.json({ success: true, ledger, timeline });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/fees/receipt/:receiptNumber
 * Retrieves receipt details for printable format or verification
 */
academyRouter.get('/fees/receipt/:receiptNumber', (req, res) => {
  try {
    const db = req.tenantDb;
    const { receiptNumber } = req.params;

    const payment = db.prepare(`
      SELECT fp.*, sf.invoice_number, sf.title as fee_title, sf.period_start, sf.period_end,
             sf.months_count, sf.base_fee, sf.discount_amount, sf.net_amount, sf.balance_amount,
             s.student_code, s.first_name, s.last_name, s.phone, s.email,
             b.name as branch_name, u.name as collector_name
      FROM fee_payments fp
      JOIN student_fees sf ON sf.id = fp.student_fee_id
      JOIN students s ON s.id = sf.student_id
      LEFT JOIN branches b ON b.id = s.branch_id
      LEFT JOIN users u ON u.id = fp.collected_by
      WHERE fp.receipt_number = ?
    `).get(receiptNumber);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    res.json({ success: true, receipt: payment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/fees/override
 * Sets a student-specific monthly fee override
 */
academyRouter.post('/fees/override', (req, res) => {
  try {
    const db = req.tenantDb;
    const { student_id, custom_monthly_fee, reason, effective_from, effective_until } = req.body;

    if (!student_id || custom_monthly_fee === undefined || !reason) {
      return res.status(400).json({ success: false, error: 'student_id, custom_monthly_fee, and reason are required' });
    }

    const result = FeeService.setStudentOverride(db, {
      student_id: Number(student_id),
      custom_monthly_fee: Number(custom_monthly_fee),
      reason,
      effective_from,
      effective_until,
      created_by: req.user.userId,
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/fees/pauses
 * Lists fee pause & membership hold requests
 */
academyRouter.get('/fees/pauses', (req, res) => {
  try {
    const db = req.tenantDb;
    const { status, student_id } = req.query;

    let query = `
      SELECT fpr.*, s.student_code, s.first_name, s.last_name, s.phone,
             b.name as branch_name, bt.name as batch_name,
             u1.name as requester_name, u2.name as approver_name
      FROM fee_pause_requests fpr
      JOIN students s ON s.id = fpr.student_id
      LEFT JOIN branches b ON b.id = fpr.branch_id
      LEFT JOIN batches bt ON bt.id = fpr.batch_id
      LEFT JOIN users u1 ON u1.id = fpr.requested_by
      LEFT JOIN users u2 ON u2.id = fpr.approved_by
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND fpr.status = ?`;
      params.push(status);
    }
    if (student_id) {
      query += ` AND fpr.student_id = ?`;
      params.push(Number(student_id));
    }

    query += ` ORDER BY fpr.id DESC`;

    const pauses = db.prepare(query).all(...params);
    res.json({ success: true, pauses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/fees/pauses
 * Submits a new fee pause request
 */
academyRouter.post('/fees/pauses', (req, res) => {
  try {
    const db = req.tenantDb;
    const { student_id, branch_id, batch_id, pause_type, requested_start_date, requested_end_date, reason } = req.body;

    const result = FeeService.requestPause(db, {
      student_id: Number(student_id),
      branch_id: branch_id ? Number(branch_id) : undefined,
      batch_id: batch_id ? Number(batch_id) : null,
      pause_type: pause_type || 'fee_pause',
      requested_start_date,
      requested_end_date,
      reason,
      requested_by: req.user.userId,
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/fees/pauses/:id/review
 * Approves or rejects a pause request with role and branch authorization checks
 */
academyRouter.put('/fees/pauses/:id/review', (req, res) => {
  try {
    const db = req.tenantDb;
    const pauseId = Number(req.params.id);
    const { decision, approval_notes, approved_start_date, approved_end_date } = req.body;

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, error: "Decision must be 'approved' or 'rejected'" });
    }

    const result = FeeService.reviewPause(db, {
      pause_id: pauseId,
      decision,
      approved_by: req.user.userId,
      approval_notes,
      approved_start_date,
      approved_end_date,
      userRole: req.user.role,
      userBranchId: req.user.branchId || null,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/fees/discount-presets
 */
academyRouter.get('/fees/discount-presets', (req, res) => {
  try {
    const db = req.tenantDb;
    const presets = db.prepare('SELECT * FROM fee_discount_presets ORDER BY months ASC').all();
    res.json({ success: true, presets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/fees
 */
academyRouter.get('/fees', (req, res) => {
  try {
    const db = req.tenantDb;

    // Strict Role Scoping: Coaches have zero access to financial ledgers or fees
    if (req.user.role === 'coach') {
      return res.status(403).json({ success: false, error: 'Access denied: Coaches do not have permission to access financial fee records' });
    }

    const { status, student_id, branch_id, batch_id, search, overdue_only, page, limit } = req.query;

    let baseQuery = `
      FROM student_fees sf
      JOIN students s ON s.id = sf.student_id
      LEFT JOIN branches b ON b.id = s.branch_id
      LEFT JOIN student_batch_enrollments sbe ON sbe.student_id = s.id AND sbe.status = 'active'
      LEFT JOIN batches bt ON bt.id = sbe.batch_id
      LEFT JOIN fee_structures fs ON fs.id = sf.fee_structure_id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'branch_admin') {
      const branches = db.prepare('SELECT branch_id FROM user_branch_assignments WHERE user_id = ?').all(req.user.userId).map(b => b.branch_id);
      if (branches.length > 0) {
        baseQuery += ` AND s.branch_id IN (${branches.map(() => '?').join(',')})`;
        params.push(...branches);
      }
    }

    if (search) {
      baseQuery += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_code LIKE ? OR sf.invoice_number LIKE ? OR sf.title LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    if (status) {
      baseQuery += ` AND sf.status = ?`;
      params.push(status);
    }
    if (student_id) {
      baseQuery += ` AND sf.student_id = ?`;
      params.push(Number(student_id));
    }
    if (branch_id) {
      baseQuery += ` AND s.branch_id = ?`;
      params.push(Number(branch_id));
    }
    if (batch_id) {
      baseQuery += ` AND bt.id = ?`;
      params.push(Number(batch_id));
    }
    if (overdue_only === '1' || overdue_only === 'true') {
      const today = new Date().toISOString().split('T')[0];
      baseQuery += ` AND (sf.status = 'overdue' OR (sf.balance_amount > 0 AND sf.due_date < ?))`;
      params.push(today);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params);
    const total = countRow ? countRow.total : 0;

    let selectQuery = `
      SELECT sf.*, s.student_code, s.first_name, s.last_name, s.phone,
             b.name as branch_name, bt.name as batch_name,
             fs.name as fee_structure_name
      ${baseQuery}
      ORDER BY sf.due_date ASC, sf.id DESC
    `;

    if (page || limit) {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.max(1, parseInt(limit) || 20);
      const offset = (p - 1) * l;
      selectQuery += ` LIMIT ? OFFSET ?`;
      const fees = db.prepare(selectQuery).all(...params, l, offset);
      return res.json({
        success: true,
        fees,
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
      });
    } else {
      const fees = db.prepare(selectQuery).all(...params);
      return res.json({ success: true, fees, total, page: 1, limit: total, totalPages: 1 });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/fees
 * Legacy / custom invoice generation
 */
academyRouter.post('/fees', (req, res) => {
  try {
    const db = req.tenantDb;
    const { student_id, fee_structure_id, title, due_date, amount, discount_amount = 0, tax_amount = 0, notes } = req.body;

    if (!student_id || !title || !due_date || amount === undefined) {
      return res.status(400).json({ success: false, error: 'student_id, title, due_date, and amount are required' });
    }

    const netAmount = Number(amount) - Number(discount_amount) + Number(tax_amount);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const insert = db.prepare(`
      INSERT INTO student_fees (
        student_id, fee_structure_id, invoice_number, title, due_date,
        amount, discount_amount, tax_amount, net_amount, paid_amount, balance_amount,
        status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?)
    `);

    const result = insert.run(
      Number(student_id),
      fee_structure_id ? Number(fee_structure_id) : null,
      invoiceNumber,
      title.trim(),
      due_date,
      Number(amount),
      Number(discount_amount),
      Number(tax_amount),
      netAmount,
      netAmount,
      notes || null
    );

    // Record in ledger
    db.prepare(`
      INSERT INTO student_fee_ledger (
        student_id, student_fee_id, entry_type, charge_type, debit, credit, running_balance, notes, created_by
      ) VALUES (?, ?, 'charge', 'tuition', ?, 0, ?, ?, ?)
    `).run(
      Number(student_id),
      result.lastInsertRowid,
      netAmount,
      netAmount,
      title.trim(),
      req.user.userId
    );

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoiceId: result.lastInsertRowid,
      invoiceNumber,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/fees/pay
 * Records a payment against an invoice and updates balance/status and ledger
 */
academyRouter.post('/fees/pay', (req, res) => {
  try {
    const db = req.tenantDb;
    const { student_fee_id, amount, payment_mode = 'cash', transaction_reference, notes } = req.body;

    if (!student_fee_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid student_fee_id and payment amount required' });
    }

    const invoice = db.prepare('SELECT * FROM student_fees WHERE id = ?').get(Number(student_fee_id));
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const paymentAmount = Number(amount);
    const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;

    let paymentId;
    let newPaid = 0;
    let newBalance = 0;
    let newStatus = 'partial';

    const tx = db.transaction(() => {
      // 1. Insert payment record
      const insertPay = db.prepare(`
        INSERT INTO fee_payments (
          student_fee_id, student_id, receipt_number, payment_date, amount,
          payment_mode, transaction_reference, notes, collected_by, status
        ) VALUES (?, ?, ?, DATE('now'), ?, ?, ?, ?, ?, 'completed')
      `).run(
        invoice.id,
        invoice.student_id,
        receiptNumber,
        paymentAmount,
        payment_mode,
        transaction_reference || null,
        notes || null,
        req.user.userId
      );
      paymentId = insertPay.lastInsertRowid;

      // 2. Update invoice balances
      newPaid = invoice.paid_amount + paymentAmount;
      newBalance = Math.max(0, invoice.net_amount - newPaid);
      newStatus = 'partial';
      if (newBalance <= 0) {
        newStatus = 'paid';
      }

      db.prepare(`
        UPDATE student_fees
        SET paid_amount = ?,
            balance_amount = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaid, newBalance, newStatus, invoice.id);

      // 3. Record in ledger
      db.prepare(`
        INSERT INTO student_fee_ledger (
          student_id, student_fee_id, fee_payment_id, entry_type, charge_type,
          debit, credit, running_balance, paid_through_date, notes, created_by
        ) VALUES (?, ?, ?, 'payment', 'tuition', 0, ?, ?, ?, ?, ?)
      `).run(
        invoice.student_id,
        invoice.id,
        paymentId,
        paymentAmount,
        newBalance,
        newStatus === 'paid' ? invoice.period_end : null,
        `Payment ${receiptNumber} (${payment_mode})`,
        req.user.userId
      );
    });

    tx();

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      receiptNumber,
      amount: paymentAmount,
      remainingBalance: newBalance,
      balanceAmount: newBalance,
      status: newStatus,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// LEAVES, BRANCHES, SPORTS, AUDIT, BACKUP
// ==========================================

/**
 * GET /api/academy/leaves
 */
academyRouter.get('/leaves', (req, res) => {
  try {
    const db = req.tenantDb;
    const { status, applicant_type, search, page, limit } = req.query;

    let baseQuery = `FROM leave_requests WHERE 1=1`;
    const params = [];

    if (status) {
      baseQuery += ` AND status = ?`;
      params.push(status);
    }
    if (applicant_type) {
      baseQuery += ` AND applicant_type = ?`;
      params.push(applicant_type);
    }
    if (search) {
      baseQuery += ` AND (applicant_name LIKE ? OR reason LIKE ? OR reviewer_comments LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params);
    const total = countRow ? countRow.total : 0;

    let selectQuery = `SELECT * ${baseQuery} ORDER BY id DESC`;

    if (page || limit) {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.max(1, parseInt(limit) || 20);
      const offset = (p - 1) * l;
      selectQuery += ` LIMIT ? OFFSET ?`;
      const leaves = db.prepare(selectQuery).all(...params, l, offset);
      return res.json({
        success: true,
        leaves,
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
      });
    } else {
      const leaves = db.prepare(selectQuery).all(...params);
      return res.json({ success: true, leaves, total, page: 1, limit: total, totalPages: 1 });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/leaves/:id
 */
academyRouter.put('/leaves/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const { status, reviewer_comments } = req.body;
    const id = Number(req.params.id);

    db.prepare(`
      UPDATE leave_requests
      SET status = ?,
          reviewer_comments = ?,
          reviewed_by = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, reviewer_comments || null, req.user.userId, id);

    res.json({ success: true, message: `Leave request ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/branches
 */
academyRouter.get('/branches', (req, res) => {
  try {
    const db = req.tenantDb;
    const branches = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM batches WHERE branch_id = b.id) AS batch_count,
        (SELECT COUNT(*) FROM students WHERE branch_id = b.id) AS student_count,
        (SELECT COUNT(*) FROM coaches WHERE branch_id = b.id) AS coach_count
      FROM branches b
      ORDER BY b.name ASC
    `).all();
    res.json({ success: true, branches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/branches
 */
academyRouter.post('/branches', (req, res) => {
  try {
    const db = req.tenantDb;
    const { name, address, city, phone, email, academy_id } = req.body;

    // Rule B & Cross-academy check
    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy branch creation is strictly forbidden' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Branch name is required' });
    }

    // Enforce branch quota via QuotaService
    QuotaService.assertCanCreate(req.academy.id, 'branches', 1);

    const insert = db.prepare(`
      INSERT INTO branches (name, address, city, phone, email, academy_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const result = insert.run(
      name.trim(),
      address || null,
      city || null,
      phone || null,
      email || null,
      req.academy.id
    );

    const newBranch = db.prepare('SELECT * FROM branches WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      branchId: result.lastInsertRowid,
      branch: newBranch,
      message: 'Branch created successfully',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/branches/:id
 */
academyRouter.put('/branches/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const branchId = Number(req.params.id);
    const { name, address, city, phone, email, is_active, academy_id } = req.body;

    // Rule B: A branch's academy ownership cannot change
    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy branch modification or ownership change is strictly forbidden' });
    }

    const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found in this academy' });
    }

    db.prepare(`
      UPDATE branches
      SET name = COALESCE(?, name),
          address = COALESCE(?, address),
          city = COALESCE(?, city),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      address || null,
      city || null,
      phone || null,
      email || null,
      is_active !== undefined ? Number(is_active) : null,
      branchId
    );

    res.json({ success: true, message: 'Branch updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/academy/branches/:id
 */
academyRouter.delete('/branches/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const branchId = Number(req.params.id);

    const branch = db.prepare('SELECT id, name FROM branches WHERE id = ?').get(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found in this academy' });
    }

    const batchCount = db.prepare('SELECT COUNT(*) AS count FROM batches WHERE branch_id = ?').get(branchId).count;
    const studentCount = db.prepare('SELECT COUNT(*) AS count FROM students WHERE branch_id = ?').get(branchId).count;
    const coachCount = db.prepare('SELECT COUNT(*) AS count FROM coaches WHERE branch_id = ?').get(branchId).count;

    if (batchCount > 0 || studentCount > 0 || coachCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete branch "${branch.name}" because it has active associations (${batchCount} batches, ${studentCount} students, ${coachCount} coaches). Reassign or deactivate it instead.`,
      });
    }

    db.prepare('DELETE FROM branches WHERE id = ?').run(branchId);

    res.json({
      success: true,
      message: `Branch "${branch.name}" deleted successfully`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/sports
 */
academyRouter.get('/sports', (req, res) => {
  try {
    const db = req.tenantDb;
    const activeOnly = req.query.active_only === '1' || req.query.active_only === 'true';

    let query = `
      SELECT s.*,
        (SELECT COUNT(*) FROM coaches WHERE sport_id = s.id) AS coach_count,
        (SELECT COUNT(*) FROM batches WHERE sport_id = s.id) AS batch_count
      FROM sports s
    `;

    if (activeOnly) {
      query += ` WHERE s.is_active = 1 `;
    }

    query += ` ORDER BY CASE WHEN LOWER(s.name) = 'karate' THEN 0 ELSE 1 END, s.name ASC `;

    const sports = db.prepare(query).all();
    res.json({ success: true, sports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/sports
 * Dynamically adds a new sport/discipline
 */
academyRouter.post('/sports', (req, res) => {
  try {
    const db = req.tenantDb;
    const { name, description = '', is_active = 1 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Sport name is required' });
    }

    const trimmedName = name.trim();

    // Check case-insensitive uniqueness
    const existing = db.prepare('SELECT id, name FROM sports WHERE LOWER(name) = LOWER(?)').get(trimmedName);
    if (existing) {
      return res.status(400).json({ success: false, error: `Sport '${existing.name}' already exists` });
    }

    const stmt = db.prepare(`
      INSERT INTO sports (name, description, is_active)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(trimmedName, description ? description.trim() : null, is_active ? 1 : 0);

    const newSport = db.prepare(`
      SELECT s.*, 0 AS coach_count, 0 AS batch_count
      FROM sports s
      WHERE s.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ success: true, sport: newSport, message: `Sport '${trimmedName}' added successfully` });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, error: 'A sport with this name already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/sports/:id
 * Updates an existing sport
 */
academyRouter.put('/sports/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const sportId = Number(req.params.id);
    if (!sportId) {
      return res.status(400).json({ success: false, error: 'Invalid sport ID' });
    }

    const existing = db.prepare('SELECT * FROM sports WHERE id = ?').get(sportId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Sport not found' });
    }

    const { name, description, is_active } = req.body;
    const updatedName = name !== undefined ? name.trim() : existing.name;

    if (!updatedName) {
      return res.status(400).json({ success: false, error: 'Sport name cannot be empty' });
    }

    // Check duplicate name on another ID
    const duplicate = db.prepare('SELECT id FROM sports WHERE LOWER(name) = LOWER(?) AND id != ?').get(updatedName, sportId);
    if (duplicate) {
      return res.status(400).json({ success: false, error: `Another sport with the name '${updatedName}' already exists` });
    }

    const updatedDesc = description !== undefined ? (description ? description.trim() : null) : existing.description;
    const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    db.prepare(`
      UPDATE sports
      SET name = ?, description = ?, is_active = ?
      WHERE id = ?
    `).run(updatedName, updatedDesc, updatedActive, sportId);

    const updated = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM coaches WHERE sport_id = s.id) AS coach_count,
        (SELECT COUNT(*) FROM batches WHERE sport_id = s.id) AS batch_count
      FROM sports s
      WHERE s.id = ?
    `).get(sportId);

    res.json({ success: true, sport: updated, message: `Sport '${updatedName}' updated successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/academy/sports/:id
 * Safely deactivates or removes a sport
 */
academyRouter.delete('/sports/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const sportId = Number(req.params.id);
    if (!sportId) {
      return res.status(400).json({ success: false, error: 'Invalid sport ID' });
    }

    const existing = db.prepare('SELECT * FROM sports WHERE id = ?').get(sportId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Sport not found' });
    }

    // Check references in related tables
    const coachCount = db.prepare('SELECT COUNT(*) as c FROM coaches WHERE sport_id = ?').get(sportId).c;
    const batchCount = db.prepare('SELECT COUNT(*) as c FROM batches WHERE sport_id = ?').get(sportId).c;
    const equipCount = db.prepare('SELECT COUNT(*) as c FROM equipment_inventory WHERE sport_id = ?').get(sportId).c;
    const feeCount = db.prepare('SELECT COUNT(*) as c FROM fee_structures WHERE sport_id = ?').get(sportId).c;

    const totalRefs = coachCount + batchCount + equipCount + feeCount;

    if (totalRefs > 0) {
      // Safely deactivate instead of hard delete to preserve referential integrity
      db.prepare('UPDATE sports SET is_active = 0 WHERE id = ?').run(sportId);
      return res.json({
        success: true,
        deactivated: true,
        message: `Sport '${existing.name}' is referenced by ${coachCount} coaches, ${batchCount} batches, and fees. It has been safely deactivated instead of deleted.`
      });
    }

    db.prepare('DELETE FROM sports WHERE id = ?').run(sportId);
    res.json({ success: true, message: `Sport '${existing.name}' deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/facilities
 */
academyRouter.get('/facilities', (req, res) => {
  try {
    const db = req.tenantDb;
    const facilities = db.prepare(`
      SELECT f.*, b.name as branch_name 
      FROM facilities f 
      LEFT JOIN branches b ON b.id = f.branch_id 
      ORDER BY f.name ASC
    `).all();
    res.json({ success: true, facilities });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/inventory
 */
academyRouter.get('/inventory', (req, res) => {
  try {
    const db = req.tenantDb;
    const items = db.prepare(`
      SELECT eq.*, s.name as sport_name, b.name as branch_name 
      FROM equipment_inventory eq
      LEFT JOIN sports s ON s.id = eq.sport_id
      LEFT JOIN branches b ON b.id = eq.branch_id
      ORDER BY eq.name ASC
    `).all();
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/audit-logs
 */
academyRouter.get('/audit-logs', (req, res) => {
  try {
    const db = req.tenantDb;
    const { action, search, user_role, page, limit } = req.query;

    let baseQuery = `FROM audit_logs WHERE 1=1`;
    const params = [];

    if (action) {
      baseQuery += ` AND action = ?`;
      params.push(action);
    }
    if (user_role) {
      baseQuery += ` AND user_role = ?`;
      params.push(user_role);
    }
    if (search) {
      baseQuery += ` AND (user_name LIKE ? OR entity LIKE ? OR details LIKE ? OR ip_address LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params);
    const total = countRow ? countRow.total : 0;

    let selectQuery = `SELECT * ${baseQuery} ORDER BY created_at DESC, id DESC`;

    if (page || limit) {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.max(1, parseInt(limit) || 25);
      const offset = (p - 1) * l;
      selectQuery += ` LIMIT ? OFFSET ?`;
      const logs = db.prepare(selectQuery).all(...params, l, offset);
      return res.json({
        success: true,
        logs,
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
      });
    } else {
      const logs = db.prepare(`${selectQuery} LIMIT 100`).all(...params);
      return res.json({ success: true, logs, total, page: 1, limit: 100, totalPages: Math.ceil(total / 100) || 1 });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/backup
 * Downloads this academy's isolated database backup
 */
academyRouter.get('/backup', async (req, res) => {
  try {
    await streamAcademyBackup(req.academy.id, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// ==========================================
// SYLLABUS CATEGORIES
// ==========================================

/**
 * GET /api/academy/syllabus-categories
 */
academyRouter.get('/syllabus-categories', (req, res) => {
  try {
    const db = req.tenantDb;
    const includeInactive = req.query.include_inactive === 'true' || req.query.all === 'true';
    const categories = SyllabusService.listCategories(db, req.academy.id, { includeInactive });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/syllabus-categories
 */
academyRouter.post('/syllabus-categories', (req, res) => {
  try {
    const db = req.tenantDb;
    const { name, description, display_order, status, academy_id } = req.body;

    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy operations are forbidden' });
    }

    const category = SyllabusService.createCategory(db, req.academy.id, {
      name,
      description,
      display_order,
      status,
    });

    res.status(201).json({ success: true, message: 'Syllabus category created successfully', category });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/syllabus-categories/:id
 */
academyRouter.put('/syllabus-categories/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const categoryId = Number(req.params.id);
    const { name, description, display_order, status, academy_id } = req.body;

    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy operations are forbidden' });
    }

    const updated = SyllabusService.updateCategory(db, req.academy.id, categoryId, {
      name,
      description,
      display_order,
      status,
    });

    res.json({ success: true, message: 'Category updated successfully', category: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/academy/syllabus-categories/:id
 */
academyRouter.delete('/syllabus-categories/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const categoryId = Number(req.params.id);
    const result = SyllabusService.deleteCategory(db, req.academy.id, categoryId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/syllabus-categories/reorder
 */
academyRouter.post('/syllabus-categories/reorder', (req, res) => {
  try {
    const db = req.tenantDb;
    const { orderIds } = req.body;
    const result = SyllabusService.reorderCategories(db, req.academy.id, orderIds);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// SYLLABUS TECHNIQUES
// ==========================================

/**
 * GET /api/academy/syllabus-techniques
 */
academyRouter.get('/syllabus-techniques', (req, res) => {
  try {
    const db = req.tenantDb;
    const { category_id, level, belt_level, include_inactive } = req.query;
    const techniques = SyllabusService.listTechniques(db, req.academy.id, {
      categoryId: category_id,
      level,
      beltLevel: belt_level,
      includeInactive: include_inactive === 'true',
    });
    res.json({ success: true, techniques });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/syllabus-techniques
 */
academyRouter.post('/syllabus-techniques', (req, res) => {
  try {
    const db = req.tenantDb;
    const {
      category_id,
      name,
      code,
      description,
      level,
      belt_level,
      media_url,
      display_order,
      status,
      academy_id,
    } = req.body;

    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy operations are forbidden' });
    }

    const technique = SyllabusService.createTechnique(db, req.academy.id, {
      category_id,
      name,
      code,
      description,
      level,
      belt_level,
      media_url,
      display_order,
      status,
    });

    res.status(201).json({ success: true, message: 'Technique created successfully', technique });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/syllabus-techniques/:id
 */
academyRouter.put('/syllabus-techniques/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const techniqueId = Number(req.params.id);
    const { academy_id, ...updates } = req.body;

    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy operations are forbidden' });
    }

    const updated = SyllabusService.updateTechnique(db, req.academy.id, techniqueId, updates);
    res.json({ success: true, message: 'Technique updated successfully', technique: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/academy/syllabus-techniques/:id
 */
academyRouter.delete('/syllabus-techniques/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const techniqueId = Number(req.params.id);
    const result = SyllabusService.deleteTechnique(db, req.academy.id, techniqueId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/syllabus-techniques/reorder
 */
academyRouter.post('/syllabus-techniques/reorder', (req, res) => {
  try {
    const db = req.tenantDb;
    const { orderIds } = req.body;
    const result = SyllabusService.reorderTechniques(db, req.academy.id, orderIds);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// STUDENT TECHNIQUE TRACKING & HISTORY
// ==========================================

/**
 * GET /api/academy/students/:id/technique-history
 */
academyRouter.get('/students/:id/technique-history', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);

    const student = db.prepare('SELECT id, academy_id FROM students WHERE id = ?').get(studentId);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in this academy' });
    }
    if (student.academy_id == null || Number(student.academy_id) !== Number(req.academy.id)) {
      db.prepare('UPDATE students SET academy_id = ? WHERE id = ?').run(Number(req.academy.id), student.id);
      student.academy_id = Number(req.academy.id);
    }

    const progress = SyllabusService.getStudentTechniqueHistory(db, studentId);
    res.json({ success: true, studentId, ...progress });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/students/:id/assign-technique
 * Assigns or transitions student technique (upgrade, downgrade, direct_jump)
 */
academyRouter.post('/students/:id/assign-technique', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);
    const { technique_id, start_date, remarks, action = 'initial', academy_id } = req.body;

    if (academy_id && Number(academy_id) !== req.academy.id) {
      return res.status(403).json({ success: false, error: 'Cross-academy operations are forbidden' });
    }

    if (!technique_id) {
      return res.status(400).json({ success: false, error: 'technique_id is required' });
    }

    const assigned = SyllabusService.assignStudentTechnique(db, req.academy.id, studentId, {
      technique_id: Number(technique_id),
      assigned_by: req.user.userId,
      start_date,
      remarks,
      action,
    });

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, ?, 'TECHNIQUE_ASSIGNMENT', 'students', ?, ?, ?)
    `).run(
      req.user.userId,
      req.user.name,
      req.user.role,
      String(studentId),
      `Assigned technique '${assigned.technique_name}' (${action.toUpperCase()}). Remarks: ${remarks || 'None'}`,
      req.ip
    );

    res.json({ success: true, message: `Successfully assigned technique: ${assigned.technique_name}`, assignment: assigned });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// SYLLABUS REPORTS
// ==========================================

/**
 * GET /api/academy/syllabus-reports
 */
academyRouter.get('/syllabus-reports', (req, res) => {
  try {
    const db = req.tenantDb;
    const reports = SyllabusService.getSyllabusReports(db, req.academy.id);
    res.json({ success: true, ...reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/domains
 * Returns registered domains and primary subdomain for the current academy
 */
academyRouter.get('/domains', (req, res) => {
  try {
    const centralDb = getCentralDb();
    const domains = centralDb.prepare(`
      SELECT id, domain, is_primary, is_custom, status, created_at
      FROM domains
      WHERE academy_id = ?
      ORDER BY is_primary DESC, created_at ASC
    `).all(req.academy.id);

    res.json({
      success: true,
      academy: {
        id: req.academy.id,
        name: req.academy.name,
        slug: req.academy.slug,
      },
      defaultSubdomain: `${req.academy.slug}.internationalsportssolutions.test`,
      domains,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// STAFF PAYROLL & SALARY STATEMENTS
// ==========================================

/**
 * GET /api/academy/payroll/my-salary
 * Employee view of their own salary statement (respects 25th-of-month visibility policy)
 */
academyRouter.get('/payroll/my-salary', (req, res) => {
  try {
    const db = req.tenantDb;
    const yearMonth = req.query.year_month || new Date().toISOString().slice(0, 7);

    const statementData = PayrollService.getEmployeeStatement(db, req.user.userId, yearMonth);
    res.json({ success: true, ...statementData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/payroll/periods
 * Lists payroll periods for the academy
 */
academyRouter.get('/payroll/periods', (req, res) => {
  try {
    const db = req.tenantDb;
    const periods = db.prepare(`
      SELECT p.*,
             COUNT(s.id) as statements_count,
             COALESCE(SUM(s.net_earnings), 0) as total_net_payroll,
             COALESCE(SUM(s.paid_amount), 0) as total_paid
      FROM staff_payroll_periods p
      LEFT JOIN staff_salary_statements s ON s.payroll_period_id = p.id
      WHERE p.academy_id = ?
      GROUP BY p.id
      ORDER BY p.year_month DESC
    `).all(req.academy.id);

    res.json({ success: true, periods });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/payroll/periods/:id/statements
 * Admin view of all statements for a given period
 */
academyRouter.get('/payroll/periods/:id/statements', (req, res) => {
  try {
    const db = req.tenantDb;
    const periodId = Number(req.params.id);

    const period = db.prepare('SELECT * FROM staff_payroll_periods WHERE id = ?').get(periodId);
    if (!period) {
      return res.status(404).json({ success: false, error: 'Payroll period not found' });
    }

    const statements = db.prepare(`
      SELECT s.*, u.name as employee_name, u.email as employee_email, u.role as employee_role
      FROM staff_salary_statements s
      JOIN users u ON s.user_id = u.id
      WHERE s.payroll_period_id = ?
      ORDER BY u.name ASC
    `).all(periodId);

    res.json({ success: true, period, statements });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/payroll/periods/:id/calculate
 * Recalculates statements for a period
 */
academyRouter.post('/payroll/periods/:id/calculate', (req, res) => {
  try {
    const db = req.tenantDb;
    const periodId = Number(req.params.id);

    const result = PayrollService.calculatePeriod(db, periodId, req.academy.id);
    res.json({ success: true, message: `Calculated statements for ${result.statementsCount} staff members`, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/payroll/periods/:id/finalize
 * Finalizes monthly payroll period, creating immutable calculation snapshot
 */
academyRouter.post('/payroll/periods/:id/finalize', (req, res) => {
  try {
    const db = req.tenantDb;
    const periodId = Number(req.params.id);

    const result = PayrollService.finalizePayrollPeriod(db, periodId, req.user.userId);
    res.json({ success: true, message: `Payroll for period ${result.yearMonth} finalized successfully. Historical snapshot locked.`, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/payroll/statements/:id/adjustments
 * Adds an itemized addition (bonus/overtime) or deduction (unpaid leave/penalty)
 */
academyRouter.post('/payroll/statements/:id/adjustments', (req, res) => {
  try {
    const db = req.tenantDb;
    const statementId = Number(req.params.id);
    const { type, category, amount, reason } = req.body;

    const result = PayrollService.addSalaryAdjustment(db, {
      statementId,
      type,
      category,
      amount: Number(amount),
      reason,
      createdBy: req.user.userId,
    });

    res.status(201).json({ success: true, message: 'Salary adjustment added successfully', ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/payroll/statements/:id/payments
 * Records salary payment disbursement
 */
academyRouter.post('/payroll/statements/:id/payments', (req, res) => {
  try {
    const db = req.tenantDb;
    const statementId = Number(req.params.id);
    const { payment_date, amount, payment_method, reference_number, notes } = req.body;

    const result = PayrollService.recordSalaryPayment(db, {
      statementId,
      paymentDate: payment_date,
      amount: Number(amount),
      paymentMethod: payment_method,
      referenceNumber: reference_number,
      notes,
      createdBy: req.user.userId,
    });

    res.status(201).json({ success: true, message: 'Salary payment recorded successfully', ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/payroll/profiles
 * Lists staff salary profiles
 */
academyRouter.get('/payroll/profiles', (req, res) => {
  try {
    const db = req.tenantDb;
    const profiles = db.prepare(`
      SELECT sp.*, u.name as staff_name, u.email as staff_email, u.role as staff_role
      FROM staff_salary_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.academy_id = ?
      ORDER BY u.name ASC
    `).all(req.academy.id);

    res.json({ success: true, profiles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/payroll/profiles
 * Creates or updates a staff salary profile (backwards-compatible alias)
 */
academyRouter.post('/payroll/profiles', (req, res) => {
  try {
    const db = req.tenantDb;
    const {
      user_id,
      salary_mode,
      base_rate,
      currency,
      scheduled_daily_hours,
      scheduled_days_per_week,
      overtime_eligible,
      overtime_rate_multiplier,
      deduction_policy,
      effective_from,
      effective_to,
      notes,
    } = req.body;

    if (!user_id || !salary_mode || base_rate === undefined) {
      return res.status(400).json({ success: false, error: 'user_id, salary_mode, and base_rate are required' });
    }

    const effFrom = effective_from || new Date().toISOString().split('T')[0];
    const effTo = effective_to || null;

    if (!effTo) {
      const prev = db.prepare(`
        SELECT id FROM staff_salary_profiles
        WHERE user_id = ? AND effective_to IS NULL AND effective_from < ?
      `).all(Number(user_id), effFrom);

      const dayBefore = new Date(new Date(effFrom + 'T00:00:00').getTime() - 86400000).toISOString().split('T')[0];
      for (const p of prev) {
        db.prepare('UPDATE staff_salary_profiles SET effective_to = ? WHERE id = ?').run(dayBefore, p.id);
      }
    }

    const ins = db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, currency, scheduled_daily_hours,
        scheduled_days_per_week, overtime_eligible, overtime_rate_multiplier,
        deduction_policy, effective_from, effective_to, is_active, notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      req.academy.id,
      Number(user_id),
      salary_mode,
      Number(base_rate),
      currency || 'INR',
      scheduled_daily_hours !== undefined ? Number(scheduled_daily_hours) : 8.0,
      scheduled_days_per_week !== undefined ? Number(scheduled_days_per_week) : 6,
      overtime_eligible !== undefined ? (overtime_eligible ? 1 : 0) : 1,
      overtime_rate_multiplier !== undefined ? Number(overtime_rate_multiplier) : 1.0,
      deduction_policy || 'working_days',
      effFrom,
      effTo,
      notes || null,
      req.user.userId,
      req.user.userId
    );

    res.status(201).json({
      success: true,
      message: 'Staff salary profile saved successfully',
      profileId: ins.lastInsertRowid,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// EMPLOYEE-SPECIFIC WORK SCHEDULES & COMPENSATION POLICIES
// ==========================================

/**
 * GET /api/academy/schedules/employee/:userId
 * Returns effective work schedule, shifts, and historical versions
 */
academyRouter.get('/schedules/employee/:userId', (req, res) => {
  try {
    const db = req.tenantDb;
    const targetUserId = Number(req.params.userId);

    const isSelf = req.user.userId === targetUserId;
    const isManager = req.user.isSuperAdmin || req.user.role === 'academy_admin' || (req.user.permissions && req.user.permissions.includes('view_coaches'));
    if (!isSelf && !isManager) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view this schedule' });
    }

    const effectiveSchedule = ScheduleService.getEffectiveSchedule(db, targetUserId);
    const history = db.prepare(`
      SELECT * FROM employee_work_schedules
      WHERE user_id = ?
      ORDER BY effective_from DESC
    `).all(targetUserId);

    res.json({
      success: true,
      effectiveSchedule,
      history,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/schedules/employee/:userId
 * Configures an employee's work schedule with shifts, break rules, and effective dates
 */
academyRouter.post('/schedules/employee/:userId', (req, res) => {
  try {
    const db = req.tenantDb;
    const targetUserId = Number(req.params.userId);

    if (!req.user.isSuperAdmin && req.user.role !== 'academy_admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required to configure work schedules.' });
    }

    const { schedule_name, branch_id, effective_from, effective_to, notes, shifts } = req.body;

    if (!Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one shift entry is required.' });
    }

    const targetUser = db.prepare('SELECT name, role FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }

    const result = ScheduleService.saveEmployeeSchedule(
      db,
      req.academy.id,
      targetUserId,
      {
        schedule_name,
        branch_id,
        effective_from,
        effective_to,
        notes,
      },
      shifts,
      req.user.userId
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details, ip_address)
      VALUES (?, ?, ?, 'UPDATE_SCHEDULE', 'employee_work_schedules', ?, ?)
    `).run(
      req.user.userId,
      req.user.name,
      req.user.role,
      `Configured work schedule for ${targetUser.name} (${result.workingDaysCount} days/wk, ${result.expectedDailyHours}h/day, ${result.expectedWeeklyHours}h/wk)`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Work schedule configured successfully for ${targetUser.name}`,
      ...result,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/compensation/employee/:userId
 * Returns effective compensation policy and historical compensation profiles
 */
academyRouter.get('/compensation/employee/:userId', (req, res) => {
  try {
    const db = req.tenantDb;
    const targetUserId = Number(req.params.userId);

    const isSelf = req.user.userId === targetUserId;
    const isManager = req.user.isSuperAdmin || req.user.role === 'academy_admin' || (req.user.permissions && req.user.permissions.includes('view_coaches'));
    if (!isSelf && !isManager) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view compensation details' });
    }

    const effectiveProfile = PayrollService.getEffectiveSalaryProfile(db, targetUserId);
    const history = db.prepare(`
      SELECT * FROM staff_salary_profiles
      WHERE user_id = ?
      ORDER BY effective_from DESC
    `).all(targetUserId);

    res.json({
      success: true,
      effectiveProfile,
      history,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/compensation/employee/:userId
 * Configures an employee's compensation policy independently from their work schedule
 */
academyRouter.post('/compensation/employee/:userId', (req, res) => {
  try {
    const db = req.tenantDb;
    const targetUserId = Number(req.params.userId);

    if (!req.user.isSuperAdmin && req.user.role !== 'academy_admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required to configure compensation policies.' });
    }

    const {
      salary_mode,
      base_rate,
      currency,
      scheduled_daily_hours,
      scheduled_days_per_week,
      overtime_eligible,
      overtime_rate_multiplier,
      deduction_policy,
      effective_from,
      effective_to,
      notes,
    } = req.body;

    const validModes = ['monthly', 'hourly', 'per_day', 'per_session', 'per_minute'];
    if (!salary_mode || !validModes.includes(salary_mode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid compensation type. Must be one of: ${validModes.join(', ')}`,
      });
    }

    if (base_rate === undefined || Number(base_rate) < 0) {
      return res.status(400).json({ success: false, error: 'A valid non-negative rate is required.' });
    }

    const targetUser = db.prepare('SELECT name, role FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }

    const effFrom = effective_from || new Date().toISOString().split('T')[0];
    const effTo = effective_to || null;

    if (!effTo) {
      const prev = db.prepare(`
        SELECT id FROM staff_salary_profiles
        WHERE user_id = ? AND effective_to IS NULL AND effective_from < ?
      `).all(targetUserId, effFrom);

      const dayBefore = new Date(new Date(effFrom + 'T00:00:00').getTime() - 86400000).toISOString().split('T')[0];
      for (const p of prev) {
        db.prepare('UPDATE staff_salary_profiles SET effective_to = ? WHERE id = ?').run(dayBefore, p.id);
      }
    }

    const ins = db.prepare(`
      INSERT INTO staff_salary_profiles (
        academy_id, user_id, salary_mode, base_rate, currency, scheduled_daily_hours,
        scheduled_days_per_week, overtime_eligible, overtime_rate_multiplier,
        deduction_policy, effective_from, effective_to, is_active, notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      req.academy.id,
      targetUserId,
      salary_mode,
      Number(base_rate),
      currency || 'INR',
      scheduled_daily_hours !== undefined ? Number(scheduled_daily_hours) : 8.0,
      scheduled_days_per_week !== undefined ? Number(scheduled_days_per_week) : 6,
      overtime_eligible !== undefined ? (overtime_eligible ? 1 : 0) : 1,
      overtime_rate_multiplier !== undefined ? Number(overtime_rate_multiplier) : 1.0,
      deduction_policy || 'working_days',
      effFrom,
      effTo,
      notes || null,
      req.user.userId,
      req.user.userId
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details, ip_address)
      VALUES (?, ?, ?, 'UPDATE_COMPENSATION', 'staff_salary_profiles', ?, ?)
    `).run(
      req.user.userId,
      req.user.name,
      req.user.role,
      `Configured compensation policy for ${targetUser.name}: ${salary_mode} @ ₹${base_rate}`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Compensation policy configured successfully for ${targetUser.name}`,
      profileId: ins.lastInsertRowid,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/compensation/preview
 * Interactive calculation and reference preview of employee setup
 */
academyRouter.post('/compensation/preview', (req, res) => {
  try {
    const {
      compensation_type,
      scheduled_hours,
      working_days_per_week,
      rate,
      allow_overtime,
      currency = 'INR',
    } = req.body;

    const numHours = Number(scheduled_hours) || 4;
    const numDays = Number(working_days_per_week) || 6;
    const numRate = Number(rate) || 0;
    const symbol = currency === 'INR' ? '₹' : (currency || '₹');

    const weeklyScheduledHours = Number((numHours * numDays).toFixed(1));
    const monthlyScheduledHours = Math.round((weeklyScheduledHours * 52) / 12);

    let referenceText = '';
    let estimatedMonthly = 0;

    if (compensation_type === 'monthly') {
      estimatedMonthly = numRate;
      referenceText = `${symbol}${numRate.toLocaleString()}/month: Fixed monthly salary for a scheduled ${numHours}-hour day (${numDays} days/week). Working hours are not multiplied by monthly salary; attendance deductions and proration follow the assigned policy.`;
    } else if (compensation_type === 'hourly') {
      estimatedMonthly = Number((monthlyScheduledHours * numRate).toFixed(2));
      referenceText = `${symbol}${numRate.toLocaleString()}/hour: Hourly rate based on approved payable hours. Estimated monthly earnings: ${symbol}${estimatedMonthly.toLocaleString()} (based on ${monthlyScheduledHours} scheduled hours/month).`;
    } else if (compensation_type === 'per_day') {
      const approxMonthlyDays = Math.round((numDays * 52) / 12);
      estimatedMonthly = approxMonthlyDays * numRate;
      referenceText = `${symbol}${numRate.toLocaleString()}/day: Daily rate based on eligible payable working days. Estimated monthly earnings: ${symbol}${estimatedMonthly.toLocaleString()} (~${approxMonthlyDays} scheduled days/month).`;
    } else if (compensation_type === 'per_session') {
      referenceText = `${symbol}${numRate.toLocaleString()}/session: Per completed or eligible coaching session. Cancellations and absent sessions are handled per academy policy.`;
    } else if (compensation_type === 'per_minute') {
      estimatedMonthly = Math.round(monthlyScheduledHours * 60 * numRate);
      referenceText = `${symbol}${numRate}/minute: Payable for approved active duty minutes.`;
    }

    const summaryText = `[Employee Setup Summary]\nCompensation: ${(compensation_type || 'monthly').toUpperCase()} @ ${symbol}${numRate}\nSchedule: ${numHours}h/day, ${numDays} days/week\nWeekly Hours: ${weeklyScheduledHours}h | Monthly Avg: ${monthlyScheduledHours}h\nOvertime: ${allow_overtime ? 'Eligible' : 'Not Permitted'}\nPolicy Rule: ${referenceText}`;

    res.json({
      success: true,
      preview: {
        weeklyScheduledHours,
        monthlyScheduledHours,
        estimatedMonthly,
        referenceText,
        summaryText,
        overtimeAllowed: !!allow_overtime,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/holidays
 * Returns list of academy & branch holidays
 */
academyRouter.get('/holidays', (req, res) => {
  try {
    const db = req.tenantDb;
    const holidays = db.prepare(`
      SELECT h.*, b.name as branch_name 
      FROM academy_holidays h
      LEFT JOIN branches b ON h.branch_id = b.id
      WHERE h.academy_id = ?
      ORDER BY h.holiday_date ASC
    `).all(req.academy.id);

    res.json({ success: true, holidays });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/holidays
 * Adds a holiday to the academy calendar
 */
academyRouter.post('/holidays', (req, res) => {
  try {
    const db = req.tenantDb;
    if (!req.user.isSuperAdmin && req.user.role !== 'academy_admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
    }

    const { holiday_date, name, branch_id, is_paid = 1 } = req.body;
    if (!holiday_date || !name) {
      return res.status(400).json({ success: false, error: 'holiday_date and name are required' });
    }

    const ins = db.prepare(`
      INSERT INTO academy_holidays (academy_id, branch_id, holiday_date, name, is_paid)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.academy.id, branch_id || null, holiday_date, name.trim(), is_paid ? 1 : 0);

    res.status(201).json({
      success: true,
      message: `Holiday '${name}' added successfully`,
      holidayId: ins.lastInsertRowid,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/academy/holidays/:id
 * Removes a holiday from the academy calendar
 */
academyRouter.delete('/holidays/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    if (!req.user.isSuperAdmin && req.user.role !== 'academy_admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
    }

    db.prepare('DELETE FROM academy_holidays WHERE id = ? AND academy_id = ?').run(Number(req.params.id), req.academy.id);
    res.json({ success: true, message: 'Holiday removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// OVERTIME & APPROVAL WORKFLOW
// ==========================================

/**
 * POST /api/academy/overtime/requests
 * Submits an overtime event (auto-approved <= threshold, pending > threshold)
 */
academyRouter.post('/overtime/requests', (req, res) => {
  try {
    const db = req.tenantDb;
    const {
      branch_id,
      user_id,
      session_id,
      date,
      scheduled_start_time,
      scheduled_end_time,
      actual_start_time,
      actual_end_time,
      overtime_minutes,
      reason,
    } = req.body;

    const targetUserId = user_id ? Number(user_id) : req.user.userId;

    const result = OvertimeService.recordOvertime(db, {
      academyId: req.academy.id,
      branchId: branch_id ? Number(branch_id) : null,
      userId: targetUserId,
      sessionId: session_id ? Number(session_id) : null,
      date: date || new Date().toISOString().split('T')[0],
      scheduledStartTime: scheduled_start_time,
      scheduledEndTime: scheduled_end_time,
      actualStartTime: actual_start_time,
      actualEndTime: actual_end_time,
      overtimeMinutes: overtime_minutes !== undefined ? Number(overtime_minutes) : null,
      reason,
      requestedBy: req.user.userId,
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/overtime/requests
 * Lists overtime requests with role-based filtering
 */
academyRouter.get('/overtime/requests', (req, res) => {
  try {
    const db = req.tenantDb;
    const { branch_id, status, year_month, user_id } = req.query;

    let targetUserId = null;
    if (req.user.role === 'coach') {
      targetUserId = req.user.userId;
    } else if (user_id) {
      targetUserId = Number(user_id);
    }

    const requests = OvertimeService.getOvertimeRequests(db, {
      academyId: req.academy.id,
      userId: targetUserId,
      branchId: branch_id ? Number(branch_id) : null,
      status: status || null,
      yearMonth: year_month || null,
    });

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/overtime/requests/:id
 * Approves or rejects overtime request (branch admin or academy admin)
 */
academyRouter.put('/overtime/requests/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const requestId = Number(req.params.id);
    const { status, reviewer_notes } = req.body;

    // Check authority: must be academy_admin, branch_admin, or super_admin
    const allowedRoles = ['academy_admin', 'branch_admin', 'super_admin'];
    if (!allowedRoles.includes(req.user.role) && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only authorized branch or academy admins may approve overtime.' });
    }

    const result = OvertimeService.reviewOvertime(db, requestId, {
      status,
      reviewerId: req.user.userId,
      reviewerNotes: reviewer_notes || null,
      academyId: req.academy.id,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// UNIFIED APPROVALS INBOX
// ==========================================

/**
 * GET /api/academy/approvals
 * Returns pending attendance corrections and pending overtime requests for admins
 */
academyRouter.get('/approvals', (req, res) => {
  try {
    const db = req.tenantDb;

    const pendingCorrections = db.prepare(`
      SELECT ac.*, b.name as batch_name, s.first_name, s.last_name, u.name as requester_name
      FROM attendance_corrections ac
      JOIN batches b ON ac.batch_id = b.id
      LEFT JOIN students s ON ac.student_id = s.id
      JOIN users u ON ac.requested_by = u.id
      WHERE ac.status = 'pending'
      ORDER BY ac.created_at DESC
    `).all();

    const pendingOvertime = db.prepare(`
      SELECT o.*, u.name as employee_name, u.email as employee_email, u.role as employee_role,
             b.name as branch_name
      FROM overtime_requests o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN branches b ON o.branch_id = b.id
      WHERE o.academy_id = ? AND o.status = 'pending'
      ORDER BY o.created_at DESC
    `).all(req.academy.id);

    res.json({
      success: true,
      pendingCorrections,
      pendingOvertime,
      totalPending: pendingCorrections.length + pendingOvertime.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ACADEMY POLICY SETTINGS
// ==========================================

/**
 * GET /api/academy/settings/policy
 */
academyRouter.get('/settings/policy', (req, res) => {
  try {
    const db = req.tenantDb;
    const policy = OvertimeService.getAcademyPolicy(db, req.academy.id);
    res.json({ success: true, policy });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/settings/policy
 */
academyRouter.put('/settings/policy', (req, res) => {
  try {
    const db = req.tenantDb;
    if (req.user.role !== 'academy_admin' && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Only Academy Admins may update policy settings.' });
    }

    const {
      attendance_cutoff_days,
      overtime_threshold_minutes,
      statement_visibility_day,
      expected_payday,
      overtime_compensation_mode,
      timezone,
      allow_future_attendance,
      default_color_theme,
    } = req.body;

    db.prepare(`
      INSERT INTO academy_policy_settings (
        academy_id, attendance_cutoff_days, overtime_threshold_minutes,
        statement_visibility_day, expected_payday, overtime_compensation_mode,
        timezone, allow_future_attendance, default_color_theme, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(academy_id) DO UPDATE SET
        attendance_cutoff_days = COALESCE(excluded.attendance_cutoff_days, attendance_cutoff_days),
        overtime_threshold_minutes = COALESCE(excluded.overtime_threshold_minutes, overtime_threshold_minutes),
        statement_visibility_day = COALESCE(excluded.statement_visibility_day, statement_visibility_day),
        expected_payday = COALESCE(excluded.expected_payday, expected_payday),
        overtime_compensation_mode = COALESCE(excluded.overtime_compensation_mode, overtime_compensation_mode),
        timezone = COALESCE(excluded.timezone, timezone),
        allow_future_attendance = COALESCE(excluded.allow_future_attendance, allow_future_attendance),
        default_color_theme = COALESCE(excluded.default_color_theme, default_color_theme),
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.academy.id,
      attendance_cutoff_days !== undefined ? Number(attendance_cutoff_days) : 2,
      overtime_threshold_minutes !== undefined ? Number(overtime_threshold_minutes) : 30,
      statement_visibility_day !== undefined ? Number(statement_visibility_day) : 25,
      expected_payday !== undefined ? Number(expected_payday) : 1,
      overtime_compensation_mode || 'standard_rate',
      timezone || 'Asia/Kolkata',
      allow_future_attendance !== undefined ? (allow_future_attendance ? 1 : 0) : 0,
      default_color_theme || 'blue'
    );

    const updated = OvertimeService.getAcademyPolicy(db, req.academy.id);
    res.json({ success: true, message: 'Academy policy settings updated successfully', policy: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// EVENTS & STUDENT PARTICIPATION
// ==========================================

/**
 * GET /api/academy/events
 */
academyRouter.get('/events', (req, res) => {
  try {
    const db = req.tenantDb;
    const { status, type, search, page, limit } = req.query;

    let baseQuery = `FROM events e WHERE e.academy_id = ?`;
    const params = [req.academy.id];

    if (status) {
      baseQuery += ` AND e.status = ?`;
      params.push(status);
    }
    if (type) {
      baseQuery += ` AND e.type = ?`;
      params.push(type);
    }
    if (search) {
      baseQuery += ` AND (e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ? OR e.location LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params);
    const total = countRow ? countRow.total : 0;

    let selectQuery = `
      SELECT e.*,
             (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) as total_invited,
             (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status = 'interested') as interested_count,
             (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status = 'not_interested') as not_interested_count,
             (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status = 'invited') as no_response_count,
             (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.registration_status = 'confirmed') as confirmed_count,
             (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.registration_status = 'pending') as pending_count
      ${baseQuery}
      ORDER BY e.event_date DESC, e.id DESC
    `;

    if (page || limit) {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.max(1, parseInt(limit) || 20);
      const offset = (p - 1) * l;
      selectQuery += ` LIMIT ? OFFSET ?`;
      const events = db.prepare(selectQuery).all(...params, l, offset);
      return res.json({
        success: true,
        events,
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
      });
    } else {
      const events = db.prepare(selectQuery).all(...params);
      return res.json({ success: true, events, total, page: 1, limit: total, totalPages: 1 });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/events/candidates
 * Returns eligible students for manual selection across branches and batches
 */
academyRouter.get('/events/candidates', (req, res) => {
  try {
    const db = req.tenantDb;
    const candidates = db.prepare(`
      SELECT s.id, s.student_code, s.first_name, s.last_name, s.email, s.phone,
             b.name as branch_name, bt.name as batch_name
      FROM students s
      LEFT JOIN branches b ON b.id = s.branch_id
      LEFT JOIN student_batch_enrollments sbe ON sbe.student_id = s.id AND sbe.status = 'active'
      LEFT JOIN batches bt ON bt.id = sbe.batch_id
      WHERE s.status = 'active'
      ORDER BY s.first_name ASC
    `).all();

    res.json({ success: true, candidates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/events
 */
academyRouter.post('/events', (req, res) => {
  try {
    const db = req.tenantDb;
    const result = EventService.createEvent(db, req.academy.id, req.body, req.user.userId);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/events/:id
 */
academyRouter.get('/events/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const eventId = Number(req.params.id);
    const result = EventService.getEventWithRoster(db, req.academy.id, eventId);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/events/:id
 */
academyRouter.put('/events/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const eventId = Number(req.params.id);
    const result = EventService.updateEvent(db, req.academy.id, eventId, req.body, req.user.userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/events/:id/publish
 */
academyRouter.post('/events/:id/publish', (req, res) => {
  try {
    const db = req.tenantDb;
    const eventId = Number(req.params.id);
    const result = EventService.publishEvent(db, req.academy.id, eventId, req.user.userId);
    res.json(result);
  } catch (err) {
    const statusCode = err.statusCode || (err.errors ? 422 : 400);
    res.status(statusCode).json({ success: false, error: err.message, errors: err.errors || [err.message] });
  }
});

/**
 * POST /api/academy/events/:id/cancel
 */
academyRouter.post('/events/:id/cancel', (req, res) => {
  try {
    const db = req.tenantDb;
    const eventId = Number(req.params.id);
    const reason = req.body.reason || req.body.cancellation_reason;
    const result = EventService.cancelEvent(db, req.academy.id, eventId, reason, req.user.userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/events/:id/participants
 */
academyRouter.get('/events/:id/participants', (req, res) => {
  try {
    const db = req.tenantDb;
    const eventId = Number(req.params.id);
    const result = EventService.getEventWithRoster(db, req.academy.id, eventId);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/events/:id/participants/:participantId/status
 * Moderates student registration: confirmed, rejected, waitlisted
 */
academyRouter.post('/events/:id/participants/:participantId/status', (req, res) => {
  try {
    const db = req.tenantDb;
    const eventId = Number(req.params.id);
    const participantId = Number(req.params.participantId);
    const status = req.body.registration_status || req.body.status;
    const reason = req.body.reason || req.body.notes;

    const result = EventService.moderateRegistration(
      db,
      req.academy.id,
      eventId,
      participantId,
      status,
      req.user.userId,
      reason
    );

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/events/:id/export
 */
academyRouter.get('/events/:id/export', (req, res) => {
  try {
    const db = req.tenantDb;
    const eventId = Number(req.params.id);
    const csvContent = EventService.exportRosterCsv(db, req.academy.id, eventId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="event_${eventId}_participants.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// ACADEMY SUBSCRIPTION & QUOTA USAGE (READ-ONLY FOR ACADEMY ADMIN)
// ==========================================

/**
 * GET /api/academy/quota-summary
 * Allows Academy Admin to view effective limits, current usage, and over-limit warnings
 */
academyRouter.get('/quota-summary', (req, res) => {
  try {
    const summary = QuotaService.getAcademyQuotaSummary(req.academy.id);
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/permissions
 * Lists catalog of all available permissions grouped by category
 */
academyRouter.get('/permissions', (req, res) => {
  try {
    const permissionsCatalog = [
      {
        category: 'Students',
        icon: 'fa-users',
        permissions: [
          { key: 'view_students', label: 'View Students Directory', desc: 'Browse student records, profiles, and batches' },
          { key: 'create_students', label: 'Enroll New Students', desc: 'Add new student profiles to the academy' },
          { key: 'edit_students', label: 'Edit Student Details', desc: 'Update contact info, guardians, and medical notes' },
          { key: 'delete_students', label: 'Delete / Archive Students', desc: 'Remove student records from the roster' },
          { key: 'transfer_students', label: 'Batch Transfers', desc: 'Transfer students between batches and branches' },
        ],
      },
      {
        category: 'Branches',
        icon: 'fa-code-branch',
        permissions: [
          { key: 'view_branches', label: 'View Branches', desc: 'Access list of branch locations and training facilities' },
          { key: 'manage_branches', label: 'Create & Edit Branches', desc: 'Add or modify branch facilities and contact info' },
          { key: 'manage_facilities', label: 'Facilities & Equipment', desc: 'Track sports courts, inventory, and equipment' },
        ],
      },
      {
        category: 'Batches & Schedules',
        icon: 'fa-calendar-days',
        permissions: [
          { key: 'view_batches', label: 'View Batches', desc: 'View training schedules, times, and days of week' },
          { key: 'create_batches', label: 'Create Batches', desc: 'Schedule new training batches for branches' },
          { key: 'edit_batches', label: 'Edit Batches', desc: 'Modify batch times, capacities, and assigned coaches' },
          { key: 'delete_batches', label: 'Delete Batches', desc: 'Remove empty training batches' },
        ],
      },
      {
        category: 'Attendance & Progression',
        icon: 'fa-clipboard-user',
        permissions: [
          { key: 'view_attendance', label: 'View Attendance', desc: 'Access daily and historical attendance registers' },
          { key: 'mark_attendance', label: 'Mark Attendance & Techniques', desc: 'Take roll call and tag practiced syllabus techniques' },
          { key: 'approve_late_attendance', label: 'Approve Beyond 2-Day Cutoff', desc: 'Authorize retroactive attendance marking' },
        ],
      },
      {
        category: 'Sports Syllabus & Belts',
        icon: 'fa-graduation-cap',
        permissions: [
          { key: 'view_syllabus', label: 'View Curriculum', desc: 'Browse syllabus categories, techniques, and belts' },
          { key: 'manage_syllabus', label: 'Manage Syllabus', desc: 'Create, reorder, or edit techniques and levels' },
          { key: 'evaluate_progression', label: 'Belt Evaluations', desc: 'Promote students and issue belt certificates' },
        ],
      },
      {
        category: 'Coaches & Staff',
        icon: 'fa-user-ninja',
        permissions: [
          { key: 'view_coaches', label: 'View Coaches', desc: 'View coach directories, assignments, and sports' },
          { key: 'manage_coaches', label: 'Manage Coaches', desc: 'Add or update coach specializations and profiles' },
          { key: 'view_leaves', label: 'View Leaves', desc: 'View coach and staff leave applications' },
          { key: 'manage_leaves', label: 'Approve / Reject Leaves', desc: 'Authorize or reject staff leave requests' },
        ],
      },
      {
        category: 'Fees & Financials',
        icon: 'fa-file-invoice-dollar',
        permissions: [
          { key: 'view_fees', label: 'View Fees & Invoices', desc: 'Inspect fee ledgers, balances, and collection history' },
          { key: 'collect_fees', label: 'Collect Fees & Receipts', desc: 'Process payments, generate invoices, and print receipts' },
          { key: 'override_fees', label: 'Fee Overrides & Discounts', desc: 'Apply student-specific rate overrides and discount caps' },
          { key: 'pause_fees', label: 'Fee Pause Management', desc: 'Request or approve fee billing pauses' },
        ],
      },
      {
        category: 'Staff Payroll & HR',
        icon: 'fa-money-check-dollar',
        permissions: [
          { key: 'view_my_salary', label: 'View Personal Salary', desc: 'Access personal monthly salary statements and payouts' },
          { key: 'view_payroll', label: 'Staff Payroll Dashboard', desc: 'View academy-wide payroll records and statements' },
          { key: 'approve_overtime', label: 'Approve Overtime (>30m)', desc: 'Review and approve coach overtime requests' },
          { key: 'finalize_payroll', label: 'Finalize Monthly Payroll', desc: 'Lock payroll periods and process disbursements' },
        ],
      },
      {
        category: 'Events & Tournaments',
        icon: 'fa-trophy',
        permissions: [
          { key: 'view_events', label: 'View Events', desc: 'Browse upcoming tournaments, seminars, and camps' },
          { key: 'manage_events', label: 'Manage Events', desc: 'Create, edit, or publish academy events and fees' },
          { key: 'approve_event_registrations', label: 'Approve Registrations', desc: 'Manage participant confirmations and waivers' },
        ],
      },
      {
        category: 'Roles & Administration',
        icon: 'fa-shield-halved',
        permissions: [
          { key: 'view_roles', label: 'View Roles & Access Control', desc: 'Inspect role matrix and staff assignments' },
          { key: 'manage_roles', label: 'Create & Edit Roles', desc: 'Configure custom roles and assign capability sets' },
          { key: 'assign_user_roles', label: 'Assign Staff Roles', desc: 'Change employee roles and custom permission overrides' },
          { key: 'view_audit_logs', label: 'View Audit Logs', desc: 'Inspect chronological tenant audit trail' },
          { key: 'manage_policies', label: 'Manage Policy Settings', desc: 'Configure cutoff thresholds, paydays, and rules' },
        ],
      },
      {
        category: 'Branding & Dynamic Themes',
        icon: 'fa-palette',
        permissions: [
          { key: 'customize_theme', label: 'Customize Personal Theme', desc: 'Allows users to personalize their UI accent color theme' },
          { key: 'manage_branding', label: 'Manage Academy Theme & Defaults', desc: 'Configure default brand color theme for all academy users' },
        ],
      },
    ];

    res.json({ success: true, categories: permissionsCatalog });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/roles
 * Lists all academy roles with user counts and permissions
 */
academyRouter.get('/roles', (req, res) => {
  try {
    const db = req.tenantDb;
    const roles = db.prepare('SELECT * FROM academy_roles ORDER BY id ASC').all();

    const rolesWithCounts = roles.map(r => {
      let perms = [];
      try {
        perms = JSON.parse(r.permissions || '[]');
      } catch (e) {
        perms = [];
      }

      const userCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get(r.name).c;

      return {
        id: r.id,
        name: r.name,
        display_name: r.display_name || r.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: r.description || '',
        permissions: perms,
        theme_color: r.theme_color || 'blue',
        is_system: Number(r.is_system) === 1 || ['academy_admin', 'academy_staff', 'coach', 'student'].includes(r.name),
        user_count: userCount,
      };
    });

    res.json({ success: true, roles: rolesWithCounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/roles
 * Creates a new custom role
 */
academyRouter.post('/roles', (req, res) => {
  try {
    const db = req.tenantDb;
    const { name, display_name, description, permissions, theme_color } = req.body;

    if (!name && !display_name) {
      return res.status(400).json({ success: false, error: 'Role name or display name is required' });
    }

    const cleanName = (name || display_name).toLowerCase().trim().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    const cleanDisplayName = display_name || cleanName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const existing = db.prepare('SELECT id FROM academy_roles WHERE LOWER(name) = ?').get(cleanName);
    if (existing) {
      return res.status(400).json({ success: false, error: `A role with identifier '${cleanName}' already exists` });
    }

    const permsArray = Array.isArray(permissions) ? permissions : [];
    const insert = db.prepare(`
      INSERT INTO academy_roles (name, display_name, description, permissions, is_system, theme_color)
      VALUES (?, ?, ?, ?, 0, ?)
    `);

    const result = insert.run(cleanName, cleanDisplayName, description || '', JSON.stringify(permsArray), theme_color || 'blue');

    res.status(201).json({
      success: true,
      roleId: result.lastInsertRowid,
      message: `Custom role '${cleanDisplayName}' created successfully`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/roles/:id
 * Updates role display name, description, permissions, and theme_color
 */
academyRouter.put('/roles/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const roleId = Number(req.params.id);
    const { display_name, description, permissions, theme_color } = req.body;

    const existing = db.prepare('SELECT * FROM academy_roles WHERE id = ?').get(roleId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }

    const cleanDisplayName = display_name || existing.display_name || existing.name;
    const permsArray = Array.isArray(permissions) ? permissions : (existing.name === 'academy_admin' ? ['all'] : []);

    db.prepare(`
      UPDATE academy_roles 
      SET display_name = ?, description = ?, permissions = ?, theme_color = COALESCE(?, theme_color)
      WHERE id = ?
    `).run(cleanDisplayName, description || existing.description || '', JSON.stringify(permsArray), theme_color || null, roleId);

    res.json({
      success: true,
      message: `Role '${cleanDisplayName}' updated successfully`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/academy/roles/:id
 * Safely deletes custom role
 */
academyRouter.delete('/roles/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const roleId = Number(req.params.id);

    const existing = db.prepare('SELECT * FROM academy_roles WHERE id = ?').get(roleId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }

    if (existing.is_system || ['academy_admin', 'academy_staff', 'coach', 'student'].includes(existing.name)) {
      return res.status(400).json({ success: false, error: `System role '${existing.name}' is essential and cannot be deleted` });
    }

    const assignedUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get(existing.name).c;
    if (assignedUsers > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete role '${existing.display_name || existing.name}' because ${assignedUsers} employee(s) are currently assigned to it. Reassign them first.`,
      });
    }

    db.prepare('DELETE FROM academy_roles WHERE id = ?').run(roleId);
    res.json({ success: true, message: `Role '${existing.display_name || existing.name}' deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/users
 * Lists staff users belonging to this academy with custom permissions and coach status
 */
academyRouter.get('/users', (req, res) => {
  try {
    const db = req.tenantDb;
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.phone, u.status, u.custom_permissions, u.theme_color, u.created_at,
             c.id as coach_id, c.specializations, c.salary_type, c.salary_amount, s.name as sport_name
      FROM users u
      LEFT JOIN coaches c ON c.user_id = u.id OR LOWER(c.email) = LOWER(u.email)
      LEFT JOIN sports s ON s.id = c.sport_id
      ORDER BY u.id DESC
    `).all();

    const parsedUsers = users.map(u => {
      let customPerms = [];
      try {
        customPerms = JSON.parse(u.custom_permissions || '[]');
      } catch (e) {
        customPerms = [];
      }
      return {
        ...u,
        custom_permissions: customPerms,
        theme_color: u.theme_color || null,
      };
    });

    res.json({ success: true, users: parsedUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/users
 * Creates a new staff user with quota enforcement (users quota and coaches subset)
 */
academyRouter.post('/users', (req, res) => {
  try {
    const db = req.tenantDb;
    const { name, email, password, role, phone, custom_permissions, theme_color } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Name and email are required' });
    }

    const assignedRole = role || 'academy_staff';

    // Enforce total users quota
    QuotaService.assertCanCreate(req.academy.id, 'users', 1);

    // If role is coach, enforce coach quota subset
    if (assignedRole === 'coach') {
      QuotaService.assertCanCreate(req.academy.id, 'coaches', 1);
    }

    const passwordHash = bcrypt.hashSync(password || 'password123', 10);
    const customPermsJson = Array.isArray(custom_permissions) ? JSON.stringify(custom_permissions) : '[]';

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone, status, custom_permissions, theme_color)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(name.trim(), email.trim().toLowerCase(), passwordHash, assignedRole, phone || null, customPermsJson, theme_color || null);

    const centralDb = getCentralDb();
    centralDb.prepare(`
      INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role)
      VALUES (?, ?, ?)
    `).run(email.trim().toLowerCase(), req.academy.id, assignedRole);

    res.status(201).json({
      success: true,
      userId: result.lastInsertRowid,
      message: 'Staff user created successfully',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/users/:id/role
 * Changes user role and updates custom permissions with role-transition quota check
 */
academyRouter.put('/users/:id/role', (req, res) => {
  try {
    const db = req.tenantDb;
    const userId = Number(req.params.id);
    const { role, custom_permissions, theme_color } = req.body;

    if (!role) {
      return res.status(400).json({ success: false, error: 'Role is required' });
    }

    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Role conversion check: if converting to coach, verify coaches quota!
    if (existingUser.role !== 'coach' && role === 'coach') {
      QuotaService.assertCanCreate(req.academy.id, 'coaches', 1);
    }

    const customPermsJson = Array.isArray(custom_permissions)
      ? JSON.stringify(custom_permissions)
      : (custom_permissions !== undefined ? JSON.stringify(custom_permissions) : (existingUser.custom_permissions || '[]'));

    let updateTheme = existingUser.theme_color;
    if (theme_color !== undefined) {
      updateTheme = (theme_color === '' || theme_color === 'inherit' || theme_color === null) ? null : theme_color;
    }

    db.prepare('UPDATE users SET role = ?, custom_permissions = ?, theme_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(role, customPermsJson, updateTheme, userId);

    const centralDb = getCentralDb();
    centralDb.prepare('UPDATE academy_users_lookup SET role = ? WHERE email = ? AND academy_id = ?')
      .run(role, existingUser.email, req.academy.id);

    res.json({
      success: true,
      message: `User '${existingUser.name}' updated to role '${role}' with permissions synced`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// STAFF TIME PUNCHES & OVERTIME TRACKING
// ==========================================

function parseIsoTime(str) {
  if (!str) return new Date();
  const s = String(str).trim();
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date(s.replace(' ', 'T') + 'Z');
}

/**
 * GET /api/academy/punches/status
 * Returns current punch state, today's logged hours, and active live session
 */
academyRouter.get('/punches/status', (req, res) => {
  try {
    const db = req.tenantDb;
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    // Find any active punch
    const activePunch = db.prepare(`
      SELECT * FROM staff_time_punches 
      WHERE user_id = ? AND status = 'in_progress' 
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    // Find all punches for today
    const todayPunches = db.prepare(`
      SELECT * FROM staff_time_punches 
      WHERE user_id = ? AND punch_date = ? 
      ORDER BY id ASC
    `).all(userId, today);

    // Sum completed duration
    let completedMinutes = 0;
    let totalOvertime = 0;
    for (const p of todayPunches) {
      if (p.status === 'completed') {
        completedMinutes += (p.duration_minutes || 0);
        totalOvertime += (p.overtime_minutes || 0);
      }
    }

    let activeDurationMinutes = 0;
    if (activePunch) {
      const inTime = parseIsoTime(activePunch.punch_in_time).getTime();
      const now = Date.now();
      if (!isNaN(inTime) && now >= inTime) {
        activeDurationMinutes = Math.floor((now - inTime) / 60000);
      }
    }

    const totalMinutesToday = completedMinutes + activeDurationMinutes;
    // Policy settings check (standard shift = 480 mins / 8 hrs)
    const policy = db.prepare('SELECT overtime_threshold_minutes FROM academy_policy_settings WHERE academy_id = ?').get(req.academy.id);
    const standardDailyMinutes = 480;
    const calculatedOvertime = Math.max(0, totalMinutesToday - standardDailyMinutes);

    // Enrich today punches with calculated time differences
    const enrichedTodayPunches = todayPunches.map(p => {
      const inDate = parseIsoTime(p.punch_in_time);
      const outDate = p.punch_out_time ? parseIsoTime(p.punch_out_time) : (p.status === 'in_progress' ? new Date() : null);
      let mins = p.duration_minutes;
      if (p.status === 'in_progress') {
        mins = Math.max(0, Math.floor((Date.now() - inDate.getTime()) / 60000));
      } else if (mins === null || mins === undefined) {
        mins = outDate ? Math.max(0, Math.round((outDate.getTime() - inDate.getTime()) / 60000)) : 0;
      }
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return {
        ...p,
        duration_minutes: mins,
        time_difference_text: hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`,
      };
    });

    res.json({
      success: true,
      isPunchedIn: !!activePunch,
      activePunch: activePunch ? {
        ...activePunch,
        currentDurationMinutes: activeDurationMinutes,
        timeDifferenceText: `${Math.floor(activeDurationMinutes / 60)}h ${activeDurationMinutes % 60}m`,
      } : null,
      todayPunches: enrichedTodayPunches,
      stats: {
        completedMinutes,
        activeDurationMinutes,
        totalMinutesToday,
        standardDailyMinutes,
        overtimeMinutes: calculatedOvertime,
        punchesCountToday: todayPunches.length,
      },
      policy: {
        overtimeThresholdMinutes: policy ? policy.overtime_threshold_minutes : 30,
        standardShiftMinutes: standardDailyMinutes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/punches/in
 * Punches in the authenticated staff member
 */
academyRouter.post('/punches/in', (req, res) => {
  try {
    const db = req.tenantDb;
    const userId = req.user.userId;

    const existingActive = db.prepare(`
      SELECT id, punch_in_time FROM staff_time_punches 
      WHERE user_id = ? AND status = 'in_progress'
    `).get(userId);

    if (existingActive) {
      return res.status(400).json({ 
        success: false, 
        error: `Already punched in since ${existingActive.punch_in_time}. Please punch out first.` 
      });
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const nowIso = now.toISOString();
    const notes = req.body.notes || null;
    const punchType = req.body.punch_type || 'duty';

    const insert = db.prepare(`
      INSERT INTO staff_time_punches 
        (academy_id, user_id, punch_date, punch_in_time, status, punch_type, ip_address, notes)
      VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?)
    `).run(req.academy.id, userId, today, nowIso, punchType, req.ip, notes);

    const newPunch = db.prepare('SELECT * FROM staff_time_punches WHERE id = ?').get(insert.lastInsertRowid);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details, ip_address)
      VALUES (?, ?, ?, 'PUNCH_IN', 'staff_time_punches', ?, ?)
    `).run(userId, req.user.name, req.user.role, `Punched in at ${nowIso}`, req.ip);

    res.json({
      success: true,
      message: `Punched in successfully at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      punch: newPunch,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/punches/out
 * Punches out the authenticated staff member and calculates duration + overtime
 */
academyRouter.post('/punches/out', (req, res) => {
  try {
    const db = req.tenantDb;
    const userId = req.user.userId;

    const activePunch = db.prepare(`
      SELECT * FROM staff_time_punches 
      WHERE user_id = ? AND status = 'in_progress' 
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    if (!activePunch) {
      return res.status(400).json({ success: false, error: 'No active punch found to punch out.' });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const inDate = parseIsoTime(activePunch.punch_in_time);
    const durationMinutes = Math.max(1, Math.round((now.getTime() - inDate.getTime()) / 60000));
    const durHrs = Math.floor(durationMinutes / 60);
    const durMins = durationMinutes % 60;
    const timeDifferenceFormatted = durHrs > 0 ? `${durHrs}h ${durMins}m` : `${durMins}m`;

    // Calculate prior completed minutes today to detect overtime
    const prev = db.prepare(`
      SELECT COALESCE(SUM(duration_minutes), 0) as total 
      FROM staff_time_punches 
      WHERE user_id = ? AND punch_date = ? AND id != ? AND status = 'completed'
    `).get(userId, activePunch.punch_date, activePunch.id);

    const priorTotal = prev.total || 0;
    const cumulativeDayMinutes = priorTotal + durationMinutes;
    let overtimeMinutes = 0;
    if (cumulativeDayMinutes > 480) {
      const priorOvertime = Math.max(0, priorTotal - 480);
      const totalOvertimeNow = cumulativeDayMinutes - 480;
      overtimeMinutes = Math.max(0, totalOvertimeNow - priorOvertime);
    }

    const appendNotes = req.body.notes 
      ? (activePunch.notes ? `${activePunch.notes} | ${req.body.notes}` : req.body.notes)
      : activePunch.notes;

    db.prepare(`
      UPDATE staff_time_punches 
      SET punch_out_time = ?, duration_minutes = ?, overtime_minutes = ?, status = 'completed', notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nowIso, durationMinutes, overtimeMinutes, appendNotes, activePunch.id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details, ip_address)
      VALUES (?, ?, ?, 'PUNCH_OUT', 'staff_time_punches', ?, ?)
    `).run(userId, req.user.name, req.user.role, `Punched out at ${nowIso} (Time difference: ${timeDifferenceFormatted})`, req.ip);

    res.json({
      success: true,
      message: `Punched out successfully. Time difference (session duration): ${timeDifferenceFormatted}`,
      durationMinutes,
      timeDifferenceFormatted,
      punchInTime: activePunch.punch_in_time,
      punchOutTime: nowIso,
      cumulativeDayMinutes,
      overtimeMinutes,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/punches/history
 * Returns punch log history for the current user or academy
 */
academyRouter.get('/punches/history', (req, res) => {
  try {
    const db = req.tenantDb;
    const isManager = req.user.isSuperAdmin || req.user.role === 'academy_admin' || (req.user.permissions && req.user.permissions.includes('view_coaches'));
    const viewAll = req.query.all === 'true' && isManager;

    let punches;
    if (viewAll) {
      punches = db.prepare(`
        SELECT p.*, u.name as user_name, u.role as user_role, u.email as user_email
        FROM staff_time_punches p
        JOIN users u ON p.user_id = u.id
        WHERE p.academy_id = ?
        ORDER BY p.punch_date DESC, p.id DESC
        LIMIT 60
      `).all(req.academy.id);
    } else {
      punches = db.prepare(`
        SELECT p.*, u.name as user_name, u.role as user_role, u.email as user_email
        FROM staff_time_punches p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ?
        ORDER BY p.punch_date DESC, p.id DESC
        LIMIT 40
      `).all(req.user.userId);
    }

    const enrichedPunches = punches.map(p => {
      const inDate = parseIsoTime(p.punch_in_time);
      const outDate = p.punch_out_time ? parseIsoTime(p.punch_out_time) : (p.status === 'in_progress' ? new Date() : null);
      let mins = p.duration_minutes;
      if (mins === null || mins === undefined || p.status === 'in_progress') {
        mins = outDate ? Math.max(0, Math.round((outDate.getTime() - inDate.getTime()) / 60000)) : 0;
      }
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return {
        ...p,
        duration_minutes: mins,
        time_difference_text: hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`,
      };
    });

    res.json({
      success: true,
      punches: enrichedPunches,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// INQUIRIES & ADMISSION WIZARD WORKFLOW
// ==========================================

/**
 * GET /api/academy/inquiries
 */
academyRouter.get('/inquiries', (req, res) => {
  try {
    const db = req.tenantDb;
    const result = InquiryService.listInquiries(db, req.academy.id, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/inquiries/check-duplicates
 */
academyRouter.get('/inquiries/check-duplicates', (req, res) => {
  try {
    const db = req.tenantDb;
    const { phone, student_name, current_inquiry_id } = req.query;
    const check = InquiryService.checkDuplicates(db, {
      phone,
      student_name,
      current_inquiry_id: current_inquiry_id ? Number(current_inquiry_id) : null,
    });
    res.json({ success: true, ...check });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/inquiries
 */
academyRouter.post('/inquiries', (req, res) => {
  try {
    const db = req.tenantDb;
    const inquiry = InquiryService.createInquiry(db, req.academy.id, req.body, req.user?.userId);
    res.status(201).json({ success: true, inquiry, message: 'Inquiry created successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/inquiries/:id
 */
academyRouter.put('/inquiries/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const inquiryId = Number(req.params.id);
    const { status, lost_reason, notes, next_followup_date, assigned_to_user_id, preferred_batch_id, branch_id, sport_id } = req.body;

    db.prepare(`
      UPDATE inquiries
      SET status = COALESCE(?, status),
          lost_reason = COALESCE(?, lost_reason),
          notes = COALESCE(?, notes),
          next_followup_date = COALESCE(?, next_followup_date),
          assigned_to_user_id = COALESCE(?, assigned_to_user_id),
          preferred_batch_id = COALESCE(?, preferred_batch_id),
          branch_id = COALESCE(?, branch_id),
          sport_id = COALESCE(?, sport_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND academy_id = ?
    `).run(
      status || null,
      lost_reason || null,
      notes || null,
      next_followup_date || null,
      assigned_to_user_id ? Number(assigned_to_user_id) : null,
      preferred_batch_id ? Number(preferred_batch_id) : null,
      branch_id ? Number(branch_id) : null,
      sport_id ? Number(sport_id) : null,
      inquiryId,
      req.academy.id
    );

    const updated = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(inquiryId);
    res.json({ success: true, inquiry: updated, message: 'Inquiry updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/inquiries/:id/trials
 * Schedules a trial class (Does NOT create fee liability)
 */
academyRouter.post('/inquiries/:id/trials', (req, res) => {
  try {
    const db = req.tenantDb;
    const trial = InquiryService.scheduleTrial(db, Number(req.params.id), req.body);
    res.status(201).json({ success: true, trial, message: 'Trial class scheduled successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/inquiries/:id/trials/:trialId
 * Updates trial attendance & feedback
 */
academyRouter.put('/inquiries/:id/trials/:trialId', (req, res) => {
  try {
    const db = req.tenantDb;
    const trialId = Number(req.params.trialId);
    const { attendance_status, feedback, coach_notes } = req.body;

    db.prepare(`
      UPDATE inquiry_trials
      SET attendance_status = COALESCE(?, attendance_status),
          feedback = COALESCE(?, feedback),
          coach_notes = COALESCE(?, coach_notes)
      WHERE id = ?
    `).run(attendance_status || null, feedback || null, coach_notes || null, trialId);

    if (attendance_status === 'attended') {
      db.prepare("UPDATE inquiries SET status = 'trial_completed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status NOT IN ('converted')")
        .run(Number(req.params.id));
    }

    const updated = db.prepare('SELECT * FROM inquiry_trials WHERE id = ?').get(trialId);
    res.json({ success: true, trial: updated, message: 'Trial record updated' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/inquiries/:id/convert
 * Converts inquiry to student with batch assignment, fee setup, and checklist initialization
 */
academyRouter.post('/inquiries/:id/convert', (req, res) => {
  try {
    const db = req.tenantDb;
    const result = InquiryService.convertInquiryToAdmission(db, req.academy.id, Number(req.params.id), req.body, req.user);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/students/admission-wizard
 * Direct comprehensive 7-step admission wizard
 */
academyRouter.post('/students/admission-wizard', (req, res) => {
  try {
    const db = req.tenantDb;
    const result = InquiryService.createAdmission(db, req.academy.id, req.body, req.user);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/students/:id/rejoin
 * Rejoining workflow for returning former students
 */
academyRouter.post('/students/:id/rejoin', (req, res) => {
  try {
    const db = req.tenantDb;
    const student = InquiryService.rejoinStudent(db, req.academy.id, Number(req.params.id), req.body, req.user);
    res.json({ success: true, student, message: 'Student successfully reactivated and assigned new batch' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/students/:id/checklist
 */
academyRouter.get('/students/:id/checklist', (req, res) => {
  try {
    const db = req.tenantDb;
    const checklist = db.prepare(`
      SELECT ac.*, u.name as verified_by_name
      FROM admission_checklists ac
      LEFT JOIN users u ON u.id = ac.verified_by_user_id
      WHERE ac.student_id = ? AND ac.academy_id = ?
      ORDER BY ac.id ASC
    `).all(Number(req.params.id), req.academy.id);
    res.json({ success: true, checklist });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/students/:id/checklist/:itemId
 */
academyRouter.put('/students/:id/checklist/:itemId', (req, res) => {
  try {
    const db = req.tenantDb;
    const itemId = Number(req.params.itemId);
    const { is_completed, notes } = req.body;

    db.prepare(`
      UPDATE admission_checklists
      SET is_completed = ?,
          verified_by_user_id = ?,
          verified_at = ?,
          notes = COALESCE(?, notes)
      WHERE id = ? AND student_id = ?
    `).run(
      is_completed ? 1 : 0,
      is_completed ? req.user?.userId : null,
      is_completed ? new Date().toISOString() : null,
      notes || null,
      itemId,
      Number(req.params.id)
    );

    const updated = db.prepare('SELECT * FROM admission_checklists WHERE id = ?').get(itemId);
    res.json({ success: true, item: updated, message: 'Checklist item updated' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/students/next-admission-number
 */
academyRouter.get('/students/next-admission-number', (req, res) => {
  try {
    const db = req.tenantDb;
    const count = db.prepare('SELECT COUNT(*) as c FROM students').get().c + 1;
    const year = new Date().getFullYear();
    const admissionNumber = `STU-${year}-${String(count).padStart(4, '0')}`;
    res.json({ success: true, admissionNumber, next_admission_number: admissionNumber });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



