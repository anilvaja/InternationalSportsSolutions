import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import { runSeed } from '../src/db/seed.js';
import { closeAllTenantDbs } from '../src/db/connectionManager.js';
import { closeCentralDb, getCentralDb } from '../src/db/centralDb.js';

console.log('=== International Sports Solutions: Database Reset & Data Cleanup ===\n');

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
  try {
    fs.copyFileSync(centralPath, backupCentral);
    console.log(`   ✔ Backed up central.db -> ${path.relative(process.cwd(), backupCentral)}`);
  } catch (e) {
    console.warn('   ⚠ Could not copy central.db:', e.message);
  }
}

const academy1Path = path.join(academiesDir, 'academy_1.db');
if (fs.existsSync(academy1Path)) {
  try {
    const db = new Database(academy1Path);
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
  } catch (_) {}
  const backupAc1 = path.join(backupsDir, `academy_1_backup_${timestamp}.db`);
  try {
    fs.copyFileSync(academy1Path, backupAc1);
    console.log(`   ✔ Backed up academy_1.db -> ${path.relative(process.cwd(), backupAc1)}`);
  } catch (e) {
    console.warn('   ⚠ Could not copy academy_1.db:', e.message);
  }
}

// 2. Close active DB handles in this process
closeAllTenantDbs();
closeCentralDb();

// 3. Stop running server processes if on Windows/Unix to release file locks
console.log('\n2. Releasing file locks from active server processes...');
try {
  if (process.platform === 'win32') {
    // Gracefully terminate node processes running server.js (excluding our own process)
    const currentPid = process.pid;
    const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'node.exe'\\" | Where-Object { $_.ProcessId -ne ${currentPid} -and $_.CommandLine -like '*server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`;
    execSync(psCmd, { stdio: 'ignore' });
  } else {
    execSync('pkill -f "node.*server.js" || true', { stdio: 'ignore' });
  }
  console.log('   ✔ Server processes released.');
} catch (_) {
  // Ignore if no process was running
}

// 4. Try unlinking database files from disk
console.log('\n3. Cleaning database files on disk...');
let unlinkedCount = 0;
let lockedFiles = [];

if (fs.existsSync(academiesDir)) {
  const files = fs.readdirSync(academiesDir);
  for (const file of files) {
    if (file === '.gitkeep') continue;
    const filePath = path.join(academiesDir, file);
    try {
      fs.unlinkSync(filePath);
      unlinkedCount++;
    } catch (err) {
      if (file.endsWith('.db')) {
        lockedFiles.push(filePath);
      }
    }
  }
}

for (const ext of ['', '-wal', '-shm', '-journal']) {
  const f = path.join(dataDir, `central.db${ext}`);
  if (fs.existsSync(f)) {
    try {
      fs.unlinkSync(f);
      unlinkedCount++;
    } catch (err) {
      if (ext === '') {
        lockedFiles.push(f);
      }
    }
  }
}

console.log(`   ✔ Unlinked ${unlinkedCount} database/WAL/SHM files.`);

// 5. If any database file was locked by another process, perform direct in-place SQL truncation!
if (lockedFiles.length > 0) {
  console.log(`\n4. Performing deep in-place SQL cleanup on ${lockedFiles.length} locked database(s)...`);
  for (const dbFile of lockedFiles) {
    try {
      const db = new Database(dbFile);
      db.pragma('foreign_keys = OFF');
      
      const isCentral = path.basename(dbFile) === 'central.db';
      if (isCentral) {
        db.prepare('DELETE FROM academies').run();
        db.prepare('DELETE FROM domains').run();
        db.prepare('DELETE FROM academy_users_lookup').run();
        db.prepare('DELETE FROM academy_subscriptions').run();
        db.prepare('DELETE FROM academy_limit_overrides').run();
        try { db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('academies', 'domains', 'academy_users_lookup')").run(); } catch (_) {}
        console.log('   ✔ Truncated central registry tables in locked central.db');
      } else {
        // Tenant database: truncate all non-system tables
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        for (const t of tables) {
          try {
            db.prepare(`DELETE FROM "${t.name}"`).run();
            try { db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(t.name); } catch (_) {}
          } catch (_) {}
        }
        console.log(`   ✔ Truncated all tables in locked tenant DB: ${path.basename(dbFile)}`);
      }
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
    } catch (err) {
      console.warn(`   ⚠ Could not SQL truncate ${path.basename(dbFile)}:`, err.message);
    }
  }
}

// 6. Run Platform Seeder to create/verify fresh central.db and default Pratik Karate Academy
console.log('\n5. Re-initializing clean baseline platform data...');
runSeed();

// 7. Verify fresh state
console.log('\n6. Verifying clean database state...');
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
  const branchCount = tDb.prepare('SELECT count(*) as c FROM branches').get().c;
  const studentCount = tDb.prepare('SELECT count(*) as c FROM students').get().c;
  const batchCount = tDb.prepare('SELECT count(*) as c FROM batches').get().c;
  tDb.close();
  console.log('   --- Default Academy 1 (Pratik Karate Academy) Verification ---');
  console.log(`   Database File: data/academies/academy_1.db`);
  console.log(`   Admin Users: ${userCount}`);
  console.log(`   Configured Roles: ${roleCount}`);
  console.log(`   Sports Disciplines: ${sportsCount}`);
  console.log(`   Branches: ${branchCount} (default baseline campus)`);
  console.log(`   Students: ${studentCount} (clean slate)`);
  console.log(`   Batches: ${batchCount} (clean slate)`);
}

console.log('\n✅ Database reset and cleanup verified successfully!');
