/**
 * NFC / RFID Reader Adapter & Card Assignment Service
 * Handles contactless wristbands, MIFARE/NTAG RFID cards, and USB/Web NFC readers.
 */
export class NfcReaderAdapter {
  /**
   * Normalizes NFC UID to standard uppercase colon-separated format (e.g. 04:5A:8B:2C:9E:61:80)
   * 
   * @param {string} rawUid 
   * @returns {string}
   */
  static normalizeUid(rawUid) {
    if (!rawUid || typeof rawUid !== 'string') return '';
    const clean = rawUid.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    if (clean.length % 2 !== 0) return clean;
    return clean.match(/.{1,2}/g).join(':');
  }

  /**
   * Assigns an NFC / RFID card or wristband to a student.
   * Enforces uniqueness per academy and prevents card hijacking.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {number} studentId 
   * @param {object} params 
   * @returns {object}
   */
  static assignCard(db, academyId, studentId, {
    card_uid,
    card_type = 'standard_nfc',
    label = 'Student NFC Pass',
    assigned_by = null,
    notes = null,
  }) {
    const targetAcademyId = Number(academyId);
    const targetStudentId = Number(studentId);
    const normalizedUid = this.normalizeUid(card_uid);

    if (!normalizedUid) {
      throw new Error('Valid NFC / RFID Card UID is required');
    }

    const student = db.prepare('SELECT id, first_name, last_name, student_code, status FROM students WHERE id = ?').get(targetStudentId);
    if (!student) {
      throw new Error(`Student #${targetStudentId} not found`);
    }

    const tx = db.transaction(() => {
      // Check if this UID is already assigned to another active student in the academy
      const existingCard = db.prepare(`
        SELECT snc.id, snc.student_id, snc.status, s.first_name, s.last_name, s.student_code
        FROM student_nfc_cards snc
        JOIN students s ON s.id = snc.student_id
        WHERE snc.academy_id = ? AND snc.card_uid = ? AND snc.status = 'active'
      `).get(targetAcademyId, normalizedUid);

      if (existingCard) {
        if (existingCard.student_id === targetStudentId) {
          return { id: existingCard.id, card_uid: normalizedUid, status: 'active', message: 'Card is already assigned to this student' };
        }
        throw new Error(
          `Card UID ${normalizedUid} is currently active and assigned to student ${existingCard.first_name} ${existingCard.last_name} (${existingCard.student_code}). Deactivate or report it lost first.`
        );
      }

      // Deactivate previous active card for this student
      db.prepare(`
        UPDATE student_nfc_cards
        SET status = 'unassigned',
            revoked_at = CURRENT_TIMESTAMP,
            revocation_reason = 'Replaced by new card assignment'
        WHERE academy_id = ? AND student_id = ? AND status = 'active'
      `).run(targetAcademyId, targetStudentId);

      // Insert or replace new assignment
      const ins = db.prepare(`
        INSERT INTO student_nfc_cards (
          academy_id, student_id, card_uid, card_type, label, status, assigned_by, notes
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
      `).run(targetAcademyId, targetStudentId, normalizedUid, card_type, label, assigned_by, notes);

      return {
        id: ins.lastInsertRowid,
        card_uid: normalizedUid,
        student_id: targetStudentId,
        student_code: student.student_code,
        status: 'active',
        assigned_at: new Date().toISOString(),
      };
    });

    return tx();
  }

  /**
   * Revokes or reports an NFC card as lost/damaged.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {string} cardUid 
   * @param {object} params
   * @returns {object}
   */
  static revokeCard(db, academyId, cardUid, { status = 'lost', revoked_by = null, reason = 'reported_lost' }) {
    const targetAcademyId = Number(academyId);
    const normalizedUid = this.normalizeUid(cardUid);

    const result = db.prepare(`
      UPDATE student_nfc_cards
      SET status = ?,
          revoked_at = CURRENT_TIMESTAMP,
          revocation_reason = ?
      WHERE academy_id = ? AND card_uid = ? AND status = 'active'
    `).run(status, reason, targetAcademyId, normalizedUid);

    return {
      success: true,
      card_uid: normalizedUid,
      revokedCount: result.changes,
    };
  }

  /**
   * Resolves an NFC tap to an active student record.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {string} rawUid 
   * @returns {object}
   */
  static resolveCard(db, academyId, rawUid) {
    const normalizedUid = this.normalizeUid(rawUid);
    if (!normalizedUid) {
      return { valid: false, reason: 'EMPTY_UID', message: 'No NFC Card UID detected' };
    }

    const record = db.prepare(`
      SELECT 
        snc.id as card_id,
        snc.student_id,
        snc.card_uid,
        snc.status as card_status,
        snc.card_type,
        s.first_name,
        s.last_name,
        s.student_code,
        s.status as student_status,
        s.branch_id,
        s.photo_url,
        b.name as branch_name
      FROM student_nfc_cards snc
      JOIN students s ON s.id = snc.student_id
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE snc.academy_id = ? AND snc.card_uid = ?
      ORDER BY snc.id DESC LIMIT 1
    `).get(Number(academyId), normalizedUid);

    if (!record) {
      return {
        valid: false,
        reason: 'UNREGISTERED_CARD',
        cardUid: normalizedUid,
        message: `Unregistered NFC card/wristband (UID: ${normalizedUid}). Please assign this card to a student in the admin panel.`,
      };
    }

    if (record.card_status !== 'active') {
      return {
        valid: false,
        reason: 'CARD_REVOKED',
        cardUid: normalizedUid,
        cardStatus: record.card_status,
        studentId: record.student_id,
        message: `This card has been marked as ${record.card_status}. Check-in denied.`,
      };
    }

    if (record.student_status !== 'active') {
      return {
        valid: false,
        reason: 'INACTIVE_STUDENT',
        cardUid: normalizedUid,
        studentId: record.student_id,
        message: `Student ${record.first_name} ${record.last_name} (${record.student_code}) is currently ${record.student_status}. Attendance check-in rejected.`,
      };
    }

    return {
      valid: true,
      cardRecord: {
        id: record.card_id,
        uid: record.card_uid,
        type: record.card_type,
      },
      student: {
        id: record.student_id,
        student_code: record.student_code,
        first_name: record.first_name,
        last_name: record.last_name,
        branch_id: record.branch_id,
        branch_name: record.branch_name,
        status: record.student_status,
        photo_url: record.photo_url,
      },
    };
  }
}
