import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('data/academies/academy_1.db');
const backupDir = path.resolve('data/backups');

if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found: ${dbPath}`);
  process.exit(1);
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// 1. Create safety backup first
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `pre_truncate_academy_1_${timestamp}.db`);
fs.copyFileSync(dbPath, backupFile);
console.log(`Safety backup created at: ${backupFile}`);

// 2. Open database connection
const db = new Database(dbPath);
db.pragma('foreign_keys = OFF');

// List of transactional tables to truncate
const tablesToTruncate = [
  'student_notifications',
  'admission_checklists',
  'inquiry_trials',
  'inquiries',
  'student_documents',
  'student_guardians',
  'event_response_history',
  'event_participants',
  'events',
  'fee_pause_requests',
  'student_fee_overrides',
  'student_fee_ledger',
  'fee_payments',
  'student_fees',
  'fee_structures',
  'session_swaps',
  'attendance_corrections',
  'attendance_technique_snapshots',
  'student_attendance',
  'attendance',
  'student_technique_assignments',
  'student_batch_enrollments',
  'students',
  'batch_sessions',
  'batches',
  'staff_salary_payments',
  'staff_salary_adjustments',
  'staff_salary_statements',
  'staff_payroll_periods',
  'overtime_requests',
  'leave_requests',
  'staff_time_punches',
  'staff_punches',
  'employee_schedule_shifts',
  'employee_work_schedules',
  'employee_compensation_history',
  'employment_records',
  'user_role_history',
  'user_branch_assignments',
  'facilities',
  'equipment_inventory',
  'audit_logs'
];

console.log(`Truncating ${tablesToTruncate.length} transactional tables...`);

const truncateTx = db.transaction(() => {
  for (const table of tablesToTruncate) {
    try {
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
      if (exists) {
        const countBefore = db.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get().c;
        db.prepare(`DELETE FROM "${table}"`).run();
        try {
          db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
        } catch (e) {}
        console.log(`✔ Cleared ${table}: deleted ${countBefore} rows`);
      }
    } catch (err) {
      console.warn(`Warning clearing table ${table}:`, err.message);
    }
  }
});

truncateTx();

// Re-enable foreign keys and checkpoint WAL
db.pragma('foreign_keys = ON');
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();

console.log('\n✅ Transactional tables under Pratik Karate Academy database truncated successfully!');
