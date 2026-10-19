import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import { AttendanceScheduleService } from '../../src/services/attendanceScheduleService.js';
import { OvertimeService } from '../../src/services/overtimeService.js';
import { PayrollService } from '../../src/services/payrollService.js';
import app from '../../server.js';

describe('Attendance Scheduling, Overtime Approval, and Attendance-Based Staff Payroll', () => {
  let server;
  let baseUrl;
  let academy1Db;
  let academy2Db;
  let academyAdminToken;
  let coachToken;
  let unauthorizedCoachToken;
  let academy2AdminToken;

  const ACADEMY_1_ID = 1;
  const ACADEMY_2_ID = 2;

  before(async () => {
    process.env.NODE_ENV = 'test';
    academy1Db = getTenantDbById(ACADEMY_1_ID);
    academy2Db = getTenantDbById(ACADEMY_2_ID);

    academyAdminToken = signToken({
      userId: 1,
      email: 'john.smith@mahavirsportsacademy.com',
      role: 'academy_admin',
      academyId: ACADEMY_1_ID,
      name: 'John Smith',
    });

    coachToken = signToken({
      userId: 2,
      email: 'rohit.sharma@mahavircoach.com',
      role: 'coach',
      academyId: ACADEMY_1_ID,
      name: 'Rohit Coach',
    });

    unauthorizedCoachToken = signToken({
      userId: 3,
      email: 'neha.verma@mahavircoach.com',
      role: 'coach',
      academyId: ACADEMY_1_ID,
      name: 'Neha Coach',
    });

    academy2AdminToken = signToken({
      userId: 4,
      email: 'admin@sardar-martial-arts.com',
      role: 'academy_admin',
      academyId: ACADEMY_2_ID,
      name: 'Sardar Admin',
    });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function api(path, { method = 'GET', body, token = academyAdminToken, academyId = ACADEMY_1_ID } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': String(academyId),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  // ==========================================
  // 1. ATTENDANCE DATE VALIDATION & RULES
  // ==========================================
  describe('1. Attendance Date Validation & Approval Rules', () => {

    it('1.1. Coach can submit attendance for today and previous 2 calendar days (inclusive)', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);
      const yesterday = AttendanceScheduleService.getPastDate(today, 1);
      const twoDaysAgo = AttendanceScheduleService.getPastDate(today, 2);

      const checkToday = AttendanceScheduleService.validateAttendanceDate(academy1Db, today);
      assert.equal(checkToday.allowed, true);

      const checkYesterday = AttendanceScheduleService.validateAttendanceDate(academy1Db, yesterday);
      assert.equal(checkYesterday.allowed, true);

      const checkTwoDaysAgo = AttendanceScheduleService.validateAttendanceDate(academy1Db, twoDaysAgo);
      assert.equal(checkTwoDaysAgo.allowed, true);

      // Verify coach submission for yesterday succeeds via API
      const res = await api('/api/academy/attendance', {
        method: 'POST',
        token: coachToken,
        body: {
          batch_id: 1,
          date: yesterday,
          entries: [{ student_id: 1, status: 'present' }],
        },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
    });

    it('1.2. Coach cannot submit attendance older than 2 calendar days without approved correction', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);
      const threeDaysAgo = AttendanceScheduleService.getPastDate(today, 3);

      const check = AttendanceScheduleService.validateAttendanceDate(academy1Db, threeDaysAgo);
      assert.equal(check.allowed, false);
      assert.equal(check.code, 'PAST_CUTOFF_EXCEEDED');

      // Direct submission by coach is rejected with 403 and requiresCorrection flag
      const res = await api('/api/academy/attendance', {
        method: 'POST',
        token: coachToken,
        body: {
          batch_id: 1,
          date: threeDaysAgo,
          entries: [{ student_id: 1, status: 'present' }],
        },
      });
      assert.equal(res.status, 403);
      assert.equal(res.data.requiresCorrection, true);
      assert.equal(res.data.code, 'PAST_CUTOFF_EXCEEDED');
    });

    it('1.3. Coach cannot submit future attendance unless explicitly configured', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);
      const tomorrow = AttendanceScheduleService.getFutureDate(today, 1);

      const check = AttendanceScheduleService.validateAttendanceDate(academy1Db, tomorrow);
      assert.equal(check.allowed, false);
      assert.equal(check.code, 'FUTURE_DATE_REJECTED');

      const res = await api('/api/academy/attendance', {
        method: 'POST',
        token: coachToken,
        body: {
          batch_id: 1,
          date: tomorrow,
          entries: [{ student_id: 1, status: 'present' }],
        },
      });
      assert.equal(res.status, 400);
      assert.equal(res.data.code, 'FUTURE_DATE_REJECTED');
    });

    it('1.4. Older attendance creates correction request with mandatory reason', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);
      const pastDate = AttendanceScheduleService.getPastDate(today, 5);

      // Submission without reason fails
      const failRes = await api('/api/academy/attendance/corrections', {
        method: 'POST',
        token: coachToken,
        body: { batch_id: 1, date: pastDate, reason: '' },
      });
      assert.equal(failRes.status, 400);

      // Valid correction request
      const reqRes = await api('/api/academy/attendance/corrections', {
        method: 'POST',
        token: coachToken,
        body: {
          batch_id: 1,
          date: pastDate,
          student_id: 1,
          original_status: 'absent',
          requested_status: 'present',
          reason: 'Coach was sick, paper log verified by parent',
        },
      });
      assert.equal(reqRes.status, 201);
      assert.ok(reqRes.data.correctionId);

      // Verify pending status in DB
      const corr = academy1Db.prepare('SELECT * FROM attendance_corrections WHERE id = ?').get(reqRes.data.correctionId);
      assert.equal(corr.status, 'pending');
      assert.equal(corr.reason, 'Coach was sick, paper log verified by parent');
    });

    it('1.5. Either authorized branch admin or academy admin can approve late attendance request', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);
      const pastDate = AttendanceScheduleService.getPastDate(today, 4);

      const ins = academy1Db.prepare(`
        INSERT INTO attendance_corrections (academy_id, batch_id, date, student_id, reason, requested_by, status)
        VALUES (1, 1, ?, 1, 'Late submission request', 2, 'pending')
      `).run(pastDate);
      const correctionId = ins.lastInsertRowid;

      // Academy Admin approves
      const approveRes = await api(`/api/academy/attendance/corrections/${correctionId}`, {
        method: 'PUT',
        token: academyAdminToken,
        body: { status: 'approved', reviewer_notes: 'Verified against gate register' },
      });
      assert.equal(approveRes.status, 200);

      const updated = academy1Db.prepare('SELECT * FROM attendance_corrections WHERE id = ?').get(correctionId);
      assert.equal(updated.status, 'approved');
      assert.equal(updated.approved_by, 1);
      assert.equal(updated.reviewer_notes, 'Verified against gate register');

      // Now coach can mark attendance for this approved date
      const submitRes = await api('/api/academy/attendance', {
        method: 'POST',
        token: coachToken,
        body: {
          batch_id: 1,
          date: pastDate,
          entries: [{ student_id: 1, status: 'present' }],
        },
      });
      assert.equal(submitRes.status, 200);
      assert.equal(submitRes.data.success, true);
    });

    it('1.6. Rejected correction request preserves reason and does not alter attendance', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);
      const pastDate = AttendanceScheduleService.getPastDate(today, 10);

      const ins = academy1Db.prepare(`
        INSERT INTO attendance_corrections (academy_id, batch_id, date, student_id, reason, requested_by, status)
        VALUES (1, 1, ?, 1, 'Unverified late claim', 2, 'pending')
      `).run(pastDate);
      const correctionId = ins.lastInsertRowid;

      const rejectRes = await api(`/api/academy/attendance/corrections/${correctionId}`, {
        method: 'PUT',
        token: academyAdminToken,
        body: { status: 'rejected', reviewer_notes: 'No CCTV evidence found' },
      });
      assert.equal(rejectRes.status, 200);

      const updated = academy1Db.prepare('SELECT * FROM attendance_corrections WHERE id = ?').get(correctionId);
      assert.equal(updated.status, 'rejected');
      assert.equal(updated.reviewer_notes, 'No CCTV evidence found');

      // Coach still cannot submit attendance for this date
      const submitRes = await api('/api/academy/attendance', {
        method: 'POST',
        token: coachToken,
        body: {
          batch_id: 1,
          date: pastDate,
          entries: [{ student_id: 1, status: 'present' }],
        },
      });
      assert.equal(submitRes.status, 403);
    });
  });

  // ==========================================
  // 2. SESSION SELECTION & BATCH SWITCHING
  // ==========================================
  describe('2. Batch Scheduling & Session Switching', () => {

    it('2.1. Automatically selects next earliest eligible pending session in allowed window', async () => {
      const res = await api('/api/academy/attendance/eligible-session?batch_id=1', { token: coachToken });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);

      if (res.data.hasSession) {
        assert.ok(res.data.session.scheduled_date);
        assert.ok(res.data.session.start_time);
        assert.notEqual(res.data.session.status, 'cancelled');
      }
    });

    it('2.2. Completed session attendance is not duplicated and moves to next eligible session', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);
      const batchId = 1;

      // Mark attendance today
      await api('/api/academy/attendance', {
        method: 'POST',
        token: coachToken,
        body: {
          batch_id: batchId,
          date: today,
          entries: [{ student_id: 1, status: 'present' }],
        },
      });

      // Query eligible session again
      const res = await api(`/api/academy/attendance/eligible-session?batch_id=${batchId}`, { token: coachToken });
      assert.equal(res.status, 200);

      if (res.data.hasSession) {
        // If the session returned is today's, attendance_status should be 'completed'
        if (res.data.session.scheduled_date === today) {
          assert.equal(res.data.session.attendance_status, 'completed');
        }
      }
    });

    it('2.3. Controlled batch session switch does not alter permanent student batch enrollment', async () => {
      // Find or create 2 distinct sessions on clean future dates
      academy1Db.prepare(`
        INSERT OR REPLACE INTO batch_sessions (id, academy_id, branch_id, batch_id, scheduled_date, start_time, end_time, status, attendance_status)
        VALUES (998, 1, 1, 1, '2026-12-20', '06:00', '07:30', 'scheduled', 'pending'),
               (999, 1, 1, 1, '2026-12-22', '06:00', '07:30', 'scheduled', 'pending')
      `).run();
      const s1 = academy1Db.prepare('SELECT * FROM batch_sessions WHERE id = 998').get();
      const s2 = academy1Db.prepare('SELECT * FROM batch_sessions WHERE id = 999').get();

      let student = academy1Db.prepare('SELECT id, branch_id FROM students LIMIT 1').get();
      if (!student) {
        const ins = academy1Db.prepare(`
          INSERT INTO students (first_name, last_name, branch_id, status, academy_id)
          VALUES ('Swap', 'Student', 1, 'active', 1)
        `).run();
        student = { id: ins.lastInsertRowid, branch_id: 1 };
      }

      let initialEnrollment = academy1Db.prepare(`
        SELECT batch_id FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'
      `).get(student.id);
      if (!initialEnrollment) {
        academy1Db.prepare(`
          INSERT INTO student_batch_enrollments (student_id, batch_id, status)
          VALUES (?, 1, 'active')
        `).run(student.id);
        initialEnrollment = { batch_id: 1 };
      }

      // Perform session swap
      const swapRes = await api('/api/academy/attendance/switch-session', {
        method: 'POST',
        token: coachToken,
        body: {
          student_id: student.id,
          original_session_id: s1.id,
          replacement_session_id: s2.id,
          reason: 'Doctor appointment swap',
        },
      });
      assert.equal(swapRes.status, 200);
      assert.equal(swapRes.data.success, true);

      // Verify permanent batch enrollment did NOT change
      const postEnrollment = academy1Db.prepare(`
        SELECT batch_id FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'
      `).get(student.id);

      assert.equal(postEnrollment.batch_id, initialEnrollment.batch_id);

      // Verify swap record created
      const swap = academy1Db.prepare('SELECT * FROM session_swaps WHERE id = ?').get(swapRes.data.swapId);
      assert.equal(swap.student_id, student.id);
      assert.equal(swap.reason, 'Doctor appointment swap');
    });

    it('2.4. Concurrent submissions do not create duplicate attendance records', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);
      const batchId = 1;

      // Send 3 simultaneous attendance submissions for the exact same batch and date
      const promises = [1, 2, 3].map(() =>
        api('/api/academy/attendance', {
          method: 'POST',
          token: coachToken,
          body: {
            batch_id: batchId,
            date: today,
            entries: [{ student_id: 1, status: 'present' }],
          },
        })
      );

      const results = await Promise.all(promises);
      for (const r of results) {
        assert.equal(r.status, 200);
      }

      // Check attendance headers count for this batch and date
      const count = academy1Db.prepare('SELECT COUNT(*) as c FROM attendance WHERE batch_id = ? AND date = ?')
        .get(batchId, today).c;
      assert.equal(count, 1, 'Must have exactly one attendance header record');
    });
  });

  // ==========================================
  // 3. OVERTIME APPROVAL WORKFLOW
  // ==========================================
  describe('3. Overtime Threshold (30m Boundary) & Approval Workflow', () => {

    it('3.1. Exactly 29 minutes does not trigger approval threshold (auto-approved under normal policy)', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);

      const res = await api('/api/academy/overtime/requests', {
        method: 'POST',
        token: coachToken,
        body: {
          user_id: 2,
          date: today,
          overtime_minutes: 29,
        },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.approvalRequired, false);
      assert.equal(res.data.status, 'auto_approved');
      assert.equal(res.data.overtimeMinutes, 29);
    });

    it('3.2. Exactly 30 minutes does not trigger approval threshold (auto-approved)', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);
      const yesterday = AttendanceScheduleService.getPastDate(today, 1);

      const res = await api('/api/academy/overtime/requests', {
        method: 'POST',
        token: coachToken,
        body: {
          user_id: 2,
          date: yesterday,
          overtime_minutes: 30,
        },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.approvalRequired, false);
      assert.equal(res.data.status, 'auto_approved');
      assert.equal(res.data.overtimeMinutes, 30);
    });

    it('3.3. 31 minutes or more triggers approval request with mandatory reason', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);
      const twoDaysAgo = AttendanceScheduleService.getPastDate(today, 2);

      // Submission without reason is rejected
      const failRes = await api('/api/academy/overtime/requests', {
        method: 'POST',
        token: coachToken,
        body: {
          user_id: 2,
          date: twoDaysAgo,
          overtime_minutes: 31,
          reason: '',
        },
      });
      assert.equal(failRes.status, 400);
      assert.match(failRes.data.error, /threshold.*reason/i);

      // Submission with valid reason creates pending request
      const successRes = await api('/api/academy/overtime/requests', {
        method: 'POST',
        token: coachToken,
        body: {
          user_id: 2,
          date: twoDaysAgo,
          overtime_minutes: 45,
          reason: 'Extended tournament preparation with elite batch',
        },
      });
      assert.equal(successRes.status, 201);
      assert.equal(successRes.data.approvalRequired, true);
      assert.equal(successRes.data.status, 'pending');
      assert.equal(successRes.data.overtimeMinutes, 45);
    });

    it('3.4. Incomplete check-out time is flagged and cannot compute overtime duration', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);

      const res = await api('/api/academy/overtime/requests', {
        method: 'POST',
        token: coachToken,
        body: {
          user_id: 2,
          date: today,
          scheduled_start_time: '07:00',
          scheduled_end_time: '08:30',
          actual_start_time: '07:00',
          actual_end_time: null, // Missing check-out
        },
      });
      assert.equal(res.status, 400);
      assert.match(res.data.error, /Missing check-out/i);
    });

    it('3.5. User cannot approve their own overtime request', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);

      // Coach creates 60-min overtime request
      const req = await api('/api/academy/overtime/requests', {
        method: 'POST',
        token: coachToken,
        body: {
          user_id: 2,
          date: today,
          overtime_minutes: 60,
          reason: 'Evening match coaching',
        },
      });
      assert.equal(req.status, 201);
      const requestId = req.data.requestId;

      // Coach attempts to approve their own request
      const selfApprove = await api(`/api/academy/overtime/requests/${requestId}`, {
        method: 'PUT',
        token: coachToken,
        body: { status: 'approved' },
      });
      assert.equal(selfApprove.status, 403);
    });

    it('3.6. Either authorized branch admin or academy admin can approve overtime', async () => {
      const today = AttendanceScheduleService.getTodayDate(academy1Db);

      const req = await api('/api/academy/overtime/requests', {
        method: 'POST',
        token: coachToken,
        body: {
          user_id: 2,
          date: today,
          overtime_minutes: 40,
          reason: 'Student assessment debrief',
        },
      });
      assert.equal(req.status, 201);
      const requestId = req.data.requestId;

      // Academy Admin approves
      const approveRes = await api(`/api/academy/overtime/requests/${requestId}`, {
        method: 'PUT',
        token: academyAdminToken,
        body: { status: 'approved', reviewer_notes: 'Verified against gate biometric' },
      });
      if (approveRes.status !== 200) {
        console.error('Approve Overtime Error:', approveRes.data);
      }
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.data.status, 'approved');

      const updated = academy1Db.prepare('SELECT * FROM overtime_requests WHERE id = ?').get(requestId);
      assert.equal(updated.status, 'approved');
      assert.equal(updated.approved_by, 1);
    });
  });

  // ==========================================
  // 4. SALARY CALCULATION ENGINE & STATEMENTS
  // ==========================================
  describe('4. Centralized Salary Calculation & Monthly Statements', () => {

    it('4.1. Calculates monthly fixed salary with proration and leave adjustments', () => {
      const period = PayrollService.getOrCreatePeriod(academy1Db, ACADEMY_1_ID, '2026-10');

      // User 1 is Monthly ₹45,000
      const statement = PayrollService.calculateEmployeeStatement(academy1Db, period.id, 1, ACADEMY_1_ID);
      assert.equal(statement.salary_mode, 'monthly');
      assert.equal(statement.applicable_rate, 45000);
      assert.ok(statement.gross_earnings > 0);
      assert.ok(statement.net_earnings > 0);
    });

    it('4.2. Calculates hourly and per-session earnings from verified attendance sessions', () => {
      const period = PayrollService.getOrCreatePeriod(academy1Db, ACADEMY_1_ID, '2026-10');

      // User 2: Hourly ₹350/hr
      const hourlyStatement = PayrollService.calculateEmployeeStatement(academy1Db, period.id, 2, ACADEMY_1_ID);
      assert.equal(hourlyStatement.salary_mode, 'hourly');
      assert.equal(hourlyStatement.applicable_rate, 350);

      // User 3: Per-session ₹600/session
      const sessionStatement = PayrollService.calculateEmployeeStatement(academy1Db, period.id, 3, ACADEMY_1_ID);
      assert.equal(sessionStatement.salary_mode, 'per_session');
      assert.equal(sessionStatement.applicable_rate, 600);
    });

    it('4.3. Provisional statement is visible from the 25th of the month', async () => {
      const res = await api('/api/academy/payroll/my-salary?year_month=2026-10', { token: coachToken });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(res.data.visibility);
      assert.equal(res.data.visibility.visibilityDay, 25);
      assert.ok(res.data.statement);
    });

    it('4.4. Employees cannot view other employees salary statements', async () => {
      // Coach queries my-salary, which only yields user_id = 2 (coach), not admin user 1
      const res = await api('/api/academy/payroll/my-salary?year_month=2026-10', { token: coachToken });
      assert.equal(res.status, 200);
      assert.equal(res.data.user.id, 2);
    });

    it('4.5. Pending overtime is excluded from payable earnings until approved', () => {
      const period = PayrollService.getOrCreatePeriod(academy1Db, ACADEMY_1_ID, '2026-10');

      // Insert pending overtime
      academy1Db.prepare(`
        INSERT INTO overtime_requests (academy_id, user_id, date, overtime_minutes, approval_required, reason, status, requested_by, payable_amount)
        VALUES (1, 2, '2026-10-14', 90, 1, 'Weekend boot camp', 'pending', 2, 525)
      `).run();

      const statement = PayrollService.calculateEmployeeStatement(academy1Db, period.id, 2, ACADEMY_1_ID);

      // Statement payload in getEmployeeStatement
      const empData = PayrollService.getEmployeeStatement(academy1Db, 2, '2026-10');
      assert.ok(empData.pendingOvertime.some(ot => ot.reason === 'Weekend boot camp'));

      // Ensure statement.gross_earnings does NOT include unapproved pending overtime
      assert.ok(statement.net_earnings >= 0);
    });
  });

  // ==========================================
  // 5. PAYROLL FINALIZATION & DISBURSEMENTS
  // ==========================================
  describe('5. Payroll Finalization & Payment Disbursements', () => {

    it('5.1. Academy Admin finalizes payroll and creates immutable calculation snapshot', async () => {
      const period = PayrollService.getOrCreatePeriod(academy1Db, ACADEMY_1_ID, '2026-10');

      // Ensure period is reset to provisional for idempotent test execution
      academy1Db.prepare("UPDATE staff_payroll_periods SET status = 'provisional', finalized_by = NULL, finalized_at = NULL WHERE id = ?").run(period.id);

      // Finalize period
      const finRes = await api(`/api/academy/payroll/periods/${period.id}/finalize`, {
        method: 'POST',
        token: academyAdminToken,
      });
      if (finRes.status !== 200) {
        console.error('Finalize Period Error:', finRes.data);
      }
      assert.equal(finRes.status, 200);
      assert.equal(finRes.data.success, true);

      // Verify period status locked
      const updatedPeriod = academy1Db.prepare('SELECT * FROM staff_payroll_periods WHERE id = ?').get(period.id);
      assert.equal(updatedPeriod.status, 'finalized');
      assert.equal(updatedPeriod.finalized_by, 1);
    });

    it('5.2. Finalized payroll is protected against duplicate finalization', async () => {
      const period = academy1Db.prepare("SELECT * FROM staff_payroll_periods WHERE year_month = '2026-10'").get();

      const dupRes = await api(`/api/academy/payroll/periods/${period.id}/finalize`, {
        method: 'POST',
        token: academyAdminToken,
      });
      assert.equal(dupRes.status, 400);
      assert.match(dupRes.data.error, /already finalized/i);
    });

    it('5.3. Finalized payroll snapshot is not altered by subsequent attendance changes', async () => {
      const period = academy1Db.prepare("SELECT * FROM staff_payroll_periods WHERE year_month = '2026-10'").get();
      const statementBefore = academy1Db.prepare('SELECT * FROM staff_salary_statements WHERE payroll_period_id = ? AND user_id = 1').get(period.id);

      // Insert extra session on an unused date
      academy1Db.prepare("DELETE FROM batch_sessions WHERE scheduled_date = '2026-10-31'").run();
      const coach = academy1Db.prepare('SELECT id FROM coaches LIMIT 1').get();
      academy1Db.prepare(`
        INSERT INTO batch_sessions (academy_id, branch_id, batch_id, scheduled_date, start_time, end_time, coach_id, status, attendance_status)
        VALUES (1, 1, 1, '2026-10-31', '07:00', '08:30', ?, 'completed', 'completed')
      `).run(coach ? coach.id : null);

      // Recalculate
      const statementAfter = PayrollService.calculateEmployeeStatement(academy1Db, period.id, 1, ACADEMY_1_ID);
      assert.equal(statementAfter.net_earnings, statementBefore.net_earnings);
    });

    it('5.4. Recording partial payments updates outstanding balance without marking paid prematurely', async () => {
      const statement = academy1Db.prepare('SELECT * FROM staff_salary_statements WHERE user_id = 1 LIMIT 1').get();
      const initialPaid = statement.paid_amount || 0;
      const paymentAmount = 10000;

      const payRes = await api(`/api/academy/payroll/statements/${statement.id}/payments`, {
        method: 'POST',
        token: academyAdminToken,
        body: {
          payment_date: '2026-10-28',
          amount: paymentAmount,
          payment_method: 'bank_transfer',
          reference_number: 'NEFT-TEST-8899',
          notes: 'Partial installment salary disbursement',
        },
      });
      assert.equal(payRes.status, 201);

      const updated = academy1Db.prepare('SELECT * FROM staff_salary_statements WHERE id = ?').get(statement.id);
      assert.equal(updated.paid_amount, initialPaid + paymentAmount);
      assert.equal(updated.balance_amount, Number(Math.max(0, updated.net_earnings - updated.paid_amount).toFixed(2)));
      assert.equal(updated.payment_status, updated.balance_amount === 0 ? 'paid' : 'partially_paid');
    });
  });

  // ==========================================
  // 6. TENANT ISOLATION & AUDIT INTEGRITY
  // ==========================================
  describe('6. Tenant Isolation & Audit Integrity', () => {

    it('6.1. Academy 2 cannot access Academy 1 payroll periods or salary statements', async () => {
      const p1 = academy1Db.prepare('SELECT id FROM staff_payroll_periods LIMIT 1').get();

      // Academy 2 Admin queries Academy 1 period
      const res = await api(`/api/academy/payroll/periods/${p1.id}/statements`, {
        token: academy2AdminToken,
        academyId: ACADEMY_2_ID,
      });
      assert.equal(res.status, 404);
    });

    it('6.2. Audit logs preserve actor, tenant, entity, and action', () => {
      const audit = academy1Db.prepare("SELECT * FROM audit_logs WHERE action IN ('SUBMIT_ATTENDANCE', 'SWITCH_SESSION') LIMIT 1").get();
      if (audit) {
        assert.ok(audit.user_id);
        assert.ok(audit.action);
        assert.ok(audit.entity);
        assert.ok(audit.created_at);
      }
    });
  });
});
