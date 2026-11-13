import { getCentralDb } from '../src/db/centralDb.js';
import { getTenantDbById } from '../src/db/connectionManager.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const cDb = getCentralDb();
  const tDb = getTenantDbById(1);

  console.log('=== CENTRAL DATABASE INSPECTION ===');
  const cPragmas = {
    journal_mode: cDb.pragma('journal_mode', { simple: true }),
    synchronous: cDb.pragma('synchronous', { simple: true }),
    foreign_keys: cDb.pragma('foreign_keys', { simple: true }),
    busy_timeout: cDb.pragma('busy_timeout', { simple: true })
  };
  console.log('Central Pragmas:', cPragmas);

  const cTables = cDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  console.log(`Central Tables (${cTables.length}):`, cTables.map(t => t.name));

  const cFkCheck = cDb.prepare('PRAGMA foreign_key_check').all();
  console.log('Central FK Check issues count:', cFkCheck.length);
  if (cFkCheck.length > 0) {
    console.log('Central FK Check details:', cFkCheck);
  }

  console.log('\n=== TENANT DATABASE INSPECTION (academy_1.db) ===');
  const tPragmas = {
    journal_mode: tDb.pragma('journal_mode', { simple: true }),
    synchronous: tDb.pragma('synchronous', { simple: true }),
    foreign_keys: tDb.pragma('foreign_keys', { simple: true }),
    busy_timeout: tDb.pragma('busy_timeout', { simple: true })
  };
  console.log('Tenant Pragmas:', tPragmas);

  const tTables = tDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  console.log(`Tenant Tables (${tTables.length}):`, tTables.map(t => t.name));

  const tFkCheck = tDb.prepare('PRAGMA foreign_key_check').all();
  console.log('Tenant FK Check issues count:', tFkCheck.length);
  if (tFkCheck.length > 0) {
    console.log('Tenant FK Check details:', tFkCheck);
  }

  // Inspect triggers
  const cTriggers = cDb.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'").all();
  console.log(`\nCentral Triggers (${cTriggers.length}):`, cTriggers.map(t => t.name));

  const tTriggers = tDb.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'").all();
  console.log(`Tenant Triggers (${tTriggers.length}):`, tTriggers.map(t => t.name));

  // Inspect indexes
  const cIndexes = cDb.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
  console.log(`Central Indexes (${cIndexes.length})`);

  const tIndexes = tDb.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
  console.log(`Tenant Indexes (${tIndexes.length})`);

  // Inspect table schema details
  const tenantSchema = {};
  for (const { name } of tTables) {
    const columns = tDb.prepare(`PRAGMA table_info("${name}")`).all();
    const fks = tDb.prepare(`PRAGMA foreign_key_list("${name}")`).all();
    const idxs = tDb.prepare(`PRAGMA index_list("${name}")`).all();
    tenantSchema[name] = { columns, fks, idxs };
  }

  const centralSchema = {};
  for (const { name } of cTables) {
    const columns = cDb.prepare(`PRAGMA table_info("${name}")`).all();
    const fks = cDb.prepare(`PRAGMA foreign_key_list("${name}")`).all();
    const idxs = cDb.prepare(`PRAGMA index_list("${name}")`).all();
    centralSchema[name] = { columns, fks, idxs };
  }

  fs.writeFileSync('scratch_schema_inspection.json', JSON.stringify({ central: centralSchema, tenant: tenantSchema }, null, 2));
  console.log('\nSaved full schema inspection to scratch_schema_inspection.json');
}

main().catch(console.error);

