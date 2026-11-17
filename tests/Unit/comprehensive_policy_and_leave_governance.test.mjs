import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { LeaveService } from '../../src/services/leaveService.js';
import { OvertimeService } from '../../src/services/overtimeService.js';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/index.js';

describe('Comprehensive Policy Settings & Leave Governance Test Suite', () => {
  let db;
  let adminToken;
  let baseUrl;
  let serverProcess;

  before(async () => {
    db = getTenantDbById(1);
    LeaveService.ensureDefaultPolicies(db, 1);

    adminToken = jwt.sign(
      { userId: 1, academyId: 1, role: 'academy_admin', permissions: ['all'] },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    baseUrl = `http://localhost:${config.port || 3005}`;
  });

  it('1. GET /api/academy/settings/policy returns all comprehensive governance fields', async () => {
    const res = await fetch(`${baseUrl}/api/academy/settings/policy`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.policy);

    // Verify all newly added governance fields exist with expected defaults
    assert.equal(data.policy.fee_grace_period_days, 7);
    assert.equal(data.policy.allow_fee_pauses, 1);
    assert.equal(data.policy.default_currency, 'INR');
    assert.equal(data.policy.standard_shift_hours, 8.0);
    assert.equal(data.policy.late_attendance_threshold_mins, 15);
    assert.equal(data.policy.checkin_window_before_mins, 30);
    assert.equal(data.policy.checkin_window_after_mins, 60);
    assert.equal(data.policy.allow_wrong_batch_checkin, 0);
    assert.equal(data.policy.auto_approve_corrections, 0);
    assert.equal(data.policy.allow_student_portal_leaves, 1);
  });

  it('2. PUT /api/academy/settings/policy updates and enforces governance rules', async () => {
    const res = await fetch(`${baseUrl}/api/academy/settings/policy`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        attendance_cutoff_days: 3,
        overtime_threshold_minutes: 45,
        statement_visibility_day: 26,
        expected_payday: 5,
        overtime_compensation_mode: 'overtime_rate',
        fee_grace_period_days: 10,
        allow_fee_pauses: 0,
        default_currency: 'USD',
        standard_shift_hours: 7.5,
        late_attendance_threshold_mins: 20,
        checkin_window_before_mins: 45,
        checkin_window_after_mins: 75,
        allow_wrong_batch_checkin: 1,
        auto_approve_corrections: 1,
        allow_student_portal_leaves: 0
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.policy.attendance_cutoff_days, 3);
    assert.equal(data.policy.fee_grace_period_days, 10);
    assert.equal(data.policy.allow_fee_pauses, 0);
    assert.equal(data.policy.default_currency, 'USD');
    assert.equal(data.policy.standard_shift_hours, 7.5);
    assert.equal(data.policy.late_attendance_threshold_mins, 20);
    assert.equal(data.policy.checkin_window_before_mins, 45);
    assert.equal(data.policy.checkin_window_after_mins, 75);
    assert.equal(data.policy.allow_wrong_batch_checkin, 1);
    assert.equal(data.policy.auto_approve_corrections, 1);
    assert.equal(data.policy.allow_student_portal_leaves, 0);
  });

  it('3. GET /api/academy/leaves/policies returns baseline leave policies', async () => {
    const res = await fetch(`${baseUrl}/api/academy/leaves/policies`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.policies));
    assert.ok(data.policies.length >= 5);

    const casual = data.policies.find(p => p.leave_type === 'casual');
    assert.ok(casual);
    assert.equal(casual.name, 'Casual Leave (CL)');
  });

  it('4. POST /api/academy/leaves/policies updates leave quotas in batch', async () => {
    const res = await fetch(`${baseUrl}/api/academy/leaves/policies`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        policies: [
          { leave_type: 'casual', name: 'Casual Leave (CL)', annual_quota: 14, monthly_accrual: 1.16, is_paid: 1, allow_half_day: 1, allow_carry_forward: 0 },
          { leave_type: 'sick', name: 'Sick Leave (SL)', annual_quota: 10, monthly_accrual: 0.83, is_paid: 1, allow_half_day: 1, allow_carry_forward: 1, max_carry_forward: 10 }
        ]
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.count, 2);

    // Verify updated quotas in database
    const updatedCasual = db.prepare("SELECT * FROM leave_policies WHERE leave_type = 'casual' AND academy_id = 1").get();
    assert.equal(updatedCasual.annual_quota, 14);

    const updatedSick = db.prepare("SELECT * FROM leave_policies WHERE leave_type = 'sick' AND academy_id = 1").get();
    assert.equal(updatedSick.annual_quota, 10);
  });

  it('5. POST and DELETE /api/academy/leaves/policies manages custom leave policy lifecycle', async () => {
    // Create custom policy
    const createRes = await fetch(`${baseUrl}/api/academy/leaves/policies`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        leave_type: 'test_maternity',
        name: 'Maternity Leave',
        annual_quota: 90,
        monthly_accrual: 0,
        is_paid: 1,
        allow_half_day: 0,
        allow_carry_forward: 0,
        max_carry_forward: 0
      })
    });
    assert.equal(createRes.status, 200);
    const createData = await createRes.json();
    assert.equal(createData.success, true);

    const customRow = db.prepare("SELECT * FROM leave_policies WHERE leave_type = 'test_maternity' AND academy_id = 1").get();
    assert.ok(customRow);
    assert.equal(customRow.annual_quota, 90);
    assert.equal(customRow.is_active, 1);

    // Delete / Deactivate custom policy
    const delRes = await fetch(`${baseUrl}/api/academy/leaves/policies/${customRow.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(delRes.status, 200);
    const delData = await delRes.json();
    assert.equal(delData.success, true);

    const deactivatedRow = db.prepare("SELECT * FROM leave_policies WHERE id = ?").get(customRow.id);
    assert.equal(deactivatedRow.is_active, 0);
  });

  it('6. PUT /api/academy/settings/policy with reset_to_defaults restores standard governance', async () => {
    const res = await fetch(`${baseUrl}/api/academy/settings/policy`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reset_to_defaults: true })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.policy.attendance_cutoff_days, 2);
    assert.equal(data.policy.overtime_threshold_minutes, 30);
    assert.equal(data.policy.statement_visibility_day, 25);
    assert.equal(data.policy.expected_payday, 1);
    assert.equal(data.policy.fee_grace_period_days, 7);
    assert.equal(data.policy.allow_fee_pauses, 1);
    assert.equal(data.policy.default_currency, 'INR');
    assert.equal(data.policy.standard_shift_hours, 8.0);
    assert.equal(data.policy.late_attendance_threshold_mins, 15);
    assert.equal(data.policy.checkin_window_before_mins, 30);
    assert.equal(data.policy.checkin_window_after_mins, 60);
    assert.equal(data.policy.allow_wrong_batch_checkin, 0);
    assert.equal(data.policy.auto_approve_corrections, 0);
    assert.equal(data.policy.allow_student_portal_leaves, 1);
  });

  it('7. Super Admin (non-tenant user ID) applies and approves coach leave without FOREIGN KEY error', async () => {
    // Generate a Super Admin token with userId 9999 (does not exist in tenant users)
    const superAdminToken = jwt.sign({
      userId: 9999,
      name: 'Central Super Admin',
      email: 'central_sa@example.com',
      role: 'super_admin',
      isSuperAdmin: true
    }, config.jwtSecret);

    // Clean up test dates to prevent duplicate overlap on re-runs
    db.prepare("DELETE FROM leave_requests WHERE start_date = '2026-12-10'").run();

    // Ensure test coach exists
    const coach = db.prepare('SELECT id, user_id, name FROM coaches LIMIT 1').get();
    assert.ok(coach, 'Coach must exist in test database');

    const res = await fetch(`${baseUrl}/api/academy/leaves`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        applicant_type: 'coach',
        applicant_id: coach.id,
        applicant_name: coach.name,
        leave_type: 'casual',
        start_date: '2026-12-10',
        end_date: '2026-12-10',
        day_part: 'full_day',
        reason: 'Casual Leave: Annual workshop',
        status: 'approved',
        reviewer_comments: 'Approved by Central Super Admin'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 201, `Failed to apply leave: ${data.error}`);
    assert.equal(data.success, true);
    assert.equal(data.status, 'approved');

    // Verify row in leave_requests
    const leaveRow = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(data.leaveId);
    assert.ok(leaveRow);
    assert.equal(leaveRow.status, 'approved');
    // reviewed_by should be safely null because 9999 is not in tenant users
    assert.equal(leaveRow.reviewed_by, null);
    assert.ok(leaveRow.reviewer_comments.includes('Approved by Central Super Admin'));
  });

  it('8. Super Admin reviews pending leave request without FOREIGN KEY error', async () => {
    const superAdminToken = jwt.sign({
      userId: 9999,
      name: 'Central Super Admin',
      email: 'central_sa@example.com',
      role: 'super_admin',
      isSuperAdmin: true
    }, config.jwtSecret);

    // Clean up test dates to prevent duplicate overlap on re-runs
    db.prepare("DELETE FROM leave_requests WHERE start_date = '2026-12-15'").run();

    const coach = db.prepare('SELECT id, user_id, name FROM coaches LIMIT 1').get();

    // Create a pending leave request directly or via API
    const createRes = await fetch(`${baseUrl}/api/academy/leaves`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        applicant_type: 'coach',
        applicant_id: coach.id,
        applicant_name: coach.name,
        leave_type: 'sick',
        start_date: '2026-12-15',
        end_date: '2026-12-15',
        day_part: 'full_day',
        reason: 'Medical Leave: Dental checkup',
        status: 'pending'
      })
    });
    const createData = await createRes.json();
    assert.equal(createData.success, true, `Failed to create pending leave: ${createData.error}`);

    // Review with super admin token
    const reviewRes = await fetch(`${baseUrl}/api/academy/leaves/${createData.leaveId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'approved',
        reviewer_comments: 'Reviewed and approved by Super Admin'
      })
    });

    const reviewData = await reviewRes.json();
    assert.equal(reviewRes.status, 200, `Review failed: ${reviewData.error}`);
    assert.equal(reviewData.success, true);

    const updated = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(createData.leaveId);
    assert.equal(updated.status, 'approved');
    assert.equal(updated.reviewed_by, null);
  });

  it('9. Submitting leave for non-existent staff user throws clear roster validation error', async () => {
    const res = await fetch(`${baseUrl}/api/academy/leaves`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        applicant_type: 'staff',
        applicant_id: 88888,
        applicant_name: 'Unknown Staff',
        leave_type: 'casual',
        start_date: '2026-12-20',
        end_date: '2026-12-20',
        reason: 'Test non-existent user'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.ok(data.error.includes('not found in this academy\'s staff roster'));
  });
});
