import express from 'express';
import { getCentralDb } from '../db/centralDb.js';
import { resolveTenant } from '../middleware/tenantResolver.js';
import { requireAuth, requireAcademyStaff } from '../middleware/auth.js';
import { streamAcademyBackup } from '../services/backupService.js';
import { SyllabusService } from '../services/syllabusService.js';

export const academyRouter = express.Router();

// All routes here require valid auth, academy staff access, and tenant DB resolution
academyRouter.use(requireAuth, requireAcademyStaff, resolveTenant);

/**
 * GET /api/academy/dashboard
 * Aggregates summary analytics from the tenant's isolated database
 */
academyRouter.get('/dashboard', (req, res) => {
  try {
    const db = req.tenantDb;

    const totalStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'active'").get().c;
    const totalCoaches = db.prepare("SELECT COUNT(*) as c FROM coaches WHERE is_active = 1").get().c;
    const totalBatches = db.prepare("SELECT COUNT(*) as c FROM batches WHERE is_active = 1").get().c;

    const today = new Date().toISOString().split('T')[0];
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

    // Recent activities from audit log
    const recentActivity = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5').all();

    res.json({
      success: true,
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

// ==========================================
// STUDENTS
// ==========================================

/**
 * GET /api/academy/students
 */
academyRouter.get('/students', (req, res) => {
  try {
    const db = req.tenantDb;
    const { search, branch_id, status } = req.query;

    let query = `
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

    if (search) {
      query += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_code LIKE ? OR s.email LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (branch_id) {
      query += ` AND s.branch_id = ?`;
      params.push(Number(branch_id));
    }
    if (status) {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY s.id DESC`;

    const students = db.prepare(query).all(...params);
    res.json({ success: true, students });
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

    // Check student quota against plan limit
    const currentCount = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
    if (currentCount >= req.academy.max_students) {
      return res.status(403).json({
        success: false,
        error: `Student limit reached (${req.academy.max_students}). Upgrade your plan in Central Admin.`,
      });
    }

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

    const currentCount = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
    if (currentCount + students.length > req.academy.max_students) {
      return res.status(403).json({
        success: false,
        error: `Importing ${students.length} students would exceed academy quota (${req.academy.max_students}). Current: ${currentCount}`,
      });
    }

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
    const coaches = db.prepare(`
      SELECT c.*, s.name as sport_name, b.name as branch_name,
             (SELECT COUNT(*) FROM batches bt WHERE bt.coach_id = c.id AND bt.is_active = 1) as active_batches
      FROM coaches c
      LEFT JOIN sports s ON s.id = c.sport_id
      LEFT JOIN branches b ON b.id = c.branch_id
      ORDER BY c.id DESC
    `).all();

    res.json({ success: true, coaches });
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
    const { name, email, phone, sport_id, branch_id, specializations, experience_years, salary_type, salary_amount } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Coach name is required' });
    }

    const currentCount = db.prepare('SELECT COUNT(*) as c FROM coaches').get().c;
    if (currentCount >= req.academy.max_coaches) {
      return res.status(403).json({
        success: false,
        error: `Coach limit reached (${req.academy.max_coaches}). Upgrade plan to add more coaches.`,
      });
    }

    const insert = db.prepare(`
      INSERT INTO coaches (
        name, email, phone, sport_id, branch_id, specializations,
        experience_years, salary_type, salary_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      name.trim(),
      email || null,
      phone || null,
      sport_id ? Number(sport_id) : null,
      branch_id ? Number(branch_id) : null,
      specializations || null,
      experience_years ? Number(experience_years) : 0,
      salary_type || 'monthly',
      salary_amount ? Number(salary_amount) : 0
    );

    res.status(201).json({ success: true, coachId: result.lastInsertRowid, message: 'Coach added successfully' });
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
    const batches = db.prepare(`
      SELECT bt.*, s.name as sport_name, b.name as branch_name, c.name as coach_name,
             (SELECT COUNT(*) FROM student_batch_enrollments sbe WHERE sbe.batch_id = bt.id AND sbe.status = 'active') as enrolled_count
      FROM batches bt
      LEFT JOIN sports s ON s.id = bt.sport_id
      LEFT JOIN branches b ON b.id = bt.branch_id
      LEFT JOIN coaches c ON c.id = bt.coach_id
      ORDER BY bt.id DESC
    `).all();

    res.json({ success: true, batches });
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

    const insert = db.prepare(`
      INSERT INTO batches (
        name, sport_id, branch_id, coach_id, start_time, end_time,
        days_of_week, max_capacity, monthly_fee, academy_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = insert.run(
      name.trim(),
      sport_id ? Number(sport_id) : null,
      Number(branch_id),
      coach_id ? Number(coach_id) : null,
      start_time,
      end_time,
      typeof days_of_week === 'object' ? JSON.stringify(days_of_week) : days_of_week || '["Mon","Wed","Fri"]',
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
      days_of_week ? (typeof days_of_week === 'object' ? JSON.stringify(days_of_week) : days_of_week) : null,
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

// ==========================================
// ATTENDANCE
// ==========================================

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
        sta.sessions_attended as active_sessions_attended
      FROM students s
      JOIN student_batch_enrollments sbe ON sbe.student_id = s.id AND sbe.batch_id = ? AND sbe.status = 'active'
      LEFT JOIN student_attendance sa ON sa.student_id = s.id AND sa.attendance_id = ?
      LEFT JOIN student_technique_assignments sta ON sta.student_id = s.id AND sta.status = 'active'
      LEFT JOIN syllabus_techniques st ON st.id = sta.technique_id
      LEFT JOIN syllabus_categories sc ON sc.id = st.category_id
      ORDER BY s.first_name ASC
    `).all(Number(batch_id), attendanceRecord ? attendanceRecord.id : -1);

    const availableTechniques = SyllabusService.listTechniques(db, req.academy.id);

    res.json({
      success: true,
      attendanceRecord: attendanceRecord || null,
      roster,
      availableTechniques,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/attendance
 * Marks or updates attendance for a batch on a given date with technique progression
 */
academyRouter.post('/attendance', (req, res) => {
  try {
    const db = req.tenantDb;
    const { batch_id, date, entries, notes } = req.body;

    if (!batch_id || !date || !Array.isArray(entries)) {
      return res.status(400).json({ success: false, error: 'batch_id, date, and entries array are required' });
    }

    const tx = db.transaction(() => {
      // Find or create attendance header
      let att = db.prepare('SELECT id FROM attendance WHERE batch_id = ? AND date = ?').get(Number(batch_id), date);
      let attId;

      if (att) {
        attId = att.id;
        db.prepare('UPDATE attendance SET notes = COALESCE(?, notes) WHERE id = ?').run(notes || null, attId);
      } else {
        const ins = db.prepare('INSERT INTO attendance (batch_id, date, taken_by_user_id, notes) VALUES (?, ?, ?, ?)');
        const res = ins.run(Number(batch_id), date, req.user.userId, notes || null);
        attId = res.lastInsertRowid;
      }

      const upsertStudentAttendance = db.prepare(`
        INSERT INTO student_attendance (attendance_id, student_id, status, remarks)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(attendance_id, student_id) DO UPDATE SET
          status = excluded.status,
          remarks = excluded.remarks
      `);

      for (const entry of entries) {
        upsertStudentAttendance.run(attId, Number(entry.student_id), entry.status || 'present', entry.remarks || null);
      }

      // Process technique progression, counting attended sessions & recording immutable snapshots
      SyllabusService.processAttendanceProgression(db, req.academy.id, attId, entries, req.user.userId);
    });

    tx();

    res.json({ success: true, message: `Attendance and technique progression marked successfully for ${entries.length} students` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// FEES & PAYMENTS
// ==========================================

/**
 * GET /api/academy/fees
 */
academyRouter.get('/fees', (req, res) => {
  try {
    const db = req.tenantDb;
    const { status, student_id } = req.query;

    let query = `
      SELECT sf.*, s.student_code, s.first_name, s.last_name, s.phone,
             fs.name as fee_structure_name
      FROM student_fees sf
      JOIN students s ON s.id = sf.student_id
      LEFT JOIN fee_structures fs ON fs.id = sf.fee_structure_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND sf.status = ?`;
      params.push(status);
    }
    if (student_id) {
      query += ` AND sf.student_id = ?`;
      params.push(Number(student_id));
    }

    query += ` ORDER BY sf.due_date ASC, sf.id DESC`;

    const fees = db.prepare(query).all(...params);
    res.json({ success: true, fees });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/fees
 * Generates a new student fee invoice
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
 * Records a payment against an invoice and updates balance/status
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

    const tx = db.transaction(() => {
      // 1. Insert payment record
      db.prepare(`
        INSERT INTO fee_payments (
          student_fee_id, receipt_number, payment_date, amount,
          payment_mode, transaction_reference, notes, collected_by
        ) VALUES (?, ?, DATE('now'), ?, ?, ?, ?, ?)
      `).run(
        invoice.id,
        receiptNumber,
        paymentAmount,
        payment_mode,
        transaction_reference || null,
        notes || null,
        req.user.userId
      );

      // 2. Update invoice balances
      const newPaid = invoice.paid_amount + paymentAmount;
      const newBalance = Math.max(0, invoice.net_amount - newPaid);
      let newStatus = 'partial';
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
    });

    tx();

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      receiptNumber,
      amount: paymentAmount,
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
    const leaves = db.prepare('SELECT * FROM leave_requests ORDER BY id DESC').all();
    res.json({ success: true, leaves });
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
    const branches = db.prepare('SELECT * FROM branches ORDER BY name ASC').all();
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

    const currentCount = db.prepare('SELECT COUNT(*) as c FROM branches WHERE is_active = 1').get().c;
    if (currentCount >= req.academy.max_branches) {
      return res.status(403).json({
        success: false,
        error: `Branch limit reached (${req.academy.max_branches}). Upgrade your plan to add more branches.`,
      });
    }

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

    res.status(201).json({
      success: true,
      branchId: result.lastInsertRowid,
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
 * GET /api/academy/sports
 */
academyRouter.get('/sports', (req, res) => {
  try {
    const db = req.tenantDb;
    const sports = db.prepare('SELECT * FROM sports ORDER BY name ASC').all();
    res.json({ success: true, sports });
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
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
    res.json({ success: true, logs });
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
    if (!student || student.academy_id !== req.academy.id) {
      return res.status(404).json({ success: false, error: 'Student not found in this academy' });
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
