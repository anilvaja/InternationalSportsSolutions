import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import { PayrollService } from '../../src/services/payrollService.js';
import { ScheduleService } from '../../src/services/scheduleService.js';
import { UserService } from '../../src/services/userService.js';
import { getCentralDb } from '../../src/db/centralDb.js';
import app from '../../server.js';

describe('Academy-Level Payroll Settings & Employee-Level Override Engine', () => {
  let server;
  let baseUrl;
  let adminToken;
  let coachToken;
  let unauthorizedToken;
  let db;
  let centralDb;
  const ACADEMY_ID = 1;

  before(async () => {
    process.env.NODE_ENV = 'test';
    db = getTenantDbById(ACADEMY_ID);
    centralDb = getCentralDb();

    adminToken = signToken({
      userId: 1,
      email: 'admin@pratikkarate.com',
      role: 'academy_admin',
      academyId: ACADEMY_ID,
      name: 'Academy Admin'
    });

    coachToken = signToken({
      userId: 2,
      email: 'rajesh.kumite@pratikkarate.com',
      role: 'coach',
      academyId: ACADEMY_ID,
      name: 'Rajesh Coach'
    });

    unauthorizedToken = signToken({
      userId: 4,
      email: 'frontdesk@pratikkarate.com',
      role: 'front_desk',
      academyId: ACADEMY_ID,
      name: 'Front Desk User'
    });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function api(path, { method = 'GET', body, token = adminToken } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': String(ACADEMY_ID)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  // =========================================================================
  // 1. Academy-Level Default Settings Inspection
  // =========================================================================
  it('1. GET /api/academy/payroll/settings returns standard recommended defaults', async () => {
    // Reset to initial baseline
    PayrollService.updateAcademyPayrollSettings(db, ACADEMY_ID, {
      monthly_salary_divisor: 'actual_scheduled_minutes',
      paid_leave_policy: 'credit_scheduled_minutes',
      short_attendance_policy: 'deduct_proportionate_minutes'
    });

    const res = await api('/api/academy/payroll/settings');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.settings.monthly_salary_divisor, 'actual_scheduled_minutes');
    assert.equal(res.data.settings.paid_leave_policy, 'credit_scheduled_minutes');
    assert.equal(res.data.settings.short_attendance_policy, 'deduct_proportionate_minutes');
  });

  // =========================================================================
  // 2. Admin Can Update Academy-Level Defaults
  // =========================================================================
  it('2. PUT /api/academy/payroll/settings successfully updates academy-wide defaults', async () => {
    const res = await api('/api/academy/payroll/settings', {
      method: 'PUT',
      body: {
        monthly_salary_divisor: 'fixed_26',
        paid_leave_policy: 'employee_policy',
        short_attendance_policy: 'daily_deduction'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.settings.monthly_salary_divisor, 'fixed_26');
    assert.equal(res.data.settings.paid_leave_policy, 'employee_policy');
    assert.equal(res.data.settings.short_attendance_policy, 'daily_deduction');

    // Verify persisted directly in database
    const policy = db.prepare('SELECT * FROM academy_policy_settings WHERE academy_id = ?').get(ACADEMY_ID);
    assert.equal(policy.default_salary_divisor, 'fixed_26');
    assert.equal(policy.paid_leave_policy, 'employee_policy');
    assert.equal(policy.short_attendance_policy, 'daily_deduction');
  });

  // =========================================================================
  // 3. Validation & Bad Request Handling
  // =========================================================================
  it('3. PUT /api/academy/payroll/settings rejects invalid divisor or missing custom value', async () => {
    // 3.1. Invalid divisor name
    const invalidDivRes = await api('/api/academy/payroll/settings', {
      method: 'PUT',
      body: { monthly_salary_divisor: 'unsupported_formula_99' }
    });
    assert.equal(invalidDivRes.status, 400);
    assert.match(invalidDivRes.data.error, /invalid monthly salary divisor/i);

    // 3.2. Custom divisor without positive numeric value
    const customNoValRes = await api('/api/academy/payroll/settings', {
      method: 'PUT',
      body: { monthly_salary_divisor: 'custom', custom_divisor_value: 0 }
    });
    assert.equal(customNoValRes.status, 400);
    assert.match(customNoValRes.data.error, /positive custom_divisor_value/i);

    // 3.3. Invalid paid leave policy
    const invalidPaidLeave = await api('/api/academy/payroll/settings', {
      method: 'PUT',
      body: { paid_leave_policy: 'invalid_policy' }
    });
    assert.equal(invalidPaidLeave.status, 400);
    assert.match(invalidPaidLeave.data.error, /invalid paid leave policy/i);

    // 3.4. Invalid short attendance policy
    const invalidShortAtt = await api('/api/academy/payroll/settings', {
      method: 'PUT',
      body: { short_attendance_policy: 'invalid_attendance' }
    });
    assert.equal(invalidShortAtt.status, 400);
    assert.match(invalidShortAtt.data.error, /invalid short attendance policy/i);
  });

  // =========================================================================
  // 4. RBAC Protection on Payroll Settings
  // =========================================================================
  it('4. Non-admin staff without payroll permissions cannot alter academy payroll settings', async () => {
    const res = await api('/api/academy/payroll/settings', {
      method: 'PUT',
      token: unauthorizedToken,
      body: { monthly_salary_divisor: 'fixed_26' }
    });
    assert.equal(res.status, 403);
  });

  // =========================================================================
  // 5. Dynamic Academy-Level Default Inheritance by Employees
  // =========================================================================
  it('5. Employee with null / academy_default divisor dynamically inherits academy default', async () => {
    const email = `test_inherit_${Date.now()}@test.com`;
    const user = UserService.createStaffUser(db, centralDb, ACADEMY_ID, {
      name: 'Inheriting Staff',
      email,
      phone: '9988776655',
      password: 'password123',
      role: 'coach',
      salary_amount: 26000,
      compensation_mode: 'monthly',
      salary_divisor: 'academy_default',
      joining_date: '2026-01-01',
      effective_from: '2026-01-01'
    });

    const period = PayrollService.getOrCreatePeriod(db, ACADEMY_ID, '2026-09');

    // Case A: Academy default is fixed_26
    PayrollService.updateAcademyPayrollSettings(db, ACADEMY_ID, {
      monthly_salary_divisor: 'fixed_26'
    });

    const stmtA = PayrollService.calculateEmployeeStatement(db, period.id, user.userId, ACADEMY_ID);
    assert.equal(stmtA.salary_divisor, 'fixed_26');
    assert.equal(stmtA.divisor_source, 'academy_default');

    // Case B: Academy default switched to actual_scheduled_minutes
    PayrollService.updateAcademyPayrollSettings(db, ACADEMY_ID, {
      monthly_salary_divisor: 'actual_scheduled_minutes'
    });

    const stmtB = PayrollService.calculateEmployeeStatement(db, period.id, user.userId, ACADEMY_ID);
    assert.equal(stmtB.salary_divisor, 'actual_scheduled_minutes');
    assert.equal(stmtB.divisor_source, 'academy_default');

    // Cleanup
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(user.userId);
    db.prepare('DELETE FROM coaches WHERE user_id = ?').run(user.userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.userId);
  });

  // =========================================================================
  // 6. Employee-Level Override Takes Precedence Over Academy Default
  // =========================================================================
  it('6. Explicit employee override takes precedence over academy default divisor', async () => {
    // Set Academy default to actual_scheduled_minutes
    PayrollService.updateAcademyPayrollSettings(db, ACADEMY_ID, {
      monthly_salary_divisor: 'actual_scheduled_minutes'
    });

    const email = `test_override_${Date.now()}@test.com`;
    const user = UserService.createStaffUser(db, centralDb, ACADEMY_ID, {
      name: 'Override Staff',
      email,
      phone: '9988776644',
      password: 'password123',
      role: 'coach',
      salary_amount: 26000,
      compensation_mode: 'monthly',
      salary_divisor: 'fixed_26', // Explicit override!
      joining_date: '2026-01-01',
      effective_from: '2026-01-01'
    });

    const period = PayrollService.getOrCreatePeriod(db, ACADEMY_ID, '2026-09');
    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, user.userId, ACADEMY_ID);

    assert.equal(stmt.salary_divisor, 'fixed_26');
    assert.equal(stmt.divisor_source, 'employee_override');

    // Cleanup
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(user.userId);
    db.prepare('DELETE FROM coaches WHERE user_id = ?').run(user.userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.userId);
  });

  // =========================================================================
  // 7. Academy-Defined Divisor (Custom) Calculation
  // =========================================================================
  it('7. Academy-defined divisor calculates daily rate using custom divisor value', async () => {
    PayrollService.updateAcademyPayrollSettings(db, ACADEMY_ID, {
      monthly_salary_divisor: 'custom',
      custom_divisor_value: 20 // e.g. 20 working days standard
    });

    const email = `test_custom_div_${Date.now()}@test.com`;
    const user = UserService.createStaffUser(db, centralDb, ACADEMY_ID, {
      name: 'Custom Divisor Staff',
      email,
      phone: '9988776633',
      password: 'password123',
      role: 'coach',
      salary_amount: 20000,
      compensation_mode: 'monthly',
      salary_divisor: 'academy_default',
      joining_date: '2026-01-01',
      effective_from: '2026-01-01'
    });

    const period = PayrollService.getOrCreatePeriod(db, ACADEMY_ID, '2026-09');
    const stmt = PayrollService.calculateEmployeeStatement(db, period.id, user.userId, ACADEMY_ID);

    assert.equal(stmt.salary_divisor, 'custom');
    assert.equal(stmt.custom_divisor_value, 20);
    assert.match(stmt.divisor_label, /20 days/i);
    assert.equal(stmt.calculation_formula, 'M / 20');

    // Cleanup
    db.prepare('DELETE FROM staff_salary_profiles WHERE user_id = ?').run(user.userId);
    db.prepare('DELETE FROM coaches WHERE user_id = ?').run(user.userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.userId);
  });

  // =========================================================================
  // 8. Policy Settings Route Synchronization
  // =========================================================================
  it('8. PUT /api/academy/settings/policy keeps monthly salary calculation settings synchronized', async () => {
    const res = await api('/api/academy/settings/policy', {
      method: 'PUT',
      body: {
        default_salary_divisor: 'actual_scheduled_minutes',
        paid_leave_policy: 'credit_scheduled_minutes',
        short_attendance_policy: 'deduct_proportionate_minutes'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.policy.default_salary_divisor, 'actual_scheduled_minutes');
    assert.equal(res.data.policy.paid_leave_policy, 'credit_scheduled_minutes');
    assert.equal(res.data.policy.short_attendance_policy, 'deduct_proportionate_minutes');

    // Check GET /api/academy/payroll/settings returns matching synchronized data
    const payRes = await api('/api/academy/payroll/settings');
    assert.equal(payRes.data.settings.monthly_salary_divisor, 'actual_scheduled_minutes');
    assert.equal(payRes.data.settings.paid_leave_policy, 'credit_scheduled_minutes');
    assert.equal(payRes.data.settings.short_attendance_policy, 'deduct_proportionate_minutes');
  });

  // =========================================================================
  // 9. Audit Logging for Payroll Settings Modifications
  // =========================================================================
  it('9. Updating payroll settings records an immutable entry in audit_logs', async () => {
    await api('/api/academy/payroll/settings', {
      method: 'PUT',
      body: {
        monthly_salary_divisor: 'actual_scheduled_days',
        paid_leave_policy: 'credit_scheduled_minutes',
        short_attendance_policy: 'deduct_proportionate_minutes'
      }
    });

    const audit = db.prepare(`
      SELECT * FROM audit_logs
      WHERE action = 'UPDATE_PAYROLL_SETTINGS'
      ORDER BY id DESC LIMIT 1
    `).get();

    assert.ok(audit, 'Audit log entry should exist');
    assert.equal(audit.entity, 'academy_policy_settings');
    const details = JSON.parse(audit.details);
    assert.equal(details.default_salary_divisor, 'actual_scheduled_days');
  });
});
