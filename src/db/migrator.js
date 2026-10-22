import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executes pending SQL migrations on a given better-sqlite3 database instance
 * @param {import('better-sqlite3').Database} db 
 * @param {'central' | 'tenant'} type 
 */
export function runMigrations(db, type) {
  // Ensure migration tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations', type);

  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const getExecuted = db.prepare('SELECT name FROM _migrations');
  const executedSet = new Set(getExecuted.all().map(r => r.name));
  const recordMigration = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  for (const file of files) {
    if (!executedSet.has(file)) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Execute within transaction
      const applyMigration = db.transaction(() => {
        if (type === 'tenant' && file.includes('002_enforce_batch_student_relationships')) {
          try {
            const obj = db.prepare("SELECT type FROM sqlite_master WHERE name = 'student_batches'").get();
            if (obj && obj.type === 'view') {
              db.exec('DROP VIEW IF EXISTS student_batches;');
            }
          } catch (_) {}
        }
        db.exec(sql);
        recordMigration.run(file);
      });

      applyMigration();
      console.log(`[Migration] [${type}] Applied migration: ${file}`);
    }
  }
}
