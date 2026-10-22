import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { DateUtils } from '../../src/utils/dateUtils.js';
import { FeeService } from '../../src/services/feeService.js';
import { LeaveService } from '../../src/services/leaveService.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';

describe('System-Wide Date Format Audit & Compliance (DD/MM/YYYY)', () => {
  let server;
  let baseUrl;
  let tenantDb;
  let adminToken;
  let studentToken;
  let studentId;
  const ACADEMY_ID = 1;

  before(async () => {
    process.env.NODE_ENV = 'test';
    tenantDb = getTenantDbById(ACADEMY_ID);

    // Clean up test dates
    tenantDb.prepare("DELETE FROM academy_holidays WHERE name LIKE 'DateTest%'").run();
    tenantDb.prepare("DELETE FROM events WHERE title LIKE 'DateTest%'").run();
    tenantDb.prepare("DELETE FROM students WHERE email LIKE '%@datetest.com'").run();
    tenantDb.prepare("DELETE FROM leave_requests WHERE reason LIKE '%Personal work%' OR reason LIKE '%School tournament%'").run();
    tenantDb.prepare("DELETE FROM fee_pause_requests WHERE reason LIKE '%Medical recovery%'").run();

    // Query an existing student or create a test one
    let student = tenantDb.prepare('SELECT id, email, first_name, last_name FROM students WHERE status = ? LIMIT 1').get('active');
    if (!student) {
      const ins = tenantDb.prepare(`
        INSERT INTO students (student_code, first_name, last_name, date_of_birth, gender, email, phone, branch_id, status)
        VALUES ('DT-001', 'Date', 'Tester', '2012-05-15', 'male', 'datetester@datetest.com', '9876543210', 1, 'active')
      `).run();
      studentId = ins.lastInsertRowid;
      student = { id: studentId, email: 'datetester@datetest.com', first_name: 'Date', last_name: 'Tester' };
    } else {
      studentId = student.id;
    }

    adminToken = signToken({
      userId: 1,
      email: 'admin@mahavirsportsacademy.com',
      role: 'academy_admin',
      name: 'Admin User',
      academyId: ACADEMY_ID,
      permissions: [
        'students.view', 'students.create', 'students.update', 'students.delete', 'students.import', 'students.export',
        'view_students', 'manage_students',
        'fees.view', 'fees.collect', 'fees.create', 'fees.pause',
        'attendance.view', 'attendance.mark',
        'leaves.view', 'leaves.apply', 'leaves.approve',
        'holidays.view', 'holidays.create',
        'events.view', 'events.create'
      ]
    });

    studentToken = signToken({
      userId: student.id,
      studentId: student.id,
      email: student.email,
      role: 'student',
      academyId: ACADEMY_ID,
      name: `${student.first_name} ${student.last_name}`
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

  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Host': 'academy-1.localhost',
      'Authorization': `Bearer ${adminToken}`,
      ...(options.headers || {})
    };
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, data: json };
  }

  // =========================================================================
  // 1. Core Parsing & Disambiguation Rules
  // =========================================================================
  describe('1. Parsing & Disambiguation Rules', () => {
    it('05/11/2026 must NEVER become May 11, 2026. Must strictly normalize to 2026-11-05 (Nov 5)', () => {
      const normalized = DateUtils.parseAndNormalizeDate('05/11/2026');
      assert.equal(normalized, '2026-11-05');
      const display = DateUtils.formatDisplayDate(normalized);
      assert.equal(display, '05/11/2026');
    });

    it('11/05/2026 must strictly normalize to 2026-05-11 (May 11)', () => {
      const normalized = DateUtils.parseAndNormalizeDate('11/05/2026');
      assert.equal(normalized, '2026-05-11');
      const display = DateUtils.formatDisplayDate(normalized);
      assert.equal(display, '11/05/2026');
    });

    it('23/10/2026 (day > 12) parses cleanly to 2026-10-23 without Invalid Date error', () => {
      const normalized = DateUtils.parseAndNormalizeDate('23/10/2026');
      assert.equal(normalized, '2026-10-23');
      const display = DateUtils.formatDisplayDate(normalized);
      assert.equal(display, '23/10/2026');
    });

    it('01/02/2026 must be February 1, 2026 (2026-02-01)', () => {
      const normalized = DateUtils.parseAndNormalizeDate('01/02/2026');
      assert.equal(normalized, '2026-02-01');
      const display = DateUtils.formatDisplayDate(normalized);
      assert.equal(display, '01/02/2026');
    });
  });

  // =========================================================================
  // 2. Leap Year & Calendar Day Validity Checks
  // =========================================================================
  describe('2. Leap Year & Calendar Day Validity Checks', () => {
    it('29/02/2024 (leap year) must be ACCEPTED and normalize to 2024-02-29', () => {
      assert.equal(DateUtils.isLeapYear(2024), true);
      assert.equal(DateUtils.getDaysInMonth(2024, 2), 29);
      const normalized = DateUtils.parseAndNormalizeDate('29/02/2024');
      assert.equal(normalized, '2024-02-29');
    });

    it('29/02/2026 (non-leap year) must be strictly REJECTED with descriptive error', () => {
      assert.equal(DateUtils.isLeapYear(2026), false);
      assert.equal(DateUtils.getDaysInMonth(2026, 2), 28);
      assert.throws(() => {
        DateUtils.parseAndNormalizeDate('29/02/2026');
      }, /not a valid leap year date|only has 28 days/);
    });

    it('31/04/2026 (April has 30 days) must be strictly REJECTED', () => {
      assert.equal(DateUtils.getDaysInMonth(2026, 4), 30);
      assert.throws(() => {
        DateUtils.parseAndNormalizeDate('31/04/2026');
      }, /only has 30 days/);
    });

    it('31/02/2026 (February never has 31 days) must be strictly REJECTED', () => {
      assert.throws(() => {
        DateUtils.parseAndNormalizeDate('31/02/2026');
      }, /only has 28 days/);
    });
  });

  // =========================================================================
  // 3. Nullable & Empty Date Handling
  // =========================================================================
  describe('3. Nullable & Empty Date Handling', () => {
    it('Empty optional date strings ("") must return null, not throw or save 1970-01-01', () => {
      const res = DateUtils.parseAndNormalizeDate('', { optional: true });
      assert.equal(res, null);
    });

    it('null or undefined optional dates must return null', () => {
      assert.equal(DateUtils.parseAndNormalizeDate(null, { optional: true }), null);
      assert.equal(DateUtils.parseAndNormalizeDate(undefined, { optional: true }), null);
    });

    it('00/00/0000 or 0000-00-00 must be rejected or cleaned to null', () => {
      assert.throws(() => {
        DateUtils.parseAndNormalizeDate('00/00/0000', { optional: false });
      }, /Invalid date format|Invalid month/);

      assert.equal(DateUtils.parseAndNormalizeDate('00/00/0000', { optional: true }), null);
      assert.equal(DateUtils.parseAndNormalizeDate('0000-00-00', { optional: true }), null);
    });
  });

  // =========================================================================
  // 4. Range Validation & Chronological Boundaries
  // =========================================================================
  describe('4. Range Validation & Chronological Boundaries', () => {
    it('end_date < start_date must fail gracefully', () => {
      assert.throws(() => {
        DateUtils.validateDateRange('15/10/2026', '10/10/2026');
      }, /cannot be before start date/);
    });

    it('single-day ranges: start_date == end_date must be valid', () => {
      assert.doesNotThrow(() => {
        DateUtils.validateDateRange('15/10/2026', '15/10/2026');
      });
      const range = DateUtils.getDateRange('2026-10-15', '2026-10-15');
      assert.deepEqual(range, ['2026-10-15']);
      assert.equal(range.length, 1);
    });

    it('inclusive multi-day range generates full sequence', () => {
      const range = DateUtils.getDateRange('2026-10-01', '2026-10-05');
      assert.deepEqual(range, [
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
        '2026-10-05'
      ]);
      assert.equal(range.length, 5);
    });
  });

  // =========================================================================
  // 5. Calendar Arithmetic Clamping & Safe Increment
  // =========================================================================
  describe('5. Calendar Arithmetic Clamping & Safe Increment', () => {
    it('Date arithmetic: adding 1 month to 31/01/2026 produces 28/02/2026 (clamped, not March 3)', () => {
      const res = FeeService.addCalendarMonths('2026-01-31', 1);
      assert.equal(res.nextInstallmentDate, '2026-02-28');
      assert.equal(res.periodEnd, '2026-02-27');
    });

    it('Date arithmetic: adding 1 month to 31/08/2026 produces 30/09/2026 (clamped, not Oct 1)', () => {
      const res = FeeService.addCalendarMonths('2026-08-31', 1);
      assert.equal(res.nextInstallmentDate, '2026-09-30');
      assert.equal(res.periodEnd, '2026-09-29');
    });

    it('Date arithmetic: leap year 31/01/2028 + 1 month produces 29/02/2028', () => {
      const res = FeeService.addCalendarMonths('2028-01-31', 1);
      assert.equal(res.nextInstallmentDate, '2028-02-29');
      assert.equal(res.periodEnd, '2028-02-28');
    });
  });

  // =========================================================================
  // 6. Timezone Safety: Date Stored as 2026-11-05 Renders as 05/11/2026
  // =========================================================================
  describe('6. Timezone-Safe Formatting', () => {
    it('date stored as 2026-11-05 renders as 05/11/2026 in ALL timezones, NEVER 04/11 or 06/11', () => {
      const iso = '2026-11-05';
      const formatted = DateUtils.formatDisplayDate(iso);
      assert.equal(formatted, '05/11/2026');

      const isoWithZ = '2026-11-05T00:00:00.000Z';
      assert.equal(DateUtils.formatDisplayDate(isoWithZ), '05/11/2026');

      const isoWithOffset = '2026-11-05T23:59:59+05:30';
      assert.equal(DateUtils.formatDisplayDate(isoWithOffset), '05/11/2026');
    });
  });

  // =========================================================================
  // 7. Student Registration Module End-to-End
  // =========================================================================
  describe('7. Student Registration Module End-to-End', () => {
    let newStudentId;

    it('creates student with date_of_birth as 05/11/2010; stored as 2010-11-05 and retrieved cleanly', async () => {
      const res = await api('/api/academy/students', {
        method: 'POST',
        body: {
          first_name: 'Aditya',
          last_name: 'Verma',
          date_of_birth: '05/11/2010', // User sends DD/MM/YYYY
          gender: 'male',
          email: 'aditya.verma.date@datetest.com',
          phone: '9898012345',
          branch_id: 1,
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      newStudentId = res.data.studentId;
      assert.ok(newStudentId);

      // Verify database stored representation is strictly normalized ISO YYYY-MM-DD
      const row = tenantDb.prepare('SELECT date_of_birth FROM students WHERE id = ?').get(newStudentId);
      assert.equal(row.date_of_birth, '2010-11-05');

      // Verify formatted output
      assert.equal(DateUtils.formatDisplayDate(row.date_of_birth), '05/11/2010');
    });

    it('rejects student creation if date_of_birth is impossible (e.g. 31/02/2010)', async () => {
      const res = await api('/api/academy/students', {
        method: 'POST',
        body: {
          first_name: 'Bad',
          last_name: 'Date',
          date_of_birth: '31/02/2010',
          gender: 'female',
          email: 'bad.date@datetest.com',
          phone: '9898099999',
          branch_id: 1,
        }
      });

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
    });
  });

  // =========================================================================
  // 8. Holidays Management Module
  // =========================================================================
  describe('8. Holidays Management Module', () => {
    it('adds single holiday with 15/08/2026: stores as 2026-08-15', async () => {
      const res = await api('/api/academy/holidays', {
        method: 'POST',
        body: {
          branch_id: 1,
          name: 'DateTest Independence Day',
          holiday_date: '15/08/2026',
          description: 'National holiday'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);

      const row = tenantDb.prepare('SELECT holiday_date FROM academy_holidays WHERE id = ?').get(res.data.holidayId);
      assert.equal(row.holiday_date, '2026-08-15');
      assert.equal(DateUtils.formatDisplayDate(row.holiday_date), '15/08/2026');
    });

    it('adds holiday date range from 24/10/2026 to 26/10/2026 (3 days): stores distinct YYYY-MM-DD records', async () => {
      const res = await api('/api/academy/holidays', {
        method: 'POST',
        body: {
          branch_id: 1,
          name: 'DateTest Diwali Festival Break',
          start_date: '24/10/2026',
          end_date: '26/10/2026',
          description: 'Academy closed for festivities'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.daysCount, 3);

      const rows = tenantDb.prepare("SELECT holiday_date FROM academy_holidays WHERE name = 'DateTest Diwali Festival Break' ORDER BY holiday_date ASC").all();
      assert.equal(rows.length, 3);
      assert.deepEqual(rows.map(r => r.holiday_date), ['2026-10-24', '2026-10-25', '2026-10-26']);
    });
  });

  // =========================================================================
  // 9. Staff & Student Leaves Module
  // =========================================================================
  describe('9. Leaves Management Module', () => {
    it('Leave request with 01/10/2026 to 05/10/2026 calculates exactly 5 days', async () => {
      const daysCount = DateUtils.calculateInclusiveDays('01/10/2026', '05/10/2026');
      assert.equal(daysCount, 5);

      const res = await api('/api/academy/leaves', {
        method: 'POST',
        body: {
          user_id: 1,
          leave_type: 'casual',
          start_date: '01/10/2026',
          end_date: '05/10/2026',
          reason: 'Personal work'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      // 5 calendar days with 1 Sunday weekly off = 4 chargeable working days
      assert.equal(res.data.daysCount, 4);

      const row = tenantDb.prepare('SELECT start_date, end_date FROM leave_requests WHERE id = ?').get(res.data.leaveId);
      assert.equal(row.start_date, '2026-10-01');
      assert.equal(row.end_date, '2026-10-05');
    });

    it('rejects leave request when end_date is before start_date (e.g. 05/10/2026 to 01/10/2026)', async () => {
      const res = await api('/api/academy/leaves', {
        method: 'POST',
        body: {
          user_id: 1,
          leave_type: 'casual',
          start_date: '05/10/2026',
          end_date: '01/10/2026',
          reason: 'Impossible timeline'
        }
      });

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
    });

    it('student portal self-service leave accepts DD/MM/YYYY and normalizes cleanly', async () => {
      const res = await fetch(`${baseUrl}/api/student/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': 'academy-1.localhost',
          'Authorization': `Bearer ${studentToken}`
        },
        body: JSON.stringify({
          start_date: '12/11/2026',
          end_date: '14/11/2026',
          reason: 'School tournament travel'
        })
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);

      const row = tenantDb.prepare("SELECT start_date, end_date FROM leave_requests WHERE applicant_type = 'student' AND applicant_id = ? ORDER BY id DESC LIMIT 1").get(studentId);
      assert.equal(row.start_date, '2026-11-12');
      assert.equal(row.end_date, '2026-11-14');
    });
  });

  // =========================================================================
  // 10. Fee Collection & Billing Module
  // =========================================================================
  describe('10. Fee Collection & Invoicing Module', () => {
    let collectedFeeId;
    let collectedPaymentId;

    it('collects fee with start_date as 01/12/2026 and months_count 3: period_end 28/02/2027 and nextInstallment 01/03/2027', async () => {
      const res = await api('/api/academy/fees/collect', {
        method: 'POST',
        body: {
          student_id: studentId,
          start_date: '01/12/2026',
          months_count: 3,
          payment_mode: 'upi',
          transaction_reference: 'UPI-REF-998877'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      collectedFeeId = res.data.feeId;
      collectedPaymentId = res.data.paymentId;

      const row = tenantDb.prepare('SELECT period_start, period_end, next_installment_date FROM student_fees WHERE id = ?').get(collectedFeeId);
      assert.equal(row.period_start, '2026-12-01');
      assert.equal(row.period_end, '2027-02-28');
      assert.equal(row.next_installment_date, '2027-03-01');

      assert.equal(DateUtils.formatDisplayDate(row.period_start), '01/12/2026');
      assert.equal(DateUtils.formatDisplayDate(row.period_end), '28/02/2027');
      assert.equal(DateUtils.formatDisplayDate(row.next_installment_date), '01/03/2027');
    });

    it('verifies fee payment record has payment_date normalized to YYYY-MM-DD and formatted to DD/MM/YYYY', async () => {
      const payment = tenantDb.prepare('SELECT payment_date FROM fee_payments WHERE id = ?').get(collectedPaymentId);
      assert.ok(payment);
      assert.match(payment.payment_date, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(DateUtils.formatDisplayDate(payment.payment_date), /^\d{2}\/\d{2}\/\d{4}$/);
    });

    it('submits fee pause with 10/01/2027 to 25/01/2027; normalizes cleanly in fee_pause_requests', async () => {
      const res = await api('/api/academy/fees/pauses', {
        method: 'POST',
        body: {
          student_id: studentId,
          pause_type: 'fee_pause',
          requested_start_date: '10/01/2027',
          requested_end_date: '25/01/2027',
          reason: 'Medical recovery'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);

      const pauseId = res.data.pauseId || (res.data.pause && res.data.pause.id);
      const pause = tenantDb.prepare('SELECT requested_start_date, requested_end_date FROM fee_pause_requests WHERE id = ?').get(pauseId);
      assert.equal(pause.requested_start_date, '2027-01-10');
      assert.equal(pause.requested_end_date, '2027-01-25');
    });
  });

  // =========================================================================
  // 11. Events Module
  // =========================================================================
  describe('11. Events Management Module', () => {
    it('creates championship event with event_date 05/11/2026 and event_end_date 07/11/2026', async () => {
      const res = await api('/api/academy/events', {
        method: 'POST',
        body: {
          title: 'DateTest Championship 2026',
          event_type: 'tournament',
          description: 'Annual inter-dojo championship',
          event_date: '05/11/2026',
          event_end_date: '07/11/2026',
          venue: 'City Indoor Stadium',
          fee: 500,
          max_participants: 100
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);

      const event = tenantDb.prepare('SELECT event_date, event_end_date FROM events WHERE id = ?').get(res.data.eventId);
      assert.equal(event.event_date, '2026-11-05');
      assert.equal(event.event_end_date, '2026-11-07');
    });

    it('rejects event creation when event_end_date < event_date', async () => {
      const res = await api('/api/academy/events', {
        method: 'POST',
        body: {
          title: 'DateTest Invalid Date Tournament',
          event_type: 'tournament',
          event_date: '10/11/2026',
          event_end_date: '08/11/2026',
          venue: 'Main Dojo'
        }
      });

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      assert.match(res.data.error, /cannot be before/i);
    });
  });

  // =========================================================================
  // 12. Bulk CSV Import Validation
  // =========================================================================
  describe('12. Bulk CSV Import Validation', () => {
    it('imports students from CSV with DD/MM/YYYY dates and stores as YYYY-MM-DD', async () => {
      const csvData = [
        {
          first_name: 'Reyansh',
          last_name: 'Joshi',
          date_of_birth: '23/10/2012',
          gender: 'male',
          email: 'reyansh@datetest.com',
          phone: '9898011111',
          branch_id: 1,
        },
        {
          first_name: 'Ananya',
          last_name: 'Deshmukh',
          date_of_birth: '05/11/2011', // Nov 5
          gender: 'female',
          email: 'ananya@datetest.com',
          phone: '9898022222',
          branch_id: 1,
        }
      ];

      const res = await api('/api/academy/students/import', {
        method: 'POST',
        body: {
          students: csvData
        }
      });

      assert.ok([200, 201].includes(res.status));
      assert.equal(res.data.success, true);
      assert.equal(res.data.importedCount, 2);

      const reyansh = tenantDb.prepare('SELECT date_of_birth FROM students WHERE email = ?').get('reyansh@datetest.com');
      assert.equal(reyansh.date_of_birth, '2012-10-23');

      const ananya = tenantDb.prepare('SELECT date_of_birth FROM students WHERE email = ?').get('ananya@datetest.com');
      assert.equal(ananya.date_of_birth, '2011-11-05');
    });

    it('rejects bulk import row containing invalid calendar date (e.g. 29/02/2026)', async () => {
      const csvData = [
        {
          first_name: 'Invalid',
          last_name: 'Leap',
          date_of_birth: '29/02/2026',
          gender: 'male',
          email: 'invalid.leap@datetest.com',
          phone: '9898033333',
          branch_id: 1,
        }
      ];

      const res = await api('/api/academy/students/import', {
        method: 'POST',
        body: {
          students: csvData
        }
      });

      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      assert.match(res.data.error, /Row 1: Invalid date/);
    });
  });

  // =========================================================================
  // 13. Roster Export & User-Facing Output
  // =========================================================================
  describe('13. Roster Export & User-Facing Output', () => {
    it('exports students with date_of_birth formatted as DD/MM/YYYY in CSV format', async () => {
      const res = await api('/api/academy/students/export');
      assert.equal(res.status, 200);
      const csv = res.data.raw;
      assert.ok(csv.includes('DOB') || csv.includes('Date of Birth'));
      assert.ok(csv.includes('23/10/2012')); // Reyansh Joshi
      assert.ok(csv.includes('05/11/2011')); // Ananya Deshmukh
      // Ensure no raw ISO appears in the CSV export date column for these records
      assert.equal(csv.includes('2012-10-23'), false);
      assert.equal(csv.includes('2011-11-05'), false);
    });
  });

  // =========================================================================
  // 14. Filter Queries & Range Matching
  // =========================================================================
  describe('14. Filter Queries & Database Date Consistency', () => {
    it('WHERE date BETWEEN YYYY-MM-DD AND YYYY-MM-DD returns exact records without boundary loss', () => {
      const records = tenantDb.prepare(`
        SELECT holiday_date FROM academy_holidays
        WHERE holiday_date BETWEEN '2026-10-24' AND '2026-10-26' AND name LIKE 'DateTest%'
        ORDER BY holiday_date ASC
      `).all();

      assert.equal(records.length, 3);
      assert.equal(records[0].holiday_date, '2026-10-24');
      assert.equal(records[1].holiday_date, '2026-10-25');
      assert.equal(records[2].holiday_date, '2026-10-26');
    });
  });
});
