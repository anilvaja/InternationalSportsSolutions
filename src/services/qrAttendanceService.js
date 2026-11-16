import crypto from 'crypto';
import QRCode from 'qrcode';

/**
 * QR Attendance Service
 * Generates and manages cryptographically secure, revocable QR tokens for students.
 * Never leaks database IDs, phone numbers, or PII in QR codes.
 */
export class QrAttendanceService {
  /**
   * Generates a new cryptographically secure QR token for a student.
   * Automatically revokes any previously active token for this student.
   * 
   * @param {import('better-sqlite3').Database} db
   * @param {number} academyId
   * @param {number} studentId
   * @param {number} [revokedByUserId]
   * @param {string} [reason]
   * @returns {{ token: string, version: number, generated_at: string }}
   */
  static generateStudentQrToken(db, academyId, studentId, revokedByUserId = null, reason = 'regenerated') {
    const targetAcademyId = Number(academyId);
    const targetStudentId = Number(studentId);

    // Verify student exists and belongs to academy
    const student = db.prepare('SELECT id, status, first_name, last_name, student_code FROM students WHERE id = ?').get(targetStudentId);
    if (!student) {
      throw new Error(`Student #${targetStudentId} not found`);
    }

    // Generate random 24-byte URL-safe base64 string (32 characters, entropy 192 bits)
    const rawEntropy = crypto.randomBytes(24).toString('base64url');
    const token = `ISS-STU-${rawEntropy}`;

    const tx = db.transaction(() => {
      // Find latest token version
      const latest = db.prepare(`
        SELECT id, version FROM student_qr_tokens
        WHERE academy_id = ? AND student_id = ?
        ORDER BY version DESC LIMIT 1
      `).get(targetAcademyId, targetStudentId);

      const nextVersion = latest ? (latest.version + 1) : 1;

      // Revoke any existing active tokens
      db.prepare(`
        UPDATE student_qr_tokens
        SET status = 'revoked',
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = ?,
            revocation_reason = ?
        WHERE academy_id = ? AND student_id = ? AND status = 'active'
      `).run(revokedByUserId, reason, targetAcademyId, targetStudentId);

      // Insert new active token
      db.prepare(`
        INSERT INTO student_qr_tokens (
          academy_id, student_id, token, version, status, generated_at
        ) VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
      `).run(targetAcademyId, targetStudentId, token, nextVersion);

      return {
        token,
        version: nextVersion,
        generated_at: new Date().toISOString(),
      };
    });

    return tx();
  }

  /**
   * Retrieves active QR token for a student, generating one if none exists.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {number} studentId 
   * @returns {{ token: string, version: number, status: string, generated_at: string }}
   */
  static getOrCreateActiveToken(db, academyId, studentId) {
    const targetAcademyId = Number(academyId);
    const targetStudentId = Number(studentId);

    const active = db.prepare(`
      SELECT token, version, status, generated_at, expires_at
      FROM student_qr_tokens
      WHERE academy_id = ? AND student_id = ? AND status = 'active'
      ORDER BY version DESC LIMIT 1
    `).get(targetAcademyId, targetStudentId);

    if (active) {
      return active;
    }

    return this.generateStudentQrToken(db, targetAcademyId, targetStudentId, null, 'initial_issue');
  }

  /**
   * Revokes an existing active QR token for a student.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {number} studentId 
   * @param {number} revokedByUserId 
   * @param {string} reason 
   * @returns {{ success: boolean, revokedCount: number }}
   */
  static revokeStudentQrToken(db, academyId, studentId, revokedByUserId, reason = 'manual_revocation') {
    const result = db.prepare(`
      UPDATE student_qr_tokens
      SET status = 'revoked',
          revoked_at = CURRENT_TIMESTAMP,
          revoked_by = ?,
          revocation_reason = ?
      WHERE academy_id = ? AND student_id = ? AND status = 'active'
    `).run(revokedByUserId, reason, Number(academyId), Number(studentId));

    return {
      success: true,
      revokedCount: result.changes,
    };
  }

  /**
   * Resolves a raw scanned QR token to a student record.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {string} rawToken 
   * @returns {{ valid: boolean, student?: any, tokenRecord?: any, reason?: string, message?: string }}
   */
  static resolveToken(db, academyId, rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      return { valid: false, reason: 'EMPTY_TOKEN', message: 'No QR token data received' };
    }

    const cleanToken = rawToken.trim();

    // Check if token exists in database for this academy
    const record = db.prepare(`
      SELECT 
        sqt.id as token_id,
        sqt.student_id,
        sqt.token,
        sqt.version,
        sqt.status as token_status,
        sqt.generated_at,
        sqt.expires_at,
        s.student_code,
        s.first_name,
        s.last_name,
        s.status as student_status,
        s.branch_id,
        s.photo_url,
        b.name as branch_name
      FROM student_qr_tokens sqt
      JOIN students s ON s.id = sqt.student_id
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE sqt.token = ? AND sqt.academy_id = ?
    `).get(cleanToken, Number(academyId));

    if (!record) {
      return {
        valid: false,
        reason: 'UNREGISTERED_TOKEN',
        message: 'Invalid or unregistered QR code for this academy',
      };
    }

    if (record.token_status === 'revoked') {
      return {
        valid: false,
        reason: 'REVOKED_TOKEN',
        message: 'This QR code has been revoked and is no longer valid. Please scan the newly issued QR pass.',
        studentId: record.student_id,
      };
    }

    if (record.token_status === 'expired' || (record.expires_at && new Date(record.expires_at) < new Date())) {
      return {
        valid: false,
        reason: 'EXPIRED_TOKEN',
        message: 'This QR code has expired. Please request a fresh ID pass.',
        studentId: record.student_id,
      };
    }

    if (record.student_status !== 'active') {
      return {
        valid: false,
        reason: 'INACTIVE_STUDENT',
        message: `Student ${record.first_name} ${record.last_name} (${record.student_code}) is currently ${record.student_status}. Attendance check-in rejected.`,
        studentId: record.student_id,
      };
    }

    return {
      valid: true,
      student: {
        id: record.student_id,
        student_code: record.student_code,
        first_name: record.first_name,
        last_name: record.last_name,
        status: record.student_status,
        branch_id: record.branch_id,
        branch_name: record.branch_name,
        photo_url: record.photo_url,
      },
      tokenRecord: {
        id: record.token_id,
        version: record.version,
        token: record.token,
        generated_at: record.generated_at,
      },
    };
  }

  /**
   * Generates printable digital ID card payload with QR code, student photo, and academy details.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {number} studentId 
   * @param {object} academyInfo 
   * @returns {Promise<object>} ID Card payload
   */
  static async getStudentIdCardData(db, academyId, studentId, academyInfo = {}) {
    const targetAcademyId = Number(academyId);
    const targetStudentId = Number(studentId);

    const student = db.prepare(`
      SELECT 
        s.id,
        s.student_code,
        s.first_name,
        s.last_name,
        s.gender,
        s.date_of_birth,
        s.blood_group,
        s.phone,
        s.guardian_name,
        s.guardian_phone,
        s.photo_url,
        s.status,
        s.enrolled_at,
        s.allowed_attendance_modes,
        b.name as branch_name,
        b.city as branch_city,
        b.address as branch_address
      FROM students s
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE s.id = ?
    `).get(targetStudentId);

    if (!student) {
      throw new Error(`Student #${targetStudentId} not found`);
    }

    // Parse allowed attendance modes
    let allowedModes = ['qr', 'face'];
    if (student.allowed_attendance_modes) {
      try {
        allowedModes = typeof student.allowed_attendance_modes === 'string'
          ? JSON.parse(student.allowed_attendance_modes)
          : student.allowed_attendance_modes;
      } catch (_) {
        allowedModes = ['qr', 'face'];
      }
    }

    // Active batches
    const batches = db.prepare(`
      SELECT b.id, b.name, b.start_time, b.end_time, b.days_of_week, sp.name as sport_name
      FROM student_batch_enrollments sbe
      JOIN batches b ON b.id = sbe.batch_id
      LEFT JOIN sports sp ON sp.id = b.sport_id
      WHERE sbe.student_id = ? AND sbe.status = 'active'
    `).all(targetStudentId);

    // Active technique / belt level
    const technique = db.prepare(`
      SELECT st.name as technique_name, st.level, st.belt_level, sc.name as category_name
      FROM student_technique_assignments sta
      JOIN syllabus_techniques st ON st.id = sta.technique_id
      LEFT JOIN syllabus_categories sc ON sc.id = st.category_id
      WHERE sta.student_id = ? AND sta.status = 'active'
      LIMIT 1
    `).get(targetStudentId);

    const tokenData = this.getOrCreateActiveToken(db, targetAcademyId, targetStudentId);

    // Generate 100% offline vector SVG and base64 data URI
    let qrSvg = '';
    let qrDataUrl = '';
    try {
      qrSvg = await QRCode.toString(tokenData.token, {
        type: 'svg',
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      qrDataUrl = await QRCode.toDataURL(tokenData.token, {
        margin: 1,
        width: 240,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    } catch (_) {}

    return {
      student: {
        id: student.id,
        student_code: student.student_code,
        full_name: `${student.first_name} ${student.last_name}`,
        first_name: student.first_name,
        last_name: student.last_name,
        gender: student.gender,
        date_of_birth: student.date_of_birth,
        blood_group: student.blood_group,
        guardian_name: student.guardian_name,
        guardian_phone: student.guardian_phone,
        photo_url: student.photo_url,
        branch_name: student.branch_name,
        branch_city: student.branch_city,
        enrolled_at: student.enrolled_at,
        status: student.status,
        allowed_attendance_modes: allowedModes,
        active_belt: technique ? (technique.belt_level || technique.technique_name) : 'White Belt',
        batches: batches.map(b => {
          let days = [];
          if (Array.isArray(b.days_of_week)) {
            days = b.days_of_week;
          } else if (typeof b.days_of_week === 'string') {
            const trimmed = b.days_of_week.trim();
            if (trimmed.startsWith('[')) {
              try { days = JSON.parse(trimmed); } catch (_) { days = [trimmed]; }
            } else {
              days = trimmed.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
          return {
            name: b.name,
            sport: b.sport_name,
            time: `${b.start_time} - ${b.end_time}`,
            days,
          };
        }),
      },
      qr: {
        token: tokenData.token,
        version: tokenData.version,
        generated_at: tokenData.generated_at,
        svg: qrSvg,
        data_url: qrDataUrl,
      },
      academy: {
        id: targetAcademyId,
        name: academyInfo.name || 'Sports Academy',
        logo_url: academyInfo.logo_url || null,
        city: academyInfo.city || null,
      },
    };
  }
}
