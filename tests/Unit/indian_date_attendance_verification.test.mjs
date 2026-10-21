import { describe, it } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { AttendanceScheduleService } from '../../src/services/attendanceScheduleService.js';

describe('Indian Date Attendance Verification (DD/MM/YYYY)', () => {
  const db = new Database(':memory:');

  db.exec(`
    CREATE TABLE academy_policy_settings (
      attendance_cutoff_days INTEGER DEFAULT 2,
      allow_future_attendance INTEGER DEFAULT 0
    );
    INSERT INTO academy_policy_settings (attendance_cutoff_days, allow_future_attendance) VALUES (2, 0);

    CREATE TABLE tenant_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  it('1. validateAttendanceDate accepts ISO YYYY-MM-DD today', () => {
    const today = AttendanceScheduleService.getTodayDate();
    const result = AttendanceScheduleService.validateAttendanceDate(db, today);
    assert.strictEqual(result.allowed, true);
  });

  it('2. validateAttendanceDate accepts Indian standard DD/MM/YYYY for today', () => {
    const today = AttendanceScheduleService.getTodayDate();
    const [y, m, d] = today.split('-');
    const indianDate = `${d}/${m}/${y}`;
    const result = AttendanceScheduleService.validateAttendanceDate(db, indianDate);
    assert.strictEqual(result.allowed, true);
  });

  it('3. validateAttendanceDate normalizes past dates within 2-day window', () => {
    const pastDate = AttendanceScheduleService.getPastDate(AttendanceScheduleService.getTodayDate(), 1);
    const [y, m, d] = pastDate.split('-');
    const indianDate = `${d}/${m}/${y}`;
    const result = AttendanceScheduleService.validateAttendanceDate(db, indianDate);
    assert.strictEqual(result.allowed, true);
  });

  it('4. validateAttendanceDate correctly rejects future date formatted as DD/MM/YYYY', () => {
    const futureDate = AttendanceScheduleService.getFutureDate(AttendanceScheduleService.getTodayDate(), 5);
    const [y, m, d] = futureDate.split('-');
    const indianDate = `${d}/${m}/${y}`;
    const result = AttendanceScheduleService.validateAttendanceDate(db, indianDate);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.code, 'FUTURE_DATE_REJECTED');
  });

  it('5. normalizeDate helper handles various formats', () => {
    assert.strictEqual(AttendanceScheduleService.normalizeDate('22/10/2026'), '2026-10-22');
    assert.strictEqual(AttendanceScheduleService.normalizeDate('2026-10-22'), '2026-10-22');
    assert.strictEqual(AttendanceScheduleService.normalizeDate('05/01/2025'), '2025-01-05');
  });
});
