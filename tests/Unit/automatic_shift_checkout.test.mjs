import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import { ShiftCheckoutService } from '../../src/services/shiftCheckoutService.js';
import { PayrollService } from '../../src/services/payrollService.js';
import app from '../../server.js';

describe('Automatic Employee Shift Checkout & Policy Workflow', () => {
  let server;
  let baseUrl;
  let adminToken;
  let coachToken;
  let db;
  const ACADEMY_ID = 1;

  before(async () => {
    process.env.NODE_ENV = 'test';
    db = getTenantDbById(ACADEMY_ID);

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

  it('1. Admin can configure shift auto-checkout policy and grace period', async () => {
    const putRes = await api('/api/academy/shifts/policy', {
      method: 'PUT',
      body: {
        auto_checkout_enabled: true,
        auto_checkout_grace_minutes: 45,
        allow_overnight_shifts: true
      }
    });

    assert.equal(putRes.status, 200);
    assert.equal(putRes.data.policy.auto_checkout_grace_minutes, 45);
    assert.equal(putRes.data.policy.auto_checkout_enabled, true);

    const getRes = await api('/api/academy/shifts/policy');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.policy.auto_checkout_grace_minutes, 45);
  });

  it('2. Coach without admin privileges is blocked from altering shift policy', async () => {
    const res = await api('/api/academy/shifts/policy', {
      method: 'PUT',
      token: coachToken,
      body: { auto_checkout_grace_minutes: 10 }
    });
    assert.equal(res.status, 403);
  });

  it('3. In-progress punch before shift end + grace threshold is NOT prematurely closed', async () => {
    // Create an in-progress punch for today
    const ins = db.prepare(`
      INSERT INTO staff_time_punches (
        academy_id, user_id, punch_date, punch_in_time, status, punch_type, notes
      ) VALUES (?, ?, '2026-10-20', '2026-10-20T09:00:00Z', 'in_progress', 'duty', 'Morning shift test')
    `).run(ACADEMY_ID, 2);
    const punchId = ins.lastInsertRowid;

    // Simulate auto-checkout check at 12:00 (shift ends at 18:00)
    const result = ShiftCheckoutService.processAutomaticShiftCheckouts(db, ACADEMY_ID, {
      referenceTime: '2026-10-20T12:00:00Z',
      graceMinutes: 45
    });

    const punch = db.prepare('SELECT * FROM staff_time_punches WHERE id = ?').get(punchId);
    assert.equal(punch.status, 'in_progress');
    assert.equal(punch.punch_out_time, null);

    // Clean up
    db.prepare('DELETE FROM staff_time_punches WHERE id = ?').run(punchId);
  });

  it('4. In-progress punch exceeding shift end + grace threshold is auto-closed', async () => {
    // Create an in-progress punch from a past date
    const ins = db.prepare(`
      INSERT INTO staff_time_punches (
        academy_id, user_id, punch_date, punch_in_time, status, punch_type, notes
      ) VALUES (?, ?, '2026-10-15', '2026-10-15T09:00:00Z', 'in_progress', 'duty', 'Missed checkout test')
    `).run(ACADEMY_ID, 2);
    const punchId = ins.lastInsertRowid;

    // Trigger auto checkout
    const res = await api('/api/academy/shifts/auto-checkout', {
      method: 'POST',
      body: { graceMinutes: 30 }
    });

    assert.equal(res.status, 200);
    assert.ok(res.data.closedCount >= 1);

    const punch = db.prepare('SELECT * FROM staff_time_punches WHERE id = ?').get(punchId);
    assert.equal(punch.status, 'auto_closed');
    assert.ok(punch.punch_out_time);
    assert.ok(punch.duration_minutes > 0);
    assert.match(punch.notes, /Auto-Closed/i);

    // Verify audit log entry
    const audit = db.prepare("SELECT * FROM audit_logs WHERE action = 'AUTO_CHECKOUT' AND details LIKE ?").get(`%#${punchId}%`);
    assert.ok(audit);

    // Clean up
    db.prepare('DELETE FROM staff_time_punches WHERE id = ?').run(punchId);
  });

  it('5. Auto-closed punches are correctly included in monthly payroll statement calculations', () => {
    const period = PayrollService.getOrCreatePeriod(db, ACADEMY_ID, '2026-10');

    // Insert an auto_closed punch
    const ins = db.prepare(`
      INSERT INTO staff_time_punches (
        academy_id, user_id, punch_date, punch_in_time, punch_out_time, duration_minutes, status, punch_type
      ) VALUES (?, ?, '2026-10-12', '2026-10-12 09:00:00', '2026-10-12 18:00:00', 540, 'auto_closed', 'duty')
    `).run(ACADEMY_ID, 2);
    const punchId = ins.lastInsertRowid;

    const statement = PayrollService.calculateEmployeeStatement(db, period.id, 2, ACADEMY_ID);
    assert.ok(statement.gross_earnings > 0);
    assert.ok(statement.net_earnings > 0);

    // Clean up
    db.prepare('DELETE FROM staff_time_punches WHERE id = ?').run(punchId);
  });
});

