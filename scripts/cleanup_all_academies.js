import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { runSeed } from '../src/db/seed.js';
import { closeAllTenantDbs } from '../src/db/connectionManager.js';
import { closeCentralDb, getCentralDb } from '../src/db/centralDb.js';

console.log('=== International Sports Solutions: Full Academies Cleanup & Re-Seed ===\n');

const dataDir = path.resolve('data');
const academiesDir = path.join(dataDir, 'academies');
const backupsDir = path.join(dataDir, 'backups');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// 1. Safety Backup of central.db and academy_1.db
console.log('1. Creating safety backups before cleanup...');
const centralPath = path.join(dataDir, 'central.db');
if (fs.existsSync(centralPath)) {
  try {
    const db = new Database(centralPath);
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
  } catch (_) {}
  const backupCentral = path.join(backupsDir, `central_backup_${timestamp}.db`);
  fs.copyFileSync(centralPath, backupCentral);
  console.log(`   ✔ Backed up central.db -> ${path.relative(process.cwd(), backupCentral)}`);
}

const academy1Path = path.join(academiesDir, 'academy_1.db');
if (fs.existsSync(academy1Path)) {
  try {
    const db = new Database(academy1Path);
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
  } catch (_) {}
  const backupAc1 = path.join(backupsDir, `academy_1_backup_${timestamp}.db`);
  fs.copyFileSync(academy1Path, backupAc1);
  console.log(`   ✔ Backed up academy_1.db -> ${path.relative(process.cwd(), backupAc1)}`);
}

// 2. Close active DB handles
closeAllTenantDbs();
closeCentralDb();

// 3. Clean up all academy databases in data/academies
console.log('\n2. Cleaning up all tenant databases from data/academies/ ...');
if (fs.existsSync(academiesDir)) {
  const files = fs.readdirSync(academiesDir);
  let removedCount = 0;
  for (const file of files) {
    if (file === '.gitkeep') continue;
    const filePath = path.join(academiesDir, file);
    try {
      fs.unlinkSync(filePath);
      removedCount++;
    } catch (err) {
      console.warn(`   ⚠ Could not delete ${file}:`, err.message);
    }
  }
  console.log(`   ✔ Removed ${removedCount} tenant database & WAL/SHM files.`);
}

// 4. Clean up central database files
console.log('\n3. Cleaning up central database files...');
for (const ext of ['', '-wal', '-shm', '-journal']) {
  const f = path.join(dataDir, `central.db${ext}`);
  if (fs.existsSync(f)) {
    try {
      fs.unlinkSync(f);
      console.log(`   ✔ Removed central.db${ext}`);
    } catch (err) {
      console.warn(`   ⚠ Could not delete central.db${ext}:`, err.message);
    }
  }
}

// 5. Run Platform Seeder to create fresh central.db and default Pratik Karate Academy
console.log('\n4. Re-initializing fresh central database and default Pratik Karate Academy...');
runSeed();

// 6. Verify fresh state
console.log('\n5. Verifying clean database state...');
const newCentral = getCentralDb();
const academies = newCentral.prepare('SELECT id, name, slug, plan, status FROM academies').all();
const superAdmins = newCentral.prepare('SELECT id, name, email FROM super_admins').all();
const plans = newCentral.prepare('SELECT count(*) as c FROM subscription_plans').get().c;

console.log('   --- Central Registry Verification ---');
console.log(`   Super Admins: ${superAdmins.length} (${superAdmins.map(s => s.email).join(', ')})`);
console.log(`   Subscription Plans: ${plans} active plans`);
console.log(`   Registered Academies: ${academies.length}`);
academies.forEach(ac => {
  console.log(`   -> [ID: ${ac.id}] ${ac.name} (slug: ${ac.slug}, plan: ${ac.plan}, status: ${ac.status})`);
});

const tenant1Path = path.join(academiesDir, 'academy_1.db');
if (fs.existsSync(tenant1Path)) {
  const tDb = new Database(tenant1Path);
  const userCount = tDb.prepare('SELECT count(*) as c FROM users').get().c;
  const roleCount = tDb.prepare('SELECT count(*) as c FROM academy_roles').get().c;
  const sportsCount = tDb.prepare('SELECT count(*) as c FROM sports').get().c;
  tDb.close();
  console.log('   --- Default Academy 1 (Pratik Karate Academy) Verification ---');
  console.log(`   Database File: data/academies/academy_1.db`);
  console.log(`   Admin Users: ${userCount}`);
  console.log(`   Configured Roles: ${roleCount}`);
  console.log(`   Sports Disciplines: ${sportsCount}`);
}

console.log('\n✅ Cleanup and fresh baseline re-seed completed successfully!');
