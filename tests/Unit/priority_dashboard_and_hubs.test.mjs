import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  getDaysUntilBirthday,
  fetchUpcomingBirthdays,
  fetchInquiryPipeline,
  fetchFeeDuesHub,
  fetchStaffAvailability,
  calculatePriorityActions
} from '../../src/routes/academyRoutes.js';

test('getDaysUntilBirthday correctly computes days for same day, upcoming and past', () => {
  const ref = new Date('2026-10-20T00:00:00');
  
  // Today's birthday
  const todayRes = getDaysUntilBirthday('1995-10-20', ref);
  assert.equal(todayRes.daysDiff, 0);
  assert.equal(todayRes.monthDayStr, '10-20');
  
  // Tomorrow's birthday
  const tomorrowRes = getDaysUntilBirthday('2000-10-21', ref);
  assert.equal(tomorrowRes.daysDiff, 1);
  
  // Birthday in 5 days
  const futureRes = getDaysUntilBirthday('1990-10-25', ref);
  assert.equal(futureRes.daysDiff, 5);
  
  // Invalid input
  assert.equal(getDaysUntilBirthday(null, ref), null);
  assert.equal(getDaysUntilBirthday('invalid', ref), null);
});

test('fetchUpcomingBirthdays returns structured staff and student birthdays within window', () => {
  const db = new Database(':memory:');
  
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT,
      role TEXT,
      date_of_birth TEXT,
      avatar_url TEXT
    );
    CREATE TABLE coaches (
      id INTEGER PRIMARY KEY,
      name TEXT,
      branch_id INTEGER,
      date_of_birth TEXT,
      profile_photo TEXT,
      is_active INTEGER DEFAULT 1
    );
    CREATE TABLE branches (
      id INTEGER PRIMARY KEY,
      name TEXT
    );
    CREATE TABLE students (
      id INTEGER PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      admission_number TEXT,
      branch_id INTEGER,
      date_of_birth TEXT,
      photo_url TEXT,
      status TEXT
    );
  `);

  db.prepare(`INSERT INTO branches (id, name) VALUES (?, ?)`).run(1, 'Main Branch');

  // Insert staff member whose birthday is today (10-20)
  db.prepare(`INSERT INTO users (name, role, date_of_birth) VALUES (?, ?, ?)`).run('Sensei Rahul', 'coach', '1990-10-20');
  // Insert coach whose birthday is in 3 days (10-23)
  db.prepare(`INSERT INTO coaches (name, branch_id, date_of_birth, is_active) VALUES (?, ?, ?, 1)`).run('Coach Priya', 1, '1992-10-23');
  // Insert staff member whose birthday is 20 days later (11-15) - should be excluded
  db.prepare(`INSERT INTO users (name, role, date_of_birth) VALUES (?, ?, ?)`).run('Admin Vikram', 'admin', '1985-11-15');

  // Insert student whose birthday is tomorrow (10-21)
  db.prepare(`INSERT INTO students (first_name, last_name, admission_number, branch_id, date_of_birth, status) VALUES (?, ?, ?, ?, ?, 'active')`).run(
    'Aarav', 'Patel', 'STU-001', 1, '2012-10-21'
  );
  // Inactive student - should be excluded
  db.prepare(`INSERT INTO students (first_name, last_name, admission_number, branch_id, date_of_birth, status) VALUES (?, ?, ?, ?, ?, 'inactive')`).run(
    'Inactive', 'Kid', 'STU-002', 1, '2013-10-20'
  );

  const { staffBirthdays, studentBirthdays } = fetchUpcomingBirthdays(db, [1], 7);

  assert.equal(staffBirthdays.length, 2);
  assert.equal(staffBirthdays[0].name, 'Sensei Rahul');
  assert.equal(staffBirthdays[0].days_until, 0);
  assert.equal(staffBirthdays[0].is_today, true);
  assert.equal(staffBirthdays[1].name, 'Coach Priya');

  assert.equal(studentBirthdays.length, 1);
  assert.equal(studentBirthdays[0].name, 'Aarav Patel');
  assert.equal(studentBirthdays[0].days_until, 1);
});

test('fetchInquiryPipeline computes counts, follow-ups, and conversion metrics accurately', () => {
  const db = new Database(':memory:');
  
  db.exec(`
    CREATE TABLE branches (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE sports (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE inquiries (
      id INTEGER PRIMARY KEY,
      branch_id INTEGER,
      sport_id INTEGER,
      student_name TEXT,
      phone TEXT,
      source TEXT,
      status TEXT,
      next_followup_date TEXT,
      created_at TEXT
    );
    CREATE TABLE inquiry_trials (
      id INTEGER PRIMARY KEY,
      inquiry_id INTEGER,
      branch_id INTEGER,
      trial_date TEXT
    );
  `);

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = '2026-10-19';
  const futureStr = '2026-10-28';

  // New inquiry awaiting contact
  db.prepare(`INSERT INTO inquiries (branch_id, student_name, status, next_followup_date, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    1, 'Kavya Sharma', 'new', null, todayStr
  );
  // Followup due today
  db.prepare(`INSERT INTO inquiries (branch_id, student_name, status, next_followup_date, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    1, 'Rohan Verma', 'contacted', todayStr, yesterdayStr
  );
  // Overdue follow-up
  db.prepare(`INSERT INTO inquiries (branch_id, student_name, status, next_followup_date, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    1, 'Meera Nair', 'contacted', '2026-10-10', yesterdayStr
  );
  // Trial scheduled
  db.prepare(`INSERT INTO inquiries (branch_id, student_name, status, next_followup_date, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    1, 'Kabir Mehta', 'trial_scheduled', futureStr, yesterdayStr
  );
  db.prepare(`INSERT INTO inquiry_trials (inquiry_id, branch_id, trial_date) VALUES (?, ?, ?)`).run(4, 1, futureStr);

  // Converted inquiry
  db.prepare(`INSERT INTO inquiries (branch_id, student_name, status, next_followup_date, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    1, 'Diya Sen', 'converted', null, yesterdayStr
  );

  const pipeline = fetchInquiryPipeline(db, [1]);

  assert.equal(pipeline.newCount, 1);
  assert.equal(pipeline.todayFollowUps, 1);
  assert.equal(pipeline.overdueFollowUps, 1);
  assert.equal(pipeline.trialsScheduled, 1);
  assert.equal(pipeline.convertedCount, 1);
  assert.equal(pipeline.totalActive, 4);
  assert.equal(pipeline.conversionRate, 20); // 1 converted out of 5 total = 20%
  assert.ok(pipeline.actionableInquiries.length > 0);
});

test('fetchFeeDuesHub computes overdue, due today, upcoming and collected totals correctly', () => {
  const db = new Database(':memory:');
  
  db.exec(`
    CREATE TABLE students (
      id INTEGER PRIMARY KEY,
      branch_id INTEGER,
      first_name TEXT
    );
    CREATE TABLE student_fees (
      id INTEGER PRIMARY KEY,
      student_id INTEGER,
      due_date TEXT,
      status TEXT,
      amount REAL,
      paid_amount REAL,
      balance_amount REAL
    );
    CREATE TABLE fee_payments (
      id INTEGER PRIMARY KEY,
      amount REAL,
      payment_date TEXT,
      status TEXT
    );
  `);

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueStr = '2026-10-01';
  const nextWeekStr = '2026-10-25';

  db.prepare(`INSERT INTO students (id, branch_id, first_name) VALUES (101, 1, 'Student A')`).run();
  db.prepare(`INSERT INTO students (id, branch_id, first_name) VALUES (102, 1, 'Student B')`).run();

  // Overdue fee: 5000 due, 2000 paid => 3000 balance
  db.prepare(`INSERT INTO student_fees (student_id, due_date, status, amount, paid_amount, balance_amount) VALUES (?, ?, ?, ?, ?, ?)`).run(
    101, overdueStr, 'partial', 5000, 2000, 3000
  );
  // Due today fee: 2500 due, 0 paid => 2500 balance
  db.prepare(`INSERT INTO student_fees (student_id, due_date, status, amount, paid_amount, balance_amount) VALUES (?, ?, ?, ?, ?, ?)`).run(
    102, todayStr, 'pending', 2500, 0, 2500
  );

  // Fee payment collected this month
  db.prepare(`INSERT INTO fee_payments (amount, payment_date, status) VALUES (?, ?, 'completed')`).run(
    2000, todayStr
  );

  const hub = fetchFeeDuesHub(db, [1]);

  assert.equal(hub.overdue.amount, 3000);
  assert.equal(hub.overdue.count, 1);
  assert.equal(hub.dueToday.amount, 2500);
  assert.equal(hub.dueToday.count, 1);
  assert.equal(hub.totalOutstanding, 5500); // 3000 + 2500
  assert.equal(hub.totalAffectedStudents, 2);
  assert.equal(hub.collectedThisMonth, 2000);
});

test('fetchStaffAvailability detects coach leave and marks scheduled batch conflicts', () => {
  const db = new Database(':memory:');
  
  db.exec(`
    CREATE TABLE leave_requests (
      id INTEGER PRIMARY KEY,
      applicant_type TEXT,
      applicant_id INTEGER,
      applicant_name TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT,
      reason TEXT
    );
    CREATE TABLE coaches (
      id INTEGER PRIMARY KEY,
      name TEXT,
      phone TEXT,
      branch_id INTEGER,
      is_active INTEGER
    );
  `);

  const todayStr = '2026-10-20';
  
  // Approved leave for coach ID 1 (Sensei Deepak)
  db.prepare(`INSERT INTO leave_requests (applicant_type, applicant_id, applicant_name, start_date, end_date, status, reason) VALUES (?, ?, ?, ?, ?, 'approved', ?)`).run(
    'coach', 1, 'Sensei Deepak', '2026-10-19', '2026-10-21', 'Medical'
  );

  // Coaches
  db.prepare(`INSERT INTO coaches (id, name, phone, branch_id, is_active) VALUES (?, ?, ?, ?, 1)`).run(1, 'Sensei Deepak', '9876543210', 1);
  db.prepare(`INSERT INTO coaches (id, name, phone, branch_id, is_active) VALUES (?, ?, ?, ?, 1)`).run(2, 'Sensei Vikram', '9876543211', 1);

  const scheduledBatches = [
    {
      id: 501,
      name: 'Karate Advanced',
      coach_id: 1,
      coach_name: 'Sensei Deepak',
      start_time: '17:00',
      end_time: '18:00'
    },
    {
      id: 502,
      name: 'Karate Beginners',
      coach_id: 2,
      coach_name: 'Sensei Vikram',
      start_time: '18:15',
      end_time: '19:15'
    }
  ];

  const avail = fetchStaffAvailability(db, todayStr, scheduledBatches);

  assert.equal(avail.leavesToday.length, 1);
  assert.equal(avail.leavesToday[0].applicant_name, 'Sensei Deepak');
  assert.equal(avail.affectedBatchesCount, 1);
  assert.equal(avail.conflicts[0].batch_name, 'Karate Advanced');
  assert.equal(avail.availableCoaches.length, 1);
  assert.equal(avail.availableCoaches[0].name, 'Sensei Vikram');
});

test('calculatePriorityActions compiles ranked operational alerts', () => {
  const alerts = calculatePriorityActions({
    inquiryPipeline: { overdueFollowUps: 3, todayFollowUps: 2 },
    feeDuesHub: { overdue: { amount: 12000, count: 4, studentCount: 4 } },
    staffAvailability: { affectedBatchesCount: 1 },
    scheduledBatches: [{ id: 1, attendance_status: 'not_started' }],
    pendingLeaves: 2
  });

  assert.ok(alerts.length >= 4);
  const ids = alerts.map(a => a.id);
  assert.ok(ids.includes('overdue_inquiries'));
  assert.ok(ids.includes('batch_leave_conflicts'));
  assert.ok(ids.includes('pending_attendance'));
  assert.ok(ids.includes('overdue_fees'));
  assert.ok(ids.includes('pending_leaves'));
});
