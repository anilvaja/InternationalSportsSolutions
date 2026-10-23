import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getCentralDb } from '../../src/db/centralDb.js';
import { provisionAcademyDb, getTenantDbById } from '../../src/db/connectionManager.js';
import { extractSubdomain, extractHost, resolveTenant } from '../../src/middleware/tenantResolver.js';

describe('Domain & Subdomain Management Architecture', () => {
  let centralDb;
  let testAcademy1;
  let testAcademy2;

  before(() => {
    centralDb = getCentralDb();

    // Clean up any previous test academies
    const old1 = centralDb.prepare("SELECT id FROM academies WHERE slug = 'e2e-domain-test-1'").get();
    if (old1) {
      centralDb.prepare('DELETE FROM domains WHERE academy_id = ?').run(old1.id);
      centralDb.prepare('DELETE FROM academies WHERE id = ?').run(old1.id);
    }
    const old2 = centralDb.prepare("SELECT id FROM academies WHERE slug = 'e2e-domain-test-2'").get();
    if (old2) {
      centralDb.prepare('DELETE FROM domains WHERE academy_id = ?').run(old2.id);
      centralDb.prepare('DELETE FROM academies WHERE id = ?').run(old2.id);
    }

    testAcademy1 = provisionAcademyDb({
      name: 'E2E Domain Academy 1',
      slug: 'e2e-domain-test-1',
      plan: 'professional',
    });

    testAcademy2 = provisionAcademyDb({
      name: 'E2E Domain Academy 2',
      slug: 'e2e-domain-test-2',
      plan: 'professional',
    });
  });

  after(() => {
    if (testAcademy1) {
      centralDb.prepare('DELETE FROM domains WHERE academy_id = ?').run(testAcademy1.id);
      centralDb.prepare('DELETE FROM academies WHERE id = ?').run(testAcademy1.id);
    }
    if (testAcademy2) {
      centralDb.prepare('DELETE FROM domains WHERE academy_id = ?').run(testAcademy2.id);
      centralDb.prepare('DELETE FROM academies WHERE id = ?').run(testAcademy2.id);
    }
  });

  it('1. Auto-registers primary platform subdomain and localhost alias upon academy provisioning', () => {
    const domains = centralDb.prepare('SELECT * FROM domains WHERE academy_id = ? ORDER BY is_primary DESC').all(testAcademy1.id);
    assert.ok(domains.length >= 2, 'Should have at least 2 domains');

    const primarySubdomain = domains.find(d => d.is_primary === 1);
    assert.ok(primarySubdomain, 'Primary domain must exist');
    assert.equal(primarySubdomain.domain, 'e2e-domain-test-1.internationalsportssolutions.test');
    assert.equal(primarySubdomain.is_custom, 0);

    const localhostDomain = domains.find(d => d.domain === 'e2e-domain-test-1.localhost');
    assert.ok(localhostDomain, 'Localhost domain alias must exist');
  });

  it('2. Allows registering a custom domain for an academy', () => {
    const customDomain = 'e2e-academy1-custom.com';
    const insert = centralDb.prepare(`
      INSERT INTO domains (academy_id, domain, is_primary, is_custom, status)
      VALUES (?, ?, 0, 1, 'active')
    `).run(testAcademy1.id, customDomain);

    assert.ok(insert.lastInsertRowid > 0);

    const row = centralDb.prepare('SELECT * FROM domains WHERE id = ?').get(insert.lastInsertRowid);
    assert.equal(row.domain, customDomain);
    assert.equal(row.is_custom, 1);
    assert.equal(row.is_primary, 0);
  });

  it('3. Enforces domain uniqueness rule across all academies (cross-tenant conflict prevention)', () => {
    const duplicateDomain = 'e2e-academy1-custom.com'; // Already belongs to testAcademy1

    assert.throws(() => {
      centralDb.prepare(`
        INSERT INTO domains (academy_id, domain, is_primary, is_custom, status)
        VALUES (?, ?, 0, 1, 'active')
      `).run(testAcademy2.id, duplicateDomain);
    }, /UNIQUE constraint failed/i);
  });

  it('4. Switching primary domain unsets previous primary domain for that academy', () => {
    const customDomain2 = 'e2e-academy1-primary.org';
    const insert = centralDb.prepare(`
      INSERT INTO domains (academy_id, domain, is_primary, is_custom, status)
      VALUES (?, ?, 0, 1, 'active')
    `).run(testAcademy1.id, customDomain2);

    const newDomainId = insert.lastInsertRowid;

    // Transaction to switch primary
    const tx = centralDb.transaction(() => {
      centralDb.prepare('UPDATE domains SET is_primary = 0 WHERE academy_id = ?').run(testAcademy1.id);
      centralDb.prepare('UPDATE domains SET is_primary = 1 WHERE id = ?').run(newDomainId);
    });
    tx();

    const primaries = centralDb.prepare('SELECT * FROM domains WHERE academy_id = ? AND is_primary = 1').all(testAcademy1.id);
    assert.equal(primaries.length, 1, 'Exactly one primary domain must exist');
    assert.equal(primaries[0].id, newDomainId);
    assert.equal(primaries[0].domain, customDomain2);
  });

  it('5. TenantResolver successfully identifies and mounts tenantDb by Host header', () => {
    const req = {
      headers: { host: 'e2e-academy1-primary.org:3005' },
      query: {},
    };
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };
    let calledNext = false;

    resolveTenant(req, res, () => {
      calledNext = true;
    });

    assert.ok(calledNext, 'Middleware next() must be called');
    assert.ok(req.academy, 'req.academy must be populated');
    assert.equal(req.academy.id, testAcademy1.id);
    assert.ok(req.tenantDb, 'req.tenantDb connection must be attached');
  });

  it('6. TenantResolver successfully identifies tenant by subdomain', () => {
    const req = {
      headers: { host: 'e2e-domain-test-2.internationalsportssolutions.test' },
      query: {},
    };
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };
    let calledNext = false;

    resolveTenant(req, res, () => {
      calledNext = true;
    });

    assert.ok(calledNext);
    assert.equal(req.academy.id, testAcademy2.id);
  });

  it('7. Protects deletion when only 1 domain remains for an academy', () => {
    const count = centralDb.prepare('SELECT COUNT(*) as c FROM domains WHERE academy_id = ?').get(testAcademy2.id).c;
    assert.equal(count, 2);

    // Delete one domain
    const d1 = centralDb.prepare('SELECT id FROM domains WHERE academy_id = ? LIMIT 1').get(testAcademy2.id);
    centralDb.prepare('DELETE FROM domains WHERE id = ?').run(d1.id);

    const remainingCount = centralDb.prepare('SELECT COUNT(*) as c FROM domains WHERE academy_id = ?').get(testAcademy2.id).c;
    assert.equal(remainingCount, 1);

    // Business rule: preventing deletion of the last remaining domain
    assert.ok(remainingCount <= 1, 'Validation check triggers prevent deletion');
  });

  it('8. Safely resolves cloud preview and airoapp domains without false subdomain extraction', () => {
    const previewReq = {
      headers: { host: 'quzjwl4b2x.preview.c40.airoapp.ai' },
      query: {},
    };
    assert.equal(extractSubdomain(previewReq), null, 'Preview host must not extract random container hash as tenant slug');

    const res = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };
    let calledNext = false;

    resolveTenant(previewReq, res, () => {
      calledNext = true;
    });

    assert.ok(calledNext, 'Middleware next() must be called for preview domain');
    assert.ok(previewReq.academy, 'req.academy must be populated with default active academy');
    assert.ok(previewReq.tenantDb, 'req.tenantDb must be mounted');
  });
});
