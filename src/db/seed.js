import bcrypt from 'bcryptjs';
import { getCentralDb } from './centralDb.js';
import { provisionAcademyDb, getTenantDbById } from './connectionManager.js';
import { ALL_ACADEMY_PERMISSIONS, DEFAULT_ACADEMY_ROLES } from '../config/permissions.js';

/**
 * Platform Database Seeder
 * - Exactly 1 Super Admin: anilvaja.007@gmail.com
 * - Exactly 1 Academy: Pratik Karate Academy
 * - Standard 8 Operational Roles (Finance & Fee Manager, Front Desk, Head Coach, Receptionist, Academy Admin, Staff, Coach, Student)
 * - Clean state without dummy students, batches, or demo records.
 */
export function runSeed() {
  console.log('--- Starting Platform Database Seed ---');
  const centralDb = getCentralDb();

  // 1. Seed Super Admin (Exactly 1 super admin)
  const defaultPasswordHash = bcrypt.hashSync('password', 10);
  
  // Remove any legacy/extra super admins so only anilvaja.007@gmail.com exists
  centralDb.prepare('DELETE FROM super_admins WHERE email != ?').run('anilvaja.007@gmail.com');

  const existingSuperAdmin = centralDb.prepare('SELECT id FROM super_admins WHERE email = ?').get('anilvaja.007@gmail.com');
  if (!existingSuperAdmin) {
    centralDb.prepare(`
      INSERT INTO super_admins (name, email, password_hash, status)
      VALUES (?, ?, ?, 'active')
    `).run('Anil Vaja', 'anilvaja.007@gmail.com', defaultPasswordHash);
    console.log('[Seed] Created Super Admin: anilvaja.007@gmail.com');
  } else {
    centralDb.prepare(`
      UPDATE super_admins SET name = ?, password_hash = ?, status = 'active' WHERE id = ?
    `).run('Anil Vaja', defaultPasswordHash, existingSuperAdmin.id);
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
        features: { syllabus: 1, facilities: 1, events: 0, payroll: 0 },
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
        features: { syllabus: 1, facilities: 1, events: 1, payroll: 1 },
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
        features: { syllabus: 1, features: 1, events: 1, payroll: 1 },
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
        features: { syllabus: 1, facilities: 1, events: 1, payroll: 1 },
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

  // 4. Exactly 1 Academy: Pratik Karate Academy
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
  } else {
    academyId = pratikAc.id;
    centralDb.prepare(`
      UPDATE academies SET
        name = ?, slug = ?, contact_email = ?, contact_phone = ?, address = ?, city = ?, plan = ?
      WHERE id = ?
    `).run(
      pratikAcademyData.name,
      pratikAcademyData.slug,
      pratikAcademyData.contact_email,
      pratikAcademyData.contact_phone,
      pratikAcademyData.address,
      pratikAcademyData.city,
      pratikAcademyData.plan,
      academyId
    );
  }

  // 5. Ensure tenant DB has exactly the standard 8 operational roles
  const tenantDb = getTenantDbById(academyId);

  // Strictly enforce: Only the standard 8 operational roles exist in exact display order
  tenantDb.prepare('DELETE FROM academy_roles').run();

  const insertRole = tenantDb.prepare(`
    INSERT INTO academy_roles (name, display_name, description, permissions, is_system, theme_color)
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

  // Ensure Admin user exists with role academy_admin, and no other users exist
  const adminPassHash = bcrypt.hashSync(pratikAcademyData.admin_password, 10);
  const existingAdmin = tenantDb.prepare('SELECT id FROM users WHERE email = ?').get(pratikAcademyData.admin_email);
  if (!existingAdmin) {
    tenantDb.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone, status)
      VALUES (?, ?, ?, 'academy_admin', ?, 'active')
    `).run(
      pratikAcademyData.admin_name,
      pratikAcademyData.admin_email,
      adminPassHash,
      pratikAcademyData.contact_phone
    );
  } else {
    tenantDb.prepare(`
      UPDATE users SET name = ?, password_hash = ?, role = 'academy_admin', status = 'active'
      WHERE id = ?
    `).run(
      pratikAcademyData.admin_name,
      adminPassHash,
      existingAdmin.id
    );
  }
  
  tenantDb.pragma('foreign_keys = OFF');
  try {
    tenantDb.prepare('DELETE FROM users WHERE email != ?').run(pratikAcademyData.admin_email);
  } finally {
    tenantDb.pragma('foreign_keys = ON');
  }

  // Ensure central users lookup
  centralDb.prepare(`
    INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role)
    VALUES (?, ?, 'academy_admin')
  `).run(pratikAcademyData.admin_email, academyId);

  // 6. Register domains for Pratik Karate Academy
  try {
    const insertDomain = centralDb.prepare(`
      INSERT OR IGNORE INTO domains (academy_id, domain, is_primary, is_custom, status)
      VALUES (?, ?, ?, ?, 'active')
    `);

    // Primary subdomain
    insertDomain.run(academyId, `${pratikAcademyData.slug}.internationalsportssolutions.test`, 1, 0);
    // Localhost subdomain
    insertDomain.run(academyId, `${pratikAcademyData.slug}.localhost`, 0, 0);
    // Custom domain alias
    insertDomain.run(academyId, 'pratikkarate.com', 0, 1);
  } catch (err) {
    console.warn('[Seed] Warning registering domains:', err.message);
  }

  console.log(`[Seed] Successfully seeded: Super Admin (${'anilvaja.007@gmail.com'}) & Academy (${pratikAcademyData.name}) with standard 8 operational roles.`);
  console.log('--- Database Seed Finished Successfully ---');
}

// Execute if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed();
}
