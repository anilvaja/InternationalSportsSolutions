import assert from 'node:assert';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { InquiryService } from '../../src/services/inquiryService.js';

console.log('--- RUNNING INQUIRY & ADMISSION WORKFLOW TEST SUITE ---');

const db = getTenantDbById(1);

// Test 1: Duplicate inquiry detection
console.log('\n[Test 1] Duplicate inquiry detection');
const dupCheck = InquiryService.checkDuplicates(db, {
  phone: '9876543210',
  student_name: 'Rahul Sharma',
});
assert.strictEqual(typeof dupCheck.hasDuplicates, 'boolean');
assert.ok(Array.isArray(dupCheck.warnings));
console.log('✓ Duplicate check successfully returns warning format');

// Test 2: Create inquiry and schedule trial class without fee liability
console.log('\n[Test 2] Create inquiry and schedule trial class');
const randId = Math.floor(100000 + Math.random() * 900000);
const testPhone = `99${randId}`;
const inquiry = InquiryService.createInquiry(db, 1, {
  student_name: `Aditya Patel ${randId}`,
  guardian_name: 'Rajesh Patel',
  phone: testPhone,
  email: `aditya.patel.${randId}@example.com`,
  gender: 'male',
  branch_id: 1,
  sport_id: 1,
  source: 'website',
  notes: 'Interested in evening batches',
}, 1);

assert.ok(inquiry.id, 'Inquiry was created');
assert.strictEqual(inquiry.status, 'new');
assert.ok(inquiry.student_name.includes('Aditya Patel'));

// Schedule trial
const trial = InquiryService.scheduleTrial(db, inquiry.id, {
  branch_id: 1,
  sport_id: 1,
  trial_date: '2026-10-25',
  start_time: '16:00',
  end_time: '17:30',
  attendance_status: 'attended',
  feedback: 'Excellent enthusiasm and stamina',
});

assert.ok(trial.id, 'Trial was created');
assert.strictEqual(trial.attendance_status, 'attended');

// Inquiry status should automatically transition to trial_completed
const updatedInquiry = db.prepare('SELECT status FROM inquiries WHERE id = ?').get(inquiry.id);
assert.strictEqual(updatedInquiry.status, 'trial_completed');

// Verify that trial class DID NOT create any fee records!
const feeCheck = db.prepare('SELECT COUNT(*) as c FROM student_fees WHERE student_id = ?').get(inquiry.id);
assert.strictEqual(feeCheck.c, 0, 'Trial class must not generate fee liability');
console.log('✓ Trial class scheduled and tracked attendance without creating fee liability');

// Test 3: Idempotent Admission Wizard Conversion
console.log('\n[Test 3] Admission Wizard Conversion');
const batch = db.prepare('SELECT id, branch_id FROM batches WHERE is_active = 1 LIMIT 1').get();

const admissionResult = InquiryService.convertInquiryToAdmission(db, 1, inquiry.id, {
  first_name: 'Aditya',
  last_name: 'Patel',
  phone: testPhone,
  branch_id: batch.branch_id || 1,
  batch_id: batch.id,
  joining_date: '2026-10-26',
  nationality: 'Indian',
  school_college_name: 'St. Xavier School',
  grade_standard: '7th Grade',
  fee_override_amount: 1500,
  joining_fee_amount: 250,
  discount_percent: 10,
  discount_reason: 'Early bird promotion',
  initial_payment_amount: 500,
  payment_method: 'cash',
}, { userId: 1, role: 'academy_admin' });

assert.ok(admissionResult.success);
assert.ok(admissionResult.student.id, 'Student created');
assert.ok(admissionResult.student.student_code, 'Student code generated');
assert.strictEqual(admissionResult.enrollment.batch_id, batch.id, 'Batch enrollment created');
assert.strictEqual(admissionResult.enrollment.status, 'active', 'Batch status active');

// Verify Single Active Batch Constraint
const activeBatchesCount = db.prepare("SELECT COUNT(*) as c FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'").get(admissionResult.student.id).c;
assert.strictEqual(activeBatchesCount, 1, 'Student must have exactly one active batch membership');

// Verify Fee Ledger Liability & Partial Payment
assert.ok(admissionResult.fee, 'Fee liability created');
assert.strictEqual(admissionResult.fee.net_amount, 1600, 'Fee net amount (1500 - 10% discount = 1350 + 250 joining = 1600)');
assert.strictEqual(admissionResult.fee.paid_amount, 500, 'Recorded paid amount is 500');
assert.strictEqual(admissionResult.fee.balance_amount, 1100, 'Remaining balance is 1100');
assert.strictEqual(admissionResult.fee.status, 'partial', 'Fee status is partial');

// Verify Inquiry is marked as converted
const postConvInquiry = db.prepare('SELECT status, converted_student_id FROM inquiries WHERE id = ?').get(inquiry.id);
assert.strictEqual(postConvInquiry.status, 'converted');
assert.strictEqual(postConvInquiry.converted_student_id, admissionResult.student.id);

// Verify Double-Conversion protection (Idempotency)
assert.throws(() => {
  InquiryService.convertInquiryToAdmission(db, 1, inquiry.id, {}, { userId: 1 });
}, /already been converted/, 'Cannot double-convert same inquiry');
console.log('✓ Idempotent admission conversion successfully created student, single batch, and date-driven fee liability');

// Test 4: Rejoining Workflow
console.log('\n[Test 4] Rejoining returning student workflow');
// Inactivate the student first
db.prepare("UPDATE students SET status = 'inactive' WHERE id = ?").run(admissionResult.student.id);

const rejoinedStudent = InquiryService.rejoinStudent(db, 1, admissionResult.student.id, {
  batch_id: batch.id,
  rejoin_date: '2026-11-01',
  fee_override_amount: 1400,
  initial_payment_amount: 1400,
}, { userId: 1 });

assert.strictEqual(rejoinedStudent.status, 'active');
const activeBatchesPostRejoin = db.prepare("SELECT COUNT(*) as c FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'").get(admissionResult.student.id).c;
assert.strictEqual(activeBatchesPostRejoin, 1, 'Only one active batch after rejoining');
console.log('✓ Rejoining workflow reactivated student without duplicate profile');

// Test 5: 20% Discount Ceiling Enforcement
console.log('\n[Test 5] Discount ceiling >20% requires admin authorization');
assert.throws(() => {
  InquiryService.createAdmission(db, 1, {
    first_name: 'Test',
    phone: '9999988888',
    branch_id: 1,
    discount_percent: 25,
  }, { userId: 5, role: 'coach' });
}, /Discount ceiling exceeded/, 'Non-admin cannot bypass 20% discount ceiling');
console.log('✓ Discount ceiling correctly enforced');

console.log('\nALL INQUIRY & ADMISSION BACKEND TESTS PASSED!');
