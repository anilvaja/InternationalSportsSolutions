import fs from 'fs';
import Database from 'better-sqlite3';

const tenantsDir = 'data/academies';
const centralDbPath = 'data/central.db';

const files = fs.existsSync(tenantsDir) ? fs.readdirSync(tenantsDir).filter(f => f.endsWith('.db')) : [];
const allDbs = [centralDbPath, ...files.map(f => `${tenantsDir}/${f}`)];

console.log(`Checking ${allDbs.length} databases for non-ISO dates...`);

let anomalies = [];

for (const dbPath of allDbs) {
  if (!fs.existsSync(dbPath)) continue;
  const db = new Database(dbPath, { readonly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  
  for (const t of tables) {
    try {
      const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
      const dateCols = cols.filter(c => (c.name.includes('date') || c.name.includes('dob') || (c.type && c.type.toUpperCase() === 'DATE')) && !c.name.includes('_at') && !c.name.includes('time'));
      for (const col of dateCols) {
        const rows = db.prepare(`
          SELECT rowid, "${col.name}" as val FROM "${t.name}"
          WHERE "${col.name}" IS NOT NULL AND "${col.name}" != ''
        `).all();
        for (const r of rows) {
          const val = String(r.val).trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
            anomalies.push({
              db: dbPath,
              table: t.name,
              column: col.name,
              rowid: r.rowid,
              val: val
            });
          }
        }
      }
    } catch (e) {
      // Ignore errors on views
    }
  }
  db.close();
}

console.log(`Found ${anomalies.length} non-ISO date entries across all databases:`);
anomalies.forEach(a => {
  console.log(`  [${a.db}] ${a.table}.${a.column} (row ${a.rowid}): "${a.val}"`);
});
