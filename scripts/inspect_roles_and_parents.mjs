import { getTenantDbById } from '../src/db/connectionManager.js';
import { getCentralDb } from '../src/db/centralDb.js';
import fs from 'fs';
import path from 'path';

const db = getTenantDbById(1);
const centralDb = getCentralDb();

console.log('--- 1. ROLES IN TENANT DB (academy_roles) ---');
const roles = db.prepare('SELECT id, name, description, is_system FROM academy_roles').all();
console.table(roles);

console.log('--- 2. USERS ROLES DISTRIBUTION ---');
const userRoles = db.prepare('SELECT role, count(*) as count FROM users GROUP BY role').all();
console.table(userRoles);

console.log('--- 3. PARENT / GUARDIAN SCHEMA ---');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%parent%' OR name LIKE '%guardian%')").all();
console.log('Tables found:', tables.map(t => t.name));

for (const t of tables) {
  const cols = db.pragma(`table_info(${t.name})`);
  console.log(`Columns of ${t.name}:`, cols.map(c => `${c.name} (${c.type})`));
}

console.log('--- 4. STUDENT GUARDIANS SAMPLES ---');
const guardians = db.prepare('SELECT * FROM student_guardians LIMIT 5').all();
console.table(guardians);

console.log('--- 5. CHECK ALL TENANT DATABASES FOR MIGRATION 036 ---');
const academiesDir = path.resolve('data/academies');
const files = fs.readdirSync(academiesDir).filter(f => f.startsWith('academy_') && f.endsWith('.db'));
for (const f of files) {
  const match = f.match(/academy_(\d+)\.db/);
  if (match) {
    const acId = Number(match[1]);
    try {
      const acDb = getTenantDbById(acId);
      const mig = acDb.prepare("SELECT name FROM _migrations WHERE name = '036_schema_relationship_integrity_hardening.sql'").get();
      console.log(`Database ${f} (Academy ${acId}): Migration 036 applied =`, !!mig);
    } catch (e) {
      console.log(`Database ${f} error:`, e.message);
    }
  }
}

