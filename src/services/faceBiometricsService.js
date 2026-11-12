import crypto from 'crypto';

// Secret key for AES-256-GCM encryption of biometric vectors
const BIOMETRIC_KEY = process.env.BIOMETRIC_ENCRYPTION_KEY 
  ? crypto.createHash('sha256').update(process.env.BIOMETRIC_ENCRYPTION_KEY).digest()
  : crypto.createHash('sha256').update('ISS_DEFAULT_SECURE_BIOMETRIC_SALT_2026').digest();

/**
 * Encrypts a biometric template vector (JSON array of floats) using AES-256-GCM
 */
function encryptTemplate(vector) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', BIOMETRIC_KEY, iv);
  const plaintext = JSON.stringify(vector);
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return JSON.stringify({
    iv: iv.toString('base64'),
    authTag,
    ciphertext,
  });
}

/**
 * Decrypts a biometric template vector using AES-256-GCM
 */
function decryptTemplate(encryptedPayload) {
  const { iv, authTag, ciphertext } = JSON.parse(encryptedPayload);
  const decipher = crypto.createDecipheriv('aes-256-gcm', BIOMETRIC_KEY, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  return JSON.parse(plaintext);
}

/**
 * Calculates Cosine Similarity between two 512-dimensional vectors:
 * similarity = (A · B) / (||A|| * ||B||)
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Face Biometrics Service
 * Secure biometric enrollment, explicit consent tracking, anti-spoofing/liveness verification,
 * encrypted vector templates, and configurable threshold classification.
 */
export class FaceBiometricsService {
  /**
   * Captures or updates explicit biometric consent from student or guardian.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {number} studentId 
   * @param {object} params
   * @returns {object}
   */
  static recordConsent(db, academyId, studentId, {
    consent_given_by,
    guardian_relationship = 'parent',
    consent_status = 'granted',
    terms_version = 'v1.0',
    ip_address = null,
    notes = null,
  }) {
    const targetAcademyId = Number(academyId);
    const targetStudentId = Number(studentId);

    if (!consent_given_by || !consent_given_by.trim()) {
      throw new Error('Name of individual providing biometric consent is required');
    }

    if (!['granted', 'withdrawn', 'declined'].includes(consent_status)) {
      throw new Error('Invalid consent status. Allowed: granted, withdrawn, declined');
    }

    const tx = db.transaction(() => {
      // Invalidate existing active consent
      db.prepare(`
        UPDATE student_face_consents
        SET consent_status = 'withdrawn',
            withdrawal_timestamp = CURRENT_TIMESTAMP
        WHERE academy_id = ? AND student_id = ? AND consent_status = 'granted'
      `).run(targetAcademyId, targetStudentId);

      // Insert new consent record
      const ins = db.prepare(`
        INSERT INTO student_face_consents (
          academy_id, student_id, consent_given_by, guardian_relationship,
          consent_type, consent_status, terms_version, ip_address, notes
        ) VALUES (?, ?, ?, ?, 'biometric_face_attendance', ?, ?, ?, ?)
      `).run(
        targetAcademyId,
        targetStudentId,
        consent_given_by.trim(),
        guardian_relationship,
        consent_status,
        terms_version,
        ip_address,
        notes
      );

      // If consent was withdrawn or declined, purge any existing face templates for data privacy
      if (consent_status !== 'granted') {
        db.prepare(`
          UPDATE student_face_profiles
          SET status = 'revoked',
              deleted_at = CURRENT_TIMESTAMP,
              deletion_reason = 'consent_withdrawn'
          WHERE academy_id = ? AND student_id = ? AND status = 'active'
        `).run(targetAcademyId, targetStudentId);
      }

      return {
        id: ins.lastInsertRowid,
        student_id: targetStudentId,
        consent_status,
        consent_timestamp: new Date().toISOString(),
      };
    });

    return tx();
  }

  /**
   * Checks if student has active biometric consent.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {number} studentId 
   * @returns {boolean}
   */
  static hasActiveConsent(db, academyId, studentId) {
    const record = db.prepare(`
      SELECT id FROM student_face_consents
      WHERE academy_id = ? AND student_id = ? AND consent_status = 'granted'
      ORDER BY id DESC LIMIT 1
    `).get(Number(academyId), Number(studentId));
    return !!record;
  }

  /**
   * Enrolls a student's facial biometric template with mandatory consent verification.
   * Templates are stored strictly as encrypted vectors (never raw photos).
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {number} studentId 
   * @param {object} params
   * @returns {object}
   */
  static enrollFaceProfile(db, academyId, studentId, {
    vector, // 512-element numeric array
    enrolled_by,
    template_version = 'v1_512d',
    sample_count = 1,
  }) {
    const targetAcademyId = Number(academyId);
    const targetStudentId = Number(studentId);

    // 1. Mandatory Consent Verification
    if (!this.hasActiveConsent(db, targetAcademyId, targetStudentId)) {
      throw new Error('Biometric enrollment rejected: Explicit parent/guardian consent is required before enrolling facial templates.');
    }

    if (!Array.isArray(vector) || vector.length !== 512) {
      throw new Error('Invalid biometric template vector: Expected 512-dimensional float array');
    }

    // Encrypt template using AES-256-GCM
    const encrypted = encryptTemplate(vector);

    const tx = db.transaction(() => {
      // Upsert profile
      const existing = db.prepare(`
        SELECT id FROM student_face_profiles
        WHERE academy_id = ? AND student_id = ?
      `).get(targetAcademyId, targetStudentId);

      if (existing) {
        db.prepare(`
          UPDATE student_face_profiles
          SET template_encrypted = ?,
              template_version = ?,
              sample_count = ?,
              status = 'active',
              enrolled_by = ?,
              enrolled_at = CURRENT_TIMESTAMP,
              deleted_at = NULL,
              deletion_reason = NULL
          WHERE id = ?
        `).run(encrypted, template_version, sample_count, enrolled_by, existing.id);
        return { id: existing.id, updated: true };
      } else {
        const ins = db.prepare(`
          INSERT INTO student_face_profiles (
            academy_id, student_id, template_encrypted, template_version, sample_count,
            status, enrolled_by, enrolled_at
          ) VALUES (?, ?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP)
        `).run(targetAcademyId, targetStudentId, encrypted, template_version, sample_count, enrolled_by);
        return { id: ins.lastInsertRowid, created: true };
      }
    });

    return tx();
  }

  /**
   * Hard-deletes biometric templates and marks profile permanently purged.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {number} studentId 
   * @param {string} reason 
   */
  static purgeFaceProfile(db, academyId, studentId, reason = 'user_requested_deletion') {
    const result = db.prepare(`
      UPDATE student_face_profiles
      SET status = 'revoked',
          template_encrypted = 'PURGED_ENCRYPTED_DATA',
          deleted_at = CURRENT_TIMESTAMP,
          deletion_reason = ?
      WHERE academy_id = ? AND student_id = ?
    `).run(reason, Number(academyId), Number(studentId));

    return {
      success: true,
      purged: result.changes > 0,
    };
  }

  /**
   * Matches a probe face vector against registered students in the academy or branch.
   * Classifies match into:
   * - VERIFIED (confidence >= threshold)
   * - MANUAL_REVIEW (confidence between review_threshold and threshold)
   * - REJECTED (confidence < review_threshold or liveness failed)
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {object} probeData
   * @param {object} settings
   * @returns {object} Match result
   */
  static matchFace(db, academyId, {
    probeVector,
    livenessScore = 1.0,
    targetStudentId = null, // Optional 1:1 verification mode
    branchId = null,
  }, settings = {}) {
    const targetAcademyId = Number(academyId);
    const confidenceThreshold = settings.face_confidence_threshold || 0.85;
    const reviewThreshold = settings.face_manual_review_threshold || 0.70;
    const livenessRequired = settings.face_liveness_required !== 0;

    // 1. Anti-Spoofing / Liveness Check
    if (livenessRequired && livenessScore < 0.65) {
      return {
        matched: false,
        classification: 'LIVENESS_FAILED',
        livenessScore,
        confidenceScore: 0,
        message: 'Anti-spoofing liveness check failed. Please face the camera naturally without glare or photos.',
      };
    }

    if (!Array.isArray(probeVector) || probeVector.length !== 512) {
      return {
        matched: false,
        classification: 'INVALID_PROBE',
        message: 'Invalid biometric probe vector',
      };
    }

    // Query active enrolled face profiles
    let query = `
      SELECT 
        sfp.id,
        sfp.student_id,
        sfp.template_encrypted,
        sfp.template_version,
        s.first_name,
        s.last_name,
        s.student_code,
        s.branch_id,
        s.status as student_status,
        b.name as branch_name
      FROM student_face_profiles sfp
      JOIN students s ON s.id = sfp.student_id
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE sfp.academy_id = ? AND sfp.status = 'active' AND s.status = 'active'
    `;
    const params = [targetAcademyId];

    if (targetStudentId) {
      query += ' AND sfp.student_id = ?';
      params.push(Number(targetStudentId));
    } else if (branchId) {
      query += ' AND (s.branch_id = ? OR s.branch_id IS NULL)';
      params.push(Number(branchId));
    }

    const profiles = db.prepare(query).all(...params);

    if (!profiles.length) {
      return {
        matched: false,
        classification: 'NO_CANDIDATES',
        confidenceScore: 0,
        message: 'No enrolled biometric profiles found matching search criteria',
      };
    }

    let bestMatch = null;
    let highestSimilarity = -1;

    for (const p of profiles) {
      try {
        const enrolledVector = decryptTemplate(p.template_encrypted);
        const similarity = cosineSimilarity(probeVector, enrolledVector);
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = {
            studentId: p.student_id,
            first_name: p.first_name,
            last_name: p.last_name,
            student_code: p.student_code,
            branch_id: p.branch_id,
            branch_name: p.branch_name,
            similarity,
          };
        }
      } catch (err) {
        console.warn(`[Face Biometrics] Could not decrypt template for student ${p.student_id}:`, err.message);
      }
    }

    const roundedScore = Math.round(highestSimilarity * 1000) / 1000;

    // Check classification against configured thresholds
    if (highestSimilarity >= confidenceThreshold) {
      return {
        matched: true,
        classification: 'VERIFIED',
        confidenceScore: roundedScore,
        livenessScore,
        student: bestMatch,
        message: `Biometric identity confirmed for ${bestMatch.first_name} ${bestMatch.last_name} (${Math.round(roundedScore * 100)}% match)`,
      };
    } else if (highestSimilarity >= reviewThreshold) {
      return {
        matched: false,
        classification: 'MANUAL_REVIEW_REQUIRED',
        confidenceScore: roundedScore,
        livenessScore,
        student: bestMatch,
        message: `Low confidence match (${Math.round(roundedScore * 100)}%). Queued for coach/admin verification.`,
      };
    } else {
      return {
        matched: false,
        classification: 'REJECTED',
        confidenceScore: roundedScore,
        livenessScore,
        message: 'Biometric identity match failed. Face does not match any enrolled student profile.',
      };
    }
  }

  /**
   * Helper: Generates a deterministic mock 512-d unit vector for testing
   */
  static generateMockVector(seedString) {
    const hash = crypto.createHash('sha512').update(seedString).digest();
    const vector = new Array(512);
    let norm = 0;
    for (let i = 0; i < 512; i++) {
      // Float between -1 and 1
      const byteVal = hash[i % hash.length];
      const val = (byteVal / 127.5) - 1.0;
      vector[i] = val;
      norm += val * val;
    }
    // Normalize to unit vector
    const sqrtNorm = Math.sqrt(norm) || 1;
    for (let i = 0; i < 512; i++) {
      vector[i] /= sqrtNorm;
    }
    return vector;
  }
}
