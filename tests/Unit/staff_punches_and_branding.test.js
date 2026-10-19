import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';
import http from 'node:http';

describe('Staff Punches, Overtime Tracking & Dynamic Academy Branding', () => {
  let server;
  let baseUrl;
  let centralDb;
  let academy1Db;
  let adminToken;
  let staffToken;
  let staffUserId;

  const ACADEMY_ID = 1;

  before(async () => {
    process.env.NODE_ENV = 'test';
    centralDb = getCentralDb();
    academy1Db = getTenantDbById(ACADEMY_ID);

    // Update academy 1 in centralDb with a test logo to verify dynamic brand loading
    centralDb.prepare(`
      UPDATE academies 
      SET logo_url = '/uploads/logos/mahavir_crest.png' 
      WHERE id = 1
    `).run();

    adminToken = signToken({
      userId: 1,
      email: 'john.smith@mahavirsportsacademy.com',
      role: 'academy_admin',
      academyId: ACADEMY_ID,
      name: 'John Smith',
    });

    // Ensure dedicated test staff user exists
    const existing = academy1Db.prepare("SELECT id FROM users WHERE email = 'punch.staff@mahavirsportsacademy.com'").get();
    if (existing) {
      staffUserId = existing.id;
    } else {
      const res = academy1Db.prepare(`
        INSERT INTO users (name, email, password_hash, role, status)
        VALUES ('Punch Tester', 'punch.staff@mahavirsportsacademy.com', 'dummyhash', 'coach', 'active')
      `).run();
      staffUserId = res.lastInsertRowid;
    }

    // Clean any prior test punches for this user
    academy1Db.prepare('DELETE FROM staff_time_punches WHERE user_id = ?').run(staffUserId);

    staffToken = signToken({
      userId: staffUserId,
      email: 'punch.staff@mahavirsportsacademy.com',
      role: 'coach',
      academyId: ACADEMY_ID,
      name: 'Punch Tester',
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('1. GET /api/auth/me returns dynamic academyName and academyLogo together', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.authenticated, true);
    assert.ok(data.user.academyName, 'Academy name must be present');
    assert.equal(data.user.academyLogo, '/uploads/logos/mahavir_crest.png', 'Academy logo must match central db');
    assert.ok(data.accessibleAcademies[0].logo_url, 'Accessible academy record must contain logo_url');
  });

  it('2. GET /api/academy/punches/status returns initial off-duty state', async () => {
    const res = await fetch(`${baseUrl}/api/academy/punches/status`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.isPunchedIn, false);
    assert.equal(data.activePunch, null);
    assert.equal(data.stats.totalMinutesToday, 0);
  });

  it('3. POST /api/academy/punches/in successfully punches in staff member', async () => {
    const res = await fetch(`${baseUrl}/api/academy/punches/in`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notes: 'Morning training shift',
        punch_type: 'duty',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.punch);
    assert.equal(data.punch.status, 'in_progress');
    assert.ok(data.punch.punch_in_time);
  });

  it('4. POST /api/academy/punches/in rejects duplicate punch in when already active', async () => {
    const res = await fetch(`${baseUrl}/api/academy/punches/in`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /already punched in/i);
  });

  it('5. GET /api/academy/punches/status reflects active punch in session', async () => {
    const res = await fetch(`${baseUrl}/api/academy/punches/status`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.isPunchedIn, true);
    assert.ok(data.activePunch);
    assert.equal(data.activePunch.status, 'in_progress');
  });

  it('6. POST /api/academy/punches/out calculates duration and closes shift', async () => {
    // Simulate shift start 500 minutes ago to verify overtime calculation (> 480 mins shift)
    const simulatedStart = new Date(Date.now() - 500 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    academy1Db.prepare(`
      UPDATE staff_time_punches 
      SET punch_in_time = ? 
      WHERE user_id = ? AND status = 'in_progress'
    `).run(simulatedStart, staffUserId);

    const res = await fetch(`${baseUrl}/api/academy/punches/out`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notes: 'Completed session training',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.durationMinutes >= 499, 'Duration should reflect simulated 500 minutes');
    assert.ok(data.overtimeMinutes >= 19, 'Overtime should be calculated for minutes past 480');

    // Verify DB state
    const record = academy1Db.prepare('SELECT * FROM staff_time_punches WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(staffUserId);
    assert.equal(record.status, 'completed');
    assert.ok(record.punch_out_time);
    assert.ok(record.overtime_minutes > 0);
  });

  it('7. GET /api/academy/punches/history returns recent punch logs', async () => {
    const res = await fetch(`${baseUrl}/api/academy/punches/history`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.punches));
    assert.ok(data.punches.length >= 1);
    assert.equal(data.punches[0].status, 'completed');
  });
});
