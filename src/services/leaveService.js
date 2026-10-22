/**
 * LeaveService
 * Manages academy leave policies, employee annual entitlements, monthly accruals,
 * opening/used/remaining balances, leave applications, date-range validations,
 * overlapping checks, half-day leaves, sandwich rules, and approval/cancellation workflows.
 */
export class LeaveService {

  /**
   * Default Leave Policy Definitions
   */
  static DEFAULT_POLICIES = [
    { leave_type: 'casual', name: 'Casual Leave (CL)', annual_quota: 12, monthly_accrual: 1.0, is_paid: 1, allow_half_day: 1, allow_carry_forward: 0, max_carry_forward: 0, allow_encashment: 0, sandwich_rule: 0 },
    { leave_type: 'sick', name: 'Sick Leave (SL)', annual_quota: 12, monthly_accrual: 1.0, is_paid: 1, allow_half_day: 1, allow_carry_forward: 1, max_carry_forward: 12, allow_encashment: 0, sandwich_rule: 0 },
    { leave_type: 'earned', name: 'Earned / Annual Leave (EL)', annual_quota: 15, monthly_accrual: 1.25, is_paid: 1, allow_half_day: 1, allow_carry_forward: 1, max_carry_forward: 30, allow_encashment: 1, sandwich_rule: 0 },
    { leave_type: 'unpaid', name: 'Leave Without Pay (LWP)', annual_quota: 0, monthly_accrual: 0.0, is_paid: 0, allow_half_day: 1, allow_carry_forward: 0, max_carry_forward: 0, allow_encashment: 0, sandwich_rule: 0 },
    { leave_type: 'half_day', name: 'Half-Day Leave', annual_quota: 12, monthly_accrual: 1.0, is_paid: 1, allow_half_day: 1, allow_carry_forward: 0, max_carry_forward: 0, allow_encashment: 0, sandwich_rule: 0 },
  ];

  /**
   * Ensures standard default leave policies exist for an academy
   */
  static ensureDefaultPolicies(db, academyId = 1) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO leave_policies (
        academy_id, branch_id, leave_type, name, annual_quota, monthly_accrual,
        is_paid, allow_half_day, allow_carry_forward, max_carry_forward,
        allow_encashment, sandwich_rule, is_active
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const p of this.DEFAULT_POLICIES) {
      insert.run(
        academyId, p.leave_type, p.name, p.annual_quota, p.monthly_accrual,
        p.is_paid, p.allow_half_day, p.allow_carry_forward, p.max_carry_forward,
        p.allow_encashment, p.sandwich_rule
      );
    }
  }

  /**
   * Retrieves all leave policies for an academy/branch
   */
  static getPolicies(db, academyId = 1, branchId = null) {
    this.ensureDefaultPolicies(db, academyId);

    if (branchId) {
      return db.prepare(`
        SELECT * FROM leave_policies
        WHERE academy_id = ? AND (branch_id IS NULL OR branch_id = ?) AND is_active = 1
        ORDER BY leave_type ASC
      `).all(academyId, branchId);
    }

    return db.prepare(`
      SELECT * FROM leave_policies
      WHERE academy_id = ? AND is_active = 1
      ORDER BY leave_type ASC
    `).all(academyId);
  }

  /**
   * Saves or updates a leave policy
   */
  static savePolicy(db, academyId, policyData, actorId = null) {
    const {
      branch_id = null,
      leave_type,
      name,
      annual_quota = 12,
      monthly_accrual = 1.0,
      is_paid = 1,
      allow_half_day = 1,
      allow_carry_forward = 0,
      max_carry_forward = 0,
      allow_encashment = 0,
      sandwich_rule = 0,
      is_active = 1
    } = policyData;

    if (!leave_type || !name) {
      throw new Error('Leave type code and policy display name are required');
    }

    return db.transaction(() => {
      const existing = db.prepare(`
        SELECT id FROM leave_policies 
        WHERE academy_id = ? AND leave_type = ? AND ((branch_id IS NULL AND ? IS NULL) OR branch_id = ?)
      `).get(academyId, leave_type, branch_id, branch_id);

      if (existing) {
        db.prepare(`
          UPDATE leave_policies
          SET name = ?, annual_quota = ?, monthly_accrual = ?, is_paid = ?,
              allow_half_day = ?, allow_carry_forward = ?, max_carry_forward = ?,
              allow_encashment = ?, sandwich_rule = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          name, Number(annual_quota), Number(monthly_accrual), is_paid ? 1 : 0,
          allow_half_day ? 1 : 0, allow_carry_forward ? 1 : 0, Number(max_carry_forward),
          allow_encashment ? 1 : 0, sandwich_rule ? 1 : 0, is_active ? 1 : 0,
          existing.id
        );
        return { id: existing.id, updated: true };
      } else {
        const ins = db.prepare(`
          INSERT INTO leave_policies (
            academy_id, branch_id, leave_type, name, annual_quota, monthly_accrual,
            is_paid, allow_half_day, allow_carry_forward, max_carry_forward,
            allow_encashment, sandwich_rule, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          academyId, branch_id, leave_type, name, Number(annual_quota), Number(monthly_accrual),
          is_paid ? 1 : 0, allow_half_day ? 1 : 0, allow_carry_forward ? 1 : 0, Number(max_carry_forward),
          allow_encashment ? 1 : 0, sandwich_rule ? 1 : 0, is_active ? 1 : 0
        );
        return { id: ins.lastInsertRowid, created: true };
      }
    })();
  }

  /**
   * Initializes or returns leave balances for an employee for a specific year
   */
  static initializeBalancesForUser(db, academyIdOrUserId, userIdOrYear, maybeYear) {
    let academyId = 1;
    let userId;
    let year = new Date().getFullYear();

    if (maybeYear !== undefined) {
      academyId = academyIdOrUserId;
      userId = userIdOrYear;
      year = maybeYear;
    } else if (typeof userIdOrYear === 'number' && userIdOrYear >= 1900 && userIdOrYear <= 2100) {
      userId = academyIdOrUserId;
      year = userIdOrYear;
    } else {
      academyId = academyIdOrUserId || 1;
      userId = userIdOrYear;
    }

    const policies = this.getPolicies(db, academyId);

    return db.transaction(() => {
      const existing = db.prepare(`
        SELECT * FROM employee_leave_balances
        WHERE user_id = ? AND year = ?
      `).all(userId, year);

      const existingMap = new Map(existing.map(b => [b.leave_type, b]));
      const insert = db.prepare(`
        INSERT OR IGNORE INTO employee_leave_balances (
          academy_id, user_id, leave_type, year, opening_balance, accrued, used, remaining
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `);

      for (const p of policies) {
        if (!existingMap.has(p.leave_type)) {
          const quota = Number(p.annual_quota || 0);
          insert.run(academyId, userId, p.leave_type, year, quota, quota, quota);
        }
      }

      return db.prepare(`
        SELECT b.*, p.name as policy_name, p.is_paid, p.allow_half_day
        FROM employee_leave_balances b
        LEFT JOIN leave_policies p ON p.academy_id = b.academy_id AND p.leave_type = b.leave_type
        WHERE b.user_id = ? AND b.year = ?
        ORDER BY b.leave_type ASC
      `).all(userId, year);
    })();
  }

  /**
   * Retrieves leave balances for an employee, initializing default quotas if missing
   */
  static getBalances(db, academyIdOrUserId, userIdOrYear, maybeYear) {
    let academyId = 1;
    let userId;
    let year = new Date().getFullYear();

    if (maybeYear !== undefined) {
      academyId = academyIdOrUserId;
      userId = userIdOrYear;
      year = maybeYear;
    } else if (typeof userIdOrYear === 'number' && userIdOrYear >= 1900 && userIdOrYear <= 2100) {
      userId = academyIdOrUserId;
      year = userIdOrYear;
    } else {
      academyId = academyIdOrUserId || 1;
      userId = userIdOrYear;
    }

    return this.initializeBalancesForUser(db, academyId, userId, year);
  }

  /**
   * Calculates net payable/chargeable leave days between start and end dates
   * taking into account weekly offs, holidays, and sandwich rules
   */
  static calculateLeaveDays(db, userId, leaveType, startDate, endDate, dayPart = 'full', academyId = 1) {
    if (dayPart === 'first_half' || dayPart === 'second_half') {
      return 0.5;
    }

    if (startDate === endDate) {
      return 1.0;
    }

    // Multi-day calculation
    const policy = db.prepare(`
      SELECT * FROM leave_policies WHERE academy_id = ? AND leave_type = ? LIMIT 1
    `).get(academyId, leaveType);

    const sandwichRule = policy ? !!policy.sandwich_rule : false;

    // Iterate through all calendar days in range
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    let chargeableDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayNum}`;

      if (sandwichRule) {
        // If sandwich rule is ON, every day in range counts
        chargeableDays += 1;
      } else {
        // Check if Sunday / weekly off
        const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
        const isWeeklyOff = dayOfWeek === 7;

        // Check if paid holiday
        const holiday = db.prepare(`
          SELECT id FROM academy_holidays WHERE holiday_date = ? AND is_paid = 1 LIMIT 1
        `).get(dateStr);

        if (!isWeeklyOff && !holiday) {
          chargeableDays += 1;
        }
      }
    }

    return Math.max(1, chargeableDays);
  }

  /**
   * Applies for a leave request with strict date-range and overlapping validation
   */
  static applyLeave(db, academyId, leaveData, actorId = null) {
    const {
      applicant_type = 'staff',
      applicant_id,
      applicant_name,
      user_id,
      branch_id = null,
      leave_type = 'casual',
      start_date,
      end_date,
      day_part = 'full',
      reason,
      status = 'pending',
      reviewer_comments = null
    } = leaveData;

    if (!start_date || !end_date || !reason) {
      throw new Error('Start date, end date, and reason are required');
    }

    if (start_date > end_date) {
      throw new Error(`Start date (${start_date}) cannot be after end date (${end_date})`);
    }

    const effectiveUserId = Number(user_id || applicant_id || actorId);
    if (!effectiveUserId) {
      throw new Error('Valid employee/user ID is required for leave request');
    }

    // 1. Prevent Overlapping Leave Requests for the same applicant
    const overlap = db.prepare(`
      SELECT id, start_date, end_date, status, leave_type
      FROM leave_requests
      WHERE (user_id = ? OR applicant_id = ?)
        AND status IN ('approved', 'pending')
        AND NOT (end_date < ? OR start_date > ?)
      LIMIT 1
    `).get(effectiveUserId, effectiveUserId, start_date, end_date);

    if (overlap) {
      throw new Error(`Overlapping leave request exists (ID #${overlap.id}, ${overlap.start_date} to ${overlap.end_date}, status: ${overlap.status}). Cannot submit duplicate request.`);
    }

    // 2. Calculate chargeable days count
    const daysCount = this.calculateLeaveDays(
      db, effectiveUserId, leave_type, start_date, end_date, day_part, academyId
    );

    // 3. Balance verification for paid leave types
    const year = new Date(start_date + 'T00:00:00').getFullYear();
    const policy = db.prepare('SELECT is_paid FROM leave_policies WHERE academy_id = ? AND leave_type = ? LIMIT 1').get(academyId, leave_type);
    const isPaid = policy ? policy.is_paid : (leave_type !== 'unpaid' ? 1 : 0);

    return db.transaction(() => {
      if (isPaid) {
        this.initializeBalancesForUser(db, academyId, effectiveUserId, year);
        const balance = db.prepare(`
          SELECT remaining FROM employee_leave_balances
          WHERE user_id = ? AND leave_type = ? AND year = ?
        `).get(effectiveUserId, leave_type, year);

        const currentRemaining = balance ? Number(balance.remaining || 0) : 0;
        if (currentRemaining < daysCount && leave_type !== 'unpaid') {
          throw new Error(`Insufficient ${leave_type} balance: requested ${daysCount} days, but only ${currentRemaining} days remaining in ${year}.`);
        }
      }

      const initialStatus = status === 'approved' ? 'approved' : 'pending';

      const ins = db.prepare(`
        INSERT INTO leave_requests (
          academy_id, branch_id, user_id, applicant_type, applicant_id, applicant_name,
          leave_type, start_date, end_date, day_part, days_count, is_paid, reason,
          status, reviewed_by, reviewed_at, reviewer_comments
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        academyId,
        branch_id,
        effectiveUserId,
        applicant_type,
        effectiveUserId,
        applicant_name || 'Staff Member',
        leave_type,
        start_date,
        end_date,
        day_part,
        daysCount,
        isPaid ? 1 : 0,
        reason,
        initialStatus,
        initialStatus === 'approved' ? actorId : null,
        initialStatus === 'approved' ? new Date().toISOString() : null,
        initialStatus === 'approved' ? (reviewer_comments || 'Approved by Academy Administrator') : null
      );

      const leaveId = ins.lastInsertRowid;

      // If pre-approved immediately, deduct balance
      if (initialStatus === 'approved' && isPaid) {
        db.prepare(`
          UPDATE employee_leave_balances
          SET used = used + ?, remaining = remaining - ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND leave_type = ? AND year = ?
        `).run(daysCount, daysCount, effectiveUserId, leave_type, year);
      }

      // Record Audit Log
      db.prepare(`
        INSERT INTO payroll_audit_logs (academy_id, entity_type, entity_id, action, actor_id, changes_summary, reason)
        VALUES (?, 'leave', ?, ?, ?, ?, ?)
      `).run(
        academyId,
        leaveId,
        initialStatus === 'approved' ? 'approve' : 'create',
        actorId || effectiveUserId,
        `Leave request for ${daysCount} day(s) (${leave_type}) from ${start_date} to ${end_date}`,
        reason
      );

      return {
        leaveId,
        daysCount,
        status: initialStatus,
        isPaid,
      };
    })();
  }

  /**
   * Reviews (Approve/Reject) a pending leave request
   */
  static reviewLeave(db, academyId, leaveId, newStatus, comments = null, reviewerId = null) {
    if (!['approved', 'rejected'].includes(newStatus)) {
      throw new Error(`Invalid review status: ${newStatus}. Must be 'approved' or 'rejected'.`);
    }

    return db.transaction(() => {
      const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leaveId);
      if (!leave) {
        throw new Error(`Leave request #${leaveId} not found`);
      }

      if (leave.status !== 'pending') {
        throw new Error(`Cannot review leave #${leaveId}: current status is already '${leave.status}'`);
      }

      const year = new Date(leave.start_date + 'T00:00:00').getFullYear();
      const userId = leave.user_id || leave.applicant_id;
      const daysCount = Number(leave.days_count || 1.0);
      const isPaid = !!leave.is_paid;

      if (newStatus === 'approved' && isPaid) {
        this.initializeBalancesForUser(db, academyId, userId, year);
        const bal = db.prepare(`
          SELECT remaining FROM employee_leave_balances
          WHERE user_id = ? AND leave_type = ? AND year = ?
        `).get(userId, leave.leave_type, year);

        const remaining = bal ? Number(bal.remaining || 0) : 0;
        if (remaining < daysCount && leave.leave_type !== 'unpaid') {
          throw new Error(`Cannot approve leave: insufficient balance (${remaining} remaining, requires ${daysCount})`);
        }

        // Deduct from balance
        db.prepare(`
          UPDATE employee_leave_balances
          SET used = used + ?, remaining = remaining - ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND leave_type = ? AND year = ?
        `).run(daysCount, daysCount, userId, leave.leave_type, year);
      }

      db.prepare(`
        UPDATE leave_requests
        SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reviewer_comments = ?
        WHERE id = ?
      `).run(newStatus, reviewerId, comments || (newStatus === 'approved' ? 'Approved by Reviewer' : 'Rejected by Reviewer'), leaveId);

      // Audit Log
      db.prepare(`
        INSERT INTO payroll_audit_logs (academy_id, entity_type, entity_id, action, actor_id, changes_summary, reason)
        VALUES (?, 'leave', ?, ?, ?, ?, ?)
      `).run(
        academyId,
        leaveId,
        newStatus,
        reviewerId,
        `Leave status changed from pending to ${newStatus}`,
        comments
      );

      return { leaveId, status: newStatus, daysCount };
    })();
  }

  /**
   * Cancels a pending or approved leave request, restoring deducted balance if approved
   */
  static cancelLeave(db, academyId, leaveId, reason = 'Cancelled by applicant', actorId = null) {
    return db.transaction(() => {
      const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leaveId);
      if (!leave) {
        throw new Error(`Leave request #${leaveId} not found`);
      }

      if (leave.status === 'cancelled') {
        throw new Error(`Leave request #${leaveId} is already cancelled`);
      }

      const year = new Date(leave.start_date + 'T00:00:00').getFullYear();
      const userId = leave.user_id || leave.applicant_id;
      const daysCount = Number(leave.days_count || 1.0);
      const wasApproved = leave.status === 'approved';
      const isPaid = !!leave.is_paid;

      // Restore leave balance if previously approved & paid
      if (wasApproved && isPaid) {
        db.prepare(`
          UPDATE employee_leave_balances
          SET used = MAX(0, used - ?), remaining = remaining + ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND leave_type = ? AND year = ?
        `).run(daysCount, daysCount, userId, leave.leave_type, year);
      }

      db.prepare(`
        UPDATE leave_requests
        SET status = 'cancelled', cancellation_reason = ?, cancelled_at = CURRENT_TIMESTAMP, cancelled_by = ?
        WHERE id = ?
      `).run(reason, actorId, leaveId);

      // Audit Log
      db.prepare(`
        INSERT INTO payroll_audit_logs (academy_id, entity_type, entity_id, action, actor_id, changes_summary, reason)
        VALUES (?, 'leave', ?, 'cancel', ?, ?, ?)
      `).run(
        academyId,
        leaveId,
        actorId,
        `Leave cancelled (was ${leave.status}, restored balance: ${wasApproved && isPaid})`,
        reason
      );

      return { leaveId, status: 'cancelled', restoredBalance: wasApproved && isPaid };
    })();
  }
}
