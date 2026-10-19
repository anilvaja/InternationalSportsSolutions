import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

console.log('=== International Sports Solutions: Single Tenant Reset Script ===');

const cwd = process.cwd();
const dataDir = path.join(cwd, 'data');
const centralDbPath = path.join(dataDir, 'central.db');
const academiesDir = path.join(dataDir, 'academies');
const backupsDir = path.join(dataDir, 'backups');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

const timestamp = Date.now();
// 1. Backup central.db and academy_199.db
console.log('1. Creating safety backups...');
if (fs.existsSync(centralDbPath)) {
  fs.copyFileSync(centralDbPath, path.join(backupsDir, `central_backup_${timestamp}.db`));
  console.log(`Backed up central.db to backups/central_backup_${timestamp}.db`);
}

const srcTenantDb = path.join(academiesDir, 'academy_199.db');
if (fs.existsSync(srcTenantDb)) {
  fs.copyFileSync(srcTenantDb, path.join(backupsDir, `academy_199_backup_${timestamp}.db`));
  console.log(`Backed up academy_199.db to backups/academy_199_backup_${timestamp}.db`);
} else {
  console.error('ERROR: academy_199.db not found in data/academies!');
  process.exit(1);
}

// 2. Open central.db and extract Pratik Karate Academy details
console.log('2. Reading Pratik Karate Academy details from central.db...');
const centralDb = new Database(centralDbPath);
centralDb.pragma('journal_mode = WAL');
centralDb.pragma('foreign_keys = OFF'); // Temporarily off for re-keying

const pratik = centralDb.prepare("SELECT * FROM academies WHERE slug = 'pratik-karate-academy' OR id = 199").get();
if (!pratik) {
  console.error('ERROR: Pratik Karate Academy record not found in central.db!');
  process.exit(1);
}
console.log('Found Pratik Karate Academy:', pratik.name, `(Original ID: ${pratik.id})`);

// Extract lookups for Pratik
const userLookups = centralDb.prepare('SELECT * FROM academy_users_lookup WHERE academy_id = ?').all(pratik.id);
console.log(`Found ${userLookups.length} user lookups for Pratik.`);

// Extract subscription for Pratik
const sub = centralDb.prepare('SELECT * FROM academy_subscriptions WHERE academy_id = ?').get(pratik.id);

// Clean up central tables
console.log('3. Cleaning up other tenant data from central.db...');
centralDb.prepare('DELETE FROM academies').run();
centralDb.prepare('DELETE FROM domains').run();
centralDb.prepare('DELETE FROM academy_users_lookup').run();
centralDb.prepare('DELETE FROM academy_subscriptions').run();
centralDb.prepare('DELETE FROM academy_limit_overrides').run();

// Target path for tenant 1 DB
const destTenantDbRel = 'data/academies/academy_1.db';
const destTenantDbAbs = path.join(academiesDir, 'academy_1.db');

// Insert Pratik Karate Academy as tenant ID 1
console.log('4. Inserting Pratik Karate Academy as tenant ID 1...');
centralDb.prepare(`
  INSERT INTO academies (
    id, name, slug, logo_url, contact_email, contact_phone, address, city, country,
    plan, max_branches, max_students, max_coaches, db_path, status, created_at, updated_at,
    is_gst_registered, gst_number, gst_rate, legal_business_name, hsn_sac_code, gst_state_code
  ) VALUES (
    1, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?
  )
`).run(
  pratik.name,
  pratik.slug,
  pratik.logo_url || null,
  pratik.contact_email || 'admin@pratik-karate-academy.internationalsportssolutions.test',
  pratik.contact_phone || null,
  pratik.address || null,
  pratik.city || 'Vadodara',
  pratik.country || 'India',
  pratik.plan || 'enterprise',
  pratik.max_branches || 5,
  pratik.max_students || 500,
  pratik.max_coaches || 50,
  destTenantDbRel,
  'active',
  pratik.created_at || new Date().toISOString(),
  new Date().toISOString(),
  pratik.is_gst_registered || 0,
  pratik.gst_number || null,
  pratik.gst_rate || 18,
  pratik.legal_business_name || null,
  pratik.hsn_sac_code || '999293',
  pratik.gst_state_code || null
);

// Insert domains for tenant 1
console.log('5. Setting up domains for tenant 1...');
centralDb.prepare(`
  INSERT INTO domains (academy_id, domain, is_primary, is_custom, status)
  VALUES (1, 'pratik-karate-academy.internationalsportssolutions.test', 1, 0, 'active')
`).run();

centralDb.prepare(`
  INSERT INTO domains (academy_id, domain, is_primary, is_custom, status)
  VALUES (1, 'pratik-karate-academy.localhost', 0, 0, 'active')
`).run();

// Insert user lookups for tenant 1
console.log('6. Re-linking user lookups for tenant 1...');
const emailsToAdd = [
  { email: 'admin@pratik-karate-academy.internationalsportssolutions.test', role: 'academy_admin' },
  { email: 'pratik.singhania@gmail.com', role: 'coach' },
  { email: 'anilvaja.007@gmail.com', role: 'student' },
  { email: 'anilvaja.2007@gmail.com', role: 'student' }
];

// Include any other user lookups from original
userLookups.forEach(u => {
  if (!emailsToAdd.some(e => e.email.toLowerCase() === u.email.toLowerCase())) {
    emailsToAdd.push({ email: u.email, role: u.role });
  }
});

emailsToAdd.forEach(u => {
  try {
    centralDb.prepare(`
      INSERT OR REPLACE INTO academy_users_lookup (email, academy_id, role)
      VALUES (?, 1, ?)
    `).run(u.email.toLowerCase(), u.role);
  } catch (e) {
    console.warn(`Could not add lookup for ${u.email}:`, e.message);
  }
});

// Subscription for tenant 1
console.log('7. Linking enterprise subscription for tenant 1...');
const enterprisePlan = centralDb.prepare("SELECT id FROM subscription_plans WHERE slug = 'enterprise'").get();
const planId = enterprisePlan ? enterprisePlan.id : 3;

centralDb.prepare(`
  INSERT INTO academy_subscriptions (academy_id, plan_id, status, starts_at, auto_renew)
  VALUES (1, ?, 'active', CURRENT_TIMESTAMP, 1)
`).run(planId);

// CRITICAL: Reset sqlite_sequence for academies so next created is 2!
console.log('8. Setting sqlite_sequence.seq = 1 for academies table...');
centralDb.prepare("DELETE FROM sqlite_sequence WHERE name = 'academies'").run();
centralDb.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('academies', 1)").run();

centralDb.pragma('wal_checkpoint(TRUNCATE)');
centralDb.close();
console.log('✔ Central database successfully updated: tenant ID = 1, sqlite_sequence seq = 1.');

// 9. Prepare tenant database file: academy_1.db
console.log('9. Migrating tenant DB file to academy_1.db...');
// Remove existing academy_1.db if any
if (fs.existsSync(destTenantDbAbs)) {
  fs.unlinkSync(destTenantDbAbs);
}
// Copy academy_199.db to academy_1.db
fs.copyFileSync(srcTenantDb, destTenantDbAbs);

// Open academy_1.db and update academy_id to 1 across all tenant tables
console.log('10. Updating academy_id = 1 inside academy_1.db...');
const tenantDb = new Database(destTenantDbAbs);
tenantDb.pragma('journal_mode = WAL');

const tables = tenantDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(t => t.name);

tables.forEach(tableName => {
  if (tableName.startsWith('sqlite_')) return;
  const cols = tenantDb.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
  if (cols.includes('academy_id')) {
    try {
      const res = tenantDb.prepare(`UPDATE ${tableName} SET academy_id = 1 WHERE academy_id IS NOT NULL`).run();
      console.log(`  Updated ${tableName}: ${res.changes} rows updated to academy_id = 1`);
    } catch (e) {
      console.warn(`  Warning updating ${tableName}:`, e.message);
    }
  }
});

// Update or set tenant_settings
try {
  tenantDb.prepare(`
    INSERT INTO tenant_settings (key, value, updated_at)
    VALUES ('academy_id', '1', CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = CURRENT_TIMESTAMP
  `).run();
} catch (e) {
  // If tenant_settings doesn't exist, create it
  tenantDb.exec(`
    CREATE TABLE IF NOT EXISTS tenant_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR REPLACE INTO tenant_settings (key, value) VALUES ('academy_id', '1');
  `);
}

tenantDb.pragma('wal_checkpoint(TRUNCATE)');
tenantDb.close();
console.log('✔ academy_1.db successfully updated with academy_id = 1.');

// 11. Remove all other tenant db files in data/academies/
console.log('11. Cleaning up all other tenant databases from data/academies/ ...');
const allFiles = fs.readdirSync(academiesDir);
let deletedCount = 0;
allFiles.forEach(file => {
  if (file === '.gitkeep') return;
  if (file === 'academy_1.db') return; // KEEP ONLY academy_1.db
  const filePath = path.join(academiesDir, file);
  try {
    fs.unlinkSync(filePath);
    deletedCount++;
  } catch (e) {
    console.warn(`Could not delete ${file}:`, e.message);
  }
});
console.log(`✔ Cleaned up ${deletedCount} non-tenant-1 database files.`);

// 12. Verification check
console.log('\n=== VERIFICATION ===');
const verifyCentral = new Database(centralDbPath);
const finalAcademies = verifyCentral.prepare('SELECT id, name, slug, db_path FROM academies').all();
console.log('Academies in central.db:', finalAcademies);

const seqRow = verifyCentral.prepare("SELECT * FROM sqlite_sequence WHERE name = 'academies'").get();
console.log('sqlite_sequence for academies:', seqRow);

const finalDomains = verifyCentral.prepare('SELECT * FROM domains').all();
console.log('Domains in central.db:', finalDomains);

const finalLookups = verifyCentral.prepare('SELECT * FROM academy_users_lookup').all();
console.log(`Lookup users count: ${finalLookups.length}`);

verifyCentral.close();

const remainingFiles = fs.readdirSync(academiesDir);
console.log('Files in data/academies/:', remainingFiles);

console.log('\n✅ RESET COMPLETE: Pratik Karate Academy is now tenant_1, all other data removed, next tenant will start at 2!');
