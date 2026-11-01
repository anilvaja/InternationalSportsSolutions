import { DateUtils } from '../utils/dateUtils.js';

/**
 * ShiftCheckoutService
 * Handles automatic employee shift checkout and shift policy enforcement.
 * - Identifies active in-progress punches past shift-end threshold + configurable grace period
 * - Closes sessions safely with status = 'auto_closed' without touching future shifts
 * - Records scheduled end time, actual checkout time and automated reasons
 * - Creates detailed audit history
 * - Supports admin corrections & payroll recalculations
 */
export class ShiftCheckoutService {
  /**
   * Retrieves tenant auto-checkout settings
   */
  static getPolicySettings(db) {
    const defaultSettings = {
      auto_checkout_enabled: true,
      auto_checkout_grace_minutes: 60,
      allow_overnight_shifts: true,
    };
    try {
      const rows = db.prepare("SELECT key, value FROM tenant_settings WHERE key LIKE 'auto_checkout_%'").all();
      for (const row of rows) {
        if (row.key === 'auto_checkout_enabled') defaultSettings.auto_checkout_enabled = row.value === 'true' || row.value === '1';
        if (row.key === 'auto_checkout_grace_minutes') defaultSettings.auto_checkout_grace_minutes = parseInt(row.value) || 60;
        if (row.key === 'auto_checkout_allow_overnight') defaultSettings.allow_overnight_shifts = row.value === 'true' || row.value === '1';
      }
    } catch (_) {}
    return defaultSettings;
  }

  /**
   * Updates tenant auto-checkout settings
   */
  static updatePolicySettings(db, { auto_checkout_enabled, auto_checkout_grace_minutes, allow_overnight_shifts }) {
    const upsert = db.prepare(`
      INSERT INTO tenant_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    if (auto_checkout_enabled !== undefined) upsert.run('auto_checkout_enabled', String(auto_checkout_enabled));
    if (auto_checkout_grace_minutes !== undefined) upsert.run('auto_checkout_grace_minutes', String(auto_checkout_grace_minutes));
    if (allow_overnight_shifts !== undefined) upsert.run('auto_checkout_allow_overnight', String(allow_overnight_shifts));
    return this.getPolicySettings(db);
  }

  /**
   * Automatically closes shifts that have exceeded the shift end + grace period
   */
  static processAutomaticShiftCheckouts(db, academyId, options = {}) {
    const policy = this.getPolicySettings(db);
    if (!policy.auto_checkout_enabled && !options.force) {
      return { success: true, closedCount: 0, closedPunches: [], message: 'Auto checkout policy is currently disabled' };
    }

    const graceMinutes = options.graceMinutes !== undefined ? Number(options.graceMinutes) : policy.auto_checkout_grace_minutes;
    const now = options.referenceTime ? new Date(options.referenceTime) : new Date();
    const todayStr = options.referenceTime 
      ? new Date(options.referenceTime).toISOString().split('T')[0]
      : DateUtils.getTodayDate('Asia/Kolkata');

    // Query active in_progress punches
    const activePunches = db.prepare(`
      SELECT p.*, u.name as user_name, u.role as user_role
      FROM staff_time_punches p
      JOIN users u ON u.id = p.user_id
      WHERE p.status = 'in_progress' AND p.academy_id = ?
    `).all(academyId);

    const closedPunches = [];

    for (const punch of activePunches) {
      // Find shift schedule for this employee on punch date
      const punchDateObj = new Date(punch.punch_date + 'T00:00:00');
      let dayOfWeek = punchDateObj.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7; // 1=Mon, ..., 7=Sun

      const shift = db.prepare(`
        SELECT s.* FROM employee_schedule_shifts s
        JOIN employee_work_schedules ws ON s.schedule_id = ws.id
        WHERE s.user_id = ? AND s.day_of_week = ? AND ws.is_active = 1
        ORDER BY s.end_time DESC LIMIT 1
      `).get(punch.user_id, dayOfWeek);

      const scheduledEndTime = shift ? shift.end_time : '18:00';
      const scheduledOutTime = new Date(`${punch.punch_date}T${scheduledEndTime}:00`);
      const thresholdTime = new Date(scheduledOutTime.getTime() + graceMinutes * 60000);

      // Check if threshold has passed (or if punch is from a previous calendar day)
      const isPastDay = punch.punch_date < todayStr;
      const isPastThreshold = now >= thresholdTime;

      if (isPastDay || isPastThreshold) {
        // Safe duration calculation
        const inTime = new Date(punch.punch_in_time);
        const outTime = isPastDay ? scheduledOutTime : (now < scheduledOutTime ? now : scheduledOutTime);
        const durationMinutes = Math.max(1, Math.round((outTime.getTime() - inTime.getTime()) / 60000));

        const autoReason = `[Auto-Closed] Shift ended at ${scheduledEndTime} (Grace period: ${graceMinutes}m elapsed)`;
        const updatedNotes = punch.notes ? `${punch.notes} | ${autoReason}` : autoReason;
        const outTimeIso = outTime.toISOString();

        db.prepare(`
          UPDATE staff_time_punches
          SET punch_out_time = ?,
              duration_minutes = ?,
              status = 'auto_closed',
              notes = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(outTimeIso, durationMinutes, updatedNotes, punch.id);

        // Audit log
        try {
          db.prepare(`
            INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details)
            VALUES (?, ?, ?, 'AUTO_CHECKOUT', 'staff_time_punches', ?)
          `).run(
            punch.user_id,
            punch.user_name,
            punch.user_role || 'staff',
            `System auto-closed punch #${punch.id} for ${punch.user_name}. Scheduled end: ${scheduledEndTime}, Duration: ${durationMinutes}m`
          );
        } catch (err) {
          console.error('[ShiftCheckout Audit Log Error]', err);
        }

        closedPunches.push({
          punchId: punch.id,
          userId: punch.user_id,
          userName: punch.user_name,
          punchDate: punch.punch_date,
          punchInTime: punch.punch_in_time,
          punchOutTime: outTimeIso,
          durationMinutes,
          reason: autoReason
        });
      }
    }

    return {
      success: true,
      closedCount: closedPunches.length,
      closedPunches,
      message: `Processed automatic checkouts: ${closedPunches.length} punch(es) auto-closed.`
    };
  }
}
