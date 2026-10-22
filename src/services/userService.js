/**
 * UserService
 * Centralized User, Role, Employment, Compensation & History Management Service
 */
import bcrypt from 'bcryptjs';
import { QuotaService } from './quotaService.js';

export class UserService {
  /**
   * Retrieves all staff/coach users for the academy
   */
  static getStaffUsers(db, academyId) {
    return db.prepare(`
      SELECT 
        u.id, u.name, u.email, u.phone, u.role, u.status, u.created_at,
        COALESCE(ar.display_name, 
          CASE 
            WHEN u.role = 'academy_admin' THEN 'Academy Administrator'
            WHEN u.role = 'head_coach' THEN 'Head Coach'
            WHEN u.role = 'coach' THEN 'Sports Coach'
            WHEN u.role = 'receptionist' THEN 'Receptionist'
            WHEN u.role = 'front_desk' THEN 'Front Desk'
            WHEN u.role = 'finance_manager' THEN 'Finance Manager'
            ELSE u.role
          END
        ) as role_display_name,
        er.id as employment_id,
        er.designation,
        er.employment_type,
        er.joining_date,
        er.status as employment_status,
        er.branch_id,
        er.sport_id,
        b.name as branch_name,
        s.name as sport_name,
        c.id as coach_id,
        c.specializations,
        c.experience_years,
        (SELECT COUNT(*) FROM batches bt WHERE bt.coach_id = c.id AND bt.is_active = 1) as active_batches,
        COALESCE(ech.compensation_mode, sp.salary_type, 'monthly') as compensation_mode,
        COALESCE(ech.new_amount, sp.base_amount, 0) as current_salary,
        COALESCE(ech.currency, sp.currency, 'INR') as currency
      FROM users u
      LEFT JOIN academy_roles ar ON ar.name = u.role
      LEFT JOIN employment_records er ON er.user_id = u.id AND er.effective_to IS NULL
      LEFT JOIN branches b ON b.id = er.branch_id
      LEFT JOIN sports s ON s.id = er.sport_id
      LEFT JOIN coaches c ON c.user_id = u.id OR (c.email IS NOT NULL AND LOWER(c.email) = LOWER(u.email))
      LEFT JOIN employee_compensation_history ech ON ech.user_id = u.id AND ech.status = 'active' AND ech.effective_to IS NULL
      LEFT JOIN staff_salary_profiles sp ON sp.user_id = u.id
      WHERE u.role != 'student'
      ORDER BY u.id DESC
    `).all();
  }

  /**
   * Retrieves comprehensive user profile with all sub-modules:
   * Identity, Roles, Employment, Work Schedule, Compensation History, Activity Trail
   */
  static getUserProfile(db, userId, academyId) {
    const user = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.theme_color, u.custom_permissions, u.created_at,
             COALESCE(ar.display_name, u.role) as role_display_name,
             ar.description as role_description
      FROM users u
      LEFT JOIN academy_roles ar ON ar.name = u.role
      WHERE u.id = ?
    `).get(userId);

    if (!user) return null;

    let customPermissions = [];
    try {
      customPermissions = JSON.parse(user.custom_permissions || '[]');
    } catch (e) {}

    // Employment
    const employment = db.prepare(`
      SELECT er.*, b.name as branch_name, s.name as sport_name
      FROM employment_records er
      LEFT JOIN branches b ON b.id = er.branch_id
      LEFT JOIN sports s ON s.id = er.sport_id
      WHERE er.user_id = ?
      ORDER BY er.id DESC LIMIT 1
    `).get(userId);

    // Branch assignments
    const branchAssignments = db.prepare(`
      SELECT uba.*, b.name as branch_name, b.city as branch_city
      FROM user_branch_assignments uba
      JOIN branches b ON b.id = uba.branch_id
      WHERE uba.user_id = ?
      ORDER BY uba.is_primary DESC, uba.id DESC
    `).all(userId);

    // Compensation history (effective-dated)
    const compensationHistory = db.prepare(`
      SELECT ech.*, u_creator.name as created_by_name, u_approver.name as approved_by_name
      FROM employee_compensation_history ech
      LEFT JOIN users u_creator ON u_creator.id = ech.created_by_user_id
      LEFT JOIN users u_approver ON u_approver.id = ech.approved_by_user_id
      WHERE ech.user_id = ?
      ORDER BY ech.effective_from DESC, ech.id DESC
    `).all(userId);

    // Active compensation
    const activeCompensation = compensationHistory.find(c => c.status === 'active' && (!c.effective_to || c.effective_to >= new Date().toISOString().split('T')[0])) || compensationHistory[0] || null;

    // Role history
    const roleHistory = db.prepare(`
      SELECT urh.*, u_changer.name as changed_by_name
      FROM user_role_history urh
      LEFT JOIN users u_changer ON u_changer.id = urh.changed_by_user_id
      WHERE urh.user_id = ?
      ORDER BY urh.effective_from DESC, urh.id DESC
    `).all(userId);

    // Work schedule & shifts
    const schedule = db.prepare(`
      SELECT * FROM employee_work_schedules 
      WHERE user_id = ? AND is_active = 1
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    let shifts = [];
    if (schedule) {
      shifts = db.prepare(`
        SELECT * FROM employee_schedule_shifts 
        WHERE schedule_id = ? 
        ORDER BY day_of_week ASC, start_time ASC
      `).all(schedule.id);
    }

    // Coach details if linked
    const coach = db.prepare(`
      SELECT c.*, s.name as sport_name, b.name as branch_name,
             (SELECT COUNT(*) FROM batches bt WHERE bt.coach_id = c.id AND bt.is_active = 1) as active_batches
      FROM coaches c
      LEFT JOIN sports s ON s.id = c.sport_id
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE c.user_id = ? OR (c.email IS NOT NULL AND LOWER(c.email) = LOWER(?))
    `).get(userId, user.email);

    // Audit logs for this user
    const auditLogs = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE user_id = ? OR details LIKE ?
      ORDER BY id DESC LIMIT 25
    `).all(userId, `%user ${userId}%`);

    return {
      user: {
        ...user,
        custom_permissions: customPermissions,
      },
      employment,
      branchAssignments,
      compensationHistory,
      activeCompensation,
      roleHistory,
      schedule,
      shifts,
      coach,
      auditLogs,
    };
  }

  /**
   * Centralized User Creation Workflow:
   * 1. Create User login identity
   * 2. Record initial role in history
   * 3. Record employment details
   * 4. Record branch access
   * 5. Record initial compensation policy
   * 6. Synchronize backward-compatible coach record if role is coach/head_coach
   */
  static createStaffUser(db, centralDb, academyId, data, actorUserId = null) {
    const {
      name,
      email,
      phone,
      password,
      role = 'coach',
      branch_id,
      designation,
      employment_type = 'full_time',
      joining_date,
      sport_id,
      specializations,
      experience_years = 0,
      certifications,
      compensation_mode = 'monthly',
      salary_amount = 0,
      effective_from,
    } = data;

    if (!name || !name.trim()) throw new Error('User name is required');
    if (!email || !email.trim()) throw new Error('Email address is required for user account');

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanRole = role || 'coach';
    const effectiveDate = effective_from || joining_date || new Date().toISOString().split('T')[0];

    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(cleanEmail);
    if (existing) {
      throw new Error(`A user with email "${cleanEmail}" already exists. You can assign roles and employment records to this existing user identity.`);
    }

    // Quota Enforcement
    QuotaService.assertCanCreate(academyId, 'users', 1);
    if (['coach', 'head_coach'].includes(cleanRole)) {
      QuotaService.assertCanCreate(academyId, 'coaches', 1);
    }

    // 1. Create User
    const passwordHash = bcrypt.hashSync(password || 'password123', 10);
    const userRes = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone, status, custom_permissions)
      VALUES (?, ?, ?, ?, ?, 'active', '[]')
    `).run(cleanName, cleanEmail, passwordHash, cleanRole, phone || null);
    const userId = userRes.lastInsertRowid;

    // Central Lookup
    centralDb.prepare(`
      INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role)
      VALUES (?, ?, ?)
    `).run(cleanEmail, academyId, cleanRole);

    // 2. Initial Role History
    db.prepare(`
      INSERT INTO user_role_history (academy_id, user_id, role, previous_role, effective_from, reason, changed_by_user_id)
      VALUES (?, ?, ?, NULL, ?, 'Initial user account onboarding', ?)
    `).run(academyId, userId, cleanRole, effectiveDate, actorUserId);

    // 3. Employment Record
    const userDesignation = designation || (
      cleanRole === 'academy_admin' ? 'Academy Administrator' :
      cleanRole === 'head_coach' ? 'Head Coach' :
      cleanRole === 'coach' ? 'Sports Coach' :
      cleanRole === 'receptionist' ? 'Front Desk Receptionist' :
      'Staff Member'
    );

    const empRes = db.prepare(`
      INSERT INTO employment_records (
        academy_id, user_id, designation, employment_type, joining_date, status,
        branch_id, sport_id, specializations, experience_years, certifications, effective_from
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
    `).run(
      academyId, userId, userDesignation, employment_type,
      joining_date || effectiveDate,
      branch_id ? Number(branch_id) : null,
      sport_id ? Number(sport_id) : null,
      specializations || null,
      Number(experience_years) || 0,
      certifications || null,
      effectiveDate
    );
    const employmentId = empRes.lastInsertRowid;

    // 4. Branch Assignment
    if (branch_id) {
      db.prepare(`
        INSERT INTO user_branch_assignments (academy_id, user_id, branch_id, is_primary, effective_from)
        VALUES (?, ?, ?, 1, ?)
      `).run(academyId, userId, Number(branch_id), effectiveDate);
    }

    // 5. Initial Compensation History
    if (salary_amount !== undefined && salary_amount !== null && Number(salary_amount) > 0) {
      db.prepare(`
        INSERT INTO employee_compensation_history (
          academy_id, user_id, employment_record_id, compensation_mode, previous_amount,
          new_amount, currency, effective_from, reason, status, created_by_user_id
        ) VALUES (?, ?, ?, ?, 0, ?, 'INR', ?, 'Initial employment compensation terms', 'active', ?)
      `).run(
        academyId, userId, employmentId, compensation_mode,
        Number(salary_amount), effectiveDate, actorUserId
      );

      // Synchronize staff_salary_profiles
      const existingProfile = db.prepare('SELECT id FROM staff_salary_profiles WHERE user_id = ?').get(userId);
      if (existingProfile) {
        db.prepare(`
          UPDATE staff_salary_profiles 
          SET salary_mode = ?, base_rate = ?, currency = 'INR', effective_from = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(compensation_mode, Number(salary_amount), effectiveDate, existingProfile.id);
      } else {
        db.prepare(`
          INSERT INTO staff_salary_profiles (
            academy_id, user_id, salary_mode, base_rate, currency, effective_from, is_active
          ) VALUES (?, ?, ?, ?, 'INR', ?, 1)
        `).run(academyId, userId, compensation_mode, Number(salary_amount), effectiveDate);
      }
    }

    // 6. Backward-Compatible Coach Record
    let coachId = null;
    if (['coach', 'head_coach'].includes(cleanRole) || sport_id) {
      const coachRes = db.prepare(`
        INSERT INTO coaches (
          user_id, name, email, phone, sport_id, branch_id, specializations,
          experience_years, salary_type, salary_amount, joining_date, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        userId, cleanName, cleanEmail, phone || null,
        sport_id ? Number(sport_id) : null,
        branch_id ? Number(branch_id) : null,
        specializations || null,
        Number(experience_years) || 0,
        compensation_mode || 'monthly',
        Number(salary_amount) || 0,
        joining_date || effectiveDate
      );
      coachId = coachRes.lastInsertRowid;
    }

    // Audit Log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details, ip_address)
      VALUES (?, ?, ?, 'USER_CREATED', 'users', ?, '127.0.0.1')
    `).run(userId, cleanName, cleanRole, `Created user ${cleanName} with role ${cleanRole} and designation ${userDesignation}`);

    return {
      success: true,
      userId,
      coachId,
      employmentId,
      message: `User "${cleanName}" (${userDesignation}) created successfully with login account.`,
    };
  }

  /**
   * Effective-Dated Role Change / Promotion
   */
  static updateUserRole(db, centralDb, academyId, userId, newRole, effectiveFrom, reason, actorUserId = null) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');

    const previousRole = user.role;
    if (previousRole === newRole) {
      return { success: true, message: `User already has role ${newRole}` };
    }

    // Quota check if upgrading to coach/head_coach
    if (!['coach', 'head_coach'].includes(previousRole) && ['coach', 'head_coach'].includes(newRole)) {
      QuotaService.assertCanCreate(academyId, 'coaches', 1);
    }

    const effectiveDate = effectiveFrom || new Date().toISOString().split('T')[0];

    // Close previous role in history
    db.prepare(`
      UPDATE user_role_history 
      SET effective_to = ? 
      WHERE user_id = ? AND effective_to IS NULL
    `).run(effectiveDate, userId);

    // Insert new role in history
    db.prepare(`
      INSERT INTO user_role_history (academy_id, user_id, role, previous_role, effective_from, reason, changed_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(academyId, userId, newRole, previousRole, effectiveDate, reason || `Role changed from ${previousRole} to ${newRole}`, actorUserId);

    // Update active user role
    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newRole, userId);

    // Update central lookup
    centralDb.prepare('UPDATE academy_users_lookup SET role = ? WHERE email = ? AND academy_id = ?')
      .run(newRole, user.email.toLowerCase(), academyId);

    // Update employment record designation if promoted
    const newDesignation = newRole === 'head_coach' ? 'Head Coach' : (newRole === 'academy_admin' ? 'Academy Administrator' : (newRole === 'coach' ? 'Sports Coach' : null));
    if (newDesignation) {
      db.prepare('UPDATE employment_records SET designation = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND effective_to IS NULL')
        .run(newDesignation, userId);
    }

    // Synchronize or create coaches record if upgraded to coach/head_coach
    if (['coach', 'head_coach'].includes(newRole)) {
      const existingCoach = db.prepare('SELECT id FROM coaches WHERE user_id = ?').get(userId);
      if (!existingCoach) {
        db.prepare(`
          INSERT INTO coaches (user_id, name, email, phone, is_active)
          VALUES (?, ?, ?, ?, 1)
        `).run(userId, user.name, user.email, user.phone);
      }
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details)
      VALUES (?, ?, ?, 'ROLE_REVISED', 'users', ?)
    `).run(userId, user.name, newRole, `Role changed from ${previousRole} to ${newRole}. Reason: ${reason || 'Promotion'}`);

    return {
      success: true,
      previousRole,
      newRole,
      effectiveDate,
      message: `Role successfully updated to ${newRole} (Effective from: ${effectiveDate})`,
    };
  }

  /**
   * Effective-Dated Salary / Compensation Revision
   */
  static createSalaryRevision(db, academyId, userId, revisionData, actorUserId = null) {
    const {
      compensation_mode = 'monthly',
      new_amount,
      effective_from,
      reason,
      currency = 'INR',
    } = revisionData;

    if (!new_amount || Number(new_amount) <= 0) {
      throw new Error('Valid compensation amount/rate is required');
    }

    const effectiveDate = effective_from || new Date().toISOString().split('T')[0];

    // Find current active compensation
    const currentActive = db.prepare(`
      SELECT * FROM employee_compensation_history 
      WHERE user_id = ? AND status = 'active' AND effective_to IS NULL 
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    const previousAmount = currentActive ? currentActive.new_amount : 0;

    // Supersede previous active compensation
    if (currentActive) {
      db.prepare(`
        UPDATE employee_compensation_history 
        SET effective_to = ?, status = 'superseded', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(effectiveDate, currentActive.id);
    }

    // Insert new compensation revision
    const res = db.prepare(`
      INSERT INTO employee_compensation_history (
        academy_id, user_id, compensation_mode, previous_amount, new_amount,
        currency, effective_from, reason, status, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(
      academyId, userId, compensation_mode, previousAmount,
      Number(new_amount), currency, effectiveDate,
      reason || `Salary revision from ₹${previousAmount} to ₹${new_amount}`,
      actorUserId
    );

    // Update active salary profile
    const existingProfile = db.prepare('SELECT id FROM staff_salary_profiles WHERE user_id = ?').get(userId);
    if (existingProfile) {
      db.prepare(`
        UPDATE staff_salary_profiles 
        SET salary_mode = ?, base_rate = ?, currency = ?, effective_from = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(compensation_mode, Number(new_amount), currency, effectiveDate, existingProfile.id);
    } else {
      db.prepare(`
        INSERT INTO staff_salary_profiles (
          academy_id, user_id, salary_mode, base_rate, currency, effective_from, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(academyId, userId, compensation_mode, Number(new_amount), currency, effectiveDate);
    }

    // Update coaches table backward compatibility
    db.prepare(`
      UPDATE coaches 
      SET salary_type = ?, salary_amount = ? 
      WHERE user_id = ?
    `).run(compensation_mode, Number(new_amount), userId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details)
      VALUES (?, ?, ?, 'SALARY_REVISED', 'employee_compensation_history', ?)
    `).run(userId, 'System', 'academy_admin', `Salary revised from ₹${previousAmount} to ₹${new_amount} (${compensation_mode}). Effective: ${effectiveDate}. Reason: ${reason || 'Revision'}`);

    return {
      success: true,
      revisionId: res.lastInsertRowid,
      previousAmount,
      newAmount: Number(new_amount),
      effectiveDate,
      message: `Salary revised to ₹${Number(new_amount).toLocaleString()} (${compensation_mode}) effective from ${effectiveDate}.`,
    };
  }

  /**
   * Branch Transfer
   */
  static transferBranch(db, academyId, userId, newBranchId, effectiveFrom, reason, actorUserId = null) {
    const branch = db.prepare('SELECT id, name FROM branches WHERE id = ?').get(newBranchId);
    if (!branch) throw new Error('Target branch does not exist');

    const effectiveDate = effectiveFrom || new Date().toISOString().split('T')[0];

    // Close old branch assignments
    db.prepare(`
      UPDATE user_branch_assignments 
      SET effective_to = ?, is_primary = 0 
      WHERE user_id = ? AND effective_to IS NULL
    `).run(effectiveDate, userId);

    // Add new primary branch assignment
    db.prepare(`
      INSERT INTO user_branch_assignments (academy_id, user_id, branch_id, is_primary, effective_from)
      VALUES (?, ?, ?, 1, ?)
    `).run(academyId, userId, Number(newBranchId), effectiveDate);

    // Update employment record branch
    db.prepare('UPDATE employment_records SET branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND effective_to IS NULL')
      .run(Number(newBranchId), userId);

    // Update coaches record branch
    db.prepare('UPDATE coaches SET branch_id = ? WHERE user_id = ?')
      .run(Number(newBranchId), userId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details)
      VALUES (?, ?, ?, 'BRANCH_TRANSFERRED', 'user_branch_assignments', ?)
    `).run(userId, 'System', 'academy_admin', `Transferred to branch "${branch.name}" (ID ${newBranchId}). Reason: ${reason || 'Reassignment'}`);

    return {
      success: true,
      branchId: newBranchId,
      branchName: branch.name,
      message: `User transferred to branch "${branch.name}" effective from ${effectiveDate}.`,
    };
  }
}
