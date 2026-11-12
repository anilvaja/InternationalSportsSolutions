-- Migration: 035_smart_attendance_engine.sql
-- Description: Centralized Smart Attendance Engine schema
-- Supporting QR Scanner, Face Biometrics & Consent, NFC/RFID, GPS Geofencing, BLE, Kiosks & Event Passes

-- 1. Extend student_attendance table with Smart Attendance tracking columns
ALTER TABLE student_attendance ADD COLUMN check_in_mode TEXT DEFAULT 'coach_manual';
ALTER TABLE student_attendance ADD COLUMN check_in_time DATETIME;
ALTER TABLE student_attendance ADD COLUMN check_out_time DATETIME;
ALTER TABLE student_attendance ADD COLUMN device_id INTEGER;
ALTER TABLE student_attendance ADD COLUMN verification_status TEXT DEFAULT 'verified';
ALTER TABLE student_attendance ADD COLUMN verification_metadata TEXT;

CREATE INDEX IF NOT EXISTS idx_student_attendance_mode ON student_attendance(check_in_mode);
CREATE INDEX IF NOT EXISTS idx_student_attendance_time ON student_attendance(check_in_time);

-- 2. Smart Attendance Settings (per academy and per branch)
CREATE TABLE IF NOT EXISTS smart_attendance_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER, -- NULL represents academy-wide default
  enabled_modes TEXT NOT NULL DEFAULT '["qr","coach_manual","gps","nfc"]',
  default_mode TEXT NOT NULL DEFAULT 'qr',
  qr_refresh_rate_seconds INTEGER NOT NULL DEFAULT 0, -- 0 = static ID pass, >0 = dynamic rotating
  qr_allow_offline INTEGER NOT NULL DEFAULT 1,
  checkin_window_before_mins INTEGER NOT NULL DEFAULT 30,
  checkin_window_after_mins INTEGER NOT NULL DEFAULT 60,
  late_threshold_mins INTEGER NOT NULL DEFAULT 15,
  duplicate_cooldown_mins INTEGER NOT NULL DEFAULT 15,
  allow_wrong_batch_checkin INTEGER NOT NULL DEFAULT 0,
  face_confidence_threshold REAL NOT NULL DEFAULT 0.85,
  face_liveness_required INTEGER NOT NULL DEFAULT 1,
  face_manual_review_threshold REAL NOT NULL DEFAULT 0.70,
  gps_geofence_meters INTEGER NOT NULL DEFAULT 150,
  gps_enforce_strict INTEGER NOT NULL DEFAULT 0,
  offline_sync_max_age_hours INTEGER NOT NULL DEFAULT 48,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(academy_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_smart_att_settings_branch ON smart_attendance_settings(academy_id, branch_id);

-- 3. Attendance Devices (Kiosks, tablets, coach mobiles, external readers)
CREATE TABLE IF NOT EXISTS attendance_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER NOT NULL,
  device_name TEXT NOT NULL,
  device_code TEXT UNIQUE NOT NULL,
  device_type TEXT NOT NULL CHECK(device_type IN ('kiosk', 'tablet', 'mobile_coach', 'nfc_reader', 'turnstile', 'external_scanner', 'web_browser')),
  platform TEXT DEFAULT 'web_browser',
  api_key_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'revoked')),
  is_online INTEGER DEFAULT 0,
  last_seen_at DATETIME,
  config TEXT DEFAULT '{}',
  registered_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attendance_devices_branch ON attendance_devices(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_devices_code ON attendance_devices(device_code);
CREATE INDEX IF NOT EXISTS idx_attendance_devices_status ON attendance_devices(status);

-- 4. Cryptographic Student QR Tokens (Random, Revocable, Non-PII)
CREATE TABLE IF NOT EXISTS student_qr_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  student_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'revoked', 'expired')),
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  revoked_at DATETIME,
  revoked_by INTEGER,
  revocation_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_student ON student_qr_tokens(student_id, status);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON student_qr_tokens(token);

-- 5. NFC / RFID Card and Wristband Assignments
CREATE TABLE IF NOT EXISTS student_nfc_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  student_id INTEGER NOT NULL,
  card_uid TEXT NOT NULL,
  card_type TEXT DEFAULT 'standard_nfc',
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'lost', 'damaged', 'revoked', 'unassigned')),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER,
  revoked_at DATETIME,
  revocation_reason TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(academy_id, card_uid),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nfc_cards_student ON student_nfc_cards(student_id, status);
CREATE INDEX IF NOT EXISTS idx_nfc_cards_uid ON student_nfc_cards(card_uid);

-- 6. Biometric Face Consents (Parent / Guardian authorization & withdrawal)
CREATE TABLE IF NOT EXISTS student_face_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  student_id INTEGER NOT NULL,
  consent_given_by TEXT NOT NULL,
  guardian_relationship TEXT,
  consent_type TEXT NOT NULL DEFAULT 'biometric_face_attendance',
  consent_status TEXT NOT NULL CHECK(consent_status IN ('granted', 'withdrawn', 'declined')),
  consent_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  withdrawal_timestamp DATETIME,
  terms_version TEXT DEFAULT 'v1.0',
  ip_address TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_face_consents_student ON student_face_consents(student_id, consent_status);

-- 7. Biometric Face Profiles (Secure encrypted mathematical templates, never raw photos)
CREATE TABLE IF NOT EXISTS student_face_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  student_id INTEGER NOT NULL,
  template_encrypted TEXT NOT NULL,
  template_version TEXT DEFAULT 'v1_512d',
  sample_count INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'revoked', 'pending_approval')),
  enrolled_by INTEGER,
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deletion_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(academy_id, student_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_face_profiles_student ON student_face_profiles(student_id, status);

-- 8. Unified Smart Attendance Scan Events / Logs (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS smart_attendance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER,
  student_id INTEGER,
  device_id INTEGER,
  batch_id INTEGER,
  session_id INTEGER,
  attendance_id INTEGER,
  check_in_mode TEXT NOT NULL CHECK(check_in_mode IN ('qr', 'face', 'nfc', 'gps', 'ble', 'coach_manual', 'kiosk')),
  scan_token_raw_masked TEXT,
  direction TEXT DEFAULT 'check_in' CHECK(direction IN ('check_in', 'check_out')),
  scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  result TEXT NOT NULL CHECK(result IN ('success', 'duplicate_rejected', 'wrong_batch', 'inactive_student', 'unregistered_token', 'outside_geofence', 'low_confidence_face', 'liveness_failed', 'offline_synced', 'flagged_for_review', 'permission_denied', 'system_error')),
  confidence_score REAL,
  liveness_score REAL,
  location_lat REAL,
  location_lng REAL,
  location_distance_meters REAL,
  ble_signal_strength INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  failure_reason TEXT,
  operator_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_smart_att_logs_student ON smart_attendance_logs(student_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_smart_att_logs_branch ON smart_attendance_logs(branch_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_smart_att_logs_result ON smart_attendance_logs(result);

-- 9. Attendance Exceptions Queue (Manual Review for Low Confidence Face, Wrong Batch, Borderline GPS)
CREATE TABLE IF NOT EXISTS attendance_exceptions_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER NOT NULL,
  scan_log_id INTEGER,
  student_id INTEGER,
  batch_id INTEGER,
  session_id INTEGER,
  exception_type TEXT NOT NULL CHECK(exception_type IN ('low_confidence_face', 'wrong_batch', 'outside_geofence', 'offline_conflict', 'duplicate_investigation', 'unassigned_nfc', 'manual_review')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  details TEXT, -- JSON snapshot of context
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  resolution_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_att_exceptions_status ON attendance_exceptions_queue(branch_id, status);

-- 10. Event Passes & Event Attendance Isolation (Separate from Class Attendance)
CREATE TABLE IF NOT EXISTS event_passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy_id INTEGER NOT NULL DEFAULT 1,
  event_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  participant_id INTEGER,
  pass_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'used', 'revoked')),
  checked_in_at DATETIME,
  checked_in_by INTEGER,
  device_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, student_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_passes_code ON event_passes(pass_code);
CREATE INDEX IF NOT EXISTS idx_event_passes_event ON event_passes(event_id, status);
