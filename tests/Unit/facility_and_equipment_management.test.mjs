import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';

describe('Facility & Equipment Management Module', () => {
  let server;
  let baseUrl;
  let adminToken;
  let coachToken;
  const ACADEMY_ID = 1;

  before(async () => {
    process.env.NODE_ENV = 'test';
    const db = getTenantDbById(ACADEMY_ID);

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

  let equipmentId;
  let issueLogId;

  it('1. Admin can register new training equipment with branch, cost and stock', async () => {
    const res = await api('/api/academy/equipment', {
      method: 'POST',
      body: {
        name: 'Kumite Sparring Mats - High Density',
        category: 'Mats & Flooring',
        description: 'Interlocking 40mm tatami mats for tournament dojo',
        quantity: 50,
        branch_id: 1,
        condition: 'new',
        purchase_date: '15/10/2026',
        purchase_cost: 75000,
        supplier: 'Mats Pro Sports Gear Ltd',
        responsible_staff_id: 1
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.ok(res.data.item.id);
    assert.equal(res.data.item.quantity, 50);
    assert.equal(res.data.item.available_quantity, 50);
    assert.equal(res.data.item.category, 'Mats & Flooring');
    assert.equal(res.data.item.purchase_cost, 75000);
    equipmentId = res.data.item.id;
  });

  it('2. List equipment filters accurately by category, branch, and status', async () => {
    const res = await api(`/api/academy/equipment?category=Mats%20%26%20Flooring&branch_id=1`);
    assert.equal(res.status, 200);
    assert.ok(res.data.items.length >= 1);
    const found = res.data.items.find((i) => i.id === equipmentId);
    assert.ok(found);
    assert.equal(found.name, 'Kumite Sparring Mats - High Density');
  });

  it('3. Issues equipment to a student and decrements available stock', async () => {
    const res = await api(`/api/academy/equipment/${equipmentId}/issue`, {
      method: 'POST',
      body: {
        student_id: 1,
        quantity: 5,
        return_due_date: '30/11/2026',
        notes: 'Issued 5 mats for championship dojo practice'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.available_quantity, 45);

    // Verify stock in database
    const verify = await api(`/api/academy/equipment`);
    const item = verify.data.items.find((i) => i.id === equipmentId);
    assert.equal(item.quantity, 50);
    assert.equal(item.available_quantity, 45);
  });

  it('4. Rejects issue request when requested quantity exceeds available stock', async () => {
    const res = await api(`/api/academy/equipment/${equipmentId}/issue`, {
      method: 'POST',
      body: {
        student_id: 1,
        quantity: 100 // only 45 available
      }
    });

    assert.equal(res.status, 400);
    assert.match(res.data.error, /Insufficient stock/i);
  });

  it('5. Audit and assignment logs track checkout accurately', async () => {
    const res = await api(`/api/academy/equipment/${equipmentId}/logs`);
    assert.equal(res.status, 200);
    assert.ok(res.data.logs.length >= 1);
    const log = res.data.logs[0];
    assert.equal(log.action, 'issue');
    assert.equal(log.quantity, 5);
    assert.equal(log.student_id, 1);
    assert.equal(log.actual_return_date, null);
    issueLogId = log.id;
  });

  it('6. Returns equipment, increments available stock and updates condition', async () => {
    const res = await api(`/api/academy/equipment/${equipmentId}/return`, {
      method: 'POST',
      body: {
        log_id: issueLogId,
        condition_on_return: 'good',
        notes: 'Returned in clean condition after weekend championship'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.available_quantity, 50);

    // Verify assignment log now has return date
    const logsRes = await api(`/api/academy/equipment/${equipmentId}/logs`);
    const updatedLog = logsRes.data.logs.find((l) => l.id === issueLogId);
    assert.ok(updatedLog.actual_return_date);
  });

  it('7. Cannot return an already-returned assignment log', async () => {
    const res = await api(`/api/academy/equipment/${equipmentId}/return`, {
      method: 'POST',
      body: {
        log_id: issueLogId
      }
    });

    assert.equal(res.status, 400);
    assert.match(res.data.error, /already been returned/i);
  });

  it('8. Coach without facilities permissions cannot delete equipment', async () => {
    const res = await api(`/api/academy/equipment/${equipmentId}`, {
      method: 'DELETE',
      token: coachToken
    });

    assert.equal(res.status, 403);
  });

  it('9. Admin can update equipment details and condition', async () => {
    const res = await api(`/api/academy/equipment/${equipmentId}`, {
      method: 'PUT',
      body: {
        condition: 'good',
        location: 'Storage Bay B, Hall 1',
        purchase_cost: 72000
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.item.condition, 'good');
    assert.equal(res.data.item.location, 'Storage Bay B, Hall 1');
    assert.equal(res.data.item.purchase_cost, 72000);
  });

  it('10. Admin can safely delete equipment when no active loans exist', async () => {
    const res = await api(`/api/academy/equipment/${equipmentId}`, {
      method: 'DELETE'
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);

    const check = await api(`/api/academy/equipment`);
    assert.ok(!check.data.items.some((i) => i.id === equipmentId));
  });
});
