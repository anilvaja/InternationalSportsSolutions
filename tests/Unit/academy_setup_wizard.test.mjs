import test from 'node:test';
import assert from 'node:assert/strict';
import { getCentralDb } from '../../src/db/centralDb.js';
import { getTenantDbById, closeTenantDb } from '../../src/db/connectionManager.js';
import { AcademySetupWizardService } from '../../src/services/academySetupWizardService.js';

test('Academy Setup Wizard — 10-Step Guided Onboarding & Setup Completeness Engine', async (t) => {
  const centralDb = getCentralDb();
  const testSlug = `wizard-test-${Date.now() % 100000}`;
  let createdAcademyId = null;

  t.after(() => {
    if (createdAcademyId) {
      try {
        closeTenantDb(createdAcademyId);
        centralDb.prepare('DELETE FROM academies WHERE id = ?').run(createdAcademyId);
        centralDb.prepare('DELETE FROM domains WHERE academy_id = ?').run(createdAcademyId);
      } catch (_) {}
    }
  });

  await t.test('1. getSetupDefaults returns standard presets across all 10 modules', () => {
    const defaults = AcademySetupWizardService.getSetupDefaults(centralDb);
    assert.ok(Array.isArray(defaults.plans), 'Must return subscription plans');
    assert.ok(defaults.plans.length > 0, 'Must have at least one active plan');
    assert.ok(Array.isArray(defaults.standardSports), 'Must return standard sports');
    assert.ok(defaults.standardSports.some(s => s.name === 'Karate'), 'Karate must be included in standard sports');
    assert.ok(Array.isArray(defaults.timezones), 'Must return timezone options');
    assert.ok(defaults.timezones.some(tz => tz.value === 'Asia/Kolkata'), 'IST must be supported');
    assert.ok(Array.isArray(defaults.currencies), 'Must return currencies');
    assert.ok(defaults.currencies.some(c => c.code === 'INR'), 'INR must be supported');
    assert.ok(Array.isArray(defaults.attendanceModes), 'Must return attendance modes');
    assert.ok(Array.isArray(defaults.salaryModes), 'Must return salary compensation modes');
  });

  await t.test('2. createAcademyThroughWizard provisions a fully-configured academy transactionally', () => {
    const wizardPayload = {
      // Step 1: Info
      name: 'Olympus Martial Arts & Sports Academy',
      code: 'OMAS',
      slug: testSlug,
      contact_email: `${testSlug}@example.com`,
      contact_phone: '9876543210',
      address: '100 Olympic Way',
      city: 'Vadodara',
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      plan: 'professional',

      // Step 2: Administrator
      admin_name: 'Sensei Vikramaditya',
      admin_email: `admin.${testSlug}@example.com`,
      admin_phone: '9876543210',
      admin_password: 'SecurePassword@123',

      // Step 3: Branches
      branches: [
        { name: 'Alkapuri Main Dojo', code: 'ALK-01', address: 'Alkapuri, Vadodara', phone: '9876543211', geofence_radius_meters: 180, is_geofence_enforced: 1 },
        { name: 'Gotri Branch', code: 'GOT-02', address: 'Gotri Road, Vadodara', phone: '9876543212', geofence_radius_meters: 150, is_geofence_enforced: 1 },
      ],

      // Step 4: Sports & Disciplines
      sports: [
        { name: 'Karate', code: 'KAR', description: 'Traditional Shotokan Karate', defaultCategories: ['Kata', 'Kumite', 'Bunkai'] },
        { name: 'Taekwondo', code: 'TKD', description: 'WTF Olympic Taekwondo', defaultCategories: ['Poomsae', 'Kyorugi'] },
      ],

      // Step 5: Staff & Instructors
      employees: [
        { name: 'Rahul Sen', email: `coach.${testSlug}@example.com`, phone: '9876543213', role: 'coach', compensation_mode: 'monthly', salary_amount: 32000 },
      ],

      // Step 6: Batches & Timetables
      batches: [
        { name: 'Morning Black Belt Batch', capacity: 25, start_time: '06:00', end_time: '07:30', days_of_week: ['Mon', 'Wed', 'Fri'] },
        { name: 'Evening Beginners Batch', capacity: 35, start_time: '17:30', end_time: '19:00', days_of_week: ['Tue', 'Thu', 'Sat'] },
      ],

      // Step 7: Attendance Settings
      attendance_settings: {
        is_qr_enabled: 1,
        is_face_enabled: 1,
        is_nfc_enabled: 1,
        is_gps_enabled: 1,
        duplicate_scan_cooldown_minutes: 20,
        late_checkin_grace_minutes: 15,
      },

      // Step 8: Salary Configuration
      salary_settings: {
        salary_divisor_mode: 'working_days',
        custom_divisor: 26,
        overtime_multiplier: 1.25,
        auto_checkout_hours: 10,
      },

      // Step 9: Fee Settings
      fee_settings: {
        name: 'Regular Monthly Karate Fee',
        base_monthly_fee: 2800,
        admission_fee: 1500,
        receipt_prefix: 'OMA-',
      },
    };

    const result = AcademySetupWizardService.createAcademyThroughWizard(centralDb, wizardPayload, 1);
    assert.equal(result.success, true);
    assert.ok(result.academy.id > 0);
    createdAcademyId = result.academy.id;

    // Verify tenant SQLite database was provisioned
    const tenantDb = getTenantDbById(createdAcademyId);

    // 1. Branches created
    const branches = tenantDb.prepare('SELECT id, name, is_geofence_enforced FROM branches ORDER BY id ASC').all();
    assert.equal(branches.length, 2, 'Must create exactly 2 branches');
    assert.equal(branches[0].name, 'Alkapuri Main Dojo');
    assert.equal(branches[0].is_geofence_enforced, 1);

    // 2. Sports and Syllabus categories created
    const sports = tenantDb.prepare('SELECT id, name FROM sports ORDER BY id ASC').all();
    assert.equal(sports.length, 2, 'Must create 2 sports');
    const categories = tenantDb.prepare('SELECT id, name, sport_id FROM syllabus_categories').all();
    assert.ok(categories.length >= 5, 'Must create syllabus categories for sports');

    // 3. Batches created
    const batches = tenantDb.prepare('SELECT id, name, max_capacity FROM batches').all();
    assert.equal(batches.length, 2, 'Must create 2 batches');

    // 4. Staff created with salary profiles
    const coachUser = tenantDb.prepare('SELECT id, email, role FROM users WHERE email = ?').get(`coach.${testSlug}@example.com`);
    assert.ok(coachUser, 'Coach must exist in tenant database');
    assert.equal(coachUser.role, 'coach');
    const salaryProfile = tenantDb.prepare('SELECT salary_mode, base_rate FROM staff_salary_profiles WHERE user_id = ?').get(coachUser.id);
    assert.equal(salaryProfile.salary_mode, 'monthly');
    assert.equal(salaryProfile.base_rate, 32000);

    // 5. Smart Attendance settings persisted
    const attSettings = tenantDb.prepare('SELECT duplicate_cooldown_mins, default_mode FROM smart_attendance_settings LIMIT 1').get();
    assert.equal(attSettings.duplicate_cooldown_mins, 20);
    assert.equal(attSettings.default_mode, 'qr');

    // 6. Setup Completeness Score
    const audit = AcademySetupWizardService.getAcademySetupCompleteness(tenantDb, createdAcademyId);
    assert.ok(audit.score >= 85, 'Fully configured academy must have high health score');
    assert.equal(audit.isOperationallyReady, true);
    assert.ok(audit.completedCount >= 7);
  });

  await t.test('3. getAcademySetupCompleteness identifies incomplete academy and missing requirements', () => {
    // Audit an academy with incomplete configurations
    const incompleteAcademy = centralDb.prepare(`
      INSERT INTO academies (name, slug, contact_email, plan, max_branches, max_students, max_coaches, db_path)
      VALUES ('Incomplete Academy', ?, 'inc@test.com', 'starter', 1, 50, 5, 'data/academies/temp.db')
    `).run(`inc-${Date.now() % 10000}`);

    const incId = Number(incompleteAcademy.lastInsertRowid);
    const incDb = getTenantDbById(incId);

    // Deliberately empty tenant (no branches, no batches, no admin)
    const audit = AcademySetupWizardService.getAcademySetupCompleteness(incDb, incId);
    assert.ok(audit.score < 50, 'Incomplete academy must have score < 50%');
    assert.equal(audit.isFullyConfigured, false);
    assert.ok(audit.missingItems.some(item => item.id === 'branches'), 'Must report missing branches');
    assert.ok(audit.missingItems.some(item => item.id === 'batches'), 'Must report missing batches');

    // Cleanup
    closeTenantDb(incId);
    centralDb.prepare('DELETE FROM academies WHERE id = ?').run(incId);
  });
});

