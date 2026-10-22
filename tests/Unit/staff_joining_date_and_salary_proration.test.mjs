import test from 'node:test';
import assert from 'node:assert/strict';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { ScheduleService } from '../../src/services/scheduleService.js';
import { PayrollService } from '../../src/services/payrollService.js';
import { UserService } from '../../src/services/userService.js';
import { getCentralDb } from '../../src/db/centralDb.js';

test('Staff Joining Date & Salary Proration Verification', async (t) => {
  const db = getTenantDbById(1);
  const centralDb = getCentralDb();
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonth = todayStr.slice(0, 7);

  let testUserId = null;
  let testCoachId = null;

  await t.test('1. Onboard staff with joining_date today: persists in both employment_records and coaches', () => {
    const email = `test_coach_${Date.now()}@example.com`;
    const res = UserService.createStaffUser(db, centralDb, 1, {
      name: 'Pooja Sharma',
      email,
      phone: '9876543210',
      password: 'password123',
      role: 'coach',
      branch_id: 1,
      joining_date: todayStr,
      designation: 'Senior Instructor',
      salary_amount: 30000,
      compensation_mode: 'monthly',
    });

    testUserId = res.userId;
    testCoachId = res.coachId;

    assert.ok(testUserId, 'User ID should be generated');
    assert.ok(testCoachId, 'Coach ID should be generated');

    const emp = db.prepare('SELECT * FROM employment_records WHERE user_id = ?').get(testUserId);
    assert.equal(emp.joining_date, todayStr, 'Employment record should store joining_date');

    const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(testCoachId);
    assert.equal(coach.joining_date, todayStr, 'Coach table should store joining_date');
  });

  await t.test('2. Schedule expected hours prior to joining_date are not counted as working days', () => {
    const period = PayrollService.getOrCreatePeriod(db, 1, currentMonth);
    const scheduleSummary = ScheduleService.calculateExpectedHoursForPeriod(
      db, testUserId, period.start_date, period.end_date, todayStr
    );

    // Filter days before joining date
    const daysBefore = scheduleSummary.dayBreakdown.filter(d => d.date < todayStr);
    for (const d of daysBefore) {
      assert.equal(d.dayType, 'not_employed', `Day ${d.date} before joining should be not_employed`);
      assert.equal(d.isWorkingDay, false, `Day ${d.date} should not be marked as working day`);
    }

    assert.ok(scheduleSummary.scheduledWorkingDays <= 31, 'Scheduled working days should only span from joining date onward');
  });

  await t.test('3. Employee statement for staff added today has 0 absent days and no false absence deductions', () => {
    const statementData = PayrollService.getEmployeeStatement(db, testUserId, currentMonth);

    assert.equal(statementData.attendanceSummary.absentDays, 0, 'Absent days must be 0 for user joined today');

    const todayCell = statementData.calendarDays.find(d => d.date === todayStr);
    assert.ok(todayCell, 'Today cell must exist');
    assert.notEqual(todayCell.status, 'absent', 'Today must not be marked as absent');
    assert.equal(todayCell.status, 'shift_pending', 'Today should have shift_pending status');

    const daysBefore = statementData.calendarDays.filter(d => d.date < todayStr);
    for (const d of daysBefore) {
      assert.equal(d.status, 'not_employed', `Day ${d.date} prior to joining must be not_employed`);
      assert.notEqual(d.status, 'absent', `Day ${d.date} prior to joining must never be absent`);
    }

    assert.ok(statementData.statement.gross_earnings > 0, 'Prorated salary must be > 0 and not wiped out by fake absences');
  });
});
