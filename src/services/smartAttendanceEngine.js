import { QrAttendanceService } from './qrAttendanceService.js';
import { FaceBiometricsService } from './faceBiometricsService.js';
import { NfcReaderAdapter } from './nfcReaderAdapter.js';
import { LocationProximityService } from './locationProximityService.js';
import { SyllabusService } from './syllabusService.js';
import { getISTDateString, getISTTimeString } from '../utils/dateUtils.js';

/**
 * Central Smart Attendance Validation Engine
 * The unified pipeline validating authenticated devices, student status, branch/batch enrollment,
 * time policies, duplicate cooldowns, and recording attendance across all scan methods.
 */
export class SmartAttendanceEngine {
  /**
   * Resolves smart attendance configuration for an academy / branch.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {number} [branchId] 
   * @returns {object} Settings object
   */
  static getSettings(db, academyId, branchId = null) {
    const targetAcademyId = Number(academyId);

    // Try branch-specific settings first
    if (branchId) {
      const branchSettings = db.prepare(`
        SELECT * FROM smart_attendance_settings
        WHERE academy_id = ? AND branch_id = ?
      `).get(targetAcademyId, Number(branchId));

      if (branchSettings) {
        return {
          ...branchSettings,
          enabled_modes: typeof branchSettings.enabled_modes === 'string'
            ? JSON.parse(branchSettings.enabled_modes)
            : branchSettings.enabled_modes,
        };
      }
    }

    // Fallback to academy default (branch_id IS NULL)
    const academyDefault = db.prepare(`
      SELECT * FROM smart_attendance_settings
      WHERE academy_id = ? AND branch_id IS NULL
    `).get(targetAcademyId);

    if (academyDefault) {
      return {
        ...academyDefault,
        enabled_modes: typeof academyDefault.enabled_modes === 'string'
          ? JSON.parse(academyDefault.enabled_modes)
          : academyDefault.enabled_modes,
      };
    }

    // Default configuration if nothing is stored in DB
    return {
      academy_id: targetAcademyId,
      branch_id: branchId ? Number(branchId) : null,
      enabled_modes: ['qr', 'face'],
      default_mode: 'qr',
      qr_refresh_rate_seconds: 0,
      qr_allow_offline: 1,
      checkin_window_before_mins: 30,
      checkin_window_after_mins: 60,
      late_threshold_mins: 15,
      duplicate_cooldown_mins: 15,
      allow_wrong_batch_checkin: 0,
      face_confidence_threshold: 0.85,
      face_liveness_required: 1,
      face_manual_review_threshold: 0.70,
      gps_geofence_meters: 150,
      gps_enforce_strict: 0,
      offline_sync_max_age_hours: 48,
    };
  }

  /**
   * Updates or saves smart attendance settings.
   */
  static saveSettings(db, academyId, branchId, settingsData) {
    const targetAcademyId = Number(academyId);
    const targetBranchId = branchId ? Number(branchId) : null;

    const enabledModesJson = JSON.stringify(settingsData.enabled_modes || ['qr', 'coach_manual', 'gps', 'nfc']);

    const query = `
      INSERT INTO smart_attendance_settings (
        academy_id, branch_id, enabled_modes, default_mode, qr_refresh_rate_seconds,
        qr_allow_offline, checkin_window_before_mins, checkin_window_after_mins,
        late_threshold_mins, duplicate_cooldown_mins, allow_wrong_batch_checkin,
        face_confidence_threshold, face_liveness_required, face_manual_review_threshold,
        gps_geofence_meters, gps_enforce_strict, offline_sync_max_age_hours, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(academy_id, branch_id) DO UPDATE SET
        enabled_modes = excluded.enabled_modes,
        default_mode = excluded.default_mode,
        qr_refresh_rate_seconds = excluded.qr_refresh_rate_seconds,
        qr_allow_offline = excluded.qr_allow_offline,
        checkin_window_before_mins = excluded.checkin_window_before_mins,
        checkin_window_after_mins = excluded.checkin_window_after_mins,
        late_threshold_mins = excluded.late_threshold_mins,
        duplicate_cooldown_mins = excluded.duplicate_cooldown_mins,
        allow_wrong_batch_checkin = excluded.allow_wrong_batch_checkin,
        face_confidence_threshold = excluded.face_confidence_threshold,
        face_liveness_required = excluded.face_liveness_required,
        face_manual_review_threshold = excluded.face_manual_review_threshold,
        gps_geofence_meters = excluded.gps_geofence_meters,
        gps_enforce_strict = excluded.gps_enforce_strict,
        offline_sync_max_age_hours = excluded.offline_sync_max_age_hours,
        updated_at = CURRENT_TIMESTAMP
    `;

    db.prepare(query).run(
      targetAcademyId,
      targetBranchId,
      enabledModesJson,
      settingsData.default_mode || 'qr',
      settingsData.qr_refresh_rate_seconds ?? 0,
      settingsData.qr_allow_offline ?? 1,
      settingsData.checkin_window_before_mins ?? 30,
      settingsData.checkin_window_after_mins ?? 60,
      settingsData.late_threshold_mins ?? 15,
      settingsData.duplicate_cooldown_mins ?? 15,
      settingsData.allow_wrong_batch_checkin ?? 0,
      settingsData.face_confidence_threshold ?? 0.85,
      settingsData.face_liveness_required ?? 1,
      settingsData.face_manual_review_threshold ?? 0.70,
      settingsData.gps_geofence_meters ?? 150,
      settingsData.gps_enforce_strict ?? 0,
      settingsData.offline_sync_max_age_hours ?? 48
    );

    return this.getSettings(db, targetAcademyId, targetBranchId);
  }

  /**
   * Primary entry point for all attendance check-in requests.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   * @param {object} payload 
   * @returns {object} Execution result
   */
  static verifyAndRecordAttendance(db, academyId, payload) {
    const targetAcademyId = Number(academyId);
    const {
      mode, // 'qr' | 'face' | 'nfc' | 'gps' | 'ble' | 'coach_manual' | 'kiosk'
      branch_id,
      batch_id,
      device_id,
      device_code,
      operator_user_id,
      ip_address,
      user_agent,
      scanned_at_override, // For offline synchronization
    } = payload;

    const todayDate = scanned_at_override
      ? (scanned_at_override.split('T')[0] || getISTDateString())
      : getISTDateString();

    const currentIsoTime = scanned_at_override || new Date().toISOString();

    // 1. Resolve Settings
    const settings = this.getSettings(db, targetAcademyId, branch_id);

    // Verify mode is enabled
    const normalizedMode = mode || settings.default_mode;
    if (!settings.enabled_modes.includes(normalizedMode) && normalizedMode !== 'coach_manual') {
      return this._logAndReject(db, targetAcademyId, {
        branch_id,
        mode: normalizedMode,
        device_id,
        operator_user_id,
        ip_address,
        user_agent,
        result: 'permission_denied',
        failure_reason: `Attendance method "${normalizedMode}" is currently disabled for this academy branch`,
        message: `Attendance method "${normalizedMode}" is currently disabled for this branch`,
      });
    }

    // 2. Resolve Device (if provided)
    let verifiedDeviceId = null;
    if (device_code || device_id) {
      const dev = db.prepare(`
        SELECT id, branch_id, status FROM attendance_devices
        WHERE academy_id = ? AND (device_code = ? OR id = ?)
      `).get(targetAcademyId, device_code || '', Number(device_id) || -1);

      if (dev) {
        if (dev.status === 'revoked') {
          return this._logAndReject(db, targetAcademyId, {
            branch_id,
            mode: normalizedMode,
            device_id: dev.id,
            operator_user_id,
            ip_address,
            user_agent,
            result: 'permission_denied',
            failure_reason: 'Device authorization has been revoked by academy administrator',
            message: 'Device revoked. Unauthorized scanner device.',
          });
        }
        verifiedDeviceId = dev.id;
        db.prepare('UPDATE attendance_devices SET last_seen_at = CURRENT_TIMESTAMP, is_online = 1 WHERE id = ?').run(dev.id);
      }
    }

    // 3. Resolve Identity across Supported Modes
    let resolvedStudent = null;
    let modeMetadata = {};
    let confidenceScore = null;
    let livenessScore = null;

    if (normalizedMode === 'qr' || normalizedMode === 'kiosk') {
      const qrRes = QrAttendanceService.resolveToken(db, targetAcademyId, payload.qr_token);
      if (!qrRes.valid) {
        return this._logAndReject(db, targetAcademyId, {
          branch_id,
          student_id: qrRes.studentId || null,
          mode: normalizedMode,
          scan_token_raw_masked: this._maskToken(payload.qr_token),
          device_id: verifiedDeviceId,
          operator_user_id,
          ip_address,
          user_agent,
          result: qrRes.reason === 'REVOKED_TOKEN' ? 'unregistered_token' : (qrRes.reason === 'INACTIVE_STUDENT' ? 'inactive_student' : 'unregistered_token'),
          failure_reason: qrRes.message,
          message: qrRes.message,
        });
      }
      resolvedStudent = qrRes.student;
      modeMetadata = { qr_version: qrRes.tokenRecord.version, qr_token_id: qrRes.tokenRecord.id };
    } else if (normalizedMode === 'nfc') {
      const nfcRes = NfcReaderAdapter.resolveCard(db, targetAcademyId, payload.card_uid);
      if (!nfcRes.valid) {
        return this._logAndReject(db, targetAcademyId, {
          branch_id,
          student_id: nfcRes.studentId || null,
          mode: normalizedMode,
          scan_token_raw_masked: this._maskToken(payload.card_uid),
          device_id: verifiedDeviceId,
          operator_user_id,
          ip_address,
          user_agent,
          result: nfcRes.reason === 'CARD_REVOKED' ? 'unregistered_token' : (nfcRes.reason === 'INACTIVE_STUDENT' ? 'inactive_student' : 'unregistered_token'),
          failure_reason: nfcRes.message,
          message: nfcRes.message,
        });
      }
      resolvedStudent = nfcRes.student;
      modeMetadata = { nfc_uid: nfcRes.cardRecord.uid, nfc_type: nfcRes.cardRecord.type };
    } else if (normalizedMode === 'face') {
      const faceRes = FaceBiometricsService.matchFace(db, targetAcademyId, {
        probeVector: payload.probe_vector,
        livenessScore: payload.liveness_score ?? 1.0,
        targetStudentId: payload.student_id,
        branchId: branch_id,
      }, settings);

      confidenceScore = faceRes.confidenceScore;
      livenessScore = faceRes.livenessScore;

      if (!faceRes.matched) {
        if (faceRes.classification === 'MANUAL_REVIEW_REQUIRED') {
          // Enqueue into exceptions queue
          const scanLogId = this._recordScanLog(db, targetAcademyId, {
            branch_id,
            student_id: faceRes.student?.studentId || null,
            mode: 'face',
            device_id: verifiedDeviceId,
            operator_user_id,
            result: 'flagged_for_review',
            confidence_score: confidenceScore,
            liveness_score: livenessScore,
            ip_address,
            user_agent,
            failure_reason: faceRes.message,
          });

          db.prepare(`
            INSERT INTO attendance_exceptions_queue (
              academy_id, branch_id, scan_log_id, student_id, batch_id,
              exception_type, status, details
            ) VALUES (?, ?, ?, ?, ?, 'low_confidence_face', 'pending', ?)
          `).run(
            targetAcademyId,
            branch_id || (faceRes.student?.branch_id || 1),
            scanLogId,
            faceRes.student?.studentId || null,
            batch_id || null,
            JSON.stringify({
              confidence: confidenceScore,
              liveness: livenessScore,
              student: faceRes.student,
              scanned_at: currentIsoTime,
            })
          );

          return {
            success: false,
            queuedForReview: true,
            status: 'pending_approval',
            classification: 'MANUAL_REVIEW_REQUIRED',
            confidenceScore,
            message: faceRes.message,
            audio_cue: 'review_prompt',
          };
        }

        return this._logAndReject(db, targetAcademyId, {
          branch_id,
          student_id: faceRes.student?.studentId || null,
          mode: 'face',
          device_id: verifiedDeviceId,
          operator_user_id,
          ip_address,
          user_agent,
          confidence_score: confidenceScore,
          liveness_score: livenessScore,
          result: faceRes.classification === 'LIVENESS_FAILED' ? 'liveness_failed' : 'low_confidence_face',
          failure_reason: faceRes.message,
          message: faceRes.message,
        });
      }

      resolvedStudent = {
        id: faceRes.student.studentId,
        student_code: faceRes.student.student_code,
        first_name: faceRes.student.first_name,
        last_name: faceRes.student.last_name,
        branch_id: faceRes.student.branch_id,
        branch_name: faceRes.student.branch_name,
      };
      modeMetadata = { confidence: confidenceScore, liveness: livenessScore };
    } else if (normalizedMode === 'gps') {
      const student = db.prepare('SELECT id, first_name, last_name, student_code, status, branch_id FROM students WHERE id = ?').get(Number(payload.student_id));
      if (!student) {
        return { success: false, message: 'Student not found', code: 'STUDENT_NOT_FOUND' };
      }
      if (student.status !== 'active') {
        return this._logAndReject(db, targetAcademyId, {
          branch_id,
          student_id: student.id,
          mode: 'gps',
          device_id: verifiedDeviceId,
          operator_user_id,
          ip_address,
          user_agent,
          result: 'inactive_student',
          failure_reason: `Student status is ${student.status}`,
          message: `Student ${student.first_name} is inactive`,
        });
      }

      const effectiveBranchId = branch_id || student.branch_id;
      const geofence = LocationProximityService.verifyGeofence(db, effectiveBranchId, {
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
      }, settings);

      if (!geofence.valid) {
        return this._logAndReject(db, targetAcademyId, {
          branch_id: effectiveBranchId,
          student_id: student.id,
          mode: 'gps',
          device_id: verifiedDeviceId,
          operator_user_id,
          location_lat: payload.latitude,
          location_lng: payload.longitude,
          location_distance_meters: geofence.distanceMeters,
          ip_address,
          user_agent,
          result: 'outside_geofence',
          failure_reason: geofence.message,
          message: geofence.message,
        });
      }

      resolvedStudent = student;
      modeMetadata = { distance_meters: geofence.distanceMeters, accuracy: payload.accuracy };
    } else if (normalizedMode === 'coach_manual') {
      const student = db.prepare('SELECT id, first_name, last_name, student_code, status, branch_id FROM students WHERE id = ?').get(Number(payload.student_id));
      if (!student) {
        return { success: false, message: 'Student not found', code: 'STUDENT_NOT_FOUND' };
      }
      if (student.status !== 'active') {
        return this._logAndReject(db, targetAcademyId, {
          branch_id,
          student_id: student.id,
          mode: 'coach_manual',
          device_id: verifiedDeviceId,
          operator_user_id,
          result: 'inactive_student',
          failure_reason: `Student status is ${student.status}`,
          message: `Student ${student.first_name} is inactive`,
        });
      }
      resolvedStudent = student;
    } else {
      return { success: false, message: `Unsupported attendance mode: ${normalizedMode}`, code: 'INVALID_MODE' };
    }

    // 3.5. Enforce Student-Level Allowed Attendance Modes & Biometric Consent
    if (resolvedStudent && resolvedStudent.id) {
      const studentDbRecord = db.prepare('SELECT allowed_attendance_modes FROM students WHERE id = ?').get(resolvedStudent.id);
      let studentAllowedModes = ['qr', 'face'];
      if (studentDbRecord && studentDbRecord.allowed_attendance_modes) {
        try {
          const parsed = JSON.parse(studentDbRecord.allowed_attendance_modes);
          if (Array.isArray(parsed) && parsed.length > 0) studentAllowedModes = parsed;
        } catch (_) {}
      }

      // Check ID Card (QR) scan authorization for this student
      if (normalizedMode === 'qr' && !studentAllowedModes.includes('qr')) {
        return this._logAndReject(db, targetAcademyId, {
          branch_id,
          student_id: resolvedStudent.id,
          mode: 'qr',
          device_id: verifiedDeviceId,
          operator_user_id,
          ip_address,
          user_agent,
          result: 'permission_denied',
          failure_reason: 'Student ID card scanning is not enabled for this student by academy administration',
          message: 'Student ID card scanning is disabled for this student. Please use Facial Recognition.',
        });
      }

      // Check Facial Recognition authorization & Biometric Consent for this student
      if (normalizedMode === 'face') {
        if (!studentAllowedModes.includes('face')) {
          return this._logAndReject(db, targetAcademyId, {
            branch_id,
            student_id: resolvedStudent.id,
            mode: 'face',
            device_id: verifiedDeviceId,
            operator_user_id,
            ip_address,
            user_agent,
            result: 'permission_denied',
            failure_reason: 'Facial recognition attendance is not enabled for this student by academy administration',
            message: 'Face scanning attendance is disabled for this student. Please use Student ID card.',
          });
        }

        // Biometric consent strictly required for face recognition
        const hasConsent = FaceBiometricsService.hasActiveConsent(db, targetAcademyId, resolvedStudent.id);
        if (!hasConsent) {
          return this._logAndReject(db, targetAcademyId, {
            branch_id,
            student_id: resolvedStudent.id,
            mode: 'face',
            device_id: verifiedDeviceId,
            operator_user_id,
            ip_address,
            user_agent,
            result: 'permission_denied',
            failure_reason: 'Explicit parental/guardian biometric consent is required before face scanning attendance can be accepted',
            message: 'Biometric consent required: Parent/guardian consent has not been granted for facial recognition. Please check in with Student ID card.',
          });
        }
      }
    }

    // Optional supporting signal: BLE proximity evaluation
    let bleInfo = null;
    if (payload.ble_data) {
      bleInfo = LocationProximityService.evaluateBleSignal(payload.ble_data);
      modeMetadata.ble = bleInfo;
    }

    // 4. Batch & Session Resolution
    let resolvedBatch = null;
    let isWrongBatch = false;

    // Fetch active enrollments for this student
    const activeEnrollments = db.prepare(`
      SELECT b.id, b.name, b.start_time, b.end_time, b.days_of_week, b.branch_id, b.coach_id, sp.name as sport_name
      FROM student_batch_enrollments sbe
      JOIN batches b ON b.id = sbe.batch_id
      LEFT JOIN sports sp ON sp.id = b.sport_id
      WHERE sbe.student_id = ? AND sbe.status = 'active'
    `).all(resolvedStudent.id);

    if (batch_id) {
      // Coach or kiosk has designated a target batch
      const targetBatch = db.prepare(`
        SELECT b.id, b.name, b.start_time, b.end_time, b.days_of_week, b.branch_id, b.coach_id, sp.name as sport_name
        FROM batches b
        LEFT JOIN sports sp ON sp.id = b.sport_id
        WHERE b.id = ?
      `).get(Number(batch_id));

      if (!targetBatch) {
        return { success: false, message: `Batch #${batch_id} not found`, code: 'BATCH_NOT_FOUND' };
      }

      const isEnrolled = activeEnrollments.some(e => e.id === targetBatch.id);
      if (!isEnrolled) {
        if (!settings.allow_wrong_batch_checkin) {
          const enrolledBatchNames = activeEnrollments.map(e => e.name).join(', ') || 'None';
          return this._logAndReject(db, targetAcademyId, {
            branch_id: targetBatch.branch_id,
            student_id: resolvedStudent.id,
            batch_id: targetBatch.id,
            mode: normalizedMode,
            device_id: verifiedDeviceId,
            operator_user_id,
            result: 'wrong_batch',
            failure_reason: `Student is not enrolled in ${targetBatch.name}. Assigned: ${enrolledBatchNames}`,
            message: `Wrong Batch! ${resolvedStudent.first_name} is enrolled in: ${enrolledBatchNames}. Check-in denied.`,
          });
        } else {
          isWrongBatch = true;
        }
      }
      resolvedBatch = targetBatch;
    } else {
      // Auto-detect batch from student's active enrollments
      if (!activeEnrollments.length) {
        return this._logAndReject(db, targetAcademyId, {
          branch_id,
          student_id: resolvedStudent.id,
          mode: normalizedMode,
          device_id: verifiedDeviceId,
          operator_user_id,
          result: 'wrong_batch',
          failure_reason: 'Student has no active batch enrollments in this academy',
          message: `${resolvedStudent.first_name} has no active batch enrollments`,
        });
      }

      // Pick matching batch for today or default to first active enrollment
      resolvedBatch = activeEnrollments[0];
    }

    // 5. Duplicate Check & Cooldown
    const existingAttendance = db.prepare(`
      SELECT 
        sa.id as student_att_id,
        sa.status,
        sa.check_in_time,
        sa.check_in_mode,
        a.date,
        a.batch_id
      FROM student_attendance sa
      JOIN attendance a ON a.id = sa.attendance_id
      WHERE sa.student_id = ? AND a.batch_id = ? AND a.date = ?
    `).get(resolvedStudent.id, resolvedBatch.id, todayDate);

    if (existingAttendance && ['present', 'late'].includes(existingAttendance.status)) {
      const cooldownMins = settings.duplicate_cooldown_mins || 15;
      let lastCheckIn = null;
      if (existingAttendance.check_in_time) {
        const timeStr = existingAttendance.check_in_time.includes('T') || existingAttendance.check_in_time.includes('Z')
          ? existingAttendance.check_in_time
          : existingAttendance.check_in_time.replace(' ', 'T') + 'Z';
        lastCheckIn = new Date(timeStr);
      }
      const now = new Date();

      if (!lastCheckIn || (now.getTime() - lastCheckIn.getTime()) < (cooldownMins * 60 * 1000)) {
        return this._logAndReject(db, targetAcademyId, {
          branch_id: resolvedBatch.branch_id,
          student_id: resolvedStudent.id,
          batch_id: resolvedBatch.id,
          mode: normalizedMode,
          device_id: verifiedDeviceId,
          operator_user_id,
          result: 'duplicate_rejected',
          failure_reason: `Duplicate scan within ${cooldownMins}m cooldown. Already checked in today.`,
          message: `Already Marked! ${resolvedStudent.first_name} ${resolvedStudent.last_name} was already checked in today at ${existingAttendance.check_in_time || 'earlier session'}.`,
        });
      }
    }

    // 6. Time Policy & Late Threshold Evaluation
    let attendanceStatus = 'present';
    const currentTimeStr = getISTTimeString(); // e.g. "07:15"
    if (resolvedBatch.start_time) {
      const lateThresholdMins = settings.late_threshold_mins || 15;
      const [startH, startM] = resolvedBatch.start_time.split(':').map(Number);
      const [curH, curM] = currentTimeStr.split(':').map(Number);

      const batchStartTotalMins = (startH * 60) + startM;
      const currentTotalMins = (curH * 60) + curM;

      if (currentTotalMins > (batchStartTotalMins + lateThresholdMins)) {
        attendanceStatus = 'late';
      }
    }

    // 7. Atomic Write: Create Attendance Header, Upsert student_attendance, Sync Session, and Write Scan Log
    const tx = db.transaction(() => {
      // Find or create attendance header
      let attHeader = db.prepare('SELECT id FROM attendance WHERE batch_id = ? AND date = ?').get(resolvedBatch.id, todayDate);
      let attendanceId;

      if (attHeader) {
        attendanceId = attHeader.id;
      } else {
        const insAtt = db.prepare(`
          INSERT INTO attendance (batch_id, date, taken_by_user_id, notes)
          VALUES (?, ?, ?, ?)
        `).run(
          resolvedBatch.id,
          todayDate,
          operator_user_id || 1,
          `Smart Attendance (${normalizedMode.toUpperCase()})`
        );
        attendanceId = insAtt.lastInsertRowid;
      }

      // Upsert student_attendance
      const verificationMetadataStr = JSON.stringify({
        ...modeMetadata,
        mode: normalizedMode,
        is_wrong_batch: isWrongBatch,
        device_id: verifiedDeviceId,
        device_code: device_code || null,
        client_ip: ip_address || null,
      });

      db.prepare(`
        INSERT INTO student_attendance (
          attendance_id, student_id, status, remarks,
          check_in_mode, check_in_time, device_id, verification_status, verification_metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'verified', ?)
        ON CONFLICT(attendance_id, student_id) DO UPDATE SET
          status = excluded.status,
          remarks = excluded.remarks,
          check_in_mode = excluded.check_in_mode,
          check_in_time = COALESCE(student_attendance.check_in_time, excluded.check_in_time),
          device_id = excluded.device_id,
          verification_status = excluded.verification_status,
          verification_metadata = excluded.verification_metadata
      `).run(
        attendanceId,
        resolvedStudent.id,
        attendanceStatus,
        isWrongBatch ? 'Cross-batch substitute check-in' : null,
        normalizedMode,
        currentIsoTime,
        verifiedDeviceId,
        verificationMetadataStr
      );

      // Auto-assign / progress active technique if syllabus is enabled
      try {
        SyllabusService.autoAssignDefaultTechniqueIfNone(db, targetAcademyId, resolvedStudent.id, operator_user_id || 1);
      } catch (_) { }

      // Sync batch_sessions table
      const session = db.prepare('SELECT id FROM batch_sessions WHERE batch_id = ? AND scheduled_date = ?').get(resolvedBatch.id, todayDate);
      if (session) {
        db.prepare(`
          UPDATE batch_sessions
          SET status = 'completed',
              attendance_status = 'completed',
              attendance_taken_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(session.id);
      }

      // Log successful scan event in smart_attendance_logs
      this._recordScanLog(db, targetAcademyId, {
        branch_id: resolvedBatch.branch_id,
        student_id: resolvedStudent.id,
        batch_id: resolvedBatch.id,
        attendance_id: attendanceId,
        mode: normalizedMode,
        scan_token_raw_masked: this._maskToken(payload.qr_token || payload.card_uid),
        device_id: verifiedDeviceId,
        operator_user_id,
        result: 'success',
        confidence_score: confidenceScore,
        liveness_score: livenessScore,
        location_lat: payload.latitude,
        location_lng: payload.longitude,
        location_distance_meters: modeMetadata.distance_meters,
        ble_signal_strength: bleInfo ? bleInfo.rssi : null,
        ip_address,
        user_agent,
      });

      return {
        attendanceId,
        status: attendanceStatus,
      };
    });

    const execution = tx();

    return {
      success: true,
      mode: normalizedMode,
      status: execution.status,
      student: {
        id: resolvedStudent.id,
        student_code: resolvedStudent.student_code,
        full_name: `${resolvedStudent.first_name} ${resolvedStudent.last_name}`,
        first_name: resolvedStudent.first_name,
        last_name: resolvedStudent.last_name,
        photo_url: resolvedStudent.photo_url || null,
      },
      batch: {
        id: resolvedBatch.id,
        name: resolvedBatch.name,
        sport: resolvedBatch.sport_name,
        time: `${resolvedBatch.start_time} - ${resolvedBatch.end_time}`,
      },
      check_in_time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      message: `Attendance marked (${execution.status.toUpperCase()}) for ${resolvedStudent.first_name} ${resolvedStudent.last_name}`,
      audio_cue: execution.status === 'late' ? 'late_chime' : 'success_beep',
    };
  }

  /**
   * Helper: Logs a scan event in smart_attendance_logs
   */
  static _recordScanLog(db, academyId, logData) {
    const ins = db.prepare(`
      INSERT INTO smart_attendance_logs (
        academy_id, branch_id, student_id, device_id, batch_id, session_id, attendance_id,
        check_in_mode, scan_token_raw_masked, direction, scanned_at, result,
        confidence_score, liveness_score, location_lat, location_lng, location_distance_meters,
        ble_signal_strength, ip_address, user_agent, failure_reason, operator_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'check_in', CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      academyId,
      logData.branch_id || null,
      logData.student_id || null,
      logData.device_id || null,
      logData.batch_id || null,
      logData.session_id || null,
      logData.attendance_id || null,
      logData.mode || 'qr',
      logData.scan_token_raw_masked || null,
      logData.result,
      logData.confidence_score ?? null,
      logData.liveness_score ?? null,
      logData.location_lat ?? null,
      logData.location_lng ?? null,
      logData.location_distance_meters ?? null,
      logData.ble_signal_strength ?? null,
      logData.ip_address || null,
      logData.user_agent || null,
      logData.failure_reason || null,
      logData.operator_user_id || null
    );

    return ins.lastInsertRowid;
  }

  /**
   * Helper: Logs failure and returns rejected response object
   */
  static _logAndReject(db, academyId, data) {
    this._recordScanLog(db, academyId, data);
    return {
      success: false,
      code: (data.result || 'REJECTED').toUpperCase(),
      message: data.message || data.failure_reason || 'Attendance check-in rejected',
      audio_cue: 'error_buzzer',
    };
  }

  /**
   * Helper: Masks raw tokens in logs to prevent secret leakage
   */
  static _maskToken(token) {
    if (!token || typeof token !== 'string') return null;
    if (token.length <= 8) return '****';
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }
}
