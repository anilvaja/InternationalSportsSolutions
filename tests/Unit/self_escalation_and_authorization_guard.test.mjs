import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { getCentralDb } from '../../src/db/centralDb.js';
import { signToken } from '../../src/middleware/auth.js';
import { SecurityGuardService } from '../../src/services/securityGuardService.js';
import app from '../../server.js';

describe('Centralized Authorization Guard & Self-Escalation Prevention Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let coachToken;
  let delegatedStaffToken;
  let headCoachToken;
  let viewOnlyToken;
  let db;
  let centralDb;
  const ACADEMY_ID = 1;

  before(async () => {
    process.env.NODE_ENV = 'test';
    db = getTenantDbById(ACADEMY_ID);
    centralDb = getCentralDb();

    // Ensure audit_logs table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        user_role TEXT,
        action TEXT NOT NULL,
        entity TEXT,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure user_role_history table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_role_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        academy_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        previous_role TEXT,
        effective_from DATE NOT NULL,
        effective_to DATE,
        reason TEXT,
        changed_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed test users into tenant database
    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, custom_permissions, status)
      VALUES (911, 'Academy Admin User', 'admin911@pratikkarate.com', 'hash', 'academy_admin', '["all"]', 'active')
    `).run();

    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, custom_permissions, status)
      VALUES (912, 'Coach Regular', 'coach912@pratikkarate.com', 'hash', 'coach', '["view_coaches"]', 'active')
    `).run();

    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, custom_permissions, status)
      VALUES (913, 'Staff Coordinator', 'staff913@pratikkarate.com', 'hash', 'academy_staff', '["assign_user_roles", "manage_roles", "create_roles", "import_coaches", "manage_coaches", "view_coaches"]', 'active')
    `).run();

    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, custom_permissions, status)
      VALUES (914, 'Auditor View Only', 'auditor914@pratikkarate.com', 'hash', 'custom_auditor', '["view_roles", "view_coaches", "view_students"]', 'active')
    `).run();

    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, custom_permissions, status)
      VALUES (915, 'Head Coach Senpai', 'headcoach915@pratikkarate.com', 'hash', 'head_coach', '["assign_user_roles", "manage_coaches", "view_coaches"]', 'active')
    `).run();

    // Also register in central lookup for role-revision consistency
    centralDb.prepare(`
      INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role)
      VALUES ('target.coach@pratikkarate.com', 1, 'coach')
    `).run();

    // 1. Academy Admin Token (Rank 80)
    adminToken = signToken({
      userId: 911,
      email: 'admin911@pratikkarate.com',
      role: 'academy_admin',
      academyId: ACADEMY_ID,
      name: 'Academy Admin User',
      permissions: ['all']
    });

    // 2. Regular Coach Token (Rank 30) - ID 912 without role management permission
    coachToken = signToken({
      userId: 912,
      email: 'coach912@pratikkarate.com',
      role: 'coach',
      academyId: ACADEMY_ID,
      name: 'Coach Regular',
      permissions: ['view_coaches']
    });

    // 3. Delegated Staff Admin (Rank 20) - ID 913 with delegated assign_user_roles, manage_roles, import_coaches
    delegatedStaffToken = signToken({
      userId: 913,
      email: 'staff913@pratikkarate.com',
      role: 'academy_staff',
      academyId: ACADEMY_ID,
      name: 'Staff Coordinator',
      permissions: ['assign_user_roles', 'manage_roles', 'create_roles', 'import_coaches', 'manage_coaches', 'view_coaches']
    });

    // 4. Head Coach Token (Rank 50) - ID 915 with delegated assign_user_roles, manage_coaches
    headCoachToken = signToken({
      userId: 915,
      email: 'headcoach915@pratikkarate.com',
      role: 'head_coach',
      academyId: ACADEMY_ID,
      name: 'Head Coach Senpai',
      permissions: ['assign_user_roles', 'manage_coaches', 'view_coaches']
    });

    // 5. View-Only Role Token (has view_roles and view_coaches only) - ID 914
    viewOnlyToken = signToken({
      userId: 914,
      email: 'auditor914@pratikkarate.com',
      role: 'custom_auditor',
      academyId: ACADEMY_ID,
      name: 'Auditor View Only',
      permissions: ['view_roles', 'view_coaches', 'view_students']
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

  it('1. User without role permission cannot modify roles (Blocked with 403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/academy/users/912/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coachToken}`
      },
      body: JSON.stringify({
        role: 'academy_admin'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.match(data.error || '', /assign_user_roles/i);
  });

  it('2. Delegated user with role permission cannot self-escalate or change own role (Blocked with 403)', async () => {
    // User 913 has 'assign_user_roles', but attempts to elevate user 913 (themselves) to 'academy_admin'
    const res = await fetch(`${baseUrl}/api/academy/users/913/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${delegatedStaffToken}`
      },
      body: JSON.stringify({
        role: 'academy_admin'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.match(data.error || '', /cannot alter their own role or privileges|cannot modify your own role/i);
  });

  it('3. Delegated user cannot self-modify role via POST /users/:id/role-revision (Blocked with 403)', async () => {
    const res = await fetch(`${baseUrl}/api/academy/users/913/role-revision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${delegatedStaffToken}`
      },
      body: JSON.stringify({
        new_role: 'academy_admin',
        reason: 'Attempted self-elevation'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.match(data.error || '', /cannot alter their own role or privileges|cannot modify your own role/i);
  });

  it('4. User cannot grant themselves custom permissions they do not possess (Blocked with 403)', async () => {
    const res = await fetch(`${baseUrl}/api/academy/users/913/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${delegatedStaffToken}`
      },
      body: JSON.stringify({
        role: 'academy_staff',
        custom_permissions: ['all', 'manage_payroll']
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.match(data.error || '', /cannot alter their own role or privileges|cannot grant or alter your own permissions/i);
  });

  it('5. Non-super administrator cannot assign super_admin in tenant context (Blocked with 403)', async () => {
    const res = await fetch(`${baseUrl}/api/academy/users/912/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        role: 'super_admin'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.match(data.error || '', /Super Admin role cannot be created or assigned/i);
  });

  it('6. Delegated Scope: Actor cannot grant permissions exceeding their own delegated scope', async () => {
    // Head Coach 915 has ['assign_user_roles', 'manage_coaches', 'view_coaches']
    // Head Coach (Rank 50) can modify Coach (Rank 30), but attempting to grant 'manage_payroll' must be blocked under the subset rule
    const res = await fetch(`${baseUrl}/api/academy/users/912/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${headCoachToken}`
      },
      body: JSON.stringify({
        role: 'coach',
        custom_permissions: ['manage_payroll']
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.match(data.error || '', /Cannot grant permission\(s\) beyond your delegated/i);
  });

  it('7. Non-admin cannot assign wildcard all permission in custom roles (Blocked with 403)', async () => {
    const res = await fetch(`${baseUrl}/api/academy/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${delegatedStaffToken}`
      },
      body: JSON.stringify({
        name: 'escalated_role',
        display_name: 'Escalated Role',
        permissions: ['all']
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.match(data.error || '', /Universal 'all' permission can only be granted by an Academy Admin/i);
  });

  it('8. Bulk Coach Import cannot inject academy_admin or super_admin accounts', async () => {
    const res = await fetch(`${baseUrl}/api/academy/coaches/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${delegatedStaffToken}`
      },
      body: JSON.stringify({
        coaches: [
          { name: 'Hacker Admin', email: 'hacker@academy.com', phone: '9876543210', role: 'super_admin' }
        ]
      })
    });

    const data = await res.json();
    assert.ok(res.status === 400 || res.status === 403);
    assert.match(data.error || '', /Super Admin role cannot be created/i);
  });

  it('9. Custom view-only roles are strictly read-only and cannot mutate resources (Blocked with 403)', async () => {
    // viewOnlyToken has 'view_roles', but tries to POST /api/academy/roles
    const res = await fetch(`${baseUrl}/api/academy/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewOnlyToken}`
      },
      body: JSON.stringify({
        name: 'test_role',
        display_name: 'Test Role',
        permissions: ['view_coaches']
      })
    });

    assert.strictEqual(res.status, 403);
  });

  it('10. Last active Super Admin cannot be deleted or set to inactive in central platform', () => {
    const activeCount = centralDb.prepare("SELECT COUNT(*) as c FROM super_admins WHERE status = 'active'").get().c;
    const firstAdmin = centralDb.prepare("SELECT id FROM super_admins WHERE status = 'active' LIMIT 1").get();

    if (activeCount === 1 && firstAdmin) {
      assert.throws(
        () => {
          SecurityGuardService.assertCanDeactivateOrDeleteSuperAdmin(centralDb, firstAdmin.id, 'inactive');
        },
        /cannot delete or deactivate the last active super admin/i
      );

      assert.throws(
        () => {
          SecurityGuardService.assertCanDeactivateOrDeleteSuperAdmin(centralDb, firstAdmin.id, null);
        },
        /cannot delete or deactivate the last active super admin/i
      );
    } else {
      assert.ok(true, 'Multiple super admins present in test environment');
    }
  });

  it('11. Authorized role modification records immutable before/after state in audit_logs', async () => {
    // Clean up if previous test run left target user
    db.prepare("DELETE FROM users WHERE email = 'target.coach@pratikkarate.com'").run();

    const tempUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?)
    `).run('Target Test Coach', 'target.coach@pratikkarate.com', 'hashed_pass', 'coach', 'active');
    const targetUserId = tempUser.lastInsertRowid;

    centralDb.prepare(`
      INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role)
      VALUES ('target.coach@pratikkarate.com', 1, 'coach')
    `).run();

    const res = await fetch(`${baseUrl}/api/academy/users/${targetUserId}/role-revision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        new_role: 'head_coach',
        effective_from: '2026-11-01',
        reason: 'Promotion for outstanding championship performance'
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);

    // Verify audit log entry
    const auditRow = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE action = 'ROLE_REVISED' AND entity_id = ? 
      ORDER BY id DESC LIMIT 1
    `).get(String(targetUserId));

    assert.ok(auditRow, 'Audit log row must be recorded');
    const parsed = JSON.parse(auditRow.details);
    assert.strictEqual(parsed.before.role, 'coach');
    assert.strictEqual(parsed.after.role, 'head_coach');
    assert.strictEqual(parsed.actor.id, 911);
    assert.match(parsed.reason, /Promotion for outstanding championship/i);
  });
});
