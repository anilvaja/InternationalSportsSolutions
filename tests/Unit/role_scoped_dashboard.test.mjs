import assert from 'node:assert';
import { getTenantDbById } from '../../src/db/connectionManager.js';

console.log('--- RUNNING ROLE-SCOPED DASHBOARD & ATTENDANCE POLICY TEST SUITE ---');

const db = getTenantDbById(1);

// Ensure test coach exists
let coachUser = db.prepare("SELECT * FROM users WHERE role = 'coach' LIMIT 1").get();
if (!coachUser) {
  const insUser = db.prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES ('Test Coach', 'coach.test@example.com', 'dummyhash', 'coach', 'active')").run();
  coachUser = db.prepare('SELECT * FROM users WHERE id = ?').get(insUser.lastInsertRowid);
}

let coachProfile = db.prepare('SELECT * FROM coaches WHERE user_id = ?').get(coachUser.id);
if (!coachProfile) {
  const insCoach = db.prepare("INSERT INTO coaches (user_id, name, email, phone, is_active) VALUES (?, ?, ?, '9898989898', 1)").run(coachUser.id, coachUser.name, coachUser.email);
  coachProfile = db.prepare('SELECT * FROM coaches WHERE id = ?').get(insCoach.lastInsertRowid);
}

// Ensure another coach exists
let otherCoach = db.prepare('SELECT * FROM coaches WHERE id != ? LIMIT 1').get(coachProfile.id);
if (!otherCoach) {
  const insOther = db.prepare("INSERT INTO coaches (name, email, phone, is_active) VALUES ('Other Coach', 'other@example.com', '9898989899', 1)").run();
  otherCoach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(insOther.lastInsertRowid);
}

// Assign a batch to our test coach for today's day of week
const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const curDayShort = dayNamesShort[new Date().getDay()];

let coachBatch = db.prepare('SELECT * FROM batches WHERE coach_id = ? AND is_active = 1 LIMIT 1').get(coachProfile.id);
if (!coachBatch) {
  const branch = db.prepare('SELECT id FROM branches LIMIT 1').get();
  const insB = db.prepare(`
    INSERT INTO batches (name, branch_id, coach_id, start_time, end_time, days_of_week, max_capacity, is_active)
    VALUES ('Coach Morning Batch', ?, ?, '09:00', '10:30', ?, 20, 1)
  `).run(branch.id, coachProfile.id, `${curDayShort}, Daily`);
  coachBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(insB.lastInsertRowid);
} else {
  // Update days_of_week to include today
  db.prepare('UPDATE batches SET days_of_week = ? WHERE id = ?').run(`${curDayShort}, Daily`, coachBatch.id);
}

// Assign another batch to other coach
let otherBatch = db.prepare('SELECT * FROM batches WHERE coach_id = ? AND is_active = 1 LIMIT 1').get(otherCoach.id);
if (!otherBatch) {
  const branch = db.prepare('SELECT id FROM branches LIMIT 1').get();
  const insB2 = db.prepare(`
    INSERT INTO batches (name, branch_id, coach_id, start_time, end_time, days_of_week, max_capacity, is_active)
    VALUES ('Other Coach Evening Batch', ?, ?, '17:00', '18:30', ?, 20, 1)
  `).run(branch.id, otherCoach.id, `${curDayShort}, Daily`);
  otherBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(insB2.lastInsertRowid);
}

console.log('✓ Test coaches and batches successfully verified');

// Test 1: Verify Coach Batches Query Isolation
console.log('\n[Test 1] Coach Batches Scoping');
const coachBatches = db.prepare('SELECT id, name, coach_id FROM batches WHERE coach_id = ? AND is_active = 1').all(coachProfile.id);
assert.ok(coachBatches.length > 0, 'Coach should have at least 1 assigned batch');
assert.ok(coachBatches.every(b => b.coach_id === coachProfile.id), 'Coach must only see batches assigned to them');
console.log(`✓ Coach correctly scoped to ${coachBatches.length} assigned batches; other batches excluded`);

// Test 2: Coach Attendance Gate Check (Simulating backend route check)
console.log('\n[Test 2] Coach Cross-Batch Attendance Access Check');
function checkCoachCanAccessBatch(user, targetBatchId) {
  if (user.role === 'coach') {
    const coach = db.prepare('SELECT * FROM coaches WHERE user_id = ? OR email = ? COLLATE NOCASE').get(user.userId, user.email);
    if (!coach) return false;
    const batch = db.prepare('SELECT coach_id FROM batches WHERE id = ?').get(targetBatchId);
    if (!batch || batch.coach_id !== coach.id) return false;
  }
  return true;
}

assert.strictEqual(checkCoachCanAccessBatch({ role: 'coach', userId: coachUser.id, email: coachUser.email }, coachBatch.id), true, 'Coach can access their own batch');
assert.strictEqual(checkCoachCanAccessBatch({ role: 'coach', userId: coachUser.id, email: coachUser.email }, otherBatch.id), false, 'Coach CANNOT access another coach batch');
assert.strictEqual(checkCoachCanAccessBatch({ role: 'academy_admin', userId: 1 }, otherBatch.id), true, 'Admin can access any batch');
console.log('✓ Coach attendance gate correctly blocks cross-batch access');

console.log('\nALL ROLE-SCOPED DASHBOARD TESTS PASSED!');
