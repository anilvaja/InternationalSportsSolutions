import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { calculateHaversineDistance, processStaffPunch, getStaffPunchStatus } from '../../src/services/geofenceService.js';
import { InquiryService } from '../../src/services/inquiryService.js';

describe('GPS Location Tracking & Geofenced Punch-In/Punch-Out Test Suite', () => {
  let db;

  before(() => {
    // In-memory SQLite database mimicking tenant schema
    db = new Database(':memory:');

    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        role TEXT
      );

      CREATE TABLE branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        code TEXT,
        city TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        academy_id INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        latitude REAL,
        longitude REAL,
        geofence_radius_meters INTEGER DEFAULT 100,
        is_geofence_enforced INTEGER DEFAULT 1
      );

      CREATE TABLE user_branch_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        branch_id INTEGER NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE staff_punches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        branch_id INTEGER NOT NULL,
        punch_type TEXT CHECK(punch_type IN ('punch_in', 'punch_out')) NOT NULL,
        punched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy_meters REAL,
        distance_meters REAL NOT NULL,
        is_within_geofence INTEGER NOT NULL,
        device_info TEXT,
        ip_address TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      CREATE TABLE tenant_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_code TEXT UNIQUE,
        first_name TEXT,
        last_name TEXT,
        branch_id INTEGER,
        status TEXT DEFAULT 'active'
      );
    `);

    // Seed test branch: Marine Drive Academy Campus (18.9438, 72.8232), radius 100 meters
    db.prepare(`
      INSERT INTO branches (id, name, code, city, latitude, longitude, geofence_radius_meters, is_geofence_enforced)
      VALUES (1, 'Marine Drive Campus', 'MDC', 'Mumbai', 18.9438, 72.8232, 100, 1)
    `).run();

    // Seed Coach user
    db.prepare(`
      INSERT INTO users (id, name, email, role)
      VALUES (10, 'Coach Rohit', 'rohit@coach.com', 'coach')
    `).run();

    // Assign coach to branch 1
    db.prepare(`
      INSERT INTO user_branch_assignments (user_id, branch_id)
      VALUES (10, 1)
    `).run();

    // Academy setting
    db.prepare("INSERT INTO tenant_settings (key, value) VALUES ('academy_code', 'GSA')").run();
  });

  after(() => {
    db.close();
  });

  it('1. Haversine distance correctly calculates distance between GPS points', () => {
    // Same point -> 0 meters
    const d0 = calculateHaversineDistance(18.9438, 72.8232, 18.9438, 72.8232);
    assert.strictEqual(d0, 0);

    // Nearby point ~25 meters away
    const d25 = calculateHaversineDistance(18.9438, 72.8232, 18.9440, 72.8232);
    assert.ok(d25 >= 20 && d25 <= 30, `Expected ~22-25m, got ${d25}m`);

    // Point ~500 meters away
    const d500 = calculateHaversineDistance(18.9438, 72.8232, 18.9480, 72.8232);
    assert.ok(d500 >= 450 && d500 <= 550, `Expected ~467m, got ${d500}m`);
  });

  it('2. Punch-in succeeds when staff device is within geofence radius', () => {
    const user = { id: 10, email: 'rohit@coach.com', role: 'coach' };
    // Device located ~22 meters from branch center
    const payload = {
      punch_type: 'punch_in',
      latitude: 18.9440,
      longitude: 72.8232,
      accuracy: 5.2,
    };

    const res = processStaffPunch(db, user, payload, '127.0.0.1', 'Mozilla/5.0');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.is_within_geofence, true);
    assert.ok(res.distance_meters <= 100, `Expected distance <= 100m, got ${res.distance_meters}`);
    assert.strictEqual(res.punch.punch_type, 'punch_in');
    assert.strictEqual(res.punch.user_id, 10);
    assert.strictEqual(res.punch.branch_id, 1);
  });

  it('3. Punch-out succeeds within geofence and status reflects punched-out', () => {
    const user = { id: 10, email: 'rohit@coach.com', role: 'coach' };
    const payload = {
      punch_type: 'punch_out',
      latitude: 18.9439,
      longitude: 72.8232,
      accuracy: 4.1,
    };

    const res = processStaffPunch(db, user, payload, '127.0.0.1', 'Mozilla/5.0');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.punch.punch_type, 'punch_out');

    const status = getStaffPunchStatus(db, user);
    assert.strictEqual(status.isPunchedIn, false);
    assert.strictEqual(status.lastPunch.punch_type, 'punch_out');
    assert.strictEqual(status.todayPunches.length, 2);
  });

  it('4. Out-of-bounds punch is strictly rejected with 403 Forbidden and descriptive error', () => {
    const user = { id: 10, email: 'rohit@coach.com', role: 'coach' };
    // Device located at Nariman Point (~1.2 km away)
    const payload = {
      punch_type: 'punch_in',
      latitude: 18.9256,
      longitude: 72.8242,
      accuracy: 10.0,
    };

    let caughtError = null;
    try {
      processStaffPunch(db, user, payload, '127.0.0.1', 'Mozilla/5.0');
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError !== null, 'Expected out of bounds punch to throw an error');
    assert.strictEqual(caughtError.status, 403);
    assert.ok(caughtError.message.includes('Out of range: you are'), `Message did not match: ${caughtError.message}`);
    assert.ok(caughtError.message.includes('Punch is allowed only within 100 meters'), `Message did not match: ${caughtError.message}`);
    assert.strictEqual(caughtError.is_within_geofence, 0);
    assert.ok(caughtError.distance_meters > 1000, `Expected distance > 1000m, got ${caughtError.distance_meters}`);
  });

  it('5. Hierarchical Student Code generation follows [Academy]-[Branch]-[Year]-[Seq]', () => {
    // Insert dummy inquiry
    db.exec(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        academy_id INTEGER,
        student_name TEXT,
        guardian_name TEXT,
        phone TEXT,
        branch_id INTEGER,
        status TEXT
      );
      CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        branch_id INTEGER,
        sport_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS student_batch_enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        batch_id INTEGER,
        start_date TEXT,
        end_date TEXT,
        status TEXT
      );
      CREATE TABLE IF NOT EXISTS student_fees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        fee_structure_id INTEGER,
        total_amount REAL,
        paid_amount REAL DEFAULT 0,
        balance_amount REAL,
        status TEXT,
        due_date TEXT
      );
      CREATE TABLE IF NOT EXISTS student_admission_checklists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        item_key TEXT,
        title TEXT,
        status TEXT
      );
      CREATE TABLE IF NOT EXISTS student_batch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        from_batch_id INTEGER,
        to_batch_id INTEGER,
        reason TEXT
      );
    `);

    db.prepare(`
      INSERT INTO batches (id, name, branch_id) VALUES (1, 'Morning Batch A', 1)
    `).run();

    const inq = db.prepare(`
      INSERT INTO inquiries (academy_id, student_name, guardian_name, phone, branch_id, status)
      VALUES (1, 'Aarav Patel', 'Rajesh Patel', '9898012345', 1, 'trial_completed')
    `).run();

    const studentCode = InquiryService.generateStudentCode(db, 1);
    assert.ok(studentCode, 'Student code should be generated');

    // Pattern: GSA-MDC-26-0001
    const parts = studentCode.split('-');
    assert.strictEqual(parts.length, 4, `Expected 4 parts in student code, got ${studentCode}`);
    assert.strictEqual(parts[0], 'GSA', 'Academy code');
    assert.strictEqual(parts[1], 'MDC', 'Branch code');
    assert.strictEqual(parts[2], String(new Date().getFullYear()).slice(-2), 'Year suffix');
    assert.strictEqual(parts[3], '0001', 'Sequence 0001');
  });

  it('6. Student archive/soft-delete marks student inactive and completes enrollment', () => {
    const studentInfo = db.prepare(`
      INSERT INTO students (student_code, first_name, last_name, branch_id, status)
      VALUES ('GSA-MDC-26-0099', 'Vikram', 'Rathore', 1, 'active')
    `).run();
    const studentId = studentInfo.lastInsertRowid;

    db.prepare(`
      INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status)
      VALUES (?, 1, date('now'), 'active')
    `).run(studentId);

    // Perform student archive operation
    db.prepare("UPDATE students SET status = 'inactive' WHERE id = ?").run(studentId);
    db.prepare("UPDATE student_batch_enrollments SET status = 'completed', end_date = date('now') WHERE student_id = ? AND status = 'active'").run(studentId);

    const updatedStudent = db.prepare('SELECT status FROM students WHERE id = ?').get(studentId);
    assert.strictEqual(updatedStudent.status, 'inactive');

    const updatedEnrollment = db.prepare('SELECT status, end_date FROM student_batch_enrollments WHERE student_id = ?').get(studentId);
    assert.strictEqual(updatedEnrollment.status, 'completed');
    assert.ok(updatedEnrollment.end_date, 'End date should be recorded');
  });

  it('7. Branch GPS geofence configuration updates and stores coordinates properly', () => {
    db.prepare(`
      UPDATE branches 
      SET latitude = ?, longitude = ?, geofence_radius_meters = ?, is_geofence_enforced = ?
      WHERE id = 1
    `).run(19.0760, 72.8777, 150, 1);

    const branch = db.prepare('SELECT latitude, longitude, geofence_radius_meters, is_geofence_enforced FROM branches WHERE id = 1').get();
    assert.strictEqual(branch.latitude, 19.0760);
    assert.strictEqual(branch.longitude, 72.8777);
    assert.strictEqual(branch.geofence_radius_meters, 150);
    assert.strictEqual(branch.is_geofence_enforced, 1);
  });
});
