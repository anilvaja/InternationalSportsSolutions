import { getCentralDb } from '../src/db/centralDb.js';
import { runMigrations } from '../src/db/migrator.js';
import { getTenantDbById } from '../src/db/connectionManager.js';

async function migrate() {
  console.log('=== Starting Database Migrations ===\n');

  // 1. Central Database Migrations
  const centralDb = getCentralDb();
  console.log('[Central DB] Running pending migrations...');
  runMigrations(centralDb, 'central');
  console.log('[Central DB] Migrations up to date.\n');

  // 2. Tenant Database Migrations
  const academies = centralDb.prepare('SELECT id, name, slug FROM academies').all();
  console.log(`Found ${academies.length} tenant academy database(s) to migrate.\n`);

  for (const academy of academies) {
    console.log(`--- Migrating Academy: ${academy.name} (ID: ${academy.id}, slug: ${academy.slug}) ---`);
    const tenantDb = getTenantDbById(academy.id);
    runMigrations(tenantDb, 'tenant');
    console.log(`[Academy ${academy.id}] Tenant migrations up to date.\n`);
  }

  console.log('=== All Database Migrations Completed Successfully ===');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
