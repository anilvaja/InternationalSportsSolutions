import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config/index.js';
import { getCentralDb } from '../db/centralDb.js';
import { closeTenantDb, closeAllTenantDbs, getAcademyDbPath } from '../db/connectionManager.js';
import { runSeed } from '../db/seed.js';

export class AcademyLifecycleService {
  /**
   * Completely purges an academy:
   * 1. Closes any open SQLite connections
   * 2. Deletes the tenant database file (.sqlite, .db, -wal, -shm)
   * 3. Deletes storage uploads, avatars, logos, backups
   * 4. Deletes all central records (domains, users lookup, quota overrides, plan usages, academy record)
   * @param {number} academyId 
   */
  static purgeAcademyCompletely(academyId) {
    const centralDb = getCentralDb();
    const id = Number(academyId);
    if (!id) {
      throw new Error('Valid Academy ID required');
    }

    const academy = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(id);
    if (!academy) {
      throw new Error(`Academy #${id} not found`);
    }

    // 1. Close open database connection
    try {
      closeTenantDb(id);
    } catch (e) {
      console.warn(`[Purge] Warning closing connection for academy #${id}:`, e.message);
    }

    // 2. Delete tenant database files (.sqlite, .db, -wal, -shm)
    const possiblePaths = [
      academy.db_path,
      getAcademyDbPath(id),
      path.join(config.academiesDir, `academy_${id}.sqlite`),
      path.join(config.academiesDir, `academy_${id}.db`),
      path.join(config.academiesDir, `${academy.slug}.sqlite`),
      path.join(config.academiesDir, `${academy.slug}.db`),
    ];

    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {
          console.warn(`[Purge] Warning deleting ${p}:`, e.message);
          // If Windows locked the file due to an external process, drop all tables inside to ensure clean state
          try {
            const db = new Database(p);
            db.pragma('foreign_keys = OFF');
            const views = db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all();
            for (const v of views) {
              try { db.prepare(`DROP VIEW IF EXISTS "${v.name}"`).run(); } catch (_) {}
            }
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
            for (const t of tables) {
              try { db.prepare(`DROP TABLE IF EXISTS "${t.name}"`).run(); } catch (_) {}
            }
            db.pragma('vacuum');
            db.close();
          } catch (_) {}
        }
        const wal = `${p}-wal`;
        const shm = `${p}-shm`;
        if (fs.existsSync(wal)) try { fs.unlinkSync(wal); } catch (e) {}
        if (fs.existsSync(shm)) try { fs.unlinkSync(shm); } catch (e) {}
      }
    }

    // 3. Delete academy uploads directory
    const uploadDirs = [
      path.join(config.uploadsDir, 'academies', String(id)),
      path.join(config.uploadsDir, 'academies', academy.slug),
    ];
    for (const dir of uploadDirs) {
      if (fs.existsSync(dir)) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
      }
    }

    // Delete custom logo if stored in local storage
    if (academy.logo_url && academy.logo_url.startsWith('/storage/')) {
      const localLogo = path.join(config.rootDir, academy.logo_url);
      if (fs.existsSync(localLogo)) {
        try { fs.unlinkSync(localLogo); } catch (e) {}
      }
    }

    // Delete backups for this academy
    if (fs.existsSync(config.backupsDir)) {
      try {
        const backupFiles = fs.readdirSync(config.backupsDir);
        for (const f of backupFiles) {
          if (f.includes(`academy_${id}`) || f.includes(academy.slug)) {
            try { fs.unlinkSync(path.join(config.backupsDir, f)); } catch (e) {}
          }
        }
      } catch (e) {}
    }

    // 4. Clean all references in Central Database
    const tx = centralDb.transaction(() => {
      try { centralDb.prepare('DELETE FROM domains WHERE academy_id = ?').run(id); } catch (e) {}
      try { centralDb.prepare('DELETE FROM academy_users_lookup WHERE academy_id = ?').run(id); } catch (e) {}
      try { centralDb.prepare('DELETE FROM academy_subscriptions WHERE academy_id = ?').run(id); } catch (e) {}
      try { centralDb.prepare('DELETE FROM academy_limit_overrides WHERE academy_id = ?').run(id); } catch (e) {}
      try { centralDb.prepare('DELETE FROM academy_feature_overrides WHERE academy_id = ?').run(id); } catch (e) {}
      try { centralDb.prepare('DELETE FROM central_audit_logs WHERE entity = ? OR details LIKE ?').run(`academy_${id}`, `%${academy.slug}%`); } catch (e) {}
      try { centralDb.prepare('DELETE FROM academies WHERE id = ?').run(id); } catch (e) {}
    });
    tx();

    console.log(`[Purge] Successfully purged academy '${academy.name}' (${academy.slug}) and all related databases & assets.`);
    return {
      success: true,
      message: `Academy '${academy.name}' and all associated databases, files, and users have been permanently deleted.`,
      purgedAcademy: {
        id: academy.id,
        name: academy.name,
        slug: academy.slug,
      },
    };
  }

  /**
   * Resets the entire platform to a completely clean slate:
   * - Deletes ALL demo/existing academies and their sqlite database files
   * - Cleans uploads and backups
   * - Wipes central tenant registries
   * - Re-seeds ONLY the Super Admin and Pratik Karate Academy
   */
  static resetPlatformToCleanState() {
    const centralDb = getCentralDb();

    console.log('[Clean Slate] Resetting platform to clean state...');

    // 1. Close all active database connections
    closeAllTenantDbs();

    // 2. Fetch and purge all academies
    const allAcademies = centralDb.prepare('SELECT id, slug, name, db_path FROM academies').all();
    for (const ac of allAcademies) {
      try {
        this.purgeAcademyCompletely(ac.id);
      } catch (err) {
        console.warn(`[Clean Slate] Warning purging academy #${ac.id}:`, err.message);
      }
    }

    // 3. Clear any orphaned database files in academies directory
    if (fs.existsSync(config.academiesDir)) {
      try {
        const files = fs.readdirSync(config.academiesDir);
        for (const f of files) {
          if (f.endsWith('.sqlite') || f.endsWith('.db') || f.endsWith('-wal') || f.endsWith('-shm')) {
            try { fs.unlinkSync(path.join(config.academiesDir, f)); } catch (e) {}
          }
        }
      } catch (e) {}
    }

    // 4. Wipe central tenant lookup tables
    try { centralDb.prepare('DELETE FROM domains').run(); } catch (e) {}
    try { centralDb.prepare('DELETE FROM academy_users_lookup').run(); } catch (e) {}
    try { centralDb.prepare('DELETE FROM academy_subscriptions').run(); } catch (e) {}
    try { centralDb.prepare('DELETE FROM academy_limit_overrides').run(); } catch (e) {}
    try { centralDb.prepare('DELETE FROM academy_feature_overrides').run(); } catch (e) {}
    try { centralDb.prepare('DELETE FROM academies').run(); } catch (e) {}
    try { centralDb.prepare("DELETE FROM sqlite_sequence WHERE name = 'academies'").run(); } catch (e) {}

    // 5. Run seeder: Seeds exactly 1 Super Admin (anilvaja.007@gmail.com) and 1 Academy (Pratik Karate Academy)
    runSeed();

    console.log('[Clean Slate] Platform is now clean with Super Admin and Pratik Karate Academy.');
    return {
      success: true,
      message: 'Platform successfully reset from scratch. All previous academies and data wiped. Pratik Karate Academy and Super Admin initialized.',
      superAdmin: {
        email: 'anilvaja.007@gmail.com',
        role: 'Super Admin',
        password: 'password',
      },
      academy: {
        name: 'Pratik Karate Academy',
        slug: 'pratik-karate-academy',
        admin_email: 'admin@pratikkarate.com',
        password: 'password123',
        role: 'Academy Admin',
      },
    };
  }
}
