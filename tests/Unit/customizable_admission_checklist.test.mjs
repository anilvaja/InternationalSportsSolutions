import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import { InquiryService } from '../../src/services/inquiryService.js';
import app from '../../server.js';

describe('Customizable Admission Checklist Workflow', () => {
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

  let templateId;

  it('1. Admin can view configured admission checklist templates', async () => {
    const res = await api('/api/academy/admission-checklist/templates');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.templates));
    assert.ok(res.data.templates.length >= 4);
    assert.ok(res.data.templates.some((t) => t.item_key === 'guardian_consent'));
  });

  it('2. Admin can create a custom checklist item template', async () => {
    const res = await api('/api/academy/admission-checklist/templates', {
      method: 'POST',
      body: {
        item_name: 'Dojo Uniform & Gi Size Measurement',
        item_key: 'gi_size_measurement',
        is_mandatory: 1,
        sort_order: 60
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.template.item_key, 'gi_size_measurement');
    assert.equal(res.data.template.is_mandatory, 1);
    templateId = res.data.template.id;
  });

  it('3. Coach without admin privileges is blocked from creating templates', async () => {
    const res = await api('/api/academy/admission-checklist/templates', {
      method: 'POST',
      token: coachToken,
      body: { item_name: 'Unauthorized Template' }
    });
    assert.equal(res.status, 403);
  });

  it('4. Converting admission uses newly configured checklist template dynamically', async () => {
    // 1. Create an inquiry
    const inqRes = await api('/api/academy/inquiries', {
      method: 'POST',
      body: {
        student_name: 'Aditya ChecklistTest',
        phone: '9898011223',
        source: 'walk_in',
        notes: 'Checklist test inquiry'
      }
    });
    assert.equal(inqRes.status, 201);
    const inquiryId = inqRes.data.inquiry.id;

    // 2. Convert inquiry to admission
    const res = await api(`/api/academy/inquiries/${inquiryId}/convert`, {
      method: 'POST',
      body: {
        first_name: 'Aditya',
        last_name: 'ChecklistTest',
        phone: '9898011223',
        branch_id: 1,
        joining_date: '10/11/2026',
        discount_type: 'none',
        medical_consent: 1
      }
    });

    assert.equal(res.status, 201);
    assert.ok(res.data.student.id);
    const studentId = res.data.student.id;

    // 3. Check student's initialized checklist
    const chkRes = await api(`/api/academy/students/${studentId}/checklist`);
    assert.equal(chkRes.status, 200);
    const customItem = chkRes.data.checklist.find((i) => i.item_key === 'gi_size_measurement');
    assert.ok(customItem, 'Custom template was dynamically added to new student checklist');
    assert.equal(customItem.is_mandatory, 1);
    assert.equal(customItem.is_completed, 0);

    // Clean up test records
    db.prepare('DELETE FROM admission_checklists WHERE student_id = ?').run(studentId);
    db.prepare('DELETE FROM student_fees WHERE student_id = ?').run(studentId);
    db.prepare('DELETE FROM student_batch_enrollments WHERE student_id = ?').run(studentId);
    db.prepare('DELETE FROM students WHERE id = ?').run(studentId);
    db.prepare('DELETE FROM inquiries WHERE id = ?').run(inquiryId);
  });

  it('5. Admin can update and deactivate checklist template', async () => {
    const updateRes = await api(`/api/academy/admission-checklist/templates/${templateId}`, {
      method: 'PUT',
      body: { is_mandatory: 0, sort_order: 70 }
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.template.is_mandatory, 0);

    const deleteRes = await api(`/api/academy/admission-checklist/templates/${templateId}`, {
      method: 'DELETE'
    });
    assert.equal(deleteRes.status, 200);

    const listRes = await api('/api/academy/admission-checklist/templates');
    assert.ok(!listRes.data.templates.some((t) => t.id === templateId));
  });
});
