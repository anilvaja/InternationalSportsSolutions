import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';

describe('Organization Documents & Compliance Management (Section 16)', () => {
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
      name: 'Academy Admin',
    });

    coachToken = signToken({
      userId: 2,
      email: 'rajesh.kumite@pratikkarate.com',
      role: 'coach',
      academyId: ACADEMY_ID,
      name: 'Rajesh Coach',
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
      'X-Tenant-Id': String(ACADEMY_ID),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  it('1. Blocks non-admin (coach) from accessing compliance documents and alert feeds', async () => {
    const resList = await api('/api/academy/compliance/documents', { token: coachToken });
    assert.equal(resList.status, 403, 'Coach must be denied access to compliance documents');

    const resCreate = await api('/api/academy/compliance/documents', {
      method: 'POST',
      token: coachToken,
      body: { title: 'Unauthorized Document', category: 'agreement' },
    });
    assert.equal(resCreate.status, 403, 'Coach must be denied creating compliance documents');

    const resAlerts = await api('/api/academy/compliance/expiring-alerts', { token: coachToken });
    assert.equal(resAlerts.status, 403, 'Coach must be denied viewing compliance alerts');
  });

  it('2. Admin can create agreements, insurance, and AMC documents with renewal windows', async () => {
    // 1. Lease Agreement
    const resLease = await api('/api/academy/compliance/documents', {
      method: 'POST',
      body: {
        title: 'Main Dojo Facility Lease Agreement 2026-2028',
        category: 'agreement',
        document_number: 'LEASE-AHM-001',
        issuing_authority: 'Ahmedabad Municipal Corporation',
        issue_date: '01/01/2026',
        expiry_date: '31/12/2028',
        renewal_reminder_days: 60,
        notes: 'Commercial lease for central training headquarters',
      },
    });
    assert.equal(resLease.status, 201);
    assert.equal(resLease.data.success, true);
    assert.equal(resLease.data.document.title, 'Main Dojo Facility Lease Agreement 2026-2028');
    assert.equal(resLease.data.document.category, 'agreement');

    // 2. Equipment AMC expiring in 15 days
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 15);
    const expStr = `${String(expDate.getDate()).padStart(2, '0')}/${String(expDate.getMonth() + 1).padStart(2, '0')}/${expDate.getFullYear()}`;

    const resAmc = await api('/api/academy/compliance/documents', {
      method: 'POST',
      body: {
        title: 'Tatami Mats & Heavy Bag Annual Maintenance Contract',
        category: 'equipment_amc',
        document_number: 'AMC-TATAMI-2026',
        issuing_authority: 'ProMat Services India',
        issue_date: '01/01/2026',
        expiry_date: expStr,
        renewal_reminder_days: 30,
      },
    });
    assert.equal(resAmc.status, 201);
    assert.equal(resAmc.data.document.category, 'equipment_amc');

    // 3. Already expired policy
    const resExpired = await api('/api/academy/compliance/documents', {
      method: 'POST',
      body: {
        title: 'Old Public Liability Insurance 2025',
        category: 'insurance',
        document_number: 'INS-2025-OLD',
        issuing_authority: 'Oriental Insurance Co',
        issue_date: '01/01/2025',
        expiry_date: '01/01/2026',
      },
    });
    assert.equal(resExpired.status, 201);
    assert.equal(resExpired.data.document.status, 'expired');
  });

  it('3. Can query compliance documents with category and keyword search filters', async () => {
    const resAll = await api('/api/academy/compliance/documents');
    assert.equal(resAll.status, 200);
    assert.ok(resAll.data.documents.length >= 3);

    const resAmc = await api('/api/academy/compliance/documents?category=equipment_amc');
    assert.equal(resAmc.status, 200);
    assert.ok(resAmc.data.documents.some((d) => d.category === 'equipment_amc'));

    const resSearch = await api('/api/academy/compliance/documents?search=Lease');
    assert.equal(resSearch.status, 200);
    assert.ok(resSearch.data.documents.some((d) => d.title.includes('Lease')));
  });

  it('4. Detects expiring documents within the reminder window and lists expired documents', async () => {
    const resAlerts = await api('/api/academy/compliance/expiring-alerts');
    assert.equal(resAlerts.status, 200);
    assert.equal(resAlerts.data.success, true);
    assert.ok(resAlerts.data.expiring_count >= 1, 'Should find AMC expiring in 15 days');
    assert.ok(resAlerts.data.expired_count >= 1, 'Should find old insurance expired in Jan 2026');

    const amcAlert = resAlerts.data.expiring_documents.find((d) => d.document_number === 'AMC-TATAMI-2026');
    assert.ok(amcAlert, 'Expiring list should include the tatami AMC');

    const expiredAlert = resAlerts.data.expired_documents.find((d) => d.document_number === 'INS-2025-OLD');
    assert.ok(expiredAlert, 'Expired list should include the 2025 insurance');
  });

  it('5. Can update and delete compliance documents', async () => {
    const createRes = await api('/api/academy/compliance/documents', {
      method: 'POST',
      body: {
        title: 'Temporary Building NOC',
        category: 'license',
        document_number: 'NOC-TEMP-999',
      },
    });
    assert.equal(createRes.status, 201);
    const docId = createRes.data.document.id;

    // Update
    const updateRes = await api(`/api/academy/compliance/documents/${docId}`, {
      method: 'PUT',
      body: {
        title: 'Updated Permanent Building NOC',
        notes: 'Verified by Chief Fire Officer',
        status: 'active',
      },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.document.title, 'Updated Permanent Building NOC');
    assert.equal(updateRes.data.document.notes, 'Verified by Chief Fire Officer');

    // Delete
    const deleteRes = await api(`/api/academy/compliance/documents/${docId}`, {
      method: 'DELETE',
    });
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.data.success, true);

    // Verify deleted
    const verifyRes = await api('/api/academy/compliance/documents?search=NOC-TEMP-999');
    assert.equal(verifyRes.data.documents.length, 0);
  });
});

