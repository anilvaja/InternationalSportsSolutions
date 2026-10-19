import bcrypt from 'bcryptjs';
import { getCentralDb } from './centralDb.js';
import { provisionAcademyDb, getTenantDbById } from './connectionManager.js';

export function runSeed() {
  console.log('--- Starting Multi-Database Seed ---');
  const centralDb = getCentralDb();

  // 1. Seed Super Admin
  const defaultPasswordHash = bcrypt.hashSync('password', 10);
  const mahavirPasswordHash = bcrypt.hashSync('password123', 10);

  const existingSuperAdmin = centralDb.prepare('SELECT id FROM super_admins WHERE email = ?').get('anilvaja.007@gmail.com');
  if (!existingSuperAdmin) {
    centralDb.prepare(`
      INSERT INTO super_admins (name, email, password_hash, status)
      VALUES (?, ?, ?, 'active')
    `).run('Anil Vaja', 'anilvaja.007@gmail.com', defaultPasswordHash);
    console.log('[Seed] Created Super Admin: anilvaja.007@gmail.com');
  }

  // 2. Central Settings
  const insertSetting = centralDb.prepare('INSERT OR REPLACE INTO central_settings (key, value) VALUES (?, ?)');
  insertSetting.run('platform_name', 'International Sports Solutions');
  insertSetting.run('currency_symbol', '₹');
  insertSetting.run('currency_code', 'INR');
  insertSetting.run('support_email', 'support@internationalsportssolutions.com');
  insertSetting.run('enable_registrations', 'true');

  // 2.1. Seed Reusable Subscription Plans (Illustrative Standard plan per specification)
  const existingStandard = centralDb.prepare("SELECT id FROM subscription_plans WHERE slug = 'standard'").get();
  if (!existingStandard) {
    const plansToSeed = [
      {
        name: 'Basic',
        slug: 'basic',
        description: 'Starter tier for single-branch sports clubs',
        price: 999,
        billing_interval: 'monthly',
        trial_days: 14,
        status: 'active',
        limits: { users: 5, branches: 1, batches: 5, students: 50, students_per_batch: 20, coaches: 2 },
      },
      {
        name: 'Standard',
        slug: 'standard',
        description: 'Illustrative standard plan for growing sports academies (development specification)',
        price: 2499,
        billing_interval: 'monthly',
        trial_days: 14,
        status: 'draft', // Draft per prompt: Illustrative development specification only
        limits: { users: 10, branches: 2, batches: 10, students: 200, students_per_batch: 30, coaches: 5 },
      },
      {
        name: 'Premium',
        slug: 'premium',
        description: 'Comprehensive tier for large multi-branch sports academies',
        price: 4999,
        billing_interval: 'monthly',
        trial_days: 30,
        status: 'active',
        limits: { users: 50, branches: 10, batches: 50, students: 1000, students_per_batch: 40, coaches: 25 },
      },
    ];

    for (const p of plansToSeed) {
      const ins = centralDb.prepare(`
        INSERT INTO subscription_plans (name, slug, description, price, billing_interval, trial_days, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(p.name, p.slug, p.description, p.price, p.billing_interval, p.trial_days, p.status);
      const planId = Number(ins.lastInsertRowid);

      for (const [qKey, qVal] of Object.entries(p.limits)) {
        centralDb.prepare(`
          INSERT INTO subscription_plan_limits (plan_id, quota_key, limit_value, counting_policy)
          VALUES (?, ?, ?, 'active_only')
        `).run(planId, qKey, qVal);
      }

      // Feature entitlements
      for (const feat of ['events', 'payroll', 'syllabus', 'facilities']) {
        centralDb.prepare(`
          INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled)
          VALUES (?, ?, 1)
        `).run(planId, feat);
      }
    }
    console.log('[Seed] Seeded subscription plans: Basic, Standard (Draft), Premium');
  }

  // 3. Academies to provision
  const academiesToSeed = [
    {
      name: 'Mahavir Sports Academy',
      slug: 'mahaviracademy',
      contact_email: 'info@mahavirsportsacademy.com',
      contact_phone: '+91 98250 12345',
      address: 'University Road, Near Sports Complex',
      city: 'Ahmedabad',
      plan: 'enterprise',
      max_branches: 10,
      max_students: 1500,
      max_coaches: 80,
      admin_name: 'John Smith',
      admin_email: 'john.smith@mahavirsportsacademy.com',
      admin_password: 'password123',
    },
    {
      name: 'Sardar Martial Arts Academy',
      slug: 'sardarmartialarts',
      contact_email: 'admin@sardar-martial-arts.com',
      contact_phone: '+91 98251 23456',
      address: 'Ring Road, Sector 5',
      city: 'Surat',
      plan: 'professional',
      admin_name: 'Sardar Martial Arts Admin',
      admin_email: 'admin@sardar-martial-arts.com',
      admin_password: 'password',
    },
    {
      name: 'Lions Basketball Academy',
      slug: 'lionsbasketball',
      contact_email: 'admin@lions-basketball.com',
      contact_phone: '+91 98252 34567',
      address: 'Indira Bridge Circle',
      city: 'Gandhinagar',
      plan: 'professional',
      admin_name: 'Lions Basketball Admin',
      admin_email: 'admin@lions-basketball.com',
      admin_password: 'password',
    },
    {
      name: 'Gujarat Swimming Club',
      slug: 'gujaratswimming',
      contact_email: 'admin@gujarat-swimming.com',
      contact_phone: '+91 98253 45678',
      address: 'Club Road, Navrangpura',
      city: 'Ahmedabad',
      plan: 'professional',
      admin_name: 'Gujarat Swimming Admin',
      admin_email: 'admin@gujarat-swimming.com',
      admin_password: 'password',
    },
    {
      name: 'Rajkot Tennis Academy',
      slug: 'rajkottennis',
      contact_email: 'admin@rajkot-tennis.com',
      contact_phone: '+91 98254 56789',
      address: 'Kalawad Road',
      city: 'Rajkot',
      plan: 'starter',
      admin_name: 'Rajkot Tennis Admin',
      admin_email: 'admin@rajkot-tennis.com',
      admin_password: 'password',
    },
    {
      name: 'Diamond Cricket Academy',
      slug: 'diamondcricket',
      contact_email: 'admin@diamond-cricket.com',
      contact_phone: '+91 98255 67890',
      address: 'Varachha Main Road',
      city: 'Surat',
      plan: 'professional',
      admin_name: 'Diamond Cricket Admin',
      admin_email: 'admin@diamond-cricket.com',
      admin_password: 'password',
    },
    {
      name: 'Kutch Football Academy',
      slug: 'kutchfootball',
      contact_email: 'admin@kutch-football.com',
      contact_phone: '+91 98256 78901',
      address: 'Station Road',
      city: 'Bhuj',
      plan: 'starter',
      admin_name: 'Kutch Football Admin',
      admin_email: 'admin@kutch-football.com',
      admin_password: 'password',
    },
  ];

  for (const acData of academiesToSeed) {
    const existing = centralDb.prepare('SELECT id FROM academies WHERE slug = ?').get(acData.slug);
    if (!existing) {
      console.log(`[Seed] Provisioning academy database for: ${acData.name} (${acData.slug})`);
      const { id } = provisionAcademyDb(acData);
      
      // If Mahavir Sports Academy, populate rich data
      if (acData.slug === 'mahaviracademy' || acData.slug === 'mahavir-sports') {
        seedMahavirAcademyData(id, mahavirPasswordHash);
      }
    }
  }

  // Ensure Mahavir rich operational data is seeded
  const mahavirAc = centralDb.prepare("SELECT id FROM academies WHERE slug IN ('mahaviracademy', 'mahavir-sports')").get();
  if (mahavirAc) {
    const mDb = getTenantDbById(mahavirAc.id);
    const studentCount = mDb.prepare('SELECT COUNT(*) as c FROM students').get().c;
    if (studentCount === 0) {
      seedMahavirAcademyData(mahavirAc.id, mahavirPasswordHash);
    }
    const profileCount = mDb.prepare('SELECT COUNT(*) as c FROM staff_salary_profiles').get().c;
    if (profileCount === 0) {
      seedMahavirSalaryAndSessions(mDb, mahavirAc.id);
    }
  }

  // 4. Seed Default Domains & Subdomains for all Academies
  try {
    const allAcademies = centralDb.prepare('SELECT id, slug, name FROM academies').all();
    const insertDomain = centralDb.prepare(`
      INSERT OR IGNORE INTO domains (academy_id, domain, is_primary, is_custom, status)
      VALUES (?, ?, ?, ?, 'active')
    `);

    for (const ac of allAcademies) {
      // Primary platform subdomain
      insertDomain.run(ac.id, `${ac.slug}.internationalsportssolutions.test`, 1, 0);
      // Local development subdomain
      insertDomain.run(ac.id, `${ac.slug}.localhost`, 0, 0);
    }

    // Custom domain & alias for Mahavir Sports Academy
    const mahavir = centralDb.prepare("SELECT id FROM academies WHERE slug IN ('mahaviracademy', 'mahavir-sports')").get();
    if (mahavir) {
      insertDomain.run(mahavir.id, 'mahavirsports.com', 0, 1);
      insertDomain.run(mahavir.id, 'mahavir-sports.internationalsportssolutions.test', 0, 0);
    }
    console.log('[Seed] Multi-tenant domains registered successfully');
  } catch (err) {
    console.warn('[Seed] Warning seeding domains:', err.message);
  }

  console.log('--- Database Seed Finished Successfully ---');
}

/**
 * Seeds rich operational data into Mahavir Sports Academy's dedicated database
 */
function seedMahavirAcademyData(academyId, passwordHash) {
  const db = getTenantDbById(academyId);

  // 1. Additional Staff
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (name, email, password_hash, role, phone, status) VALUES (?, ?, ?, ?, ?, ?)');
  insertUser.run('Sarah Johnson', 'sarah.johnson@mahavirsportsacademy.com', passwordHash, 'academy_staff', '+91 98250 55555', 'active');
  insertUser.run('Arun Verma', 'arun.verma@mahavirsportsacademy.com', passwordHash, 'coach', '+91 98250 44444', 'active');

  // Register Sarah and Arun in Central lookup
  const centralDb = getCentralDb();
  centralDb.prepare('INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role) VALUES (?, ?, ?)').run('sarah.johnson@mahavirsportsacademy.com', academyId, 'academy_staff');
  centralDb.prepare('INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role) VALUES (?, ?, ?)').run('arun.verma@mahavirsportsacademy.com', academyId, 'coach');

  // 2. Branches
  const insertBranch = db.prepare('INSERT INTO branches (name, address, city, phone, email) VALUES (?, ?, ?, ?, ?)');
  const b1 = insertBranch.run('Main Campus - West Wing', '101 Stadium Complex, Drive-in Road', 'Ahmedabad', '+91 79 2685 0001', 'west@mahavirsports.com').lastInsertRowid;
  const b2 = insertBranch.run('East City Center', 'Sports Enclave, Nikol Road', 'Ahmedabad', '+91 79 2685 0002', 'east@mahavirsports.com').lastInsertRowid;

  // 3. Sports (Dynamically manageable, Karate is initial primary sport for InternationalSportsSolutions)
  const getOrInsertSport = (name, description) => {
    const existing = db.prepare('SELECT id FROM sports WHERE LOWER(name) = LOWER(?)').get(name);
    if (existing) return existing.id;
    return db.prepare('INSERT INTO sports (name, description, is_active) VALUES (?, ?, 1)').run(name, description).lastInsertRowid;
  };

  const sKarate = getOrInsertSport('Karate', 'Traditional Shotokan Karate, Kata, Kumite & Belt Progression');
  const sFootball = getOrInsertSport('Football', 'Professional grass turf and youth football coaching');
  const sCricket = getOrInsertSport('Cricket', 'BCCI standard turf pitches, net facilities and video analysis');
  const sSwimming = getOrInsertSport('Swimming', 'Semi-Olympic temperature controlled pool and certified trainers');
  const sTennis = getOrInsertSport('Tennis', 'Synthetic hard courts and clay court facilities');

  // 4. Coaches
  const insertCoach = db.prepare('INSERT INTO coaches (name, email, phone, sport_id, branch_id, specializations, experience_years, salary_type, salary_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const cKarate = insertCoach.run('Sensei Arun Verma', 'arun.verma@mahavirsportsacademy.com', '+91 98250 44444', sKarate, b1, '4th Dan Black Belt, WKF Certified, Kata & Kumite Specialist', 10, 'monthly', 50000).lastInsertRowid;
  const c1 = insertCoach.run('Rajesh Kumar', 'rajesh.football@mahavir.com', '+91 98250 11111', sFootball, b1, 'AFC B-License, Tactical Training', 8, 'monthly', 45000).lastInsertRowid;
  const c2 = insertCoach.run('Vikram Mehta', 'vikram.cricket@mahavir.com', '+91 98250 22222', sCricket, b1, 'Level 2 Certified, Pace Bowling & Fielding', 12, 'monthly', 55000).lastInsertRowid;
  const c3 = insertCoach.run('Priya Patel', 'priya.swimming@mahavir.com', '+91 98250 33333', sSwimming, b2, 'FINA Level 1, Stroke Technique & Stamina', 6, 'monthly', 40000).lastInsertRowid;

  // 5. Batches
  const insertBatch = db.prepare('INSERT INTO batches (name, sport_id, branch_id, coach_id, start_time, end_time, days_of_week, max_capacity, monthly_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const batchKarate = insertBatch.run('Karate Cadets & Kumite (Shotokan)', sKarate, b1, cKarate, '17:00', '18:30', '["Mon","Wed","Fri"]', 25, 3000).lastInsertRowid;
  const batch1 = insertBatch.run('Morning Football Elite (U-16)', sFootball, b1, c1, '06:30', '08:00', '["Mon","Wed","Fri"]', 25, 2500).lastInsertRowid;
  const batch2 = insertBatch.run('Cricket Champions Batch', sCricket, b1, c2, '07:00', '08:30', '["Tue","Thu","Sat"]', 20, 3500).lastInsertRowid;
  const batch3 = insertBatch.run('Swimming Squad - Evening', sSwimming, b2, c3, '17:30', '18:45', '["Mon","Tue","Wed","Thu","Fri"]', 15, 3000).lastInsertRowid;

  // 6. Fee Structures
  const insertFeeStructure = db.prepare('INSERT INTO fee_structures (name, sport_id, amount, billing_frequency, description) VALUES (?, ?, ?, ?, ?)');
  const fsKarate = insertFeeStructure.run('Monthly Karate Training & Belt Progression', sKarate, 3000, 'monthly', 'Kata, Kumite, and regular belt evaluation sessions').lastInsertRowid;
  const fs1 = insertFeeStructure.run('Monthly Football Coaching', sFootball, 2500, 'monthly', 'Standard weekday morning training').lastInsertRowid;
  const fs2 = insertFeeStructure.run('Quarterly Cricket Coaching', sCricket, 9500, 'quarterly', 'Weekend and weekday academy sessions with match practice').lastInsertRowid;
  const fs3 = insertFeeStructure.run('Monthly Swimming Pass', sSwimming, 3000, 'monthly', 'Daily pool access with coach supervision').lastInsertRowid;

  // 7. Students & Batches
  const insertStudent = db.prepare(`
    INSERT INTO students (
      student_code, first_name, last_name, email, password_hash, phone, date_of_birth,
      gender, guardian_name, guardian_phone, guardian_email, address, branch_id, blood_group, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);
  const enrollBatch = db.prepare(`
    INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status, assigned_by)
    VALUES (?, ?, DATE('now', '-30 days'), 'active', 1)
  `);

  const studentData = [
    { code: 'STU-1001', fn: 'Aarav', ln: 'Patel', email: 'aarav.patel@student.com', dob: '2010-04-12', g: 'male', guardian: 'Ramesh Patel', phone: '+91 98980 11111', blood: 'B+', batch: batch1, fs: fs1 },
    { code: 'STU-1002', fn: 'Diya', ln: 'Shah', email: 'diya.shah@student.com', dob: '2011-09-21', g: 'female', guardian: 'Mukesh Shah', phone: '+91 98980 22222', blood: 'O+', batch: batch1, fs: fs1 },
    { code: 'STU-1003', fn: 'Vivaan', ln: 'Desai', email: 'vivaan.desai@student.com', dob: '2009-12-05', g: 'male', guardian: 'Hiren Desai', phone: '+91 98980 33333', blood: 'A+', batch: batch2, fs: fs2 },
    { code: 'STU-1004', fn: 'Ananya', ln: 'Joshi', email: 'ananya.joshi@student.com', dob: '2012-03-18', g: 'female', guardian: 'Kamlesh Joshi', phone: '+91 98980 44444', blood: 'AB+', batch: batch3, fs: fs3 },
    { code: 'STU-1005', fn: 'Kabir', ln: 'Mehta', email: 'kabir.mehta@student.com', dob: '2010-08-14', g: 'male', guardian: 'Sanjay Mehta', phone: '+91 98980 55555', blood: 'B-', batch: batch2, fs: fs2 },
    { code: 'STU-1006', fn: 'Ishaan', ln: 'Trivedi', email: 'ishaan.trivedi@student.com', dob: '2011-01-30', g: 'male', guardian: 'Nirav Trivedi', phone: '+91 98980 66666', blood: 'O-', batch: batch3, fs: fs3 },
  ];

  const insertStudentFee = db.prepare(`
    INSERT INTO student_fees (
      student_id, fee_structure_id, invoice_number, title, due_date,
      amount, discount_amount, tax_amount, net_amount, paid_amount, balance_amount, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO fee_payments (
      student_fee_id, receipt_number, payment_date, amount, payment_mode, transaction_reference, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  studentData.forEach((s, idx) => {
    const studentId = insertStudent.run(
      s.code, s.fn, s.ln, s.email, passwordHash, s.phone, s.dob,
      s.g, s.guardian, s.phone, `parent.${s.email}`, 'Ahmedabad, Gujarat', b1, s.blood
    ).lastInsertRowid;

    // Enroll in EXACTLY ONE active batch
    enrollBatch.run(studentId, s.batch);

    // If Student 1 (Aarav Patel), seed historical transfer record to demonstrate audit preservation
    if (idx === 0) {
      db.prepare(`
        INSERT INTO student_batch_enrollments (
          student_id, batch_id, start_date, end_date, status, assigned_by,
          transferred_to_batch_id, transfer_reason
        ) VALUES (?, ?, DATE('now', '-90 days'), DATE('now', '-30 days'), 'transferred', 1, ?, 'Promoted to Elite Squad after mid-season performance review')
      `).run(studentId, batch2, batch1);
    }

    // Register student in central lookup for student portal login
    centralDb.prepare('INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role) VALUES (?, ?, ?)').run(s.email, academyId, 'student');

    // Create fee invoice
    const invNum = `INV-2026-${1000 + idx}`;
    const feeAmt = s.fs === fs2 ? 9500 : (s.fs === fs3 ? 3000 : 2500);

    if (idx === 0) {
      // Fully paid
      const feeId = insertStudentFee.run(studentId, s.fs, invNum, 'Term 1 Coaching Fees', '2026-10-10', feeAmt, 0, 0, feeAmt, feeAmt, 0, 'paid').lastInsertRowid;
      insertPayment.run(feeId, `REC-2026-${500 + idx}`, '2026-10-05', feeAmt, 'upi', 'UPI/20261005/982187', 'Online UPI Payment');
    } else if (idx === 1) {
      // Partial payment
      const feeId = insertStudentFee.run(studentId, s.fs, invNum, 'Term 1 Coaching Fees', '2026-10-15', feeAmt, 0, 0, feeAmt, 1000, feeAmt - 1000, 'partial').lastInsertRowid;
      insertPayment.run(feeId, `REC-2026-${500 + idx}`, '2026-10-12', 1000, 'cash', 'CASH/0921', 'Cash advance');
    } else if (idx === 2) {
      // Overdue
      insertStudentFee.run(studentId, s.fs, invNum, 'Term 1 Coaching Fees', '2026-09-30', feeAmt, 0, 0, feeAmt, 0, feeAmt, 'overdue');
    } else {
      // Pending
      insertStudentFee.run(studentId, s.fs, invNum, 'Term 1 Coaching Fees', '2026-10-30', feeAmt, 0, 0, feeAmt, 0, feeAmt, 'pending');
    }
  });

  // 8. Attendance Records
  const insertAttendance = db.prepare('INSERT INTO attendance (batch_id, date, notes) VALUES (?, ?, ?)');
  const insertStudentAttendance = db.prepare('INSERT INTO student_attendance (attendance_id, student_id, status, remarks) VALUES (?, ?, ?, ?)');

  const att1 = insertAttendance.run(batch1, '2026-10-12', 'Morning drill and passing practice').lastInsertRowid;
  insertStudentAttendance.run(att1, 1, 'present', 'On time');
  insertStudentAttendance.run(att1, 2, 'present', 'Excellent stamina');

  const att2 = insertAttendance.run(batch1, '2026-10-14', 'Tactical set piece drills').lastInsertRowid;
  insertStudentAttendance.run(att2, 1, 'present', 'Good performance');
  insertStudentAttendance.run(att2, 2, 'absent', 'Informed sick leave');

  // 9. Facilities & Inventory
  const insertFacility = db.prepare('INSERT INTO facilities (branch_id, name, type, capacity, is_available) VALUES (?, ?, ?, ?, ?)');
  insertFacility.run(b1, 'FIFA 2-Star Grass Turf A', 'field', 60, 1);
  insertFacility.run(b1, 'Cricket Practice Nets (4 Pitches)', 'field', 40, 1);
  insertFacility.run(b2, 'Semi-Olympic Swimming Pool (25m)', 'pool', 50, 1);
  insertFacility.run(b1, 'Fitness & Strength Gym', 'gym', 30, 1);

  const insertEquip = db.prepare('INSERT INTO equipment_inventory (branch_id, sport_id, name, quantity, condition, location) VALUES (?, ?, ?, ?, ?, ?)');
  insertEquip.run(b1, sFootball, 'FIFA Match Footballs (Size 5)', 35, 'good', 'Locker Room 1');
  insertEquip.run(b1, sCricket, 'Leather Match Cricket Balls', 48, 'new', 'Pavilion Storage');
  insertEquip.run(b1, sFootball, 'Agility Ladders & Training Cones', 60, 'good', 'Ground Shed');
  insertEquip.run(b2, sSwimming, 'Swimming Kickboards & Pull Buoys', 25, 'good', 'Poolside Rack');

  // 10. Leave Requests
  const insertLeave = db.prepare('INSERT INTO leave_requests (applicant_type, applicant_id, applicant_name, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertLeave.run('coach', c1, 'Rajesh Kumar', '2026-10-25', '2026-10-27', 'Attending AIFF coaching refresher clinic', 'approved');
  insertLeave.run('student', 2, 'Diya Shah', '2026-10-14', '2026-10-14', 'Fever & medical rest', 'approved');
  insertLeave.run('student', 3, 'Vivaan Desai', '2026-11-01', '2026-11-04', 'School mid-term examinations', 'pending');

  // 11. Sports Syllabus & Learning Progression
  const insertCat = db.prepare('INSERT INTO syllabus_categories (academy_id, name, description, display_order, status) VALUES (?, ?, ?, ?, ?)');
  const catStances = insertCat.run(academyId, 'Basic Stances & Footwork', 'Foundational balance, posture and movement drills', 1, 'active').lastInsertRowid;
  const catPunches = insertCat.run(academyId, 'Punching & Striking', 'Direct thrusts, lunge strikes and palm techniques', 2, 'active').lastInsertRowid;
  const catKicks = insertCat.run(academyId, 'Kicking Techniques (Geri)', 'Snap, thrust and rotational kicking curriculum', 3, 'active').lastInsertRowid;
  const catKata = insertCat.run(academyId, 'Kata Forms (Heian Series)', 'Pre-arranged formal sequences testing timing and precision', 4, 'active').lastInsertRowid;
  const catKumite = insertCat.run(academyId, 'Kumite & Sparring Drills', 'Controlled partner combat and defensive counters', 5, 'active').lastInsertRowid;

  const insertTech = db.prepare(`
    INSERT INTO syllabus_techniques (
      academy_id, category_id, name, code, description, level, belt_level, media_url, display_order, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const t1 = insertTech.run(academyId, catStances, 'Zenkutsu-Dachi (Forward Stance)', 'STANCE-01', 'Low hips, 60% front leg weight distribution with locked rear ankle', 1, 'White Belt', 'https://youtu.be/example1', 1, 'active').lastInsertRowid;
  const t2 = insertTech.run(academyId, catPunches, 'Oi-Zuki (Lunge Punch)', 'PUNCH-01', 'Coordinated step-and-punch with explosive hip rotation and seiken fist alignment', 1, 'White Belt', 'https://youtu.be/example2', 2, 'active').lastInsertRowid;
  const t3 = insertTech.run(academyId, catKicks, 'Mae-Geri (Front Snap Kick)', 'KICK-01', 'High knee chamber with striking surface on the ball of the foot (Chusoku)', 2, 'Yellow Belt', 'https://youtu.be/example3', 3, 'active').lastInsertRowid;
  const t4 = insertTech.run(academyId, catKata, 'Heian Shodan (Form 1)', 'KATA-01', 'First formal pattern containing 21 movements focusing on basic blocks and lunges', 2, 'Yellow Belt', 'https://youtu.be/example4', 4, 'active').lastInsertRowid;
  const t5 = insertTech.run(academyId, catKicks, 'Mawashi-Geri (Roundhouse Kick)', 'KICK-02', 'Diagonal hip drive impacting with the instep or ball of foot', 3, 'Orange Belt', 'https://youtu.be/example5', 5, 'active').lastInsertRowid;
  const t6 = insertTech.run(academyId, catKata, 'Heian Nidan (Form 2)', 'KATA-02', 'Intermediate pattern introducing knife-hand blocks and high kicks', 3, 'Green Belt', 'https://youtu.be/example6', 6, 'active').lastInsertRowid;
  const t7 = insertTech.run(academyId, catKumite, 'Jiyu Ippon Kumite', 'SPAR-01', 'One-step semi-free sparring drills with predetermined attacks and counter-strikes', 4, 'Brown Belt', 'https://youtu.be/example7', 7, 'active').lastInsertRowid;

  // Student Technique Assignments & Historical Progression
  const assignTech = db.prepare(`
    INSERT INTO student_technique_assignments (
      academy_id, student_id, technique_id, assigned_by, start_date, end_date, status, sessions_attended, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Student 1 (Aarav Patel): Promoted from Oi-Zuki -> Heian Shodan
  assignTech.run(academyId, 1, t2, 1, '2026-07-01', '2026-08-31', 'completed', 16, 'Successfully cleared 9th Kyu Yellow Belt grading');
  assignTech.run(academyId, 1, t4, 1, '2026-09-01', null, 'active', 18, 'Active training for 8th Kyu examination');

  // Student 2 (Diya Shah): Active on Mae-Geri
  assignTech.run(academyId, 2, t3, 1, '2026-09-15', null, 'active', 12, 'Practicing high knee chamber and balance');

  // Student 3 (Vivaan Desai): Active on Forward Stance
  assignTech.run(academyId, 3, t1, 1, '2026-10-01', null, 'active', 8, 'Working on lower hip positioning');

  // Student 4 (Ananya Joshi): Active on Mawashi-Geri
  assignTech.run(academyId, 4, t5, 1, '2026-08-15', null, 'active', 28, 'Exceptional flexibility; preparing for Green Belt');

  // Historical Attendance Snapshots
  const insertSnap = db.prepare(`
    INSERT INTO attendance_technique_snapshots (
      attendance_id, student_id, technique_id, technique_level, progression_action, sessions_count_at_time, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertSnap.run(att1, 1, t4, 2, 'keep', 17, 'Great hip drive during Heian Shodan');
  insertSnap.run(att1, 2, t3, 2, 'keep', 11, 'Snap execution improved');
  insertSnap.run(att2, 1, t4, 2, 'keep', 18, 'Ready for mock test next week');

  // Update existing attendance records with technique metadata
  db.prepare('UPDATE student_attendance SET technique_id = ?, technique_level = 2, technique_status = ?, technique_remarks = ?, attended_sessions_snapshot = ? WHERE attendance_id = ? AND student_id = ?')
    .run(t4, 'keep', 'Great hip drive during Heian Shodan', 17, att1, 1);
  db.prepare('UPDATE student_attendance SET technique_id = ?, technique_level = 2, technique_status = ?, technique_remarks = ?, attended_sessions_snapshot = ? WHERE attendance_id = ? AND student_id = ?')
    .run(t3, 'keep', 'Snap execution improved', 11, att1, 2);
  db.prepare('UPDATE student_attendance SET technique_id = ?, technique_level = 2, technique_status = ?, technique_remarks = ?, attended_sessions_snapshot = ? WHERE attendance_id = ? AND student_id = ?')
    .run(t4, 'keep', 'Ready for mock test next week', 18, att2, 1);

  // 12. Seed Salary Profiles, Sessions, and Payroll
  seedMahavirSalaryAndSessions(db, academyId);

  console.log(`[Seed] Seeded operational data for Mahavir Sports Academy (ID: ${academyId})`);
}

/**
 * Seeds staff salary profiles, batch sessions, and payroll period for Mahavir Sports Academy
 */
export function seedMahavirSalaryAndSessions(db, academyId) {
  // Ensure staff and coach users exist so foreign keys resolve
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (name, email, password_hash, role, phone, status) VALUES (?, ?, ?, ?, ?, ?)');
  const dummyHash = '$2a$10$GBvbRxOtBxww5sVobf9NvODjxldrPlR1xxHOkMbBQN1YKI4s.IXei';
  insertUser.run('Sarah Johnson', 'sarah.johnson@mahavirsportsacademy.com', dummyHash, 'academy_staff', '+91 98250 55555', 'active');
  insertUser.run('Arun Verma', 'arun.verma@mahavirsportsacademy.com', dummyHash, 'coach', '+91 98250 44444', 'active');

  const uAdmin = db.prepare("SELECT id FROM users WHERE role = 'academy_admin' LIMIT 1").get() || { id: 1 };
  const uStaff = db.prepare("SELECT id FROM users WHERE email = 'sarah.johnson@mahavirsportsacademy.com'").get() || uAdmin;
  const uCoach = db.prepare("SELECT id FROM users WHERE email = 'arun.verma@mahavirsportsacademy.com'").get() || uAdmin;

  // 1. Staff Salary Profiles (Multi-mode rates)
  const insertSalaryProfile = db.prepare(`
    INSERT OR REPLACE INTO staff_salary_profiles (
      id, academy_id, user_id, salary_mode, base_rate, effective_from, is_active, notes
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);
  insertSalaryProfile.run(1, academyId, uAdmin.id, 'monthly', 45000, '2026-01-01', 'Academy Director base compensation');
  insertSalaryProfile.run(2, academyId, uStaff.id, 'hourly', 350, '2026-01-01', 'Operations staff hourly rate (₹350/hr)');
  insertSalaryProfile.run(3, academyId, uCoach.id, 'per_session', 600, '2026-01-01', 'Head Karate Coach per-session rate (₹600/class)');

  // 2. Generate Batch Sessions for current month
  const todayStr = new Date().toISOString().split('T')[0];
  const [curYear, curMonth] = todayStr.split('-');
  const yearMonth = `${curYear}-${curMonth}`;
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-28`;

  try {
    const batches = db.prepare('SELECT id, branch_id, coach_id, start_time, end_time, days_of_week FROM batches').all();
    const insertSession = db.prepare(`
      INSERT OR IGNORE INTO batch_sessions (
        academy_id, branch_id, batch_id, scheduled_date, start_time, end_time, coach_id, status, attendance_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', 'pending')
    `);

    const dayNameMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
    let cur = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    while (cur <= end) {
      const dayOfWeek = dayNameMap[cur.getUTCDay()];
      const dStr = cur.toISOString().split('T')[0];

      for (const b of batches) {
        let days = ['Mon', 'Wed', 'Fri'];
        try { days = JSON.parse(b.days_of_week); } catch (e) {}

        if (days.includes(dayOfWeek)) {
          insertSession.run(academyId, b.branch_id, b.id, dStr, b.start_time || '07:00', b.end_time || '08:30', b.coach_id || 1);
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // Link historical attendance to sessions
    db.prepare(`
      UPDATE batch_sessions
      SET status = 'completed', attendance_status = 'completed', attendance_taken_at = CURRENT_TIMESTAMP
      WHERE (batch_id = 1 AND scheduled_date IN ('2026-10-12', '2026-10-14'))
    `).run();
  } catch (e) {
    console.warn('[Seed] Warning generating sessions:', e.message);
  }

  // 3. Staff Payroll Period (Current Month)
  try {
    const lastDay = new Date(Number(curYear), Number(curMonth), 0).getDate();
    const pEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
    const pIns = db.prepare(`
      INSERT OR IGNORE INTO staff_payroll_periods (
        academy_id, year_month, start_date, end_date, statement_visibility_day, status, expected_payment_date
      ) VALUES (?, ?, ?, ?, 25, 'provisional', ?)
    `).run(academyId, yearMonth, startDate, pEnd, `${yearMonth}-28`);

    const periodId = pIns.lastInsertRowid || db.prepare('SELECT id FROM staff_payroll_periods WHERE academy_id = ? AND year_month = ?').get(academyId, yearMonth).id;

    // Calculate initial provisional statements
    const staffList = [
      { id: 1, mode: 'monthly', rate: 45000, units: 31, gross: 45000 },
      { id: 2, mode: 'hourly', rate: 350, units: 48, gross: 16800 },
      { id: 3, mode: 'per_session', rate: 600, units: 24, gross: 14400 },
    ];

    for (const st of staffList) {
      const insStmt = db.prepare(`
        INSERT OR REPLACE INTO staff_salary_statements (
          payroll_period_id, academy_id, user_id, salary_mode, applicable_rate,
          payable_units, gross_earnings, total_additions, total_deductions,
          net_earnings, paid_amount, balance_amount, payment_status, calculation_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, ?, 'unpaid', ?)
      `).run(
        periodId, academyId, st.id, st.mode, st.rate, st.units, st.gross, st.gross, st.gross,
        JSON.stringify({
          salary_mode: st.mode,
          base_rate: st.rate,
          payable_units: st.units,
          verified_sessions: st.units,
          period: yearMonth,
        })
      );

      // Add a sample bonus adjustment to Coach Arun Verma
      if (st.id === 3) {
        const stmtId = insStmt.lastInsertRowid;
        db.prepare(`
          INSERT INTO staff_salary_adjustments (statement_id, type, category, amount, reason, created_by)
          VALUES (?, 'addition', 'bonus', 1200, 'State Karate Championship Coaching Bonus', 1)
        `).run(stmtId);
        db.prepare('UPDATE staff_salary_statements SET total_additions = 1200, net_earnings = net_earnings + 1200, balance_amount = balance_amount + 1200 WHERE id = ?').run(stmtId);
      }
    }
  } catch (e) {
    console.warn('[Seed] Warning setting up payroll period:', e.message);
  }
}

// Execute if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed();
}
