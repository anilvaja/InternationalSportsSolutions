/**
 * Syllabus & Technique Progression Service
 * Implements business logic for:
 * - Syllabus Categories (academy-scoped, ordering, deletion protection)
 * - Syllabus Techniques (difficulty levels, belt ranks, ordering, deletion protection)
 * - Student Technique Assignment (single active constraint, atomic transitions, history tracking)
 * - Attendance Technique Progression (snapshots, session counting across months, upgrade/downgrade)
 */

export class SyllabusService {
  /**
   * List syllabus categories for an academy
   */
  static listCategories(db, academyId, { includeInactive = false } = {}) {
    let sql = `
      SELECT sc.*,
             (SELECT COUNT(*) FROM syllabus_techniques st WHERE st.category_id = sc.id AND st.deleted_at IS NULL) as technique_count
      FROM syllabus_categories sc
      WHERE sc.academy_id = ? AND sc.deleted_at IS NULL
    `;
    if (!includeInactive) {
      sql += ` AND sc.status = 'active'`;
    }
    sql += ` ORDER BY sc.display_order ASC, sc.id ASC`;
    return db.prepare(sql).all(academyId);
  }

  /**
   * Create a syllabus category
   */
  static createCategory(db, academyId, { name, description, display_order = 0, status = 'active' }) {
    if (!name || !name.trim()) {
      throw new Error('Category name is required');
    }

    const trimmedName = name.trim();
    const existing = db.prepare(`
      SELECT id FROM syllabus_categories 
      WHERE academy_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL
    `).get(academyId, trimmedName);

    if (existing) {
      throw new Error(`A syllabus category named "${trimmedName}" already exists in this academy`);
    }

    const res = db.prepare(`
      INSERT INTO syllabus_categories (academy_id, name, description, display_order, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(academyId, trimmedName, description || null, Number(display_order) || 0, status || 'active');

    return {
      id: res.lastInsertRowid,
      academy_id: academyId,
      name: trimmedName,
      description: description || null,
      display_order: Number(display_order) || 0,
      status: status || 'active',
    };
  }

  /**
   * Update a syllabus category
   */
  static updateCategory(db, academyId, categoryId, { name, description, display_order, status }) {
    const category = db.prepare('SELECT * FROM syllabus_categories WHERE id = ? AND academy_id = ? AND deleted_at IS NULL').get(categoryId, academyId);
    if (!category) {
      throw new Error('Syllabus category not found in this academy');
    }

    if (name && name.trim().toLowerCase() !== category.name.toLowerCase()) {
      const existing = db.prepare(`
        SELECT id FROM syllabus_categories 
        WHERE academy_id = ? AND LOWER(name) = LOWER(?) AND id != ? AND deleted_at IS NULL
      `).get(academyId, name.trim(), categoryId);
      if (existing) {
        throw new Error(`A syllabus category named "${name.trim()}" already exists in this academy`);
      }
    }

    db.prepare(`
      UPDATE syllabus_categories
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          display_order = COALESCE(?, display_order),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND academy_id = ?
    `).run(
      name ? name.trim() : null,
      description !== undefined ? description : null,
      display_order !== undefined ? Number(display_order) : null,
      status || null,
      categoryId,
      academyId
    );

    return db.prepare('SELECT * FROM syllabus_categories WHERE id = ?').get(categoryId);
  }

  /**
   * Delete or soft-delete a category with usage protection
   */
  static deleteCategory(db, academyId, categoryId) {
    const category = db.prepare('SELECT * FROM syllabus_categories WHERE id = ? AND academy_id = ? AND deleted_at IS NULL').get(categoryId, academyId);
    if (!category) {
      throw new Error('Syllabus category not found in this academy');
    }

    // Check if techniques exist
    const techniqueCount = db.prepare('SELECT COUNT(*) as c FROM syllabus_techniques WHERE category_id = ? AND deleted_at IS NULL').get(categoryId).c;
    if (techniqueCount > 0) {
      throw new Error(`Cannot delete category "${category.name}" because it contains ${techniqueCount} technique(s). Remove or reassign them first.`);
    }

    // Soft delete
    db.prepare(`
      UPDATE syllabus_categories 
      SET deleted_at = CURRENT_TIMESTAMP, status = 'inactive', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND academy_id = ?
    `).run(categoryId, academyId);

    return { success: true, message: `Category "${category.name}" deleted successfully` };
  }

  /**
   * Reorder categories
   */
  static reorderCategories(db, academyId, orderIds) {
    if (!Array.isArray(orderIds)) {
      throw new Error('orderIds must be an array of category IDs');
    }

    const tx = db.transaction(() => {
      const updateStmt = db.prepare('UPDATE syllabus_categories SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?');
      orderIds.forEach((id, index) => {
        updateStmt.run(index, Number(id), academyId);
      });
    });

    tx();
    return { success: true, message: 'Categories reordered successfully' };
  }

  // ==========================================
  // TECHNIQUES
  // ==========================================

  /**
   * List techniques for an academy, optionally filtered by category
   */
  static listTechniques(db, academyId, { categoryId, level, beltLevel, includeInactive = false } = {}) {
    let sql = `
      SELECT st.*, sc.name as category_name,
             (SELECT COUNT(*) FROM student_technique_assignments sta WHERE sta.technique_id = st.id AND sta.status = 'active') as active_students_count
      FROM syllabus_techniques st
      JOIN syllabus_categories sc ON sc.id = st.category_id
      WHERE st.academy_id = ? AND st.deleted_at IS NULL
    `;
    const params = [academyId];

    if (categoryId) {
      sql += ` AND st.category_id = ?`;
      params.push(Number(categoryId));
    }
    if (level !== undefined && level !== null && level !== '') {
      sql += ` AND st.level = ?`;
      params.push(Number(level));
    }
    if (beltLevel) {
      sql += ` AND LOWER(st.belt_level) = LOWER(?)`;
      params.push(beltLevel.trim());
    }
    if (!includeInactive) {
      sql += ` AND st.status = 'active'`;
    }

    sql += ` ORDER BY st.display_order ASC, st.level ASC, st.id ASC`;
    return db.prepare(sql).all(...params);
  }

  /**
   * Create technique
   */
  static createTechnique(db, academyId, {
    category_id,
    name,
    code,
    description,
    level = 1,
    belt_level,
    media_url,
    display_order = 0,
    status = 'active'
  }) {
    if (!category_id) {
      throw new Error('category_id is required');
    }
    if (!name || !name.trim()) {
      throw new Error('Technique name is required');
    }

    const category = db.prepare('SELECT id, name FROM syllabus_categories WHERE id = ? AND academy_id = ? AND deleted_at IS NULL').get(Number(category_id), academyId);
    if (!category) {
      throw new Error('Syllabus category does not exist in this academy');
    }

    const trimmedName = name.trim();
    const existing = db.prepare(`
      SELECT id FROM syllabus_techniques
      WHERE academy_id = ? AND category_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL
    `).get(academyId, category.id, trimmedName);

    if (existing) {
      throw new Error(`Technique "${trimmedName}" already exists in category "${category.name}"`);
    }

    const res = db.prepare(`
      INSERT INTO syllabus_techniques (
        academy_id, category_id, name, code, description, level, belt_level,
        media_url, display_order, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      academyId,
      category.id,
      trimmedName,
      code ? code.trim() : null,
      description || null,
      Number(level) || 1,
      belt_level ? belt_level.trim() : null,
      media_url || null,
      Number(display_order) || 0,
      status || 'active'
    );

    return {
      id: res.lastInsertRowid,
      academy_id: academyId,
      category_id: category.id,
      category_name: category.name,
      name: trimmedName,
      code: code ? code.trim() : null,
      description: description || null,
      level: Number(level) || 1,
      belt_level: belt_level ? belt_level.trim() : null,
      media_url: media_url || null,
      display_order: Number(display_order) || 0,
      status: status || 'active',
    };
  }

  /**
   * Update technique
   */
  static updateTechnique(db, academyId, techniqueId, updates) {
    const technique = db.prepare('SELECT * FROM syllabus_techniques WHERE id = ? AND academy_id = ? AND deleted_at IS NULL').get(techniqueId, academyId);
    if (!technique) {
      throw new Error('Technique not found in this academy');
    }

    const { category_id, name, code, description, level, belt_level, media_url, display_order, status } = updates;

    let targetCatId = technique.category_id;
    if (category_id && Number(category_id) !== technique.category_id) {
      const cat = db.prepare('SELECT id FROM syllabus_categories WHERE id = ? AND academy_id = ? AND deleted_at IS NULL').get(Number(category_id), academyId);
      if (!cat) throw new Error('Target syllabus category does not exist in this academy');
      targetCatId = cat.id;
    }

    if (name && (name.trim().toLowerCase() !== technique.name.toLowerCase() || targetCatId !== technique.category_id)) {
      const existing = db.prepare(`
        SELECT id FROM syllabus_techniques
        WHERE academy_id = ? AND category_id = ? AND LOWER(name) = LOWER(?) AND id != ? AND deleted_at IS NULL
      `).get(academyId, targetCatId, name.trim(), techniqueId);
      if (existing) {
        throw new Error(`Technique "${name.trim()}" already exists in this category`);
      }
    }

    db.prepare(`
      UPDATE syllabus_techniques
      SET category_id = ?,
          name = COALESCE(?, name),
          code = COALESCE(?, code),
          description = COALESCE(?, description),
          level = COALESCE(?, level),
          belt_level = COALESCE(?, belt_level),
          media_url = COALESCE(?, media_url),
          display_order = COALESCE(?, display_order),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND academy_id = ?
    `).run(
      targetCatId,
      name ? name.trim() : null,
      code !== undefined ? (code ? code.trim() : null) : null,
      description !== undefined ? description : null,
      level !== undefined ? Number(level) : null,
      belt_level !== undefined ? (belt_level ? belt_level.trim() : null) : null,
      media_url !== undefined ? media_url : null,
      display_order !== undefined ? Number(display_order) : null,
      status || null,
      techniqueId,
      academyId
    );

    return db.prepare('SELECT * FROM syllabus_techniques WHERE id = ?').get(techniqueId);
  }

  /**
   * Delete technique with usage protection
   */
  static deleteTechnique(db, academyId, techniqueId) {
    const technique = db.prepare('SELECT * FROM syllabus_techniques WHERE id = ? AND academy_id = ? AND deleted_at IS NULL').get(techniqueId, academyId);
    if (!technique) {
      throw new Error('Technique not found in this academy');
    }

    // Check if student assignments or attendance records exist
    const assignmentCount = db.prepare('SELECT COUNT(*) as c FROM student_technique_assignments WHERE technique_id = ?').get(techniqueId).c;
    const attendanceCount = db.prepare('SELECT COUNT(*) as c FROM student_attendance WHERE technique_id = ?').get(techniqueId).c;

    if (assignmentCount > 0 || attendanceCount > 0) {
      // Historical student progress depends on this technique -> soft-delete / deactivate
      db.prepare(`
        UPDATE syllabus_techniques
        SET deleted_at = CURRENT_TIMESTAMP, status = 'inactive', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND academy_id = ?
      `).run(techniqueId, academyId);
      return { success: true, message: `Technique "${technique.name}" has student learning history; it was archived and marked inactive.` };
    }

    // No student history -> safe to remove
    db.prepare('DELETE FROM syllabus_techniques WHERE id = ? AND academy_id = ?').run(techniqueId, academyId);
    return { success: true, message: `Technique "${technique.name}" deleted successfully.` };
  }

  /**
   * Reorder techniques
   */
  static reorderTechniques(db, academyId, orderIds) {
    if (!Array.isArray(orderIds)) {
      throw new Error('orderIds must be an array of technique IDs');
    }

    const tx = db.transaction(() => {
      const updateStmt = db.prepare('UPDATE syllabus_techniques SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?');
      orderIds.forEach((id, index) => {
        updateStmt.run(index, Number(id), academyId);
      });
    });

    tx();
    return { success: true, message: 'Techniques reordered successfully' };
  }

  // ==========================================
  // STUDENT TECHNIQUE ASSIGNMENT & PROGRESSION
  // ==========================================

  /**
   * Gets current active technique for a student
   */
  static getActiveAssignment(db, studentId) {
    return db.prepare(`
      SELECT sta.*, st.name as technique_name, st.code as technique_code, st.level as technique_level,
             st.belt_level as technique_belt_level, sc.name as category_name
      FROM student_technique_assignments sta
      JOIN syllabus_techniques st ON st.id = sta.technique_id
      JOIN syllabus_categories sc ON sc.id = st.category_id
      WHERE sta.student_id = ? AND sta.status = 'active'
    `).get(studentId);
  }

  /**
   * Returns full technique learning history and stats for a student
   */
  static getStudentTechniqueHistory(db, studentId) {
    let current = this.getActiveAssignment(db, studentId);

    // Auto-assign default technique if student currently has none and techniques exist
    if (!current) {
      const student = db.prepare('SELECT academy_id FROM students WHERE id = ?').get(studentId);
      if (student && student.academy_id) {
        current = this.autoAssignDefaultTechniqueIfNone(db, student.academy_id, studentId);
      }
    }

    const history = db.prepare(`
      SELECT sta.*, st.name as technique_name, st.code as technique_code, st.level as technique_level,
             st.belt_level as technique_belt_level, sc.name as category_name, u.name as assigned_by_name
      FROM student_technique_assignments sta
      JOIN syllabus_techniques st ON st.id = sta.technique_id
      JOIN syllabus_categories sc ON sc.id = st.category_id
      LEFT JOIN users u ON u.id = sta.assigned_by
      WHERE sta.student_id = ?
      ORDER BY sta.id DESC
    `).all(studentId);

    // Total attended sessions across all techniques
    const totalAttendedAcrossTechniques = db.prepare(`
      SELECT SUM(sessions_attended) as total FROM student_technique_assignments WHERE student_id = ?
    `).get(studentId).total || 0;

    // Detailed progression snapshots
    const snapshots = db.prepare(`
      SELECT ats.*, a.date as attendance_date, b.name as batch_name, st.name as technique_name
      FROM attendance_technique_snapshots ats
      JOIN attendance a ON a.id = ats.attendance_id
      JOIN batches b ON b.id = a.batch_id
      JOIN syllabus_techniques st ON st.id = ats.technique_id
      WHERE ats.student_id = ?
      ORDER BY a.date DESC, ats.id DESC
      LIMIT 50
    `).all(studentId);

    // Also fetch general attendance sessions from student_attendance
    const attendanceLogs = db.prepare(`
      SELECT sa.id, sa.attendance_id, sa.status, sa.remarks, a.date as attendance_date, b.name as batch_name,
             st.name as technique_name, sa.technique_level, sa.attended_sessions_snapshot
      FROM student_attendance sa
      JOIN attendance a ON a.id = sa.attendance_id
      JOIN batches b ON b.id = a.batch_id
      LEFT JOIN syllabus_techniques st ON st.id = sa.technique_id
      WHERE sa.student_id = ?
      ORDER BY a.date DESC, sa.id DESC
      LIMIT 50
    `).all(studentId);

    return {
      currentTechnique: current || null,
      history,
      totalAttendedAcrossTechniques,
      snapshots,
      attendanceLogs,
    };
  }

  /**
   * Assign or transition student technique (atomic transaction)
   * action: 'initial' | 'upgrade' | 'downgrade' | 'direct_jump'
   */
  static assignStudentTechnique(db, academyId, studentId, {
    technique_id,
    assigned_by = null,
    start_date = null,
    remarks = null,
    action = 'initial',
  }) {
    const student = db.prepare('SELECT id, academy_id, first_name, last_name FROM students WHERE id = ?').get(studentId);
    if (!student) {
      throw new Error('Student record not found');
    }

    const targetAcademyId = Number(academyId);

    // If student in this tenant database has null or mismatched academy_id, self-heal to match this tenant
    if (student.academy_id == null || Number(student.academy_id) !== targetAcademyId) {
      db.prepare('UPDATE students SET academy_id = ? WHERE id = ?').run(targetAcademyId, student.id);
      student.academy_id = targetAcademyId;
    }

    const newTechnique = db.prepare('SELECT * FROM syllabus_techniques WHERE id = ? AND (academy_id = ? OR academy_id IS NULL) AND deleted_at IS NULL').get(Number(technique_id), targetAcademyId);
    if (!newTechnique) {
      throw new Error('Selected technique does not exist in this academy');
    }

    if (newTechnique.academy_id == null) {
      db.prepare('UPDATE syllabus_techniques SET academy_id = ? WHERE id = ?').run(targetAcademyId, newTechnique.id);
    }

    const effectiveDate = start_date || new Date().toISOString().split('T')[0];
    let newAssignmentId;

    const tx = db.transaction(() => {
      const active = this.getActiveAssignment(db, studentId);

      if (active) {
        if (active.technique_id === newTechnique.id) {
          // Already on this technique; update remarks if provided
          if (remarks) {
            db.prepare('UPDATE student_technique_assignments SET remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(remarks, active.id);
          }
          newAssignmentId = active.id;
          return;
        }

        // Retire previous active assignment
        const retireStatus = action === 'downgrade' ? 'downgraded' : 'completed';
        db.prepare(`
          UPDATE student_technique_assignments
          SET status = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(retireStatus, effectiveDate, active.id);
      }

      // Create new active assignment (enforced by idx_student_single_active_technique)
      const ins = db.prepare(`
        INSERT INTO student_technique_assignments (
          academy_id, student_id, technique_id, assigned_by, start_date, status, sessions_attended, remarks
        ) VALUES (?, ?, ?, ?, ?, 'active', 0, ?)
      `).run(targetAcademyId, studentId, newTechnique.id, assigned_by, effectiveDate, remarks || `${action.toUpperCase()} assignment`);

      newAssignmentId = ins.lastInsertRowid;
    });

    tx();
    return this.getActiveAssignment(db, studentId);
  }

  /**
   * Auto-assign default technique (lowest level/order) on new student registration or enrollment if unassigned
   */
  static autoAssignDefaultTechniqueIfNone(db, academyId, studentId, assignedBy = null) {
    const active = this.getActiveAssignment(db, studentId);
    if (active) return active;

    const targetAcademyId = Number(academyId);
    const firstTechnique = db.prepare(`
      SELECT st.id FROM syllabus_techniques st
      JOIN syllabus_categories sc ON sc.id = st.category_id
      WHERE (st.academy_id = ? OR st.academy_id IS NULL) AND st.status = 'active' AND st.deleted_at IS NULL AND sc.status = 'active'
      ORDER BY st.level ASC, st.display_order ASC, st.id ASC
      LIMIT 1
    `).get(targetAcademyId);

    if (!firstTechnique) return null;

    return this.assignStudentTechnique(db, targetAcademyId, studentId, {
      technique_id: firstTechnique.id,
      assigned_by: assignedBy,
      action: 'initial',
      remarks: 'Automatic syllabus enrollment default assignment',
    });
  }

  /**
   * Process attendance technique progression for a batch of entries
   * Called within attendance recording transaction
   */
  static processAttendanceProgression(db, academyId, attendanceId, entries, assignedBy) {
    const targetAcademyId = Number(academyId);
    for (const entry of entries) {
      const studentId = Number(entry.student_id);
      const newStatus = entry.status || 'present';
      const isAttended = ['present', 'late'].includes(newStatus);

      // Check previous attendance state in this exact session for idempotency and technique shifts
      const prevStudentAttendance = db.prepare(`
        SELECT status, technique_id, attended_sessions_snapshot
        FROM student_attendance
        WHERE attendance_id = ? AND student_id = ?
      `).get(attendanceId, studentId);

      const prevTechId = prevStudentAttendance ? prevStudentAttendance.technique_id : null;

      let activeAssignment = this.getActiveAssignment(db, studentId);

      // If student has no technique yet, assign chosen technique or auto-assign baseline technique
      if (!activeAssignment) {
        try {
          if (entry.technique_id) {
            activeAssignment = this.assignStudentTechnique(db, targetAcademyId, studentId, {
              technique_id: Number(entry.technique_id),
              assigned_by: assignedBy,
              action: 'initial',
            });
          } else {
            activeAssignment = this.autoAssignDefaultTechniqueIfNone(db, targetAcademyId, studentId, assignedBy);
          }
        } catch (err) {
          console.warn(`[Attendance Progression] Could not assign initial technique for student ${studentId}:`, err.message);
        }
      }

      const progressionAction = entry.technique_status || 'keep';
      const requestedTechId = entry.technique_id ? Number(entry.technique_id) : (activeAssignment ? activeAssignment.technique_id : null);

      if (!requestedTechId) continue;

      // Fetch technique details
      const tech = db.prepare('SELECT id, level FROM syllabus_techniques WHERE id = ?').get(requestedTechId);
      const techLevel = tech ? tech.level : (entry.technique_level || 1);

      // 1. First, UPSERT student_attendance with exact technique metadata
      db.prepare(`
        INSERT INTO student_attendance (
          attendance_id, student_id, status, remarks,
          technique_id, technique_level, technique_status, technique_remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(attendance_id, student_id) DO UPDATE SET
          status = excluded.status,
          remarks = excluded.remarks,
          technique_id = excluded.technique_id,
          technique_level = excluded.technique_level,
          technique_status = excluded.technique_status,
          technique_remarks = excluded.technique_remarks
      `).run(
        attendanceId,
        studentId,
        newStatus,
        entry.remarks || null,
        requestedTechId,
        techLevel,
        progressionAction,
        entry.technique_remarks || null
      );

      // 2. Transition technique assignment if requested technique is different from current active
      if (activeAssignment && requestedTechId !== activeAssignment.technique_id) {
        try {
          activeAssignment = this.assignStudentTechnique(db, targetAcademyId, studentId, {
            technique_id: requestedTechId,
            assigned_by: assignedBy,
            action: progressionAction,
            remarks: entry.technique_remarks || `Transitioned during attendance (${progressionAction})`,
          });
        } catch (err) {
          console.warn(`[Attendance Progression] Could not transition technique for student ${studentId}:`, err.message);
        }
      }

      // 3. Compute accurate cumulative attended sessions count for this technique from attendance history
      const techSessionsCount = db.prepare(`
        SELECT COUNT(DISTINCT a.id) as cnt
        FROM student_attendance sa
        JOIN attendance a ON a.id = sa.attendance_id
        WHERE sa.student_id = ? AND sa.technique_id = ? AND sa.status IN ('present', 'late')
      `).get(studentId, requestedTechId).cnt;

      if (activeAssignment) {
        db.prepare(`
          UPDATE student_technique_assignments
          SET sessions_attended = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(techSessionsCount, activeAssignment.id);
        activeAssignment.sessions_attended = techSessionsCount;
      }

      // If this attendance session was previously recorded with a different technique, update the previous technique's counter too
      if (prevTechId && prevTechId !== requestedTechId) {
        const prevTechCount = db.prepare(`
          SELECT COUNT(DISTINCT a.id) as cnt
          FROM student_attendance sa
          JOIN attendance a ON a.id = sa.attendance_id
          WHERE sa.student_id = ? AND sa.technique_id = ? AND sa.status IN ('present', 'late')
        `).get(studentId, prevTechId).cnt;

        db.prepare(`
          UPDATE student_technique_assignments
          SET sessions_attended = ?, updated_at = CURRENT_TIMESTAMP
          WHERE student_id = ? AND technique_id = ?
        `).run(prevTechCount, studentId, prevTechId);
      }

      // 4. Update student_attendance.attended_sessions_snapshot
      db.prepare(`
        UPDATE student_attendance
        SET attended_sessions_snapshot = ?
        WHERE attendance_id = ? AND student_id = ?
      `).run(techSessionsCount, attendanceId, studentId);

      // 5. Upsert attendance_technique_snapshots
      const existingSnapshot = db.prepare(`
        SELECT id FROM attendance_technique_snapshots WHERE attendance_id = ? AND student_id = ?
      `).get(attendanceId, studentId);

      if (existingSnapshot) {
        db.prepare(`
          UPDATE attendance_technique_snapshots
          SET technique_id = ?, technique_level = ?, progression_action = ?,
              sessions_count_at_time = ?, remarks = ?
          WHERE id = ?
        `).run(
          requestedTechId,
          techLevel,
          progressionAction,
          techSessionsCount,
          entry.technique_remarks || null,
          existingSnapshot.id
        );
      } else {
        db.prepare(`
          INSERT INTO attendance_technique_snapshots (
            attendance_id, student_id, technique_id, technique_level, progression_action,
            sessions_count_at_time, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          attendanceId,
          studentId,
          requestedTechId,
          techLevel,
          progressionAction,
          techSessionsCount,
          entry.technique_remarks || null
        );
      }
    }
  }

  /**
   * Reports: Students grouped by technique, extended duration, and attendance totals
   */
  static getSyllabusReports(db, academyId) {
    // 1. Grouped by technique
    const byTechnique = db.prepare(`
      SELECT st.id as technique_id, st.name as technique_name, st.level, st.belt_level,
             sc.name as category_name,
             COUNT(sta.id) as student_count,
             COALESCE(AVG(sta.sessions_attended), 0) as avg_sessions_attended
      FROM syllabus_techniques st
      JOIN syllabus_categories sc ON sc.id = st.category_id
      LEFT JOIN student_technique_assignments sta ON sta.technique_id = st.id AND sta.status = 'active'
      WHERE st.academy_id = ? AND st.deleted_at IS NULL
      GROUP BY st.id
      ORDER BY st.level ASC, st.display_order ASC
    `).all(academyId);

    // 2. Students with extended duration (> 30 sessions or > 60 days on same technique)
    const extendedDurationStudents = db.prepare(`
      SELECT s.id as student_id, s.student_code, s.first_name, s.last_name,
             st.name as technique_name, st.level as technique_level, st.belt_level,
             sta.start_date, sta.sessions_attended,
             (julianday('now') - julianday(sta.start_date)) as days_on_technique
      FROM student_technique_assignments sta
      JOIN students s ON s.id = sta.student_id
      JOIN syllabus_techniques st ON st.id = sta.technique_id
      WHERE sta.academy_id = ? AND sta.status = 'active'
        AND (sta.sessions_attended >= 25 OR (julianday('now') - julianday(sta.start_date)) >= 60)
      ORDER BY sta.sessions_attended DESC
      LIMIT 50
    `).all(academyId);

    // 3. Monthly attendance totals by technique
    const monthlyTechniqueAttendance = db.prepare(`
      SELECT strftime('%Y-%m', a.date) as month,
             st.name as technique_name,
             COUNT(sa.id) as sessions_marked_present
      FROM student_attendance sa
      JOIN attendance a ON a.id = sa.attendance_id
      JOIN syllabus_techniques st ON st.id = sa.technique_id
      WHERE sa.status IN ('present', 'late') AND st.academy_id = ?
      GROUP BY month, st.name
      ORDER BY month DESC, sessions_marked_present DESC
      LIMIT 50
    `).all(academyId);

    return {
      byTechnique,
      extendedDurationStudents,
      monthlyTechniqueAttendance,
    };
  }
}
