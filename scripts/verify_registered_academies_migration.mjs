import { getCentralDb } from '../src/db/centralDb.js';
import { getTenantDbById } from '../src/db/connectionManager.js';

const centralDb = getCentralDb();
const academies = centralDb.prepare('SELECT id, name, slug FROM academies').all();
console.log(`Checking ${academies.length} active registered academies in central.db...`);

let allApplied = true;
for (const a of academies) {
  try {
    const db = getTenantDbById(a.id);
    const mig = db.prepare("SELECT name FROM _migrations WHERE name = '036_schema_relationship_integrity_hardening.sql'").get();
    if (!mig) {
      console.error(`❌ Academy ${a.id} (${a.name} - ${a.slug}): Migration 036 MISSING`);
      allApplied = false;
    } else {
      console.log(`✅ Academy ${a.id} (${a.slug}): Migration 036 APPLIED`);
    }
  } catch (err) {
    console.error(`❌ Academy ${a.id} error:`, err.message);
    allApplied = false;
  }
}

if (allApplied) {
  console.log('🎉 ALL active registered tenant databases have migration 036 applied!');
}

