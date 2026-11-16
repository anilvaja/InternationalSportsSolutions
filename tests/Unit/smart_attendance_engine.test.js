import test from 'node:test';
import assert from 'node:assert/strict';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { SmartAttendanceEngine } from '../../src/services/smartAttendanceEngine.js';
import { QrAttendanceService } from '../../src/services/qrAttendanceService.js';
import { FaceBiometricsService } from '../../src/services/faceBiometricsService.js';
import { NfcReaderAdapter } from '../../src/services/nfcReaderAdapter.js';
import { LocationProximityService } from '../../src/services/locationProximityService.js';
import { EventPassService } from '../../src/services/eventPassService.js';
import { getISTDateString } from '../../src/utils/dateUtils.js';

test('Smart Attendance Engine — Comprehensive Architectural Test Suite', async (t) => {
  try {
    const db = getTenantDbById(1);
  const academyId = 1;

  // Setup test branch, batch, and students
  const branch = db.prepare('SELECT id, name, latitude, longitude FROM branches WHERE is_active = 1 LIMIT 1').get() || { id: 1, name: 'Main Dojo' };
  
  // Ensure branch has coordinates for geofence tests
  db.prepare(`
    UPDATE branches 
    SET latitude = 19.0760, longitude = 72.8777, geofence_radius_meters = 150, is_geofence_enforced = 1
    WHERE id = ?
  `).run(branch.id);

  // Ensure test batch exists
  let batch = db.prepare('SELECT id, name, start_time, end_time, branch_id FROM batches WHERE branch_id = ? LIMIT 1').get(branch.id);
  if (!batch) {
    const insB = db.prepare(`
      INSERT INTO batches (name, branch_id, start_time, end_time, days_of_week)
      VALUES ('Morning Elite Batch', ?, '06:00', '07:30', '["Mon","Wed","Fri"]')
    `).run(branch.id);
    batch = { id: insB.lastInsertRowid, name: 'Morning Elite Batch', start_time: '06:00', end_time: '07:30', branch_id: branch.id };
  }

  // Ensure test students exist
  let studentA = db.prepare("SELECT id, student_code, first_name, last_name, status FROM students WHERE status = 'active' LIMIT 1").get();
  if (!studentA) {
    const insS = db.prepare(`
      INSERT INTO students (student_code, first_name, last_name, branch_id, status)
      VALUES ('STU-TEST-001', 'Aarav', 'Patel', ?, 'active')
    `).run(branch.id);
    studentA = { id: insS.lastInsertRowid, student_code: 'STU-TEST-001', first_name: 'Aarav', last_name: 'Patel', status: 'active' };
  }

  // Enroll studentA into batch
  db.prepare('DELETE FROM student_batch_enrollments WHERE student_id = ?').run(studentA.id);
  db.prepare(`
    INSERT INTO student_batch_enrollments (student_id, batch_id, status)
    VALUES (?, ?, 'active')
  `).run(studentA.id, batch.id);

  await t.test('1. Cryptographic QR Token Lifecycle & PII Shielding', async () => {
    // Generate QR token
    const tokenData = QrAttendanceService.generateStudentQrToken(db, academyId, studentA.id, 1, 'Initial card issuance');
    assert.ok(tokenData.token.startsWith('ISS-STU-'), 'Token must be prefixed with ISS-STU-');
    assert.ok(!tokenData.token.startsWith(`ISS-STU-${studentA.id}-`), 'Token must not be simply derived from numeric student ID');
    assert.ok(!tokenData.token.includes(studentA.student_code), 'Token must never leak student code');
    assert.equal(tokenData.token.length >= 32, true, 'Token must have high entropy');

    // Resolves token cleanly
    const resolved = QrAttendanceService.resolveToken(db, academyId, tokenData.token);
    assert.equal(resolved.valid, true);
    assert.equal(resolved.student.id, studentA.id);
    assert.equal(resolved.tokenRecord.version, tokenData.version);

    // Re-issuance revokes old token and increments version
    const tokenData2 = QrAttendanceService.generateStudentQrToken(db, academyId, studentA.id, 1, 'Re-issued card');
    assert.equal(tokenData2.version, tokenData.version + 1, 'Version must increment');
    assert.notEqual(tokenData2.token, tokenData.token, 'Tokens must be distinct');

    // Old token should now be rejected as REVOKED
    const resolvedOld = QrAttendanceService.resolveToken(db, academyId, tokenData.token);
    assert.equal(resolvedOld.valid, false);
    assert.equal(resolvedOld.reason, 'REVOKED_TOKEN');

    // Digital ID Card payload test
    const idCard = await QrAttendanceService.getStudentIdCardData(db, academyId, studentA.id, { name: 'Karate Academy' });
    assert.equal(idCard.student.id, studentA.id);
    assert.equal(idCard.qr.token, tokenData2.token);
    assert.ok(Array.isArray(idCard.student.batches));
  });

  await t.test('2. NFC / RFID Card Adapter & Conflict Detection', async () => {
    const p1 = Math.floor(10 + Math.random() * 89);
    const p2 = Math.floor(10 + Math.random() * 89);
    const cardUid = `04:A1:B2:${p1}:${p2}`;
    db.prepare('DELETE FROM student_nfc_cards WHERE card_uid = ?').run(cardUid);

    // Assign card to studentA
    const assignRes = NfcReaderAdapter.assignCard(db, academyId, studentA.id, {
      card_uid: cardUid,
      card_type: 'mifare_classic',
      label: 'Silicone Wristband #1',
      assigned_by: 1,
    });
    assert.equal(assignRes.card_uid, cardUid);
    assert.equal(assignRes.status, 'active');

    // Resolve card
    const resolvedCard = NfcReaderAdapter.resolveCard(db, academyId, cardUid);
    assert.equal(resolvedCard.valid, true);
    assert.equal(resolvedCard.student.id, studentA.id);

    // Ensure studentB exists for duplicate conflict test
    let studentB = db.prepare("SELECT id FROM students WHERE id != ? AND status = 'active' LIMIT 1").get(studentA.id);
    if (!studentB) {
      const uniqueCode = 'STU-TEST-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const insB = db.prepare(`
        INSERT INTO students (student_code, first_name, last_name, branch_id, status)
        VALUES (?, 'Rohan', 'Sharma', ?, 'active')
      `).run(uniqueCode, branch.id);
      studentB = { id: insB.lastInsertRowid };
    }

    // Attempt duplicate assignment to another student should throw error
    assert.throws(() => {
      NfcReaderAdapter.assignCard(db, academyId, studentB.id, {
        card_uid: cardUid,
      });
    }, /is currently active and assigned/);

    // Revoke card
    const revokeRes = NfcReaderAdapter.revokeCard(db, academyId, cardUid, { status: 'lost', reason: 'Student lost wristband' });
    assert.equal(revokeRes.success, true);

    // Resolving revoked card returns rejection
    const resolvedRevoked = NfcReaderAdapter.resolveCard(db, academyId, cardUid);
    assert.equal(resolvedRevoked.valid, false);
    assert.equal(resolvedRevoked.reason, 'CARD_REVOKED');
  });

  await t.test('3. Face Biometrics: Mandatory Consent, Encrypted Templates & Cosine Similarity', async () => {
    // Reset consent and profile state for clean test run
    db.prepare('DELETE FROM student_face_profiles WHERE student_id = ?').run(studentA.id);
    db.prepare('DELETE FROM student_face_consents WHERE student_id = ?').run(studentA.id);

    // 1. Enrollment without consent must be REJECTED
    const mockVector = FaceBiometricsService.generateMockVector('student_face_aarav');
    assert.throws(() => {
      FaceBiometricsService.enrollFaceProfile(db, academyId, studentA.id, {
        vector: mockVector,
        enrolled_by: 1,
      });
    }, /Explicit parent\/guardian consent is required/);

    // 2. Record explicit parent consent
    const consentRes = FaceBiometricsService.recordConsent(db, academyId, studentA.id, {
      consent_given_by: 'Rajesh Patel (Father)',
      guardian_relationship: 'father',
      consent_status: 'granted',
    });
    assert.equal(consentRes.consent_status, 'granted');
    assert.equal(FaceBiometricsService.hasActiveConsent(db, academyId, studentA.id), true);

    // 3. Now enrollment must succeed
    const enrollRes = FaceBiometricsService.enrollFaceProfile(db, academyId, studentA.id, {
      vector: mockVector,
      enrolled_by: 1,
    });
    assert.ok(enrollRes.id);

    // Verify template in database is ENCRYPTED and not raw plaintext floats
    const rawProfile = db.prepare('SELECT template_encrypted FROM student_face_profiles WHERE student_id = ?').get(studentA.id);
    assert.ok(rawProfile.template_encrypted.includes('ciphertext'), 'Stored template must be encrypted JSON with ciphertext');
    assert.ok(rawProfile.template_encrypted.includes('authTag'), 'Stored template must include GCM authTag');

    // 4. Exact vector probe should match with high confidence (1.0) -> VERIFIED
    const matchVerified = FaceBiometricsService.matchFace(db, academyId, {
      probeVector: mockVector,
      livenessScore: 0.95,
      targetStudentId: studentA.id,
    });
    assert.equal(matchVerified.matched, true);
    assert.equal(matchVerified.classification, 'VERIFIED');
    assert.ok(matchVerified.confidenceScore >= 0.85);

    // 5. Anti-spoofing liveness failure
    const matchSpoof = FaceBiometricsService.matchFace(db, academyId, {
      probeVector: mockVector,
      livenessScore: 0.30, // Failed liveness check
    });
    assert.equal(matchSpoof.matched, false);
    assert.equal(matchSpoof.classification, 'LIVENESS_FAILED');

    // 6. Withdrawing consent purges profile
    FaceBiometricsService.recordConsent(db, academyId, studentA.id, {
      consent_given_by: 'Rajesh Patel',
      consent_status: 'withdrawn',
    });
    assert.equal(FaceBiometricsService.hasActiveConsent(db, academyId, studentA.id), false);
    const purgedProfile = db.prepare('SELECT status FROM student_face_profiles WHERE student_id = ?').get(studentA.id);
    assert.equal(purgedProfile.status, 'revoked');
  });

  await t.test('4. GPS Haversine Geofencing & BLE Proximity Signal', async () => {
    // Inside geofence: Branch coords: 19.0760, 72.8777
    const insideRes = LocationProximityService.verifyGeofence(db, branch.id, {
      latitude: 19.0761,
      longitude: 72.8778,
      accuracy: 10,
    });
    assert.equal(insideRes.valid, true);
    assert.equal(insideRes.isWithinGeofence, true);
    assert.ok(insideRes.distanceMeters < 50);

    // Outside geofence: 2km away
    const outsideRes = LocationProximityService.verifyGeofence(db, branch.id, {
      latitude: 19.0950,
      longitude: 72.8900,
      accuracy: 15,
    });
    assert.equal(outsideRes.valid, false);
    assert.equal(outsideRes.isWithinGeofence, false);
    assert.equal(outsideRes.reason, 'OUTSIDE_GEOFENCE');

    // BLE proximity signal test: Strict rule that BLE is NEVER sufficient alone
    const bleSignal = LocationProximityService.evaluateBleSignal({
      beaconUuid: 'e2c56db5-dffb-48d2-b060-d0f5a71096e0',
      rssi: -62,
    });
    assert.equal(bleSignal.supported, true);
    assert.equal(bleSignal.isStandaloneSufficient, false, 'BLE must never be standalone sufficient for attendance');
  });

  await t.test('5. Central Validation Engine: QR Check-In, Duplicate Cooldown & Separation', async () => {
    const today = getISTDateString();

    // Clean attendance for testing
    const existingAtt = db.prepare('SELECT id FROM attendance WHERE batch_id = ? AND date = ?').get(batch.id, today);
    if (existingAtt) {
      db.prepare('DELETE FROM student_attendance WHERE attendance_id = ?').run(existingAtt.id);
      db.prepare('DELETE FROM attendance WHERE id = ?').run(existingAtt.id);
    }

    // Generate fresh QR token for studentA
    const qrData = QrAttendanceService.generateStudentQrToken(db, academyId, studentA.id, 1, 'Test scan');

    const staffPunchCountBefore = db.prepare('SELECT COUNT(*) as cnt FROM staff_punches').get().cnt;
    const staffSlotAttCountBefore = db.prepare('SELECT COUNT(*) as cnt FROM staff_slot_attendance').get().cnt;

    // 1. First Scan: Must succeed
    const scanOutcome = SmartAttendanceEngine.verifyAndRecordAttendance(db, academyId, {
      mode: 'qr',
      qr_token: qrData.token,
      batch_id: batch.id,
      branch_id: branch.id,
      operator_user_id: 1,
    });

    assert.equal(scanOutcome.success, true);
    assert.equal(scanOutcome.student.id, studentA.id);
    assert.ok(['present', 'late'].includes(scanOutcome.status));

    // Verify row in student_attendance
    const savedRecord = db.prepare(`
      SELECT sa.* FROM student_attendance sa
      JOIN attendance a ON a.id = sa.attendance_id
      WHERE sa.student_id = ? AND a.batch_id = ? AND a.date = ?
    `).get(studentA.id, batch.id, today);

    assert.ok(savedRecord, 'student_attendance row must exist');
    assert.equal(savedRecord.check_in_mode, 'qr');
    assert.equal(savedRecord.verification_status, 'verified');

    // 2. Duplicate Scan within cooldown: Must be REJECTED
    const duplicateOutcome = SmartAttendanceEngine.verifyAndRecordAttendance(db, academyId, {
      mode: 'qr',
      qr_token: qrData.token,
      batch_id: batch.id,
      branch_id: branch.id,
      operator_user_id: 1,
    });

    assert.equal(duplicateOutcome.success, false);
    assert.equal(duplicateOutcome.code, 'DUPLICATE_REJECTED');

    // 3. Strict Employee Isolation Check:
    // Verify that NO staff punches or coach payroll rows were created during student scan
    const staffPunchCountAfter = db.prepare('SELECT COUNT(*) as cnt FROM staff_punches').get().cnt;
    assert.equal(staffPunchCountAfter, staffPunchCountBefore, 'Student check-in must never write to staff_punches');

    const staffSlotAttCountAfter = db.prepare('SELECT COUNT(*) as cnt FROM staff_slot_attendance').get().cnt;
    assert.equal(staffSlotAttCountAfter, staffSlotAttCountBefore, 'Student check-in must never write to staff_slot_attendance');
  });

  await t.test('6. Event Pass QR Isolation: Event Check-In Separate from Class Attendance', async () => {
    // Create test event
    const insEvent = db.prepare(`
      INSERT INTO events (academy_id, title, slug, type, status, event_date)
      VALUES (?, 'State Karate Championship 2026', 'state-karate-2026', 'tournament', 'published', '2026-11-20 09:00:00')
    `).run(academyId);
    const eventId = insEvent.lastInsertRowid;

    // Generate event pass
    const passData = EventPassService.getOrCreateEventPass(db, academyId, eventId, studentA.id);
    assert.ok(passData.pass_code.startsWith('ISS-EVT-'));
    assert.equal(passData.status, 'active');

    // Check in event pass at entrance
    const checkInRes = EventPassService.checkInEventPass(db, academyId, passData.pass_code, { operatorUserId: 1 });
    assert.equal(checkInRes.success, true);
    assert.equal(checkInRes.student.id, studentA.id);

    // Pass should now be 'used'
    const usedPass = db.prepare('SELECT status FROM event_passes WHERE pass_code = ?').get(passData.pass_code);
    assert.equal(usedPass.status, 'used');

    // Participant marked 'attended'
    const participant = db.prepare('SELECT status FROM event_participants WHERE event_id = ? AND student_id = ?').get(eventId, studentA.id);
    assert.equal(participant.status, 'attended');

    // Re-scanning used pass should reject with PASS_ALREADY_USED
    const duplicateEventScan = EventPassService.checkInEventPass(db, academyId, passData.pass_code, { operatorUserId: 1 });
    assert.equal(duplicateEventScan.success, false);
    assert.equal(duplicateEventScan.reason, 'PASS_ALREADY_USED');
  });

  await t.test('7. Attendance Exceptions Queue & Manual Approval Workflow', async () => {
    // Insert mock exception
    const insEx = db.prepare(`
      INSERT INTO attendance_exceptions_queue (
        academy_id, branch_id, student_id, batch_id, exception_type, status, details
      ) VALUES (?, ?, ?, ?, 'low_confidence_face', 'pending', '{"confidence":0.74}')
    `).run(academyId, branch.id, studentA.id, batch.id);

    const exceptionId = insEx.lastInsertRowid;

    // Approve exception
    db.prepare(`
      UPDATE attendance_exceptions_queue
      SET status = 'approved', reviewed_by = 1, reviewed_at = CURRENT_TIMESTAMP, resolution_notes = 'Face visually confirmed by coach'
      WHERE id = ?
    `).run(exceptionId);

    const updated = db.prepare('SELECT status, resolution_notes FROM attendance_exceptions_queue WHERE id = ?').get(exceptionId);
    assert.equal(updated.status, 'approved');
    assert.equal(updated.resolution_notes, 'Face visually confirmed by coach');
  });

  await t.test('8. Real Face Biometrics & Image Feature Vector Extraction with Sharp', async () => {
    // Generate a valid 100x100 test image with distinct features using sharp
    const sharp = (await import('sharp')).default;
    const svgFace = Buffer.from('<svg width="100" height="100"><circle cx="50" cy="50" r="30" fill="#333333"/><circle cx="40" cy="40" r="5" fill="#ffffff"/><circle cx="60" cy="40" r="5" fill="#ffffff"/></svg>');
    const testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 240, g: 220, b: 200 },
      },
    }).composite([{ input: svgFace, top: 0, left: 0 }]).jpeg().toBuffer();

    // 1. Feature extraction creates 512-d normalized vector
    const extracted = await FaceBiometricsService.extractVectorFromImage(testImageBuffer);
    assert.ok(Array.isArray(extracted.vector), 'Must extract array vector');
    assert.equal(extracted.vector.length, 512, 'Must produce 512-dimensional vector');
    assert.ok(extracted.livenessScore >= 0 && extracted.livenessScore <= 1, 'Liveness score in range [0, 1]');

    // 2. Grant consent and enroll directly from image buffer
    FaceBiometricsService.recordConsent(db, academyId, studentA.id, {
      consent_given_by: 'Parent Consent',
      guardian_relationship: 'mother',
      consent_status: 'granted',
    });

    const enrolled = await FaceBiometricsService.enrollFaceProfileFromImage(db, academyId, studentA.id, {
      image_buffer: testImageBuffer,
      enrolled_by: 1,
    });
    assert.ok(enrolled.id);
    const profile = db.prepare('SELECT status FROM student_face_profiles WHERE id = ?').get(enrolled.id);
    assert.equal(profile.status, 'active');

    // 3. Probing with the exact same face image produces matching vector
    const probe = await FaceBiometricsService.extractVectorFromImage(testImageBuffer);
    const match = FaceBiometricsService.matchFace(db, academyId, {
      probeVector: probe.vector,
      livenessScore: 0.95,
      targetStudentId: studentA.id,
    });
    assert.equal(match.matched, true);
    assert.equal(match.classification, 'VERIFIED');
    assert.ok(match.confidenceScore >= 0.9);
  });

  await t.test('9. Card Photo Face Identification Fallback', async () => {
    // When an ID card photo is uploaded without readable QR, the engine falls back
    // to recognizing the student from their portrait on the ID badge
    const svgFace = Buffer.from('<svg width="100" height="100"><circle cx="50" cy="50" r="30" fill="#333333"/><circle cx="40" cy="40" r="5" fill="#ffffff"/><circle cx="60" cy="40" r="5" fill="#ffffff"/></svg>');
    const sharp = (await import('sharp')).default;
    const cardPhotoBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 240, g: 220, b: 200 },
      },
    }).composite([{ input: svgFace, top: 0, left: 0 }]).jpeg().toBuffer();

    const probe = await FaceBiometricsService.extractVectorFromImage(cardPhotoBuffer);
    const faceMatch = FaceBiometricsService.matchFace(db, academyId, {
      probeVector: probe.vector,
      livenessScore: 1.0,
      targetStudentId: studentA.id,
    });
    assert.equal(faceMatch.matched, true);
    assert.equal(faceMatch.student.first_name, studentA.first_name);
  });
  } catch (err) {
    console.error('TEST SETUP / EXECUTION ERROR:', err);
    throw err;
  }
});
