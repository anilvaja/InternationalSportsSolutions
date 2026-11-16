import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { SmartAttendanceEngine } from '../services/smartAttendanceEngine.js';
import { QrAttendanceService } from '../services/qrAttendanceService.js';
import { FaceBiometricsService } from '../services/faceBiometricsService.js';
import { NfcReaderAdapter } from '../services/nfcReaderAdapter.js';
import { EventPassService } from '../services/eventPassService.js';
import { QuotaService } from '../services/quotaService.js';

export const smartAttendanceRouter = express.Router();
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function requirePlanFeature(featureKey = 'smart_attendance') {
  return (req, res, next) => {
    if (req.user?.isSuperAdmin) return next();
    const academyId = req.academy?.id || req.user?.academyId;
    if (!academyId) return next();

    const isEnabled = QuotaService.isFeatureEnabled(academyId, featureKey);
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_UPGRADE_REQUIRED',
        error: `Smart attendance feature '${featureKey}' is not included in your academy's current subscription plan. Please contact your platform administrator or upgrade your subscription.`,
      });
    }
    next();
  };
}

function checkPermission(req, perm) {
  if (!req.user) return false;
  if (req.user.isSuperAdmin || req.user.role === 'academy_admin') return true;
  const perms = req.user.permissions || [];
  if (perms.includes('all')) return true;

  const checkSingle = (target) => {
    if (perms.includes(target)) return true;
    const parts = target.split('_');
    const action = parts[0];
    const moduleName = parts.slice(1).join('_');
    if (['view', 'create', 'edit', 'delete', 'import', 'export', 'download', 'mark', 'collect', 'scan'].includes(action)) {
      if (perms.includes(`manage_${moduleName}`)) return true;
    }
    if (target.startsWith('manage_')) {
      const mod = target.substring(7);
      if (perms.some(k => k === `create_${mod}` || k === `edit_${mod}` || k === `delete_${mod}` || k === `scan_${mod}`)) {
        return true;
      }
    }
    return false;
  };

  if (Array.isArray(perm)) {
    return perm.some(p => checkSingle(p));
  }
  return checkSingle(perm);
}

// Helper middleware for route-level permission checks
function requirePerm(perms) {
  return (req, res, next) => {
    if (checkPermission(req, perms)) {
      return next();
    }
    const label = Array.isArray(perms) ? perms.join(' or ') : perms;
    return res.status(403).json({ success: false, error: `Access denied: Permission '${label}' required.` });
  };
}

/**
 * GET /api/academy/smart-attendance/settings
 */
smartAttendanceRouter.get('/settings', requirePlanFeature('smart_attendance'), (req, res) => {
  try {
    const db = req.tenantDb;
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
    const settings = SmartAttendanceEngine.getSettings(db, req.academy.id, branchId);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/smart-attendance/settings
 */
smartAttendanceRouter.put('/settings', requirePerm(['manage_smart_attendance', 'edit_academy_settings', 'all']), requirePlanFeature('smart_attendance'), (req, res) => {
  try {
    const db = req.tenantDb;
    const branchId = req.body.branch_id ? Number(req.body.branch_id) : null;
    const settings = SmartAttendanceEngine.saveSettings(db, req.academy.id, branchId, req.body);
    res.json({ success: true, settings, message: 'Smart attendance configuration saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/verify
 * Central attendance verification and recording endpoint
 */
smartAttendanceRouter.post('/verify', requirePerm(['scan_attendance', 'mark_attendance', 'view_kiosk', 'all']), requirePlanFeature('smart_attendance'), async (req, res) => {
  try {
    const db = req.tenantDb;
    let payload = { ...req.body };

    // If face mode with image_base64 provided, extract probe vector using sharp
    if (payload.mode === 'face' && payload.image_base64 && !payload.probe_vector) {
      try {
        const extracted = await FaceBiometricsService.extractVectorFromImage(payload.image_base64);
        payload.probe_vector = extracted.vector;
        payload.liveness_score = payload.liveness_score ?? extracted.livenessScore;
      } catch (extractErr) {
        return res.status(400).json({
          success: false,
          error: 'Face processing error: ' + extractErr.message,
          message: 'Could not extract facial features from image. Ensure face is clearly visible.',
        });
      }
    }

    const outcome = SmartAttendanceEngine.verifyAndRecordAttendance(db, req.academy.id, {
      ...payload,
      operator_user_id: req.user?.userId || null,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });
    res.json(outcome);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/scan-card-photo
 * Decodes QR code or identifies student from an uploaded/captured card photo
 */
smartAttendanceRouter.post('/scan-card-photo', requirePerm(['scan_attendance', 'mark_attendance', 'view_kiosk', 'all']), requirePlanFeature('smart_attendance'), memoryUpload.single('photo'), async (req, res) => {
  try {
    const db = req.tenantDb;
    let imageBuffer = req.file ? req.file.buffer : null;

    if (!imageBuffer && req.body.image_base64) {
      const base64Data = req.body.image_base64.includes('base64,')
        ? req.body.image_base64.split('base64,')[1]
        : req.body.image_base64;
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    if (!imageBuffer) {
      return res.status(400).json({ success: false, error: 'Card image or photo is required' });
    }

    // 1. Try decoding QR code from card image using sharp + jsQR
    let qrToken = null;
    try {
      const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      if (code && code.data) {
        qrToken = code.data.trim();
      }
    } catch (_) {}

    // If QR code found, process as QR check-in
    if (qrToken) {
      const outcome = SmartAttendanceEngine.verifyAndRecordAttendance(db, req.academy.id, {
        mode: 'qr',
        qr_token: qrToken,
        branch_id: req.body.branch_id ? Number(req.body.branch_id) : null,
        batch_id: req.body.batch_id ? Number(req.body.batch_id) : null,
        operator_user_id: req.user?.userId || null,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
      });
      return res.json({ success: outcome.success, method: 'qr_from_card_photo', token: qrToken, ...outcome });
    }

    // 2. If no QR code found, attempt matching student from face on card photo
    try {
      const extracted = await FaceBiometricsService.extractVectorFromImage(imageBuffer);
      const faceMatch = FaceBiometricsService.matchFace(db, req.academy.id, {
        probeVector: extracted.vector,
        livenessScore: 1.0,
        branchId: req.body.branch_id ? Number(req.body.branch_id) : null,
      });

      if (faceMatch.matched && faceMatch.student) {
        const outcome = SmartAttendanceEngine.verifyAndRecordAttendance(db, req.academy.id, {
          mode: 'face',
          probe_vector: extracted.vector,
          liveness_score: 1.0,
          student_id: faceMatch.student.studentId,
          branch_id: req.body.branch_id ? Number(req.body.branch_id) : null,
          batch_id: req.body.batch_id ? Number(req.body.batch_id) : null,
          operator_user_id: req.user?.userId || null,
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
        });
        return res.json({
          success: outcome.success,
          method: 'face_from_card_photo',
          message: `Identified student ${faceMatch.student.first_name} ${faceMatch.student.last_name} from card photo`,
          ...outcome,
        });
      }
    } catch (_) {}

    return res.status(422).json({
      success: false,
      error: 'Could not detect a readable QR code or enrolled student face from this card photo. Please ensure good lighting and clear alignment, or enter student code manually.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/sync-offline
 * Batch processes an offline scan queue safely with duplicate prevention
 */
smartAttendanceRouter.post('/sync-offline', requirePerm(['scan_attendance', 'mark_attendance', 'all']), (req, res) => {
  try {
    const db = req.tenantDb;
    const scans = req.body.scans;

    if (!Array.isArray(scans) || scans.length === 0) {
      return res.status(400).json({ success: false, error: 'Expected non-empty scans array' });
    }

    const settings = SmartAttendanceEngine.getSettings(db, req.academy.id, req.body.branch_id);
    const maxAgeHours = settings.offline_sync_max_age_hours || 48;
    const now = Date.now();

    const results = [];
    let synced = 0;
    let failed = 0;
    let expired = 0;

    for (const scan of scans) {
      const scanTime = scan.scanned_at ? new Date(scan.scanned_at).getTime() : now;
      const ageHours = (now - scanTime) / (1000 * 60 * 60);

      if (ageHours > maxAgeHours) {
        expired++;
        results.push({
          success: false,
          code: 'OFFLINE_SCAN_EXPIRED',
          message: `Scan rejected: exceeds ${maxAgeHours}h offline threshold (${Math.round(ageHours)}h old)`,
          scan,
        });
        continue;
      }

      try {
        const outcome = SmartAttendanceEngine.verifyAndRecordAttendance(db, req.academy.id, {
          ...scan,
          scanned_at_override: scan.scanned_at,
          operator_user_id: req.user.userId,
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
        });

        if (outcome.success) {
          synced++;
        } else {
          failed++;
        }
        results.push({ ...outcome, scanId: scan.client_id || null });
      } catch (err) {
        failed++;
        results.push({ success: false, error: err.message, scanId: scan.client_id || null });
      }
    }

    res.json({
      success: true,
      total: scans.length,
      synced,
      failed,
      expired,
      results,
      message: `Offline synchronization completed: ${synced} recorded, ${failed} rejected, ${expired} expired`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/smart-attendance/devices
 */
smartAttendanceRouter.get('/devices', (req, res) => {
  try {
    const db = req.tenantDb;
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
    let query = `
      SELECT ad.*, b.name as branch_name
      FROM attendance_devices ad
      LEFT JOIN branches b ON b.id = ad.branch_id
      WHERE ad.academy_id = ?
    `;
    const params = [req.academy.id];
    if (branchId) {
      query += ' AND ad.branch_id = ?';
      params.push(branchId);
    }
    query += ' ORDER BY ad.created_at DESC';

    const devices = db.prepare(query).all(...params);
    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/devices
 */
smartAttendanceRouter.post('/devices', requirePerm(['manage_attendance_devices', 'manage_smart_attendance', 'all']), (req, res) => {
  try {
    const db = req.tenantDb;
    const { device_name, device_code, device_type, branch_id, platform, config } = req.body;

    if (!device_name || !device_code || !device_type || !branch_id) {
      return res.status(400).json({ success: false, error: 'device_name, device_code, device_type, and branch_id are required' });
    }

    const ins = db.prepare(`
      INSERT INTO attendance_devices (
        academy_id, branch_id, device_name, device_code, device_type, platform, config, registered_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      req.academy.id,
      Number(branch_id),
      device_name.trim(),
      device_code.trim().toUpperCase(),
      device_type,
      platform || 'web_browser',
      typeof config === 'object' ? JSON.stringify(config) : (config || '{}'),
      req.user.userId
    );

    res.json({
      success: true,
      deviceId: ins.lastInsertRowid,
      message: `Device "${device_name}" registered successfully with code ${device_code.toUpperCase()}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/smart-attendance/devices/:id/revoke
 */
smartAttendanceRouter.put('/devices/:id/revoke', requirePerm(['manage_attendance_devices', 'manage_smart_attendance', 'all']), (req, res) => {
  try {
    const db = req.tenantDb;
    const deviceId = Number(req.params.id);
    const result = db.prepare(`
      UPDATE attendance_devices
      SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND academy_id = ?
    `).run(deviceId, req.academy.id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    res.json({ success: true, message: 'Device revoked successfully. It can no longer scan or record attendance.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/smart-attendance/students/:id/qr
 * Retrieves printable digital ID card data with QR token
 */
smartAttendanceRouter.get('/students/:id/qr', requirePlanFeature('smart_attendance'), async (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);
    const cardData = await QrAttendanceService.getStudentIdCardData(db, req.academy.id, studentId, req.academy);
    res.json({ success: true, ...cardData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/students/:id/qr/regenerate
 */
smartAttendanceRouter.post('/students/:id/qr/regenerate', requirePerm(['manage_student_qr', 'manage_smart_attendance', 'all']), requirePlanFeature('smart_attendance'), (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);
    const reason = req.body.reason || 'Requested by administrator';
    const newToken = QrAttendanceService.generateStudentQrToken(db, req.academy.id, studentId, req.user.userId, reason);
    res.json({ success: true, ...newToken, message: 'New QR pass issued. Previous QR codes for this student have been revoked.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/students/:id/nfc/assign
 */
smartAttendanceRouter.post('/students/:id/nfc/assign', requirePerm(['manage_nfc_cards', 'manage_smart_attendance', 'all']), (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);
    const outcome = NfcReaderAdapter.assignCard(db, req.academy.id, studentId, {
      ...req.body,
      assigned_by: req.user.userId,
    });
    res.json({ success: true, ...outcome, message: `Card ${outcome.card_uid} assigned to student #${studentId}` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/students/:id/nfc/revoke
 */
smartAttendanceRouter.post('/students/:id/nfc/revoke', requirePerm(['manage_nfc_cards', 'manage_smart_attendance', 'all']), (req, res) => {
  try {
    const db = req.tenantDb;
    const { card_uid, status, reason } = req.body;
    const outcome = NfcReaderAdapter.revokeCard(db, req.academy.id, card_uid, {
      status: status || 'lost',
      revoked_by: req.user.userId,
      reason: reason || 'reported_lost',
    });
    res.json({ success: true, ...outcome, message: `Card marked as ${status || 'lost'}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/students/:id/face/consent
 */
smartAttendanceRouter.post('/students/:id/face/consent', requirePerm(['manage_face_enrollment', 'manage_smart_attendance', 'all']), requirePlanFeature('face_attendance'), (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);
    const outcome = FaceBiometricsService.recordConsent(db, req.academy.id, studentId, {
      ...req.body,
      ip_address: req.ip,
    });
    res.json({ success: true, ...outcome, message: `Biometric consent updated to '${outcome.consent_status}'` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/students/:id/face/enroll
 */
smartAttendanceRouter.post('/students/:id/face/enroll', requirePerm(['manage_face_enrollment', 'manage_smart_attendance', 'all']), requirePlanFeature('face_attendance'), (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);

    // Auto-record consent if student has signed photo_video_permission from admission or explicit consent passed
    if (!FaceBiometricsService.hasActiveConsent(db, req.academy.id, studentId)) {
      const student = db.prepare('SELECT first_name, last_name, guardian_name, father_name, mother_name, photo_video_permission FROM students WHERE id = ?').get(studentId);
      if (req.body.consent_given || req.body.parent_consent || req.query.auto_consent || (student && student.photo_video_permission === 1)) {
        const consentGivenBy = req.body.consent_given_by || (student ? (student.guardian_name || student.father_name || student.mother_name || `${student.first_name}'s Parent / Guardian`) : 'Parent / Guardian');
        FaceBiometricsService.recordConsent(db, req.academy.id, studentId, {
          consent_given_by: consentGivenBy,
          guardian_relationship: req.body.guardian_relationship || 'parent',
          consent_status: 'granted',
          notes: 'Parental biometric consent granted during face vector enrollment',
          ip_address: req.ip,
        });
      }
    }

    const outcome = FaceBiometricsService.enrollFaceProfile(db, req.academy.id, studentId, {
      vector: req.body.vector,
      enrolled_by: req.user.userId,
      sample_count: req.body.sample_count || 1,
    });
    res.json({ success: true, ...outcome, message: 'Facial biometric template encrypted and enrolled successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/students/:id/face/enroll-photo
 * Enrolls face directly from webcam photo or uploaded image
 */
smartAttendanceRouter.post('/students/:id/face/enroll-photo', requirePerm(['manage_face_enrollment', 'manage_smart_attendance', 'all']), requirePlanFeature('face_attendance'), memoryUpload.single('photo'), async (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);
    let imageBuffer = req.file ? req.file.buffer : null;

    if (!imageBuffer && req.body.image_base64) {
      const base64Data = req.body.image_base64.includes('base64,')
        ? req.body.image_base64.split('base64,')[1]
        : req.body.image_base64;
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    // Fallback: If no image payload provided in the request, try using the student's existing profile photo
    if (!imageBuffer) {
      const student = db.prepare('SELECT photo_url FROM students WHERE id = ?').get(studentId);
      if (student && student.photo_url) {
        if (student.photo_url.startsWith('data:image')) {
          const b64 = student.photo_url.split('base64,')[1];
          imageBuffer = Buffer.from(b64, 'base64');
        } else if (student.photo_url.startsWith('/storage/') || student.photo_url.startsWith('storage/')) {
          const localPath = path.resolve(student.photo_url.replace(/^\//, ''));
          if (fs.existsSync(localPath)) {
            imageBuffer = fs.readFileSync(localPath);
          }
        }
      }
    }

    if (!imageBuffer) {
      return res.status(400).json({ success: false, error: 'Face photo image is required' });
    }

    // Auto-record consent if student has signed photo_video_permission from admission or explicit consent passed
    if (!FaceBiometricsService.hasActiveConsent(db, req.academy.id, studentId)) {
      const student = db.prepare('SELECT first_name, last_name, guardian_name, father_name, mother_name, photo_video_permission FROM students WHERE id = ?').get(studentId);
      if (req.body.consent_given || req.body.parent_consent || req.query.auto_consent || (student && student.photo_video_permission === 1)) {
        const consentGivenBy = req.body.consent_given_by || (student ? (student.guardian_name || student.father_name || student.mother_name || `${student.first_name}'s Parent / Guardian`) : 'Parent / Guardian');
        FaceBiometricsService.recordConsent(db, req.academy.id, studentId, {
          consent_given_by: consentGivenBy,
          guardian_relationship: req.body.guardian_relationship || 'parent',
          consent_status: 'granted',
          notes: 'Parental biometric consent granted during staff face photo enrollment',
          ip_address: req.ip,
        });
      }
    }

    const outcome = await FaceBiometricsService.enrollFaceProfileFromImage(db, req.academy.id, studentId, {
      image_buffer: imageBuffer,
      enrolled_by: req.user.userId,
    });

    res.json({
      success: true,
      ...outcome,
      message: 'Student facial biometric template extracted, AES-256 encrypted, and enrolled successfully',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/face/auto-enroll-all
 * Batch auto-enrolls all students with photos in the academy
 */
smartAttendanceRouter.post('/face/auto-enroll-all', requirePerm(['manage_face_enrollment', 'manage_smart_attendance', 'all']), requirePlanFeature('face_attendance'), async (req, res) => {
  try {
    const db = req.tenantDb;
    const outcome = await FaceBiometricsService.autoEnrollFromProfilePhotos(db, req.academy.id, req.user.userId);
    res.json({
      success: true,
      ...outcome,
      message: `Enrolled ${outcome.enrolledCount} of ${outcome.totalCandidates} eligible student photo profiles`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/academy/smart-attendance/students/:id/face
 */
smartAttendanceRouter.delete('/students/:id/face', requirePerm(['manage_face_enrollment', 'manage_smart_attendance', 'all']), (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = Number(req.params.id);
    const outcome = FaceBiometricsService.purgeFaceProfile(db, req.academy.id, studentId, req.body.reason || 'user_requested_deletion');
    res.json({ success: true, ...outcome, message: 'Facial biometric profile permanently purged' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/smart-attendance/exceptions
 * Lists attendance exceptions requiring manual review (low-confidence face, etc.)
 */
smartAttendanceRouter.get('/exceptions', requirePerm(['approve_attendance_exceptions', 'manage_smart_attendance', 'all']), (req, res) => {
  try {
    const db = req.tenantDb;
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
    let query = `
      SELECT 
        aeq.*,
        s.first_name,
        s.last_name,
        s.student_code,
        s.photo_url,
        b.name as branch_name,
        bat.name as batch_name
      FROM attendance_exceptions_queue aeq
      LEFT JOIN students s ON s.id = aeq.student_id
      LEFT JOIN branches b ON b.id = aeq.branch_id
      LEFT JOIN batches bat ON bat.id = aeq.batch_id
      WHERE aeq.academy_id = ?
    `;
    const params = [req.academy.id];
    if (branchId) {
      query += ' AND aeq.branch_id = ?';
      params.push(branchId);
    }
    if (req.query.status) {
      query += ' AND aeq.status = ?';
      params.push(req.query.status);
    } else {
      query += " AND aeq.status = 'pending'";
    }
    query += ' ORDER BY aeq.created_at DESC';

    const exceptions = db.prepare(query).all(...params);
    res.json({ success: true, exceptions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/exceptions/:id/resolve
 */
smartAttendanceRouter.post('/exceptions/:id/resolve', requirePerm(['approve_attendance_exceptions', 'manage_smart_attendance', 'all']), (req, res) => {
  try {
    const db = req.tenantDb;
    const exceptionId = Number(req.params.id);
    const { action, resolution_notes } = req.body; // 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action must be approve or reject' });
    }

    const ex = db.prepare('SELECT * FROM attendance_exceptions_queue WHERE id = ? AND academy_id = ?').get(exceptionId, req.academy.id);
    if (!ex) {
      return res.status(404).json({ success: false, error: 'Exception not found' });
    }

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE attendance_exceptions_queue
        SET status = ?,
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            resolution_notes = ?
        WHERE id = ?
      `).run(action === 'approve' ? 'approved' : 'rejected', req.user.userId, resolution_notes || null, exceptionId);

      // If approved, mark attendance
      if (action === 'approve' && ex.student_id && ex.batch_id) {
        SmartAttendanceEngine.verifyAndRecordAttendance(db, req.academy.id, {
          mode: 'coach_manual',
          student_id: ex.student_id,
          batch_id: ex.batch_id,
          operator_user_id: req.user.userId,
        });
      }
    });

    tx();
    res.json({ success: true, message: `Exception #${exceptionId} has been ${action === 'approve' ? 'approved' : 'rejected'}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/smart-attendance/logs
 */
smartAttendanceRouter.get('/logs', requirePerm(['view_smart_attendance', 'view_attendance', 'all']), (req, res) => {
  try {
    const db = req.tenantDb;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    let query = `
      SELECT 
        sal.*,
        s.first_name,
        s.last_name,
        s.student_code,
        b.name as branch_name,
        bat.name as batch_name
      FROM smart_attendance_logs sal
      LEFT JOIN students s ON s.id = sal.student_id
      LEFT JOIN branches b ON b.id = sal.branch_id
      LEFT JOIN batches bat ON bat.id = sal.batch_id
      WHERE sal.academy_id = ?
    `;
    const params = [req.academy.id];

    if (req.query.branch_id) {
      query += ' AND sal.branch_id = ?';
      params.push(Number(req.query.branch_id));
    }
    if (req.query.result) {
      query += ' AND sal.result = ?';
      params.push(req.query.result);
    }

    query += ' ORDER BY sal.scanned_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = db.prepare(query).all(...params);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/smart-attendance/events/:eventId/pass/:studentId
 */
smartAttendanceRouter.get('/events/:eventId/pass/:studentId', (req, res) => {
  try {
    const db = req.tenantDb;
    const eventId = Number(req.params.eventId);
    const studentId = Number(req.params.studentId);
    const pass = EventPassService.getOrCreateEventPass(db, req.academy.id, eventId, studentId);
    res.json({ success: true, ...pass });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/smart-attendance/events/check-in
 */
smartAttendanceRouter.post('/events/check-in', requirePerm(['scan_attendance', 'approve_event_registrations', 'manage_events', 'all']), (req, res) => {
  try {
    const db = req.tenantDb;
    const outcome = EventPassService.checkInEventPass(db, req.academy.id, req.body.pass_code, {
      operatorUserId: req.user.userId,
    });
    res.json(outcome);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});