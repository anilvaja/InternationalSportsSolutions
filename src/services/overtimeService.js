/**
 * OvertimeService
 * Manages overtime tracking, threshold enforcement (default 30m boundary),
 * approval workflows (branch admin / academy admin), and compensation calculation.
 */
export class OvertimeService {

  /**
   * Fetches academy policy settings (with safe defaults)
   */
  static getAcademyPolicy(db, academyId = 1) {
    const settings = db.prepare('SELECT * FROM academy_policy_settings WHERE academy_id = ?').get(academyId);
    return settings || {
      academy_id: academyId,
      attendance_cutoff_days: 2,
      overtime_threshold_minutes: 30,
      statement_visibility_day: 25,
      expected_payday: 1,
      overtime_compensation_mode: 'standard_rate',
      timezone: 'Asia/Kolkata',
      allow_future_attendance: 0,
      default_color_theme: 'blue',
    };
  }

  /**
   * Helper: calculate minutes between HH:MM
   */
  static parseMinutes(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Submits or records an overtime event/request
   */
  static recordOvertime(db, {
    academyId = 1,
    branchId = null,
    userId,
    sessionId = null,
    date,
    scheduledStartTime,
    scheduledEndTime,
    actualStartTime,
    actualEndTime,
    overtimeMinutes = null,
    reason = '',
    requestedBy,
  }) {
    if (!userId || !date) {
      throw new Error('User ID and date are required for overtime request');
    }

    // Flag incomplete checkout: if actualStartTime provided but actualEndTime missing
    if (actualStartTime && !actualEndTime) {
      throw new Error('Missing check-out time. Overtime cannot be calculated with an incomplete shift.');
    }

    // Compute overtime duration if not explicitly passed
    let computedMinutes = overtimeMinutes;
    if (computedMinutes === null && scheduledEndTime && actualEndTime) {
      const schedEnd = this.parseMinutes(scheduledEndTime);
      const actEnd = this.parseMinutes(actualEndTime);
      computedMinutes = Math.max(0, actEnd - schedEnd);
    }

    if (computedMinutes === null || computedMinutes < 0) {
      computedMinutes = 0;
    }

    // Check for overlapping shift / duplicate submission
    const existing = db.prepare(`
      SELECT id FROM overtime_requests
      WHERE user_id = ? AND date = ? AND (session_id = ? OR session_id IS NULL)
        AND status IN ('pending', 'approved', 'auto_approved')
    `).get(userId, date, sessionId);

    if (existing && sessionId) {
      throw new Error('An overtime record or pending request already exists for this session.');
    }

    const policy = this.getAcademyPolicy(db, academyId);
    const threshold = policy.overtime_threshold_minutes ?? 30;

    // Rules:
    // 0-29 min: Normal policy (no approval required)
    // Exactly 30 min: No approval required under this threshold
    // 31 min or more: Approval required (status: 'pending')
    let approvalRequired = 0;
    let status = 'auto_approved';

    if (computedMinutes > threshold) {
      approvalRequired = 1;
      status = 'pending';

      if (!reason || !reason.trim()) {
        throw new Error(`Overtime of ${computedMinutes} mins exceeds the ${threshold}-minute threshold. A detailed reason is mandatory.`);
      }
    }

    // Calculate payable amount estimate
    const profile = db.prepare(`
      SELECT * FROM staff_salary_profiles
      WHERE user_id = ? AND is_active = 1
      ORDER BY effective_from DESC LIMIT 1
    `).get(userId);

    let payableAmount = 0;
    if (profile && computedMinutes > 0) {
      if (profile.salary_mode === 'hourly') {
        payableAmount = Number(((computedMinutes / 60) * profile.base_rate).toFixed(2));
      } else if (profile.salary_mode === 'per_minute') {
        payableAmount = Number((computedMinutes * profile.base_rate).toFixed(2));
      } else if (profile.salary_mode === 'monthly') {
        // Standard 8-hr day, 30 days
        const hourlyRate = profile.base_rate / (30 * 8);
        payableAmount = Number(((computedMinutes / 60) * hourlyRate).toFixed(2));
      }
    }

    const ins = db.prepare(`
      INSERT INTO overtime_requests (
        academy_id, branch_id, user_id, session_id, date,
        scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time,
        overtime_minutes, approval_required, reason, status, requested_by, payable_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      academyId, branchId, userId, sessionId, date,
      scheduledStartTime || null, scheduledEndTime || null,
      actualStartTime || null, actualEndTime || null,
      computedMinutes, approvalRequired, reason ? reason.trim() : null,
      status, requestedBy, payableAmount
    );

    return {
      success: true,
      requestId: ins.lastInsertRowid,
      overtimeMinutes: computedMinutes,
      approvalRequired: Boolean(approvalRequired),
      status,
      payableAmount,
      threshold,
      message: approvalRequired
        ? `Overtime of ${computedMinutes} mins exceeds ${threshold}-minute threshold and has been submitted for branch/academy admin approval.`
        : `Overtime of ${computedMinutes} mins recorded and auto-approved under normal academy policy.`,
    };
  }

  /**
   * Reviews (approves or rejects) an overtime request
   * Either branch admin or academy admin can approve/reject
   */
  static reviewOvertime(db, requestId, { status, reviewerId, reviewerNotes = null, academyId = 1 }) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new Error("Status must be either 'approved' or 'rejected'");
    }

    const request = db.prepare('SELECT * FROM overtime_requests WHERE id = ?').get(requestId);
    if (!request) {
      throw new Error(`Overtime request #${requestId} not found`);
    }

    if (request.status !== 'pending') {
      throw new Error(`Overtime request #${requestId} has already been ${request.status}`);
    }

    // Prevent user from approving their own request
    if (request.requested_by === reviewerId || request.user_id === reviewerId) {
      throw new Error('Users are not permitted to approve their own overtime requests.');
    }

    db.prepare(`
      UPDATE overtime_requests
      SET status = ?, approved_by = ?, reviewer_notes = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, reviewerId, reviewerNotes, requestId);

    // If approved, sync with any provisional salary statement for this period
    const yearMonth = request.date.slice(0, 7);
    const period = db.prepare('SELECT id, status FROM staff_payroll_periods WHERE academy_id = ? AND year_month = ?')
      .get(academyId, yearMonth);

    if (period && period.status !== 'finalized' && status === 'approved') {
      const statement = db.prepare('SELECT id FROM staff_salary_statements WHERE payroll_period_id = ? AND user_id = ?')
        .get(period.id, request.user_id);

      if (statement && request.payable_amount > 0) {
        // Add or update an itemized adjustment for this approved overtime
        db.prepare(`
          INSERT INTO staff_salary_adjustments (statement_id, type, category, amount, reason, created_by)
          VALUES (?, 'addition', 'overtime', ?, ?, ?)
        `).run(
          statement.id,
          request.payable_amount,
          `Approved Overtime on ${request.date} (${request.overtime_minutes} mins)`,
          reviewerId
        );
      }
    }

    return {
      success: true,
      requestId,
      status,
      message: `Overtime request #${requestId} has been marked as ${status}.`,
    };
  }

  /**
   * Lists overtime requests with filtering
   */
  static getOvertimeRequests(db, { academyId = 1, userId = null, branchId = null, status = null, yearMonth = null }) {
    let query = `
      SELECT o.*, u.name as employee_name, u.email as employee_email, u.role as employee_role,
             b.name as branch_name, r.name as reviewer_name
      FROM overtime_requests o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN branches b ON o.branch_id = b.id
      LEFT JOIN users r ON o.approved_by = r.id
      WHERE o.academy_id = ?
    `;
    const params = [academyId];

    if (userId) {
      query += ' AND o.user_id = ?';
      params.push(userId);
    }
    if (branchId) {
      query += ' AND o.branch_id = ?';
      params.push(branchId);
    }
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    if (yearMonth) {
      query += ' AND o.date LIKE ?';
      params.push(`${yearMonth}%`);
    }

    query += ' ORDER BY o.date DESC, o.created_at DESC';
    return db.prepare(query).all(...params);
  }
}
