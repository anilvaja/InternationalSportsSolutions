/**
 * International Sports Solutions — Safe Tenant Reset Script
 * 
 * Safely creates a timestamped backup before purging tenant databases and registry entries.
 * Preserves super admin accounts, subscription plans, and central configuration.
 * 
 * Usage:
 *   node scripts/reset_tenants_safely.js --confirm
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DATA_DIR = path.join(ROOT_DIR, 'data');
const ACADEMIES_DIR = path.join(DATA_DIR, 'academies');
const CENTRAL_DB_PATH = path.join(DATA_DIR, 'central.db');
const BACKUPS_DIR = path.join(ROOT_DIR, 'storage', 'backups');

const isConfirmed = process.argv.includes('--confirm');

console.log('====================================================');
console.log(' International Sports Solutions — Tenant Reset Utility');
console.log('====================================================\n');

if (!isConfirmed) {
  console.warn('⚠️  SAFETY NOTICE: This operation will remove all tenant databases and registry records.');
  console.log('To execute this reset safely with automatic backup, run with the --confirm flag:');
  console.log('\n  node scripts/reset_tenants_safely.js --confirm\n');
  process.exit(0);
}

// 1. Create safety backup directory
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(BACKUPS_DIR, `pre_reset_backup_${timestamp}`);
fs.mkdirSync(backupDir, { recursive: true });

console.log(`📦 Creating safety backup in: ${backupDir}...`);

// Backup central.db
if (fs.existsSync(CENTRAL_DB_PATH)) {
  fs.copyFileSync(CENTRAL_DB_PATH, path.join(backupDir, 'central.db'));
  console.log('  ✔ Backed up central.db');
}

// Backup academies
let backedUpCount = 0;
if (fs.existsSync(ACADEMIES_DIR)) {
  const academyBackupDir = path.join(backupDir, 'academies');
  fs.mkdirSync(academyBackupDir, { recursive: true });

  const files = fs.readdirSync(ACADEMIES_DIR);
  for (const f of files) {
    if (f.endsWith('.db') || f.endsWith('.sqlite')) {
      fs.copyFileSync(path.join(ACADEMIES_DIR, f), path.join(academyBackupDir, f));
      backedUpCount++;
    }
  }
  console.log(`  ✔ Backed up ${backedUpCount} tenant database files`);
}

// 2. Clear tenant registry in central.db
if (fs.existsSync(CENTRAL_DB_PATH)) {
  console.log('\n🧹 Clearing tenant entries in central registry (preserving super admins)...');
  const centralDb = new Database(CENTRAL_DB_PATH);
  centralDb.pragma('foreign_keys = OFF');

  const tablesToClear = [
    'academies',
    'academy_users_lookup',
    'domains',
    'academy_subscriptions',
    'academy_limit_overrides',
    'academy_feature_overrides',
    'central_audit_logs',
  ];

  for (const tbl of tablesToClear) {
    try {
      const info = centralDb.prepare(`DELETE FROM ${tbl}`).run();
      console.log(`  ✔ Cleared table '${tbl}' (${info.changes} rows deleted)`);
    } catch (e) {
      // Table might not exist or already empty
    }
  }

  // Vacuum to reclaim disk space
  centralDb.exec('VACUUM;');
  centralDb.close();
}

// 3. Purge tenant databases from data/academies/
let deletedCount = 0;
if (fs.existsSync(ACADEMIES_DIR)) {
  console.log('\n🗑️  Purging tenant databases from data/academies/...');
  const files = fs.readdirSync(ACADEMIES_DIR);
  for (const f of files) {
    const fullPath = path.join(ACADEMIES_DIR, f);
    try {
      fs.unlinkSync(fullPath);
      deletedCount++;
    } catch (err) {
      console.warn(`  ⚠️ Could not remove ${f}: ${err.message}`);
    }
  }
  console.log(`  ✔ Removed ${deletedCount} tenant database files`);
}

console.log('\n====================================================');
console.log('✅ Tenant reset complete! Ready for fresh tenant onboarding.');
console.log(`📦 Safety backup preserved at: ${backupDir}`);
console.log('====================================================\n');
