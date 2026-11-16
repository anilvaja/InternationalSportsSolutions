import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { getCentralDb } from './centralDb.js';
import { provisionAcademyDb, getTenantDbById } from './connectionManager.js';
import { ALL_ACADEMY_PERMISSIONS, DEFAULT_ACADEMY_ROLES } from '../config/permissions.js';

/**
 * Platform Database Seeder
 * - Primary Super Admin: anilvaja.007@gmail.com (Password: Iss@15890)
 * - Central System Settings & Subscription Tiers (Starter, Standard, Professional, Enterprise)
 * - Standard 8 Operational Academy Roles with Granular Permission Assignments
 * - Clean state: Zero academies or dummy users created by default.
 */
export function runSeed(options = {}) {
  const { includeDefaultAcademy = false } = options;
  console.log('--- Starting Platform Database Seed ---');
  const centralDb = getCentralDb();

  // 1. Seed Super Admin (ensure primary super admin exists)
  const superAdminPasswordHash = bcrypt.hashSync('Iss@15890', 10);
  const existingSuperAdmin = centralDb.prepare('SELECT id FROM super_admins WHERE email = ?').get('anilvaja.007@gmail.com');
  if (!existingSuperAdmin) {
    centralDb.prepare(`
      INSERT INTO super_admins (name, email, password_hash, status)
      VALUES (?, ?, ?, 'active')
    `).run('Anil Vaja', 'anilvaja.007@gmail.com', superAdminPasswordHash);
    console.log('[Seed] Created Super Admin: anilvaja.007@gmail.com');
  } else {
    centralDb.prepare(`
      UPDATE super_admins SET name = ?, password_hash = ?, status = 'active' WHERE id = ?
    `).run('Anil Vaja', superAdminPasswordHash, existingSuperAdmin.id);
  }

  // 2. Central Settings
  const insertSetting = centralDb.prepare('INSERT OR REPLACE INTO central_settings (key, value) VALUES (?, ?)');
  insertSetting.run('platform_name', 'International Sports Solutions');
  insertSetting.run('currency_symbol', '₹');
  insertSetting.run('currency_code', 'INR');
  insertSetting.run('support_email', 'support@internationalsportssolutions.com');
  insertSetting.run('enable_registrations', 'true');

  // 3. Seed Subscription Plans (Starter, Standard, Professional, Enterprise)
  const existingStandard = centralDb.prepare("SELECT id FROM subscription_plans WHERE slug = 'standard'").get();
  if (!existingStandard) {
    const plansToSeed = [
      {
        name: 'Starter',
        slug: 'starter',
        description: 'Starter tier for single-branch sports clubs and individual dojos',
        price: 999,
        billing_interval: 'monthly',
        trial_days: 14,
        status: 'active',
        is_default: 1,
        limits: { branches: 1, coaches: 3, batches: 5, students: 75, students_per_batch: 25, users: 5 },
        features: { syllabus: 1, facilities: 1, events: 0, payroll: 0, smart_attendance: 0, face_attendance: 0 },
      },
      {
        name: 'Standard',
        slug: 'standard',
        description: 'Best for growing sports academies with multiple batches, schedules, and staff',
        price: 2499,
        billing_interval: 'monthly',
        trial_days: 14,
        status: 'active',
        is_default: 0,
        limits: { branches: 3, coaches: 10, batches: 15, students: 250, students_per_batch: 30, users: 15 },
        features: { syllabus: 1, facilities: 1, events: 1, payroll: 1, smart_attendance: 1, face_attendance: 1 },
      },
      {
        name: 'Professional',
        slug: 'professional',
        description: 'High-capacity multi-campus academies with extensive payroll and event operations',
        price: 4999,
        billing_interval: 'monthly',
        trial_days: 30,
        status: 'active',
        is_default: 0,
        limits: { branches: 8, coaches: 25, batches: 40, students: 800, students_per_batch: 40, users: 35 },
        features: { syllabus: 1, facilities: 1, events: 1, payroll: 1, smart_attendance: 1, face_attendance: 1 },
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Nationwide sports organizations and federations with priority SLA and scale',
        price: 9999,
        billing_interval: 'monthly',
        trial_days: 30,
        status: 'active',
        is_default: 0,
        limits: { branches: 25, coaches: 100, batches: 150, students: 3000, students_per_batch: 60, users: 100 },
        features: { syllabus: 1, facilities: 1, events: 1, payroll: 1, smart_attendance: 1, face_attendance: 1 },
      },
    ];

    for (const p of plansToSeed) {
      const ins = centralDb.prepare(`
        INSERT INTO subscription_plans (name, slug, description, price, billing_interval, trial_days, status, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(p.name, p.slug, p.description, p.price, p.billing_interval, p.trial_days, p.status, p.is_default);
      const planId = Number(ins.lastInsertRowid);

      for (const [qKey, qVal] of Object.entries(p.limits)) {
        centralDb.prepare(`
          INSERT INTO subscription_plan_limits (plan_id, quota_key, limit_value, counting_policy)
          VALUES (?, ?, ?, 'active_only')
        `).run(planId, qKey, qVal);
      }

      for (const [feat, isEn] of Object.entries(p.features)) {
        centralDb.prepare(`
          INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled)
          VALUES (?, ?, ?)
        `).run(planId, feat, isEn);
      }
    }
    console.log('[Seed] Seeded subscription plans: Starter, Standard, Professional, Enterprise');
  }

  // 4. Seed Central Permissions Catalog & Academy Role Templates
  try {
    const insertCentralPerm = centralDb.prepare(`
      INSERT OR REPLACE INTO central_permissions (permission_key, category, description)
      VALUES (?, ?, ?)
    `);

    for (const perm of ALL_ACADEMY_PERMISSIONS) {
      const category = perm.split('_')[1] || 'general';
      const description = `Permission to ${perm.replace(/_/g, ' ')}`;
      insertCentralPerm.run(perm, category, description);
    }

    const insertCentralRole = centralDb.prepare(`
      INSERT OR REPLACE INTO central_role_templates (name, display_name, description, permissions, is_system, theme_color)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const role of DEFAULT_ACADEMY_ROLES) {
      insertCentralRole.run(
        role.name,
        role.display_name,
        role.description,
        JSON.stringify(role.permissions),
        role.is_system,
        role.theme_color
      );
    }
    console.log(`[Seed] Seeded ${ALL_ACADEMY_PERMISSIONS.length} central permissions and ${DEFAULT_ACADEMY_ROLES.length} role templates with assigned permissions.`);
  } catch (err) {
    console.warn('[Seed] Warning seeding central roles/permissions:', err.message);
  }

  // 5. Optional Academy Seeding (only if explicitly requested)
  if (includeDefaultAcademy) {
    const pratikAcademyData = {
      id: 1,
      name: 'Pratik Karate Academy',
      slug: 'pratik-karate-academy',
      contact_email: 'admin@pratikkarate.com',
      contact_phone: '+91 98250 12345',
      address: 'Dojo 1, Sports Complex',
      city: 'Ahmedabad',
      plan: 'enterprise',
      max_branches: 10,
      max_students: 1500,
      max_coaches: 80,
      admin_name: 'Pratik Karate Admin',
      admin_email: 'admin@pratikkarate.com',
      admin_password: 'password123',
    };

    let pratikAc = centralDb.prepare('SELECT id FROM academies WHERE slug = ? OR id = ?').get(pratikAcademyData.slug, pratikAcademyData.id);
    let academyId;

    if (!pratikAc) {
      console.log(`[Seed] Provisioning academy database for: ${pratikAcademyData.name} (${pratikAcademyData.slug})`);
      const provisioned = provisionAcademyDb(pratikAcademyData);
      academyId = provisioned.id;

      const tenantDb = getTenantDbById(academyId);
      const insertRole = tenantDb.prepare(`
        INSERT OR REPLACE INTO academy_roles (name, display_name, description, permissions, is_system, theme_color)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const role of DEFAULT_ACADEMY_ROLES) {
        insertRole.run(
          role.name,
          role.display_name,
          role.description,
          JSON.stringify(role.permissions),
          role.is_system,
          role.theme_color
        );
      }

      const adminPassHash = bcrypt.hashSync(pratikAcademyData.admin_password, 10);
      tenantDb.prepare(`
        INSERT INTO users (name, email, password_hash, role, phone, status)
        VALUES (?, ?, ?, 'academy_admin', ?, 'active')
      `).run(
        pratikAcademyData.admin_name,
        pratikAcademyData.admin_email,
        adminPassHash,
        pratikAcademyData.contact_phone
      );

      centralDb.prepare(`
        INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role)
        VALUES (?, ?, 'academy_admin')
      `).run(pratikAcademyData.admin_email, academyId);

      tenantDb.prepare(`
        INSERT INTO branches (id, name, city, is_active, academy_id, geofence_radius_meters, is_geofence_enforced)
        VALUES (1, 'Main Campus Dojo', ?, 1, ?, 100, 1)
      `).run(pratikAcademyData.city || 'Ahmedabad', academyId);

      try {
        const insertDomain = centralDb.prepare(`
          INSERT OR IGNORE INTO domains (academy_id, domain, is_primary, is_custom, status)
          VALUES (?, ?, ?, ?, 'active')
        `);
        insertDomain.run(academyId, `${pratikAcademyData.slug}.${config.baseDomain || 'internationalsportssolutions.com'}`, 1, 0);
        insertDomain.run(academyId, `${pratikAcademyData.slug}.internationalsportssolutions.test`, 0, 0);
        insertDomain.run(academyId, `${pratikAcademyData.slug}.localhost`, 0, 0);
        insertDomain.run(academyId, 'pratikkarate.com', 0, 1);
      } catch (_) {}
    } else {
      console.log(`[Seed] Academy #${pratikAc.id} ('${pratikAcademyData.name}') already exists in central registry. Preserving all tenant branches, batches, students, and settings intact.`);
    }
  }

  const academiesCount = centralDb.prepare('SELECT COUNT(*) as c FROM academies').get()?.c || 0;
  console.log(`[Seed] Seeded: Super Admin (anilvaja.007@gmail.com), ${DEFAULT_ACADEMY_ROLES.length} roles, ${ALL_ACADEMY_PERMISSIONS.length} permissions. Academies in DB: ${academiesCount}`);
  console.log('--- Database Seed Finished Successfully ---');

  return {
    superAdmin: 'anilvaja.007@gmail.com',
    rolesCount: DEFAULT_ACADEMY_ROLES.length,
    permissionsCount: ALL_ACADEMY_PERMISSIONS.length,
    academiesCount,
  };
}

// Execute if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed({ includeDefaultAcademy: true });
}
