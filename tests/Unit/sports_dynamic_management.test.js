import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';
import http from 'node:http';

describe('Dynamic Sports Management & Karate Specialization', () => {
  let server;
  let baseUrl;
  let academy1Db;
  let academy2Db;
  let academy1AdminToken;
  let academy2AdminToken;

  const ACADEMY_1_ID = 1;
  const ACADEMY_2_ID = 2;

  before(async () => {
    process.env.NODE_ENV = 'test';
    academy1Db = getTenantDbById(ACADEMY_1_ID);
    academy2Db = getTenantDbById(ACADEMY_2_ID);

    academy1AdminToken = signToken({
      userId: 1,
      email: 'john.smith@mahavirsportsacademy.com',
      role: 'academy_admin',
      academyId: ACADEMY_1_ID,
      name: 'John Smith',
    });

    academy2AdminToken = signToken({
      userId: 2,
      email: 'admin@sardar-martial-arts.com',
      role: 'academy_admin',
      academyId: ACADEMY_2_ID,
      name: 'Sardar Admin',
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

  async function api(path, { method = 'GET', body, token = academy1AdminToken, academyId = ACADEMY_1_ID } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Academy-Id': String(academyId),
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
    return { status: res.status, data };
  }

  it('1. GET /api/academy/sports returns unique sports with Karate prioritized at the top', async () => {
    const res = await api('/api/academy/sports');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(Array.isArray(res.data.sports));

    const sports = res.data.sports;
    assert.ok(sports.length > 0, 'Sports should not be empty');

    // Karate must be the first sport
    assert.equal(sports[0].name.toLowerCase(), 'karate', 'Karate must be the first sport in the list');

    // Verify there are NO duplicate names in the list (case-insensitive)
    const names = sports.map(s => s.name.toLowerCase());
    const uniqueNames = new Set(names);
    assert.equal(names.length, uniqueNames.size, 'No duplicate sports should exist');
  });

  it('2. POST /api/academy/sports dynamically creates a new sport discipline', async () => {
    const uniqueSportName = `Taekwondo_${Date.now()}`;
    const res = await api('/api/academy/sports', {
      method: 'POST',
      body: {
        name: uniqueSportName,
        description: 'Korean martial art focusing on kicking techniques and sparring',
        is_active: 1,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.sport.name, uniqueSportName);
    assert.equal(res.data.sport.is_active, 1);

    // Verify in database
    const dbRecord = academy1Db.prepare('SELECT * FROM sports WHERE id = ?').get(res.data.sport.id);
    assert.ok(dbRecord);
    assert.equal(dbRecord.name, uniqueSportName);
  });

  it('3. POST /api/academy/sports rejects duplicate sport names (case-insensitive)', async () => {
    // Attempt to insert "karate" in lowercase
    const res = await api('/api/academy/sports', {
      method: 'POST',
      body: {
        name: 'karate',
        description: 'Duplicate attempt',
      },
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.error, /already exists/i);
  });

  it('4. PUT /api/academy/sports/:id updates an existing sport and checks duplicate conflicts', async () => {
    // Create a temporary sport to edit
    const tempName = `TempSport_${Date.now()}`;
    const createRes = await api('/api/academy/sports', {
      method: 'POST',
      body: { name: tempName, description: 'Initial description' },
    });
    const sportId = createRes.data.sport.id;

    // Update name and description
    const updateRes = await api(`/api/academy/sports/${sportId}`, {
      method: 'PUT',
      body: {
        name: `${tempName}_Updated`,
        description: 'Updated description',
        is_active: 0,
      },
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.success, true);
    assert.equal(updateRes.data.sport.name, `${tempName}_Updated`);
    assert.equal(updateRes.data.sport.is_active, 0);

    // Attempting to rename to an existing sport name (e.g. Karate) must fail
    const conflictRes = await api(`/api/academy/sports/${sportId}`, {
      method: 'PUT',
      body: { name: 'Karate' },
    });
    assert.equal(conflictRes.status, 400);
    assert.equal(conflictRes.data.success, false);
    assert.match(conflictRes.data.error, /already exists/i);
  });

  it('5. DELETE /api/academy/sports/:id safely deactivates if referenced, deletes if unreferenced', async () => {
    // 5a. Unreferenced sport can be deleted cleanly
    const unrefName = `Unreferenced_${Date.now()}`;
    const unrefRes = await api('/api/academy/sports', {
      method: 'POST',
      body: { name: unrefName },
    });
    const unrefId = unrefRes.data.sport.id;

    const deleteRes = await api(`/api/academy/sports/${unrefId}`, { method: 'DELETE' });
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.data.success, true);
    assert.equal(deleteRes.data.deactivated, undefined);

    const checkDeleted = academy1Db.prepare('SELECT * FROM sports WHERE id = ?').get(unrefId);
    assert.equal(checkDeleted, undefined);

    // 5b. Referenced sport (e.g. Karate or Football having active coaches/batches) is safely deactivated
    const karate = academy1Db.prepare("SELECT id FROM sports WHERE LOWER(name) = 'karate'").get();
    assert.ok(karate);

    // Ensure a batch references it if not already
    const refCheck = academy1Db.prepare('SELECT COUNT(*) as c FROM batches WHERE sport_id = ?').get(karate.id).c;
    if (refCheck === 0) {
      let branch = academy1Db.prepare('SELECT id FROM branches LIMIT 1').get();
      if (!branch) {
        const insB = academy1Db.prepare("INSERT INTO branches (name, city, is_active, academy_id) VALUES ('Default Branch', 'Ahmedabad', 1, 1)").run();
        branch = { id: insB.lastInsertRowid };
      }
      academy1Db.prepare(`
        INSERT INTO batches (name, sport_id, branch_id, start_time, end_time, days_of_week, max_capacity, monthly_fee)
        VALUES ('Karate Safety Test Batch', ?, ?, '10:00', '11:00', '["Mon"]', 20, 2000)
      `).run(karate.id, branch.id);
    }

    const safeDeleteRes = await api(`/api/academy/sports/${karate.id}`, { method: 'DELETE' });
    assert.equal(safeDeleteRes.status, 200);
    assert.equal(safeDeleteRes.data.success, true);
    assert.equal(safeDeleteRes.data.deactivated, true);
    assert.match(safeDeleteRes.data.message, /safely deactivated/i);

    // Verify row still exists in DB but is_active is 0
    const checkKarate = academy1Db.prepare('SELECT is_active FROM sports WHERE id = ?').get(karate.id);
    assert.equal(checkKarate.is_active, 0);

    // Re-activate Karate
    await api(`/api/academy/sports/${karate.id}`, {
      method: 'PUT',
      body: { is_active: 1 },
    });
    const checkRestored = academy1Db.prepare('SELECT is_active FROM sports WHERE id = ?').get(karate.id);
    assert.equal(checkRestored.is_active, 1);
  });

  it('6. Tenant Isolation: Sports added in Academy 1 do not leak into Academy 2', async () => {
    const isolatedSportName = `IsolatedDiscipline_${Date.now()}`;
    await api('/api/academy/sports', {
      method: 'POST',
      body: { name: isolatedSportName },
    });

    // Check Academy 2
    const resA2 = await api('/api/academy/sports', {
      token: academy2AdminToken,
      academyId: ACADEMY_2_ID,
    });
    assert.equal(resA2.status, 200);
    const namesA2 = resA2.data.sports.map(s => s.name);
    assert.ok(!namesA2.includes(isolatedSportName), 'Academy 2 must not see sports created in Academy 1');
  });
});
