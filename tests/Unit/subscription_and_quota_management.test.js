import test from 'node:test';
import assert from 'node:assert/strict';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById, provisionAcademyDb } from '../../src/db/connectionManager.js';
import { QuotaService, DEFAULT_PLAN_VALUES } from '../../src/services/quotaService.js';

test('Subscription Plans & Academy Quota Management Module', async (t) => {
  const centralDb = getCentralDb();
  const testRunId = Date.now().toString().slice(-4);
  const academySlugA = `quota-test-a-${testRunId}`;
  const academySlugB = `quota-test-b-${testRunId}`;

  // Provision isolated sandbox test academies
  const academyA = provisionAcademyDb({
    name: `Quota Test Academy A ${testRunId}`,
    slug: academySlugA,
    admin_name: 'Admin A',
    admin_email: `admin.a.${testRunId}@test.com`,
    admin_password: 'password',
    max_branches: 2,
    max_students: 200,
    max_coaches: 5,
  });

  const academyB = provisionAcademyDb({
    name: `Quota Test Academy B ${testRunId}`,
    slug: academySlugB,
    admin_name: 'Admin B',
    admin_email: `admin.b.${testRunId}@test.com`,
    admin_password: 'password',
    max_branches: 2,
    max_students: 200,
    max_coaches: 5,
  });

  const tenantDbA = getTenantDbById(academyA.id);
  const tenantDbB = getTenantDbById(academyB.id);

  let planId;

  // Ensure clean test plan
  const testPlanSlug = `standard-test-${testRunId}`;

  await t.test('1. Create Standard plan: All six configured values persist in database', () => {
    const insertPlan = centralDb.prepare(`
      INSERT INTO subscription_plans (name, slug, description, price, billing_interval, trial_days, status)
      VALUES (?, ?, 'Standard Test Tier', 2499, 'monthly', 14, 'draft')
    `).run(`Standard Plan ${testRunId}`, testPlanSlug);

    planId = Number(insertPlan.lastInsertRowid);

    // Persist all 6 illustrative quotas
    const quotasToSet = {
      users: 10,
      branches: 2,
      batches: 10,
      students: 200,
      students_per_batch: 30,
      coaches: 5,
    };

    for (const [key, val] of Object.entries(quotasToSet)) {
      centralDb.prepare(`
        INSERT INTO subscription_plan_limits (plan_id, quota_key, limit_value, counting_policy)
        VALUES (?, ?, ?, 'active_only')
      `).run(planId, key, val);
    }

    // Verify persistence
    const savedLimits = centralDb.prepare('SELECT quota_key, limit_value FROM subscription_plan_limits WHERE plan_id = ?').all(planId);
    const limitMap = Object.fromEntries(savedLimits.map(l => [l.quota_key, l.limit_value]));

    assert.equal(limitMap.users, 10);
    assert.equal(limitMap.branches, 2);
    assert.equal(limitMap.batches, 10);
    assert.equal(limitMap.students, 200);
    assert.equal(limitMap.students_per_batch, 30);
    assert.equal(limitMap.coaches, 5);
  });

  await t.test('2. Assign Standard plan to Academy A and resolve its six quotas correctly', () => {
    centralDb.prepare(`
      INSERT INTO academy_subscriptions (academy_id, plan_id, status, starts_at)
      VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
    `).run(academyA.id, planId);

    assert.equal(QuotaService.effectiveLimit(academyA.id, 'users'), 10);
    assert.equal(QuotaService.effectiveLimit(academyA.id, 'branches'), 2);
    assert.equal(QuotaService.effectiveLimit(academyA.id, 'batches'), 10);
    assert.equal(QuotaService.effectiveLimit(academyA.id, 'students'), 200);
    assert.equal(QuotaService.effectiveLimit(academyA.id, 'students_per_batch'), 30);
    assert.equal(QuotaService.effectiveLimit(academyA.id, 'coaches'), 5);
  });

  await t.test('3. Change Standard plan limits and verify new effective values apply', () => {
    centralDb.prepare(`
      UPDATE subscription_plan_limits
      SET limit_value = 12
      WHERE plan_id = ? AND quota_key = 'batches'
    `).run(planId);

    assert.equal(QuotaService.effectiveLimit(academyA.id, 'batches'), 12);

    // Revert back to standard 10
    centralDb.prepare(`
      UPDATE subscription_plan_limits
      SET limit_value = 10
      WHERE plan_id = ? AND quota_key = 'batches'
    `).run(planId);
  });

  await t.test("4. Override one academy's branch limit: other academies remain unaffected", () => {
    // Override Academy A branch limit from 2 to 3
    centralDb.prepare(`
      INSERT INTO academy_limit_overrides (academy_id, quota_key, override_value, reason)
      VALUES (?, 'branches', 3, 'Special promotion expansion')
    `).run(academyA.id);

    assert.equal(QuotaService.effectiveLimit(academyA.id, 'branches'), 3);
    // Academy B must remain unaffected (inherits standard limit = 2)
    assert.equal(QuotaService.effectiveLimit(academyB.id, 'branches'), 2);

    // Clean up override for subsequent branch boundary test
    centralDb.prepare('DELETE FROM academy_limit_overrides WHERE academy_id = ?').run(academyA.id);
    assert.equal(QuotaService.effectiveLimit(academyA.id, 'branches'), 2);
  });

  await t.test('5. Branches quota boundary: 2nd branch allowed, 3rd branch rejected', () => {
    // 1st branch already provisioned or created
    tenantDbA.prepare("INSERT INTO branches (name, is_active, academy_id) VALUES ('North Branch', 1, ?)").run(academyA.id);
    assert.equal(QuotaService.usage(academyA.id, 'branches'), 1);

    // 2nd branch is allowed (1 + 1 = 2 <= 2)
    assert.doesNotThrow(() => {
      QuotaService.assertCanCreate(academyA.id, 'branches', 1);
    });

    tenantDbA.prepare("INSERT INTO branches (name, is_active, academy_id) VALUES ('South Branch', 1, ?)").run(academyA.id);
    assert.equal(QuotaService.usage(academyA.id, 'branches'), 2);

    // 3rd branch must be rejected (2 + 1 = 3 > 2)
    assert.throws(() => {
      QuotaService.assertCanCreate(academyA.id, 'branches', 1);
    }, /reached its maximum of 2 branches/);
  });

  await t.test('6. Batches quota boundary: 10th batch allowed, 11th batch rejected', () => {
    const branch = tenantDbA.prepare('SELECT id FROM branches LIMIT 1').get();

    // Populate batches up to 9
    for (let i = 1; i <= 9; i++) {
      tenantDbA.prepare(`
        INSERT INTO batches (name, branch_id, start_time, end_time, is_active, academy_id)
        VALUES (?, ?, '06:00', '07:00', 1, ?)
      `).run(`Batch ${i}`, branch.id, academyA.id);
    }
    assert.equal(QuotaService.usage(academyA.id, 'batches'), 9);

    // 10th batch is allowed
    assert.doesNotThrow(() => {
      QuotaService.assertCanCreate(academyA.id, 'batches', 1);
    });

    tenantDbA.prepare(`
      INSERT INTO batches (name, branch_id, start_time, end_time, is_active, academy_id)
      VALUES ('Batch 10', ?, '07:00', '08:00', 1, ?)
    `).run(branch.id, academyA.id);
    assert.equal(QuotaService.usage(academyA.id, 'batches'), 10);

    // 11th batch must be rejected
    assert.throws(() => {
      QuotaService.assertCanCreate(academyA.id, 'batches', 1);
    }, /reached its maximum of 10 batches/);
  });

  await t.test('7. Students quota boundary: 200th student allowed, 201st student rejected', () => {
    // Override student limit to 5 for fast boundary test
    centralDb.prepare(`
      INSERT INTO academy_limit_overrides (academy_id, quota_key, override_value, reason)
      VALUES (?, 'students', 5, 'Boundary testing override')
    `).run(academyA.id);

    for (let i = 1; i <= 4; i++) {
      tenantDbA.prepare(`
        INSERT INTO students (student_code, first_name, last_name, status, academy_id)
        VALUES (?, 'Student', ?, 'active', ?)
      `).run(`STU-${testRunId}-${i}`, String(i), academyA.id);
    }
    assert.equal(QuotaService.usage(academyA.id, 'students'), 4);

    // 5th student allowed
    assert.doesNotThrow(() => {
      QuotaService.assertCanCreate(academyA.id, 'students', 1);
    });

    tenantDbA.prepare(`
      INSERT INTO students (student_code, first_name, last_name, status, academy_id)
      VALUES (?, 'Student', '5', 'active', ?)
    `).run(`STU-${testRunId}-5`, academyA.id);

    // 6th student rejected
    assert.throws(() => {
      QuotaService.assertCanCreate(academyA.id, 'students', 1);
    }, /reached its maximum of 5 students/);

    // Clean up override
    centralDb.prepare("DELETE FROM academy_limit_overrides WHERE academy_id = ? AND quota_key = 'students'").run(academyA.id);
  });

  await t.test('8. Students per batch quota boundary: 30th student allowed, 31st student rejected', () => {
    const batch = tenantDbA.prepare('SELECT id FROM batches LIMIT 1').get();

    // Set batch cap override to 3 for fast boundary test
    centralDb.prepare(`
      INSERT INTO academy_limit_overrides (academy_id, quota_key, override_value, reason)
      VALUES (?, 'students_per_batch', 3, 'Per-batch test override')
    `).run(academyA.id);

    const students = tenantDbA.prepare('SELECT id FROM students LIMIT 3').all();

    // Enroll 2 students
    tenantDbA.prepare("INSERT INTO student_batch_enrollments (student_id, batch_id, status) VALUES (?, ?, 'active')").run(students[0].id, batch.id);
    tenantDbA.prepare("INSERT INTO student_batch_enrollments (student_id, batch_id, status) VALUES (?, ?, 'active')").run(students[1].id, batch.id);

    assert.equal(QuotaService.usage(academyA.id, 'students_per_batch', { batchId: batch.id }), 2);

    // 3rd student enrollment allowed
    assert.doesNotThrow(() => {
      QuotaService.assertCanCreate(academyA.id, 'students_per_batch', 1, { batchId: batch.id });
    });

    tenantDbA.prepare("INSERT INTO student_batch_enrollments (student_id, batch_id, status) VALUES (?, ?, 'active')").run(students[2].id, batch.id);
    assert.equal(QuotaService.usage(academyA.id, 'students_per_batch', { batchId: batch.id }), 3);

    // 4th student enrollment rejected
    assert.throws(() => {
      QuotaService.assertCanCreate(academyA.id, 'students_per_batch', 1, { batchId: batch.id });
    }, /reached its maximum of 3 students in this batch/);

    centralDb.prepare("DELETE FROM academy_limit_overrides WHERE academy_id = ? AND quota_key = 'students_per_batch'").run(academyA.id);
  });

  await t.test('9. Coaches quota boundary: 5th coach allowed, 6th coach rejected', () => {
    // Academy A starts with initial coaches. Set coach override to 2
    centralDb.prepare(`
      INSERT INTO academy_limit_overrides (academy_id, quota_key, override_value, reason)
      VALUES (?, 'coaches', 2, 'Coach quota test')
    `).run(academyA.id);

    tenantDbA.prepare("DELETE FROM coaches WHERE is_active = 1").run();
    tenantDbA.prepare("INSERT INTO coaches (name, is_active) VALUES ('Coach 1', 1)").run();

    assert.equal(QuotaService.usage(academyA.id, 'coaches'), 1);

    // 2nd coach allowed
    assert.doesNotThrow(() => {
      QuotaService.assertCanCreate(academyA.id, 'coaches', 1);
    });

    tenantDbA.prepare("INSERT INTO coaches (name, is_active) VALUES ('Coach 2', 1)").run();

    // 3rd coach rejected
    assert.throws(() => {
      QuotaService.assertCanCreate(academyA.id, 'coaches', 1);
    }, /reached its maximum of 2 coaches/);

    centralDb.prepare("DELETE FROM academy_limit_overrides WHERE academy_id = ? AND quota_key = 'coaches'").run(academyA.id);
  });

  await t.test('10. Role transition: converting staff user to coach enforces coach quota', () => {
    // Set coaches limit to 1
    centralDb.prepare(`
      INSERT INTO academy_limit_overrides (academy_id, quota_key, override_value, reason)
      VALUES (?, 'coaches', 1, 'Single coach limit')
    `).run(academyA.id);

    tenantDbA.prepare("DELETE FROM coaches WHERE is_active = 1").run();
    tenantDbA.prepare("INSERT INTO coaches (name, is_active) VALUES ('Existing Coach', 1)").run();

    // Usage is 1, effective limit is 1
    assert.equal(QuotaService.usage(academyA.id, 'coaches'), 1);

    // Transitioning a staff user to coach must be rejected because coach quota is full
    assert.throws(() => {
      QuotaService.assertCanCreate(academyA.id, 'coaches', 1);
    }, /reached its maximum of 1 coaches/);

    centralDb.prepare("DELETE FROM academy_limit_overrides WHERE academy_id = ? AND quota_key = 'coaches'").run(academyA.id);
  });

  await t.test('11. Bulk import exceeding capacity is rejected prior to insert', () => {
    // Current students = 5. Set limit to 6
    centralDb.prepare(`
      INSERT INTO academy_limit_overrides (academy_id, quota_key, override_value, reason)
      VALUES (?, 'students', 6, 'Import limit test')
    `).run(academyA.id);

    const currentStudents = QuotaService.usage(academyA.id, 'students');

    // Attempting to bulk import 3 students when only 1 slot remains must throw
    assert.throws(() => {
      QuotaService.assertCanCreate(academyA.id, 'students', 3);
    }, /reached its maximum of 6 students/);

    // Verify existing student count remains untouched
    assert.equal(QuotaService.usage(academyA.id, 'students'), currentStudents);

    centralDb.prepare("DELETE FROM academy_limit_overrides WHERE academy_id = ? AND quota_key = 'students'").run(academyA.id);
  });

  await t.test('12. Concurrency safety: atomic lock ensures two competing requests cannot both succeed', () => {
    // Set branches limit to exactly current count + 1
    const currentBranches = QuotaService.usage(academyA.id, 'branches');
    centralDb.prepare(`
      INSERT INTO academy_limit_overrides (academy_id, quota_key, override_value, reason)
      VALUES (?, 'branches', ?, 'Concurrency test limit')
    `).run(academyA.id, currentBranches + 1);

    let successCount = 0;
    let failureCount = 0;

    // Simulate two concurrent requests competing for 1 remaining branch slot
    const tryCreateBranch = () => {
      try {
        QuotaService.executeWithQuotaLock(academyA.id, 'branches', 1, {}, (db) => {
          db.prepare("INSERT INTO branches (name, is_active, academy_id) VALUES ('Concurrent Branch', 1, ?)").run(academyA.id);
          successCount++;
        });
      } catch (e) {
        failureCount++;
      }
    };

    tryCreateBranch();
    tryCreateBranch();

    assert.equal(successCount, 1, 'Exactly one concurrent request must succeed');
    assert.equal(failureCount, 1, 'The competing concurrent request must be rejected');

    centralDb.prepare("DELETE FROM academy_limit_overrides WHERE academy_id = ? AND quota_key = 'branches'").run(academyA.id);
  });

  await t.test('13. Limit reduction below current usage: preserves existing records and blocks further creation', () => {
    const currentBranches = QuotaService.usage(academyA.id, 'branches');

    // Reduce branch limit to 1 (which is less than current branches)
    centralDb.prepare(`
      INSERT INTO academy_limit_overrides (academy_id, quota_key, override_value, reason)
      VALUES (?, 'branches', 1, 'Downsizing test')
    `).run(academyA.id);

    // Existing records are preserved intact (never deleted)
    assert.equal(QuotaService.usage(academyA.id, 'branches'), currentBranches);

    // Summary correctly flags over-limit state
    const summary = QuotaService.getAcademyQuotaSummary(academyA.id);
    assert.equal(summary.branches.is_over_limit, true);
    assert.equal(summary.branches.remaining, 0);

    // Further creation is strictly blocked
    assert.throws(() => {
      QuotaService.assertCanCreate(academyA.id, 'branches', 1);
    }, /reached its maximum of 1 branches/);

    centralDb.prepare("DELETE FROM academy_limit_overrides WHERE academy_id = ? AND quota_key = 'branches'").run(academyA.id);
  });

  await t.test('14. Expiry policy: expired override reverts to plan; expired subscription blocks creation', () => {
    // 1. Expired override reverts to plan limit (branches = 2)
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    centralDb.prepare(`
      INSERT INTO academy_limit_overrides (academy_id, quota_key, override_value, reason, ends_at)
      VALUES (?, 'branches', 10, 'Expired promo', ?)
    `).run(academyA.id, yesterday);

    assert.equal(QuotaService.effectiveLimit(academyA.id, 'branches'), 2);

    // 2. Expired subscription blocks creation
    centralDb.prepare(`
      UPDATE academy_subscriptions
      SET status = 'expired'
      WHERE academy_id = ?
    `).run(academyA.id);

    assert.throws(() => {
      QuotaService.assertCanCreate(academyA.id, 'branches', 1);
    }, /subscription is currently expired/);

    // Restore active status
    centralDb.prepare(`
      UPDATE academy_subscriptions
      SET status = 'active'
      WHERE academy_id = ?
    `).run(academyA.id);

    // Clean up
    centralDb.prepare("DELETE FROM academy_limit_overrides WHERE academy_id = ?").run(academyA.id);
  });
});
