import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';
import http from 'node:http';

describe('Dynamic Color Themes, Permissions & Multi-Tier Hierarchy', () => {
  let server;
  let baseUrl;
  let academy1Db;
  let adminToken;
  let staffToken;

  const ACADEMY_ID = 1;

  before(async () => {
    process.env.NODE_ENV = 'test';
    academy1Db = getTenantDbById(ACADEMY_ID);

    adminToken = signToken({
      userId: 1,
      email: 'john.smith@mahavirsportsacademy.com',
      role: 'academy_admin',
      academyId: ACADEMY_ID,
      name: 'John Smith',
    });

    academy1Db.prepare(`
      INSERT OR REPLACE INTO academy_roles (name, display_name, permissions, is_system, theme_color)
      VALUES ('academy_staff', 'Staff', '["customize_theme"]', 1, 'blue')
    `).run();

    // Create a dedicated staff test user
    const existing = academy1Db.prepare("SELECT id FROM users WHERE email = 'theme.tester@example.com'").get();
    let staffUserId;
    if (existing) {
      staffUserId = existing.id;
    } else {
      const res = academy1Db.prepare(`
        INSERT INTO users (name, email, password_hash, role, status, custom_permissions)
        VALUES ('Theme Tester', 'theme.tester@example.com', 'dummyhash', 'academy_staff', 'active', '["customize_theme"]')
      `).run();
      staffUserId = res.lastInsertRowid;
    }

    staffToken = signToken({
      userId: staffUserId,
      email: 'theme.tester@example.com',
      role: 'academy_staff',
      academyId: ACADEMY_ID,
      name: 'Theme Tester',
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

  it('1. GET /api/academy/permissions includes Branding & Dynamic Themes category', async () => {
    const res = await fetch(`${baseUrl}/api/academy/permissions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);

    const brandingCategory = data.categories.find(c => c.category.includes('Branding'));
    assert.ok(brandingCategory, 'Branding & Dynamic Themes category exists');
    const permKeys = brandingCategory.permissions.map(p => p.key);
    assert.ok(permKeys.includes('customize_theme'), 'customize_theme permission exists');
    assert.ok(permKeys.includes('manage_branding'), 'manage_branding permission exists');
  });

  it('2. PUT /api/academy/settings/policy persists default_color_theme', async () => {
    const res = await fetch(`${baseUrl}/api/academy/settings/policy`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cutoff_days: 3,
        ot_threshold_minutes: 45,
        ot_rate_type: 'time_and_a_half',
        statement_release_day: 28,
        payday_day: 1,
        timezone: 'Asia/Kolkata',
        allow_future_attendance: 0,
        default_color_theme: 'emerald',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);

    // Verify persisted in DB
    const policy = academy1Db.prepare('SELECT default_color_theme FROM academy_policy_settings LIMIT 1').get();
    assert.equal(policy.default_color_theme, 'emerald');
  });

  it('3. POST /api/academy/roles creates a custom role with a signature theme_color', async () => {
    const roleName = `senior_sensei_${Date.now()}`;
    const res = await fetch(`${baseUrl}/api/academy/roles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: roleName,
        display_name: 'Senior Sensei',
        description: 'Lead Martial Arts Sensei',
        permissions: ['view_students', 'take_attendance'],
        theme_color: 'purple',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);

    // Verify stored
    const roleRow = academy1Db.prepare('SELECT * FROM academy_roles WHERE name = ?').get(roleName);
    assert.ok(roleRow);
    assert.equal(roleRow.theme_color, 'purple');
  });

  it('4. PUT /api/academy/roles/:id updates role theme_color', async () => {
    const role = academy1Db.prepare("SELECT * FROM academy_roles WHERE name LIKE 'senior_sensei_%' LIMIT 1").get();
    assert.ok(role);

    const res = await fetch(`${baseUrl}/api/academy/roles/${role.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        display_name: 'Master Sensei',
        description: 'Chief Tournament Coach',
        permissions: ['view_students', 'take_attendance', 'manage_batches'],
        theme_color: 'crimson',
      }),
    });
    assert.equal(res.status, 200);

    const updated = academy1Db.prepare('SELECT theme_color, display_name FROM academy_roles WHERE id = ?').get(role.id);
    assert.equal(updated.theme_color, 'crimson');
    assert.equal(updated.display_name, 'Master Sensei');
  });

  it('5. PUT /api/auth/theme updates authenticated user personal theme and cascades to /api/auth/me', async () => {
    const res = await fetch(`${baseUrl}/api/auth/theme`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme_color: 'teal' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.theme_color, 'teal');

    // Check GET /api/auth/me resolves personal theme as effectiveTheme
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.themeColor, 'teal');
    assert.equal(meData.user.effectiveTheme, 'teal');
  });

  it('6. Reverting personal theme falls back to role signature theme', async () => {
    // Revert personal theme to null
    const res = await fetch(`${baseUrl}/api/auth/theme`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme_color: null }),
    });
    assert.equal(res.status, 200);

    // Verify in DB that theme_color is null
    const userRow = academy1Db.prepare("SELECT theme_color FROM users WHERE email = 'theme.tester@example.com'").get();
    assert.equal(userRow.theme_color, null);

    // Ensure staff role default theme is 'blue'
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const meData = await meRes.json();
    assert.equal(meData.user.themeColor, null);
    // Effective theme should resolve to role theme ('blue' for academy_staff)
    assert.equal(meData.user.effectiveTheme, 'blue');
  });

  it('7. PUT /api/academy/users/:id/role updates staff role and personal theme override', async () => {
    const userRow = academy1Db.prepare("SELECT id FROM users WHERE email = 'theme.tester@example.com'").get();
    assert.ok(userRow);

    const res = await fetch(`${baseUrl}/api/academy/users/${userRow.id}/role`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'academy_staff',
        custom_permissions: ['customize_theme'],
        theme_color: 'amber',
      }),
    });
    assert.equal(res.status, 200);

    const updated = academy1Db.prepare('SELECT theme_color FROM users WHERE id = ?').get(userRow.id);
    assert.equal(updated.theme_color, 'amber');

    // Verify /api/auth/me reflects the updated personal theme override
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const meData = await meRes.json();
    assert.equal(meData.user.effectiveTheme, 'amber');
  });
});
