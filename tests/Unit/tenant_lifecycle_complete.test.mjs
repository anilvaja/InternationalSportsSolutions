import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { calculateHaversineDistance, processStaffPunch, getStaffPunchStatus } from '../../src/services/geofenceService.js';
import { InquiryService } from '../../src/services/inquiryService.js';

describe('Complete End-to-End Tenant Lifecycle & Feature Verification', () => {
  let centralDb;
  let tenantDb;

  before(() => {
    // 1. Mock Central Database in memory
    centralDb = new Database(':memory:');
    centralDb.exec(`
      CREATE TABLE super_admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password_hash TEXT
      );
      CREATE TABLE academies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        slug TEXT UNIQUE,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE academy_users_lookup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        academy_id INTEGER,
        role TEXT,
        FOREIGN KEY (academy_id) REFERENCES academies(id)
      );
    `);

    // 2. Mock Isolated Tenant Database in memory
    tenantDb = new Database(':memory:');
    tenantDb.exec(`
      CREATE TABLE tenant_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        role TEXT,
        is_active INTEGER DEFAULT 1
      );
      CREATE TABLE branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        code TEXT,
        city TEXT,
        address TEXT,
        latitude REAL,
        longitude REAL,
        geofence_radius_meters INTEGER DEFAULT 100,
        is_geofence_enforced INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1
      );
      CREATE TABLE sports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        is_active INTEGER DEFAULT 1
      );
      CREATE TABLE coaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        phone TEXT,
        branch_id INTEGER,
        sport_id INTEGER,
        is_active INTEGER DEFAULT 1
      );
      CREATE TABLE batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        sport_id INTEGER,
        branch_id INTEGER,
        coach_id INTEGER,
        start_time TEXT,
        end_time TEXT,
        days_of_week TEXT,
        monthly_fee REAL DEFAULT 2000,
        max_capacity INTEGER DEFAULT 25,
        is_active INTEGER DEFAULT 1
      );
      CREATE TABLE students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_code TEXT UNIQUE,
        admission_number TEXT,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        date_of_birth TEXT,
        gender TEXT,
        blood_group TEXT,
        nationality TEXT DEFAULT 'Indian',
        preferred_language TEXT DEFAULT 'English',
        guardian_name TEXT,
        guardian_phone TEXT,
        guardian_email TEXT,
        primary_guardian_relation TEXT,
        father_name TEXT,
        father_phone TEXT,
        mother_name TEXT,
        mother_phone TEXT,
        alternate_emergency_contact TEXT,
        authorized_pickup_persons TEXT,
        parent_portal_enabled INTEGER DEFAULT 0,
        address TEXT,
        permanent_address TEXT,
        city TEXT,
        state TEXT,
        postal_code TEXT,
        country TEXT DEFAULT 'India',
        same_as_current_address INTEGER DEFAULT 1,
        school_college_name TEXT,
        grade_standard TEXT,
        education_board TEXT,
        academic_year TEXT,
        occupation TEXT,
        allergies TEXT,
        emergency_medical_instructions TEXT,
        injury_history TEXT,
        doctor_clinic_contact TEXT,
        medical_consent INTEGER DEFAULT 0,
        branch_id INTEGER,
        previous_sports_experience TEXT,
        previous_academy TEXT,
        goals_notes TEXT,
        photo_video_permission INTEGER DEFAULT 1,
        competition_consent INTEGER DEFAULT 1,
        joining_fee_amount REAL DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        discount_reason TEXT,
        discount_approved_by INTEGER,
        discount_approved_at TEXT,
        status TEXT DEFAULT 'active',
        enrolled_at TEXT,
        academy_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE student_guardians (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        name TEXT,
        relationship TEXT,
        phone TEXT,
        is_primary INTEGER DEFAULT 0
      );
      CREATE TABLE inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        academy_id INTEGER,
        student_name TEXT,
        guardian_name TEXT,
        guardian_relation TEXT,
        phone TEXT,
        email TEXT,
        date_of_birth TEXT,
        gender TEXT,
        sport_id INTEGER,
        branch_id INTEGER,
        preferred_batch_id INTEGER,
        assigned_to_user_id INTEGER,
        status TEXT DEFAULT 'new',
        source TEXT,
        preferred_timing TEXT,
        notes TEXT,
        next_followup_date TEXT,
        lost_reason TEXT,
        converted_student_id INTEGER,
        converted_at TEXT,
        created_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE admission_checklists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        academy_id INTEGER,
        student_id INTEGER,
        item_key TEXT,
        item_name TEXT,
        item_title TEXT,
        is_mandatory INTEGER DEFAULT 0,
        is_completed INTEGER DEFAULT 0,
        notes TEXT,
        verified_by_user_id INTEGER,
        verified_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE student_fees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        invoice_number TEXT,
        title TEXT,
        due_date TEXT,
        amount REAL,
        discount_amount REAL DEFAULT 0,
        net_amount REAL,
        paid_amount REAL DEFAULT 0,
        balance_amount REAL,
        status TEXT DEFAULT 'pending',
        period_start TEXT,
        period_end TEXT,
        months_count INTEGER DEFAULT 1,
        base_fee REAL,
        discount_percentage REAL DEFAULT 0,
        discount_type TEXT,
        discount_reason TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE fee_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_fee_id INTEGER,
        student_id INTEGER,
        receipt_number TEXT,
        payment_date TEXT,
        amount REAL,
        payment_mode TEXT,
        notes TEXT,
        collected_by INTEGER,
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE student_fee_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        student_fee_id INTEGER,
        fee_payment_id INTEGER,
        entry_type TEXT,
        charge_type TEXT,
        period_start TEXT,
        period_end TEXT,
        months_count INTEGER,
        debit REAL,
        credit REAL,
        running_balance REAL,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE student_batch_enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        batch_id INTEGER,
        start_date TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'active',
        transfer_reason TEXT,
        assigned_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE user_branch_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        branch_id INTEGER
      );
      CREATE TABLE staff_punches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        branch_id INTEGER,
        punch_type TEXT,
        punched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        latitude REAL,
        longitude REAL,
        accuracy_meters REAL,
        distance_meters REAL,
        is_within_geofence INTEGER,
        device_info TEXT,
        ip_address TEXT
      );
      CREATE TABLE staff_time_punches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        punch_date TEXT,
        punch_in_time TEXT,
        punch_out_time TEXT,
        duration_minutes INTEGER,
        status TEXT,
        punch_type TEXT,
        ip_address TEXT
      );
      CREATE TABLE equipment_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sport_id INTEGER,
        name TEXT
      );
      CREATE TABLE fee_structures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sport_id INTEGER,
        name TEXT
      );
    `);
  });

  after(() => {
    centralDb.close();
    tenantDb.close();
  });

  it('1. Central Tenant Creation: Registers new academy and creates admin lookup', () => {
    const aca = centralDb.prepare("INSERT INTO academies (name, slug) VALUES ('Apex Martial Arts Academy', 'apex')").run();
    const academyId = aca.lastInsertRowid;
    assert.strictEqual(academyId, 1);

    centralDb.prepare("INSERT INTO academy_users_lookup (email, academy_id, role) VALUES ('admin@apex.com', ?, 'academy_admin')").run(academyId);
    const lookup = centralDb.prepare('SELECT * FROM academy_users_lookup WHERE email = ?').get('admin@apex.com');
    assert.strictEqual(lookup.academy_id, 1);
    assert.strictEqual(lookup.role, 'academy_admin');

    // Tenant DB settings initialized
    tenantDb.prepare("INSERT INTO tenant_settings (key, value) VALUES ('academy_name', 'Apex Martial Arts Academy')").run();
    tenantDb.prepare("INSERT INTO tenant_settings (key, value) VALUES ('academy_code', 'APEX')").run();
    tenantDb.prepare("INSERT INTO users (name, email, role) VALUES ('Apex Admin', 'admin@apex.com', 'academy_admin')").run();
  });

  it('2. Branch & Geofence Provisioning: Configures training dojo with GPS coordinates', () => {
    // Marine Drive Dojo: Lat 18.9438, Lon 72.8232, Radius 150m, Enforced = 1
    const res = tenantDb.prepare(`
      INSERT INTO branches (name, code, city, latitude, longitude, geofence_radius_meters, is_geofence_enforced)
      VALUES ('Marine Drive Dojo', 'MDD', 'Mumbai', 18.9438, 72.8232, 150, 1)
    `).run();
    const branchId = res.lastInsertRowid;
    assert.strictEqual(branchId, 1);

    const branch = tenantDb.prepare('SELECT * FROM branches WHERE id = ?').get(branchId);
    assert.strictEqual(branch.name, 'Marine Drive Dojo');
    assert.strictEqual(branch.code, 'MDD');
    assert.strictEqual(branch.geofence_radius_meters, 150);
  });

  it('3. Coach & User Branch Assignment: Associates staff with branch', () => {
    const coachRes = tenantDb.prepare("INSERT INTO users (name, email, role) VALUES ('Sensei Kenji', 'kenji@apex.com', 'coach')").run();
    const coachUserId = coachRes.lastInsertRowid;

    tenantDb.prepare("INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?, 1)").run(coachUserId);
    const assignment = tenantDb.prepare('SELECT * FROM user_branch_assignments WHERE user_id = ?').get(coachUserId);
    assert.strictEqual(assignment.branch_id, 1);
  });

  it('4. GPS Punch-In: Successfully records duty when within geofence perimeter', () => {
    const user = { id: 2, email: 'kenji@apex.com', role: 'coach' };
    // Device located 30 meters from branch center
    const payload = {
      punch_type: 'punch_in',
      latitude: 18.9440,
      longitude: 72.8232,
      accuracy: 6.5,
    };

    const res = processStaffPunch(tenantDb, user, payload, '192.168.1.100', 'Mobile Safari');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.is_within_geofence, true);
    assert.ok(res.distance_meters <= 150, `Distance ${res.distance_meters} should be <= 150m`);

    const status = getStaffPunchStatus(tenantDb, user);
    assert.strictEqual(status.isPunchedIn, true);
    assert.strictEqual(status.lastPunch.punch_type, 'punch_in');
  });

  it('5. GPS Out-of-Range Punch-In: Strictly blocked with 403 Forbidden', () => {
    const user = { id: 2, email: 'kenji@apex.com', role: 'coach' };
    // Device located 15 kilometers away
    const payload = {
      punch_type: 'punch_in',
      latitude: 19.0760,
      longitude: 72.8777,
      accuracy: 10.0,
    };

    assert.throws(() => {
      processStaffPunch(tenantDb, user, payload, '192.168.1.100', 'Mobile Safari');
    }, (err) => {
      return err.status === 403 && err.message.includes('Out of range: you are');
    });
  });

  it('6. GPS Out-of-Range Punch-Out: Allowed with warning note for admin audit review', () => {
    const user = { id: 2, email: 'kenji@apex.com', role: 'coach' };
    // Staff left dojo and punches out from 15 km away
    const payload = {
      punch_type: 'punch_out',
      latitude: 19.0760,
      longitude: 72.8777,
      accuracy: 8.0,
    };

    const res = processStaffPunch(tenantDb, user, payload, '192.168.1.100', 'Mobile Safari');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.is_within_geofence, false);
    assert.strictEqual(res.out_of_range_flag, true);
    assert.ok(res.warning.includes('Marked for admin review'));

    // Verify shift is completed in shift log
    const status = getStaffPunchStatus(tenantDb, user);
    assert.strictEqual(status.isPunchedIn, false);
  });

  it('7. Hierarchical Student Code: Generates [Academy]-[Branch]-[Year]-[Sequence]', () => {
    const studentCode1 = InquiryService.generateStudentCode(tenantDb, 1);
    const yr = String(new Date().getFullYear()).slice(-2);
    assert.strictEqual(studentCode1, `APEX-MDD-${yr}-0001`);

    tenantDb.prepare(`
      INSERT INTO students (student_code, first_name, last_name, phone, branch_id)
      VALUES (?, 'Rohan', 'Sharma', '9898098980', 1)
    `).run(studentCode1);

    const studentCode2 = InquiryService.generateStudentCode(tenantDb, 1);
    assert.strictEqual(studentCode2, `APEX-MDD-${yr}-0002`);
  });

  it('8. Multiselect Bulk Operations: Deactivates and safely deletes records', () => {
    // Create sports
    const s1 = tenantDb.prepare("INSERT INTO sports (name, is_active) VALUES ('Karate', 1)").run().lastInsertRowid;
    const s2 = tenantDb.prepare("INSERT INTO sports (name, is_active) VALUES ('Judo', 1)").run().lastInsertRowid;
    const s3 = tenantDb.prepare("INSERT INTO sports (name, is_active) VALUES ('Taekwondo', 1)").run().lastInsertRowid;

    // Link s1 to a batch
    tenantDb.prepare("INSERT INTO batches (name, sport_id, branch_id) VALUES ('Morning Kata', ?, 1)").run(s1);

    // Bulk Deactivate s2 and s3
    tenantDb.prepare(`UPDATE sports SET is_active = 0 WHERE id IN (${s2}, ${s3})`).run();
    assert.strictEqual(tenantDb.prepare('SELECT is_active FROM sports WHERE id = ?').get(s2).is_active, 0);
    assert.strictEqual(tenantDb.prepare('SELECT is_active FROM sports WHERE id = ?').get(s3).is_active, 0);

    // Bulk Delete s1 and s3: s1 should be preserved as inactive, s3 should be deleted
    const sportIds = [s1, s3];
    for (const id of sportIds) {
      const batchCount = tenantDb.prepare('SELECT COUNT(*) as c FROM batches WHERE sport_id = ?').get(id)?.c || 0;
      if (batchCount > 0) {
        tenantDb.prepare('UPDATE sports SET is_active = 0 WHERE id = ?').run(id);
      } else {
        tenantDb.prepare('DELETE FROM sports WHERE id = ?').run(id);
      }
    }

    assert.strictEqual(tenantDb.prepare('SELECT is_active FROM sports WHERE id = ?').get(s1).is_active, 0);
    assert.strictEqual(tenantDb.prepare('SELECT id FROM sports WHERE id = ?').get(s3), undefined);
  });

  it('9. Inquiry to Admission Without Batch: Enrolls student cleanly, leaves batch optional, allows assign & unassign', () => {
    // Create an inquiry
    const inq = InquiryService.createInquiry(tenantDb, 1, {
      student_name: 'Devan Patel',
      guardian_name: 'Manoj Patel',
      phone: '9820198201',
      email: 'devan@example.com',
      date_of_birth: '2012-05-15',
      gender: 'male',
      branch_id: 1,
    });
    assert.ok(inq.id);
    assert.strictEqual(inq.date_of_birth, '2012-05-15');

    // Create admission from inquiry WITHOUT any batch (batch_id: null)
    const admResult = InquiryService.createAdmission(tenantDb, 1, {
      inquiry_id: inq.id,
      first_name: 'Devan',
      last_name: 'Patel',
      admission_number: 'ADM-PATEL-01',
      date_of_birth: '2012-05-15',
      phone: '9820198201',
      branch_id: 1,
      batch_id: null, // OPTIONAL!
      admission_fee: 500,
      initial_payment_amount: 500,
      payment_method: 'upi',
    }, { userId: 1, isSuperAdmin: true });

    assert.strictEqual(admResult.success, true);
    assert.strictEqual(admResult.student.first_name, 'Devan');
    assert.strictEqual(admResult.student.admission_number, 'ADM-PATEL-01');
    assert.strictEqual(admResult.enrollment, null); // No batch enrollment created

    // Verify inquiry is converted
    const updatedInq = tenantDb.prepare('SELECT status, converted_student_id FROM inquiries WHERE id = ?').get(inq.id);
    assert.strictEqual(updatedInq.status, 'converted');
    assert.strictEqual(updatedInq.converted_student_id, admResult.student.id);

    // Verify admission checklist: batch assignment is NOT mandatory
    const batchChk = tenantDb.prepare("SELECT * FROM admission_checklists WHERE student_id = ? AND item_key = 'batch_assignment'").get(admResult.student.id);
    assert.ok(batchChk);
    assert.strictEqual(batchChk.is_mandatory, 0);
    assert.strictEqual(batchChk.is_completed, 0);

    // Now assign batch later (e.g. batch created earlier in test 8)
    const batch = tenantDb.prepare('SELECT id, name FROM batches LIMIT 1').get();
    tenantDb.prepare(`
      INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status)
      VALUES (?, ?, '2026-10-19', 'active')
    `).run(admResult.student.id, batch.id);

    const activeEnrollment = tenantDb.prepare("SELECT * FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'").get(admResult.student.id);
    assert.ok(activeEnrollment);
    assert.strictEqual(activeEnrollment.batch_id, batch.id);

    // Now unassign student from batch back to unassigned pool
    tenantDb.prepare(`
      UPDATE student_batch_enrollments
      SET status = 'completed', end_date = '2026-10-20', transfer_reason = 'Unassigned by admin'
      WHERE id = ?
    `).run(activeEnrollment.id);

    const postUnassign = tenantDb.prepare("SELECT * FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'").get(admResult.student.id);
    assert.strictEqual(postUnassign, undefined); // Successfully unassigned!
  });
});

