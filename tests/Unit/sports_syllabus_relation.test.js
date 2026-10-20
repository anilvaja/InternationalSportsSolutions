import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';

describe('Sports, Syllabus Categories & Techniques Discipline Hierarchy', () => {
  let server;
  let baseUrl;
  let academyDb;
  let adminToken;
  const ACADEMY_ID = 1;

  before(async () => {
    process.env.NODE_ENV = 'test';
    academyDb = getTenantDbById(ACADEMY_ID);

    adminToken = signToken({
      userId: 1,
      email: 'john.smith@mahavirsportsacademy.com',
      role: 'academy_admin',
      academyId: ACADEMY_ID,
      name: 'John Smith',
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

  async function api(path, { method = 'GET', body = null } = {}) {
    const headers = {
      'Authorization': `Bearer ${adminToken}`,
      'X-Academy-Id': String(ACADEMY_ID),
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  it('1. Existing categories (Kata, Kumite) and techniques are linked to Karate sport', async () => {
    const sportsRes = await api('/api/academy/sports');
    assert.equal(sportsRes.status, 200);
    const karate = sportsRes.data.sports.find(s => s.name.toLowerCase() === 'karate');
    assert.ok(karate, 'Karate sport must exist');

    const catRes = await api(`/api/academy/syllabus-categories?sport_id=${karate.id}`);
    assert.equal(catRes.status, 200);
    const kata = catRes.data.categories.find(c => c.name.toLowerCase() === 'kata');
    const kumite = catRes.data.categories.find(c => c.name.toLowerCase() === 'kumite');
    assert.ok(kata, 'Kata must belong to Karate');
    assert.ok(kumite, 'Kumite must belong to Karate');
    assert.equal(kata.sport_id, karate.id);
    assert.equal(kumite.sport_id, karate.id);
    assert.equal(kata.sport_name, 'Karate');

    // Techniques under Karate
    const techRes = await api(`/api/academy/syllabus-techniques?sport_id=${karate.id}`);
    assert.equal(techRes.status, 200);
    assert.ok(techRes.data.techniques.length > 0, 'Karate techniques should exist');
    techRes.data.techniques.forEach(t => {
      assert.equal(t.sport_id, karate.id);
      assert.equal(t.sport_name, 'Karate');
    });
  });

  it('2. Can create distinct sport discipline with isolated categories and techniques', async () => {
    // 1. Create or ensure Taekwondo exists
    let tkdSportRes = await api('/api/academy/sports', {
      method: 'POST',
      body: { name: 'Taekwondo Test', description: 'Korean martial art focusing on kicks' }
    });
    let tkdId = tkdSportRes.data.sport ? tkdSportRes.data.sport.id : null;
    if (!tkdId) {
      const allSports = await api('/api/academy/sports');
      const found = allSports.data.sports.find(s => s.name.toLowerCase().includes('taekwondo'));
      tkdId = found.id;
    }
    assert.ok(tkdId, 'Taekwondo sport created or resolved');

    // 2. Create Category under Taekwondo
    const catName = 'Poomsae (Forms) ' + Date.now();
    const catRes = await api('/api/academy/syllabus-categories', {
      method: 'POST',
      body: {
        sport_id: tkdId,
        name: catName,
        description: 'Taekwondo pattern forms',
        status: 'active'
      }
    });
    assert.equal(catRes.status, 201);
    assert.equal(catRes.data.category.sport_id, tkdId);
    const poomsaeId = catRes.data.category.id;

    // 3. Create Technique under this category
    const techName = 'Taegeuk Il Jang ' + Date.now();
    const techRes = await api('/api/academy/syllabus-techniques', {
      method: 'POST',
      body: {
        category_id: poomsaeId,
        name: techName,
        level: 1,
        belt_level: 'Yellow Belt'
      }
    });
    assert.equal(techRes.status, 201);
    assert.equal(techRes.data.technique.sport_id, tkdId);

    // 4. Verify sport-level filtering isolates Karate from Taekwondo
    const tkdTechs = await api(`/api/academy/syllabus-techniques?sport_id=${tkdId}`);
    assert.ok(tkdTechs.data.techniques.some(t => t.name === techName));
    assert.ok(!tkdTechs.data.techniques.some(t => t.category_name.toLowerCase() === 'kata'));

    // Cleanup test category and technique
    await api(`/api/academy/syllabus-techniques/${techRes.data.technique.id}`, { method: 'DELETE' });
    await api(`/api/academy/syllabus-categories/${poomsaeId}`, { method: 'DELETE' });
  });
});
