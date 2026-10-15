import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { getCentralDb } from '../db/centralDb.js';
import { getTenantDbById, getAcademyDbPath } from '../db/connectionManager.js';

/**
 * Streams a full ZIP backup of a specific academy's database and storage files
 */
export async function streamAcademyBackup(academyId, res) {
  const centralDb = getCentralDb();
  const academy = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(academyId);
  if (!academy) {
    throw new Error('Academy not found');
  }

  // Ensure DB flush checkpoint before archiving
  const tenantDb = getTenantDbById(academyId);
  tenantDb.pragma('wal_checkpoint(TRUNCATE)');

  const dbPath = academy.db_path || getAcademyDbPath(academyId);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${academy.slug}-backup-${timestamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(res);

  // 1. Add academy SQLite database
  if (fs.existsSync(dbPath)) {
    archive.file(dbPath, { name: `database/${path.basename(dbPath)}` });
  }

  // 2. Add metadata
  const totalStudents = tenantDb.prepare('SELECT COUNT(*) as count FROM students').get().count;
  const totalCoaches = tenantDb.prepare('SELECT COUNT(*) as count FROM coaches').get().count;
  const totalRevenue = tenantDb.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM fee_payments').get().total;

  const metadata = {
    academy: {
      id: academy.id,
      name: academy.name,
      slug: academy.slug,
      plan: academy.plan,
    },
    exportDate: new Date().toISOString(),
    metrics: {
      totalStudents,
      totalCoaches,
      totalRevenue,
    },
  };

  archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

  // 3. Add any tenant storage attachments if present
  const academyStorage = path.join(config.uploadsDir, `academy_${academyId}`);
  if (fs.existsSync(academyStorage)) {
    archive.directory(academyStorage, 'storage');
  }

  await archive.finalize();
}

/**
 * Streams a full platform backup (Central DB + all Tenant DBs)
 */
export async function streamCentralPlatformBackup(res) {
  const centralDb = getCentralDb();
  centralDb.pragma('wal_checkpoint(TRUNCATE)');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `iss-full-system-backup-${timestamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(res);

  // 1. Add Central DB
  if (fs.existsSync(config.centralDbPath)) {
    archive.file(config.centralDbPath, { name: 'central.db' });
  }

  // 2. Add all tenant DBs
  if (fs.existsSync(config.academiesDir)) {
    archive.directory(config.academiesDir, 'academies');
  }

  // 3. Add storage
  if (fs.existsSync(config.storageDir)) {
    archive.directory(config.storageDir, 'storage');
  }

  const academies = centralDb.prepare('SELECT id, name, slug, plan FROM academies').all();
  const summary = {
    platform: 'International Sports Solutions',
    version: '2.0.0 (Node.js & SQLite per Tenant)',
    exportTimestamp: new Date().toISOString(),
    academyCount: academies.length,
    academies,
  };

  archive.append(JSON.stringify(summary, null, 2), { name: 'system_summary.json' });

  await archive.finalize();
}
