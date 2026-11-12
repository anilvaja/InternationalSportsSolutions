import crypto from 'crypto';

/**
 * Event Pass & Attendance Isolation Service
 * Manages unique event-specific QR passes and entrance check-in.
 * 
 * Strict Architecture Rule:
 * Event check-in NEVER touches batch training attendance (attendance / student_attendance).
 */
export class EventPassService {
  /**
   * Generates or retrieves an event-specific cryptographic QR pass for an enrolled participant.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {number} eventId 
   * @param {number} studentId 
   * @returns {object}
   */
  static getOrCreateEventPass(db, academyId, eventId, studentId) {
    const targetAcademyId = Number(academyId);
    const targetEventId = Number(eventId);
    const targetStudentId = Number(studentId);

    // Verify event exists
    const event = db.prepare(`
      SELECT id, title, type, event_date, status
      FROM events
      WHERE id = ? AND academy_id = ?
    `).get(targetEventId, targetAcademyId);

    if (!event) {
      throw new Error(`Event #${targetEventId} not found`);
    }

    // Verify student exists
    const student = db.prepare('SELECT id, first_name, last_name, student_code, status FROM students WHERE id = ?').get(targetStudentId);
    if (!student) {
      throw new Error(`Student #${targetStudentId} not found`);
    }

    const tx = db.transaction(() => {
      // Find or create participant record
      let participant = db.prepare(`
        SELECT id, status, registration_status
        FROM event_participants
        WHERE event_id = ? AND student_id = ?
      `).get(targetEventId, targetStudentId);

      if (!participant) {
        const insP = db.prepare(`
          INSERT INTO event_participants (event_id, student_id, status, registration_status)
          VALUES (?, ?, 'interested', 'confirmed')
        `).run(targetEventId, targetStudentId);
        participant = { id: insP.lastInsertRowid, status: 'interested', registration_status: 'confirmed' };
      }

      // Check for existing pass
      const existingPass = db.prepare(`
        SELECT id, pass_code, status, checked_in_at, created_at
        FROM event_passes
        WHERE event_id = ? AND student_id = ?
      `).get(targetEventId, targetStudentId);

      if (existingPass && existingPass.status === 'active') {
        return {
          pass_code: existingPass.pass_code,
          status: existingPass.status,
          event_title: event.title,
          student_name: `${student.first_name} ${student.last_name}`,
          student_code: student.student_code,
          created_at: existingPass.created_at,
        };
      }

      // Generate secure unique pass code
      const rawEntropy = crypto.randomBytes(20).toString('base64url');
      const passCode = `ISS-EVT-${rawEntropy}`;

      db.prepare(`
        INSERT INTO event_passes (academy_id, event_id, student_id, participant_id, pass_code, status)
        VALUES (?, ?, ?, ?, ?, 'active')
        ON CONFLICT(event_id, student_id) DO UPDATE SET
          pass_code = excluded.pass_code,
          status = 'active',
          checked_in_at = NULL,
          checked_in_by = NULL
      `).run(targetAcademyId, targetEventId, targetStudentId, participant.id, passCode);

      return {
        pass_code: passCode,
        status: 'active',
        event_title: event.title,
        student_name: `${student.first_name} ${student.last_name}`,
        student_code: student.student_code,
        created_at: new Date().toISOString(),
      };
    });

    return tx();
  }

  /**
   * Scans and checks in an event pass at the venue entrance.
   * Prevents pass reuse, checks event status, and marks event attendance without touching regular class attendance.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {string} rawPassCode 
   * @param {object} context { operatorUserId, deviceId }
   * @returns {object} Check-in outcome
   */
  static checkInEventPass(db, academyId, rawPassCode, { operatorUserId = null, deviceId = null } = {}) {
    if (!rawPassCode || typeof rawPassCode !== 'string') {
      return { success: false, reason: 'EMPTY_PASS', message: 'No event pass code received' };
    }

    const cleanPass = rawPassCode.trim();

    const pass = db.prepare(`
      SELECT 
        ep.id as pass_id,
        ep.pass_code,
        ep.status as pass_status,
        ep.checked_in_at,
        ep.event_id,
        ep.student_id,
        e.title as event_title,
        e.type as event_type,
        e.event_date,
        e.status as event_status,
        s.first_name,
        s.last_name,
        s.student_code,
        s.status as student_status,
        s.photo_url
      FROM event_passes ep
      JOIN events e ON e.id = ep.event_id
      JOIN students s ON s.id = ep.student_id
      WHERE ep.pass_code = ? AND ep.academy_id = ?
    `).get(cleanPass, Number(academyId));

    if (!pass) {
      return {
        success: false,
        reason: 'UNREGISTERED_PASS',
        message: 'Invalid or unrecognized event pass',
      };
    }

    if (pass.pass_status === 'used') {
      return {
        success: false,
        reason: 'PASS_ALREADY_USED',
        message: `Pass already used! ${pass.first_name} ${pass.last_name} was checked in earlier on ${pass.checked_in_at}`,
        student: {
          first_name: pass.first_name,
          last_name: pass.last_name,
          student_code: pass.student_code,
        },
        checkedInAt: pass.checked_in_at,
      };
    }

    if (pass.pass_status === 'revoked') {
      return {
        success: false,
        reason: 'PASS_REVOKED',
        message: 'This event pass has been cancelled or revoked',
      };
    }

    if (['cancelled', 'draft'].includes(pass.event_status)) {
      return {
        success: false,
        reason: 'EVENT_INACTIVE',
        message: `Event "${pass.event_title}" is currently ${pass.event_status}. Check-in closed.`,
      };
    }

    const tx = db.transaction(() => {
      // 1. Mark pass as used
      db.prepare(`
        UPDATE event_passes
        SET status = 'used',
            checked_in_at = CURRENT_TIMESTAMP,
            checked_in_by = ?,
            device_id = ?
        WHERE id = ?
      `).run(operatorUserId, deviceId, pass.pass_id);

      // 2. Mark event participant status as 'attended'
      db.prepare(`
        UPDATE event_participants
        SET status = 'attended',
            updated_at = CURRENT_TIMESTAMP
        WHERE event_id = ? AND student_id = ?
      `).run(pass.event_id, pass.student_id);

      return {
        success: true,
        event: {
          id: pass.event_id,
          title: pass.event_title,
          type: pass.event_type,
          event_date: pass.event_date,
        },
        student: {
          id: pass.student_id,
          first_name: pass.first_name,
          last_name: pass.last_name,
          student_code: pass.student_code,
          photo_url: pass.photo_url,
        },
        checked_in_at: new Date().toISOString(),
        message: `Welcome ${pass.first_name} ${pass.last_name}! Checked in to ${pass.event_title}.`,
      };
    });

    return tx();
  }
}
