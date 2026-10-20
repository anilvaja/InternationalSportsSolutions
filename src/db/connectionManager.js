import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { getCentralDb } from './centralDb.js';
import { runMigrations } from './migrator.js';

// Cache for open tenant database connections: academyId -> Database
const tenantDbMap = new Map();

/**
 * Normalizes and formats the DB path for an academy
 */
export function getAcademyDbPath(academyId) {
  return path.join(config.academiesDir, `academy_${academyId}.db`);
}

/**
 * Gets or initializes a tenant database connection by Academy ID
 * @param {number|string} academyId 
 * @returns {import('better-sqlite3').Database}
 */
export function getTenantDbById(academyId) {
  const id = Number(academyId);
  if (!id) {
    throw new Error(`Invalid Academy ID: ${academyId}`);
  }

  if (tenantDbMap.has(id)) {
    return tenantDbMap.get(id);
  }

  const centralDb = getCentralDb();
  const academy = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(id);
  if (!academy) {
    throw new Error(`Academy with ID ${id} not found in central registry`);
  }

  if (academy.status === 'suspended') {
    throw new Error(`Academy '${academy.name}' is currently suspended`);
  }

  const dbPath = academy.db_path || getAcademyDbPath(id);

  // Ensure directory exists
  const parentDir = path.dirname(dbPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Record tenant identity in tenant_settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.prepare("INSERT OR REPLACE INTO tenant_settings (key, value) VALUES ('academy_id', ?)").run(String(id));

  // Automatically execute tenant migrations on connect
  runMigrations(db, 'tenant');

  // Ensure tenant-scoped rows are stamped with this academy_id if any were created without it
  try {
    db.prepare('UPDATE students SET academy_id = ? WHERE academy_id IS NULL').run(id);
    db.prepare('UPDATE branches SET academy_id = ? WHERE academy_id IS NULL').run(id);
    db.prepare('UPDATE batches SET academy_id = ? WHERE academy_id IS NULL').run(id);
    db.prepare('UPDATE syllabus_categories SET academy_id = ? WHERE academy_id IS NULL').run(id);
    db.prepare('UPDATE syllabus_techniques SET academy_id = ? WHERE academy_id IS NULL').run(id);
    db.prepare(`
      UPDATE student_attendance
      SET technique_id = (
        SELECT ats.technique_id
        FROM attendance_technique_snapshots ats
        WHERE ats.attendance_id = student_attendance.attendance_id
          AND ats.student_id = student_attendance.student_id
      ),
      technique_level = (
        SELECT ats.technique_level
        FROM attendance_technique_snapshots ats
        WHERE ats.attendance_id = student_attendance.attendance_id
          AND ats.student_id = student_attendance.student_id
      ),
      attended_sessions_snapshot = (
        SELECT ats.sessions_count_at_time
        FROM attendance_technique_snapshots ats
        WHERE ats.attendance_id = student_attendance.attendance_id
          AND ats.student_id = student_attendance.student_id
      )
      WHERE technique_id IS NULL
        AND EXISTS (
          SELECT 1 FROM attendance_technique_snapshots ats
          WHERE ats.attendance_id = student_attendance.attendance_id
            AND ats.student_id = student_attendance.student_id
        )
    `).run();
  } catch (e) {
    // ignore if tables not yet created
  }

  tenantDbMap.set(id, db);
  return db;
}

/**
 * Resolves an academy by its slug and returns its database connection
 * @param {string} slug 
 */
export function getTenantDbBySlug(slug) {
  if (!slug) return null;
  const centralDb = getCentralDb();
  const academy = centralDb.prepare('SELECT id FROM academies WHERE slug = ? COLLATE NOCASE').get(slug);
  if (!academy) {
    return null;
  }
  return {
    academyId: academy.id,
    db: getTenantDbById(academy.id),
  };
}

/**
 * Provisions a new academy:
 * 1. Inserts into central `academies` table
 * 2. Creates the isolated `data/academies/academy_{id}.db` file
 * 3. Runs tenant migrations
 * 4. Seeds default academy roles and optionally an initial admin user
 * 5. Registers user in `academy_users_lookup`
 */
export function provisionAcademyDb({
  name,
  slug,
  contact_email,
  contact_phone,
  address,
  city,
  logo_url = null,
  plan = 'professional',
  max_branches = 5,
  max_students = 500,
  max_coaches = 50,
  admin_name,
  admin_email,
  admin_password,
  is_gst_registered = 0,
  gst_number = null,
  gst_rate = 18.0,
  legal_business_name = null,
  hsn_sac_code = '999293',
  gst_state_code = null,
}) {
  const centralDb = getCentralDb();

  // Check if slug exists
  const existing = centralDb.prepare('SELECT id FROM academies WHERE slug = ? COLLATE NOCASE').get(slug);
  if (existing) {
    throw new Error(`Academy with slug '${slug}' already exists`);
  }

  // Insert into central academies
  const insertAcademy = centralDb.prepare(`
    INSERT INTO academies (
      name, slug, contact_email, contact_phone, address, city,
      plan, max_branches, max_students, max_coaches, db_path,
      is_gst_registered, gst_number, gst_rate, legal_business_name, hsn_sac_code, gst_state_code, logo_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let newAcademyId;
  const dbPathPlaceholder = path.join(config.academiesDir, `temp.db`);

  const tx = centralDb.transaction(() => {
    const res = insertAcademy.run(
      name,
      slug.toLowerCase().trim(),
      contact_email || admin_email || null,
      contact_phone || null,
      address || null,
      city || null,
      plan,
      max_branches,
      max_students,
      max_coaches,
      dbPathPlaceholder,
      is_gst_registered ? 1 : 0,
      gst_number ? gst_number.trim().toUpperCase() : null,
      gst_rate !== undefined ? Number(gst_rate) : 18.0,
      legal_business_name ? legal_business_name.trim() : null,
      hsn_sac_code ? hsn_sac_code.trim() : '999293',
      gst_state_code ? gst_state_code.trim() : null,
      logo_url || null
    );
    newAcademyId = Number(res.lastInsertRowid);
    const finalDbPath = getAcademyDbPath(newAcademyId);
    centralDb.prepare('UPDATE academies SET db_path = ? WHERE id = ?').run(finalDbPath, newAcademyId);

    // Register default platform subdomain & localhost alias in central domains table
    try {
      centralDb.prepare(`
        INSERT OR IGNORE INTO domains (academy_id, domain, is_primary, is_custom, status)
        VALUES (?, ?, 1, 0, 'active')
      `).run(newAcademyId, `${slug.toLowerCase().trim()}.internationalsportssolutions.test`);

      centralDb.prepare(`
        INSERT OR IGNORE INTO domains (academy_id, domain, is_primary, is_custom, status)
        VALUES (?, ?, 0, 0, 'active')
      `).run(newAcademyId, `${slug.toLowerCase().trim()}.localhost`);
    } catch (e) {
      // Ignore if table not yet migrated
    }
  });

  tx();

  // Initialize and migrate tenant database
  const tenantDb = getTenantDbById(newAcademyId);

  // Store GST compliance settings inside tenant_settings
  try {
    const setTenantSetting = tenantDb.prepare('INSERT OR REPLACE INTO tenant_settings (key, value) VALUES (?, ?)');
    setTenantSetting.run('is_gst_registered', is_gst_registered ? '1' : '0');
    if (gst_number) setTenantSetting.run('gst_number', gst_number.trim().toUpperCase());
    if (gst_rate !== undefined) setTenantSetting.run('gst_rate', String(gst_rate));
    if (legal_business_name) setTenantSetting.run('legal_business_name', legal_business_name.trim());
    if (hsn_sac_code) setTenantSetting.run('hsn_sac_code', hsn_sac_code.trim());
    if (gst_state_code) setTenantSetting.run('gst_state_code', gst_state_code.trim());
    if (logo_url) setTenantSetting.run('logo_url', logo_url);
  } catch (e) {}

  // Seed default roles
  const seedRoles = tenantDb.transaction(() => {
    const insertRole = tenantDb.prepare('INSERT OR IGNORE INTO academy_roles (name, description, permissions) VALUES (?, ?, ?)');
    
    insertRole.run(
      'academy_admin',
      'Full administrative access to all academy features and settings',
      JSON.stringify(['all'])
    );
    insertRole.run(
      'academy_staff',
      'Staff member with operational access to students, attendance, and fees',
      JSON.stringify(['view_students', 'manage_students', 'view_attendance', 'mark_attendance', 'view_fees', 'collect_fees', 'view_leaves'])
    );
    insertRole.run(
      'coach',
      'Sports coach with schedule, batch management, and attendance marking',
      JSON.stringify(['view_batches', 'view_students', 'mark_attendance', 'apply_leaves'])
    );
    insertRole.run(
      'student',
      'Self-service student portal access',
      JSON.stringify(['view_my_attendance', 'view_my_fees', 'pay_fees', 'apply_leaves'])
    );
  });
  seedRoles();

  // If initial admin credentials supplied, create admin in tenant DB and central lookup
  if (admin_email && admin_password) {
    const passwordHash = bcrypt.hashSync(admin_password, 10);
    const insertUser = tenantDb.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone, status)
      VALUES (?, ?, ?, 'academy_admin', ?, 'active')
    `);
    insertUser.run(admin_name || `${name} Admin`, admin_email, passwordHash, contact_phone || null);

    // Register in central lookup
    centralDb.prepare(`
      INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role)
      VALUES (?, ?, 'academy_admin')
    `).run(admin_email, newAcademyId);
  }

  return {
    id: newAcademyId,
    name,
    slug,
    db_path: getAcademyDbPath(newAcademyId),
    tenantDb,
  };
}

/**
 * Closes an open tenant database connection
 * @param {number} academyId 
 */
export function closeTenantDb(academyId) {
  const id = Number(academyId);
  if (tenantDbMap.has(id)) {
    try {
      tenantDbMap.get(id).close();
    } catch (e) {
      console.error(`Error closing DB for academy ${id}:`, e);
    }
    tenantDbMap.delete(id);
  }
}

/**
 * Closes all open tenant DB connections
 */
export function closeAllTenantDbs() {
  for (const [id, db] of tenantDbMap.entries()) {
    try {
      db.close();
    } catch (e) {
      console.error(`Error closing DB for academy ${id}:`, e);
    }
  }
  tenantDbMap.clear();
}
