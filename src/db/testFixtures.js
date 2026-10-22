import bcrypt from 'bcryptjs';
import { getCentralDb } from './centralDb.js';

/**
 * Isolated unit test fixture seeder.
 * ONLY runs during automated test suites (NODE_ENV === 'test').
 * Never runs in production.
 */
export function seedUnitTestFixtures(db, academyId = 1) {
  const centralDb = getCentralDb();
  const passwordHash = bcrypt.hashSync('password123', 10);

  db.pragma('foreign_keys = OFF');
  try {

  // 1. Roles in Tenant DB for test execution
  const insertRole = db.prepare('INSERT OR REPLACE INTO academy_roles (name, display_name, description, permissions, is_system, theme_color) VALUES (?, ?, ?, ?, ?, ?)');
  insertRole.run('coach', 'Coach', 'Coaching staff', JSON.stringify(['mark_attendance', 'view_attendance', 'view_students', 'view_batches', 'view_syllabus', 'request_attendance_correction']), 0, 'purple');
  insertRole.run('academy_staff', 'Staff', 'Staff members', JSON.stringify(['mark_attendance', 'view_attendance', 'view_students', 'view_batches', 'customize_theme']), 0, 'blue');

  // 2. Staff and Coaches in Tenant DB and Central Lookup
  const insertUser = db.prepare('INSERT OR REPLACE INTO users (id, name, email, password_hash, role, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertUser.run(1, 'John Smith', 'john.smith@mahavirsportsacademy.com', passwordHash, 'academy_admin', '+91 98250 12345', 'active');
  insertUser.run(2, 'Rohit Coach', 'rohit.sharma@mahavircoach.com', passwordHash, 'coach', '+91 98250 44444', 'active');
  insertUser.run(3, 'Neha Coach', 'neha.verma@mahavircoach.com', passwordHash, 'coach', '+91 98250 55555', 'active');

  centralDb.prepare('INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role) VALUES (?, ?, ?)').run('john.smith@mahavirsportsacademy.com', academyId, 'academy_admin');
  centralDb.prepare('INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role) VALUES (?, ?, ?)').run('rohit.sharma@mahavircoach.com', academyId, 'coach');
  centralDb.prepare('INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role) VALUES (?, ?, ?)').run('neha.verma@mahavircoach.com', academyId, 'coach');

  // 3. Branches
  const insertBranch = db.prepare('INSERT OR REPLACE INTO branches (id, name, address, city, phone, email) VALUES (?, ?, ?, ?, ?, ?)');
  insertBranch.run(1, 'Main Campus - West Wing', '101 Stadium Complex, Drive-in Road', 'Ahmedabad', '+91 79 2685 0001', 'west@mahavirsports.com');
  insertBranch.run(2, 'East City Center', 'Sports Enclave, Nikol Road', 'Ahmedabad', '+91 79 2685 0002', 'east@mahavirsports.com');

  const b1 = 1;
  const b2 = 2;

  // 4. Sports
  const insertSport = db.prepare('INSERT OR REPLACE INTO sports (id, name, description) VALUES (?, ?, ?)');
  insertSport.run(1, 'Karate', 'Martial arts discipline focusing on striking and kata forms');
  insertSport.run(2, 'Football', 'Professional grass turf and youth football coaching');
  insertSport.run(3, 'Cricket', 'BCCI standard turf pitches, net facilities and video analysis');
  insertSport.run(4, 'Swimming', 'Semi-Olympic temperature controlled pool and certified trainers');
  insertSport.run(5, 'Tennis', 'Synthetic hard courts and clay court facilities');

  const sKarate = 1;
  const sFootball = 2;
  const sCricket = 3;
  const sSwimming = 4;

  // 5. Coaches
  const insertCoach = db.prepare('INSERT OR REPLACE INTO coaches (id, user_id, name, email, phone, sport_id, branch_id, specializations, experience_years, salary_type, salary_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertCoach.run(1, 2, 'Rohit Coach', 'rohit.sharma@mahavircoach.com', '+91 98250 44444', sKarate, b1, 'Shotokan Kata & Kumite', 8, 'monthly', 45000);
  insertCoach.run(2, 3, 'Neha Coach', 'neha.verma@mahavircoach.com', '+91 98250 55555', sKarate, b1, 'Shotokan Kumite', 6, 'monthly', 40000);
  insertCoach.run(3, null, 'Vikram Mehta', 'vikram.cricket@mahavir.com', '+91 98250 22222', sCricket, b1, 'Pace Bowling & Fielding', 12, 'monthly', 55000);
  insertCoach.run(4, null, 'Priya Patel', 'priya.swimming@mahavir.com', '+91 98250 33333', sSwimming, b2, 'Stroke Technique', 6, 'monthly', 40000);

  const c1 = 1;
  const c2 = 2;
  const c3 = 3;

  // 6. Batches
  const insertBatch = db.prepare('INSERT OR REPLACE INTO batches (id, name, sport_id, branch_id, coach_id, start_time, end_time, days_of_week, max_capacity, monthly_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertBatch.run(1, 'Karate Cadets & Kumite (Shotokan)', sKarate, b1, c1, '17:00', '18:30', '["Mon","Wed","Fri"]', 25, 3000);
  insertBatch.run(2, 'Morning Football Elite (U-16)', sFootball, b1, c1, '06:30', '08:00', '["Mon","Wed","Fri"]', 25, 2500);
  insertBatch.run(3, 'Cricket Champions Batch', sCricket, b1, c2, '07:00', '08:30', '["Tue","Thu","Sat"]', 20, 3500);
  insertBatch.run(4, 'Swimming Squad - Evening', sSwimming, b2, c3, '17:30', '18:45', '["Mon","Tue","Wed","Thu","Fri"]', 15, 3000);

  const batchKarate = 1;
  const batch1 = 2;
  const batch2 = 3;
  const batch3 = 4;

  // 7. Fee Structures
  const insertFeeStructure = db.prepare('INSERT OR REPLACE INTO fee_structures (id, name, sport_id, amount, billing_frequency, description) VALUES (?, ?, ?, ?, ?, ?)');
  insertFeeStructure.run(1, 'Monthly Karate Training & Belt Progression', sKarate, 3000, 'monthly', 'Kata, Kumite, and regular belt evaluation sessions');
  insertFeeStructure.run(2, 'Monthly Football Coaching', sFootball, 2500, 'monthly', 'Standard weekday morning training');
  insertFeeStructure.run(3, 'Quarterly Cricket Coaching', sCricket, 9500, 'quarterly', 'Weekend and weekday academy sessions with match practice');
  insertFeeStructure.run(4, 'Monthly Swimming Pass', sSwimming, 3000, 'monthly', 'Daily pool access with coach supervision');

  const fs1 = 2;
  const fs2 = 3;
  const fs3 = 4;

  // 8. Students & Batches
  const insertStudent = db.prepare(`
    INSERT OR REPLACE INTO students (
      id, student_code, first_name, last_name, email, password_hash, phone, date_of_birth,
      gender, guardian_name, guardian_phone, guardian_email, address, branch_id, blood_group, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);
  const enrollBatch = db.prepare(`
    INSERT OR REPLACE INTO student_batch_enrollments (id, student_id, batch_id, start_date, status, assigned_by)
    VALUES (?, ?, ?, DATE('now', '-30 days'), 'active', 1)
  `);

  const studentData = [
    { id: 1, code: 'STU-1001', fn: 'Aarav', ln: 'Patel', email: 'aarav.patel@student.com', dob: '2010-04-12', g: 'male', guardian: 'Ramesh Patel', phone: '+91 98980 11111', blood: 'B+', batch: batchKarate, fs: fs1 },
    { id: 2, code: 'STU-1002', fn: 'Diya', ln: 'Shah', email: 'diya.shah@student.com', dob: '2011-09-21', g: 'female', guardian: 'Mukesh Shah', phone: '+91 98980 22222', blood: 'O+', batch: batchKarate, fs: fs1 },
    { id: 3, code: 'STU-1003', fn: 'Vivaan', ln: 'Desai', email: 'vivaan.desai@student.com', dob: '2009-12-05', g: 'male', guardian: 'Hiren Desai', phone: '+91 98980 33333', blood: 'A+', batch: batch2, fs: fs2 },
    { id: 4, code: 'STU-1004', fn: 'Ananya', ln: 'Joshi', email: 'ananya.joshi@student.com', dob: '2012-03-18', g: 'female', guardian: 'Kamlesh Joshi', phone: '+91 98980 44444', blood: 'AB+', batch: batch3, fs: fs3 },
    { id: 5, code: 'STU-1005', fn: 'Kabir', ln: 'Mehta', email: 'kabir.mehta@student.com', dob: '2010-08-14', g: 'male', guardian: 'Sanjay Mehta', phone: '+91 98980 55555', blood: 'B-', batch: batch2, fs: fs2 },
    { id: 6, code: 'STU-1006', fn: 'Ishaan', ln: 'Trivedi', email: 'ishaan.trivedi@student.com', dob: '2011-01-30', g: 'male', guardian: 'Nirav Trivedi', phone: '+91 98980 66666', blood: 'O-', batch: batch3, fs: fs3 },
  ];

  studentData.forEach((s, idx) => {
    insertStudent.run(
      s.id, s.code, s.fn, s.ln, s.email, passwordHash, s.phone, s.dob,
      s.g, s.guardian, s.phone, `parent.${s.email}`, 'Ahmedabad, Gujarat', b1, s.blood
    );

    enrollBatch.run(s.id, s.id, s.batch);

    if (idx === 0) {
      try {
        db.prepare(`
          INSERT OR REPLACE INTO student_batch_enrollments (
            id, student_id, batch_id, start_date, end_date, status, assigned_by,
            transferred_to_batch_id, transfer_reason
          ) VALUES (99, ?, ?, DATE('now', '-90 days'), DATE('now', '-30 days'), 'transferred', 1, ?, 'Promoted to Elite Squad after mid-season performance review')
        `).run(s.id, batch2, batchKarate);
      } catch (_) {}
    }

    centralDb.prepare('INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role) VALUES (?, ?, ?)').run(s.email, academyId, 'student');
  });

  // 9. Attendance
  const insertAttendance = db.prepare('INSERT OR REPLACE INTO attendance (id, batch_id, date, notes) VALUES (?, ?, ?, ?)');
  const insertStudentAttendance = db.prepare('INSERT OR REPLACE INTO student_attendance (attendance_id, student_id, status, remarks) VALUES (?, ?, ?, ?)');

  insertAttendance.run(1, batchKarate, '2026-10-12', 'Morning drill and passing practice');
  insertStudentAttendance.run(1, 1, 'present', 'On time');
  insertStudentAttendance.run(1, 2, 'present', 'Excellent stamina');

  insertAttendance.run(2, batchKarate, '2026-10-14', 'Tactical set piece drills');
  insertStudentAttendance.run(2, 1, 'present', 'Good performance');
  insertStudentAttendance.run(2, 2, 'absent', 'Informed sick leave');

  // 10. Facilities
  const insertFacility = db.prepare('INSERT OR REPLACE INTO facilities (id, branch_id, name, type, capacity, is_available) VALUES (?, ?, ?, ?, ?, ?)');
  insertFacility.run(1, b1, 'FIFA 2-Star Grass Turf A', 'field', 60, 1);
  insertFacility.run(2, b1, 'Cricket Practice Nets (4 Pitches)', 'field', 40, 1);
  insertFacility.run(3, b2, 'Semi-Olympic Swimming Pool (25m)', 'pool', 50, 1);
  insertFacility.run(4, b1, 'Fitness & Strength Gym', 'gym', 30, 1);

  // 11. Leaves
  const insertLeave = db.prepare('INSERT OR REPLACE INTO leave_requests (id, applicant_type, applicant_id, applicant_name, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertLeave.run(1, 'coach', c1, 'Rohit Coach', '2026-10-25', '2026-10-27', 'Attending AIFF coaching refresher clinic', 'approved');
  insertLeave.run(2, 'student', 2, 'Diya Shah', '2026-10-14', '2026-10-14', 'Fever & medical rest', 'approved');
  insertLeave.run(3, 'student', 3, 'Vivaan Desai', '2026-11-01', '2026-11-04', 'School mid-term examinations', 'pending');

  // 12. Sports Syllabus & Learning Progression
  const insertCat = db.prepare('INSERT OR REPLACE INTO syllabus_categories (id, academy_id, sport_id, name, description, display_order, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertCat.run(1, academyId, sKarate, 'Kata', 'Pre-arranged formal sequences', 1, 'active');
  insertCat.run(2, academyId, sKarate, 'Kumite', 'Controlled partner combat', 2, 'active');
  insertCat.run(3, academyId, sKarate, 'Basic Stances & Footwork', 'Foundational balance, posture and movement drills', 3, 'active');
  insertCat.run(4, academyId, sKarate, 'Punching & Striking', 'Direct thrusts, lunge strikes and palm techniques', 4, 'active');
  insertCat.run(5, academyId, sKarate, 'Kicking Techniques (Geri)', 'Snap, thrust and rotational kicking curriculum', 5, 'active');

  const catKata = 1;
  const catKumite = 2;
  const catStances = 3;
  const catPunches = 4;
  const catKicks = 5;

  const insertTech = db.prepare(`
    INSERT OR REPLACE INTO syllabus_techniques (
      id, academy_id, category_id, name, code, description, level, belt_level, media_url, display_order, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTech.run(1, academyId, catStances, 'Zenkutsu-Dachi (Forward Stance)', 'STANCE-01', 'Low hips, 60% front leg weight distribution with locked rear ankle', 1, 'White Belt', 'https://youtu.be/example1', 1, 'active');
  insertTech.run(2, academyId, catPunches, 'Oi-Zuki (Lunge Punch)', 'PUNCH-01', 'Coordinated step-and-punch with explosive hip rotation and seiken fist alignment', 1, 'White Belt', 'https://youtu.be/example2', 2, 'active');
  insertTech.run(3, academyId, catKicks, 'Mae-Geri (Front Snap Kick)', 'KICK-01', 'High knee chamber with striking surface on the ball of the foot (Chusoku)', 2, 'Yellow Belt', 'https://youtu.be/example3', 3, 'active');
  insertTech.run(4, academyId, catKata, 'Heian Shodan (Form 1)', 'KATA-01', 'First formal pattern containing 21 movements focusing on basic blocks and lunges', 2, 'Yellow Belt', 'https://youtu.be/example4', 4, 'active');
  insertTech.run(5, academyId, catKicks, 'Mawashi-Geri (Roundhouse Kick)', 'KICK-02', 'Diagonal hip drive impacting with the instep or ball of foot', 3, 'Orange Belt', 'https://youtu.be/example5', 5, 'active');
  insertTech.run(6, academyId, catKata, 'Heian Nidan (Form 2)', 'KATA-02', 'Intermediate pattern introducing knife-hand blocks and high kicks', 3, 'Green Belt', 'https://youtu.be/example6', 6, 'active');
  insertTech.run(7, academyId, catKumite, 'Jiyu Ippon Kumite', 'SPAR-01', 'One-step semi-free sparring drills with predetermined attacks and counter-strikes', 4, 'Brown Belt', 'https://youtu.be/example7', 7, 'active');

  const t1 = 1;
  const t2 = 2;
  const t3 = 3;
  const t4 = 4;
  const t5 = 5;

  const assignTech = db.prepare(`
    INSERT OR REPLACE INTO student_technique_assignments (
      id, academy_id, student_id, technique_id, assigned_by, start_date, end_date, status, sessions_attended, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  assignTech.run(1, academyId, 1, t2, 1, '2026-07-01', '2026-08-31', 'completed', 16, 'Successfully cleared 9th Kyu Yellow Belt grading');
  assignTech.run(2, academyId, 1, t4, 1, '2026-09-01', null, 'active', 18, 'Active training for 8th Kyu examination');
  assignTech.run(3, academyId, 2, t3, 1, '2026-09-15', null, 'active', 12, 'Practicing high knee chamber and balance');
  assignTech.run(4, academyId, 3, t1, 1, '2026-10-01', null, 'active', 8, 'Working on lower hip positioning');
  assignTech.run(5, academyId, 4, t5, 1, '2026-08-15', null, 'active', 28, 'Exceptional flexibility; preparing for Green Belt');

  const insertSnap = db.prepare(`
    INSERT OR REPLACE INTO attendance_technique_snapshots (
      id, attendance_id, student_id, technique_id, technique_level, progression_action, sessions_count_at_time, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSnap.run(1, 1, 1, t4, 2, 'keep', 17, 'Great hip drive during Heian Shodan');
  insertSnap.run(2, 1, 2, t3, 2, 'keep', 11, 'Snap execution improved');
  insertSnap.run(3, 2, 1, t4, 2, 'keep', 18, 'Ready for mock test next week');

  // 13. Staff Salary Profiles, Sessions, and Payroll
  try {
    const insertSalaryProfile = db.prepare(`
      INSERT OR REPLACE INTO staff_salary_profiles (
        id, academy_id, user_id, salary_mode, base_rate, effective_from, is_active, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);
    insertSalaryProfile.run(1, academyId, 1, 'monthly', 45000, '2026-01-01', 'Academy Director base compensation');
    insertSalaryProfile.run(2, academyId, 2, 'hourly', 350, '2026-01-01', 'Operations staff hourly rate (₹350/hr)');
    insertSalaryProfile.run(3, academyId, 3, 'per_session', 600, '2026-01-01', 'Head Karate Coach per-session rate (₹600/class)');

    const todayStr = new Date().toISOString().split('T')[0];
    const [curYear, curMonth] = todayStr.split('-');
    const yearMonth = `${curYear}-${curMonth}`;
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-28`;

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

    db.prepare(`
      UPDATE batch_sessions
      SET status = 'completed', attendance_status = 'completed', attendance_taken_at = CURRENT_TIMESTAMP
      WHERE (batch_id = 1 AND scheduled_date IN ('2026-10-12', '2026-10-14'))
    `).run();

    const lastDay = new Date(Number(curYear), Number(curMonth), 0).getDate();
    const pEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
    const pIns = db.prepare(`
      INSERT OR IGNORE INTO staff_payroll_periods (
        academy_id, year_month, start_date, end_date, statement_visibility_day, status, expected_payment_date
      ) VALUES (?, ?, ?, ?, 25, 'provisional', ?)
    `).run(academyId, yearMonth, startDate, pEnd, `${yearMonth}-28`);

    const periodId = pIns.lastInsertRowid || db.prepare('SELECT id FROM staff_payroll_periods WHERE academy_id = ? AND year_month = ?').get(academyId, yearMonth)?.id;

    if (periodId) {
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

        if (st.id === 3) {
          const stmtId = insStmt.lastInsertRowid;
          db.prepare(`
            INSERT INTO staff_salary_adjustments (statement_id, type, category, amount, reason, created_by)
            VALUES (?, 'addition', 'bonus', 1200, 'State Karate Championship Coaching Bonus', 1)
          `).run(stmtId);
          db.prepare('UPDATE staff_salary_statements SET total_additions = 1200, net_earnings = net_earnings + 1200, balance_amount = balance_amount + 1200 WHERE id = ?').run(stmtId);
        }
      }
    }
  } catch (_) {}
  } finally {
    try { db.pragma('foreign_keys = ON'); } catch (_) {}
  }
}
