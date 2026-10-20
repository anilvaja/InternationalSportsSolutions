import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getCentralDb } from '../db/centralDb.js';
import { getTenantDbById, getAcademyDbPath } from '../db/connectionManager.js';
import { runMigrations } from '../db/migrator.js';
import { config } from '../config/index.js';

export class TenantCleanupService {
  /**
   * Standard list of transactional and operational tables safe for operational cleanup
   */
  static TRANSACTIONAL_TABLES = [
    'student_notifications',
    'admission_checklists',
    'inquiry_trials',
    'inquiries',
    'student_documents',
    'student_guardians',
    'event_response_history',
    'event_participants',
    'events',
    'fee_pause_requests',
    'student_fee_overrides',
    'student_fee_ledger',
    'fee_payments',
    'student_fees',
    'fee_structures',
    'session_swaps',
    'attendance_corrections',
    'attendance_technique_snapshots',
    'student_attendance',
    'attendance',
    'student_technique_assignments',
    'student_batch_enrollments',
    'students',
    'batch_sessions',
    'batches',
    'staff_salary_payments',
    'staff_salary_adjustments',
    'staff_salary_statements',
    'staff_payroll_periods',
    'overtime_requests',
    'leave_requests',
    'staff_time_punches',
    'staff_punches',
    'employee_schedule_shifts',
    'employee_work_schedules',
    'employee_compensation_history',
    'employment_records',
    'user_role_history',
    'user_branch_assignments',
    'facilities',
    'equipment_inventory',
    'audit_logs'
  ];

  /**
   * Performs tenant database cleanup under Super Admin control
   * @param {Object} params
   * @param {number} params.academyId
   * @param {'transactional'|'factory_reset'|'selective'} params.mode
   * @param {string[]} [params.selectedTables]
   * @param {Object} params.operatorUser
   * @param {string} [params.ipAddress]
   */
  static async cleanupTenant({
    academyId,
    mode = 'transactional',
    selectedTables = [],
    operatorUser,
    ipAddress = '127.0.0.1'
  }) {
    const id = Number(academyId);
    if (!id) {
      throw new Error(`Invalid academy ID: ${academyId}`);
    }

    const centralDb = getCentralDb();
    const academy = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(id);
    if (!academy) {
      throw new Error(`Academy #${id} not found in central registry`);
    }

    const dbPath = academy.db_path || getAcademyDbPath(id);
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database file for ${academy.name} does not exist at ${dbPath}`);
    }

    // 1. Mandatory Pre-Cleanup Safety Backup
    const backupDir = config.backupsDir;
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `tenant_${id}_pre_cleanup_${timestamp}.db`;
    const backupFilePath = path.join(backupDir, backupFilename);

    try {
      // Checkpoint WAL first to ensure clean file state
      const db = getTenantDbById(id);
      db.pragma('wal_checkpoint(TRUNCATE)');
      fs.copyFileSync(dbPath, backupFilePath);
    } catch (e) {
      console.warn('[TenantCleanupService] Warning during pre-checkpoint:', e.message);
      fs.copyFileSync(dbPath, backupFilePath);
    }

    const tenantDb = getTenantDbById(id);
    const deletedRowCounts = {};
    const tablesCleared = [];

    if (mode === 'transactional') {
      tenantDb.pragma('foreign_keys = OFF');
      const tx = tenantDb.transaction(() => {
        for (const table of this.TRANSACTIONAL_TABLES) {
          const exists = tenantDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
          if (exists) {
            const count = tenantDb.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get().c;
            tenantDb.prepare(`DELETE FROM "${table}"`).run();
            try {
              tenantDb.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
            } catch (err) {}
            deletedRowCounts[table] = count;
            tablesCleared.push(table);
          }
        }
      });
      tx();
      tenantDb.pragma('foreign_keys = ON');
      tenantDb.pragma('wal_checkpoint(TRUNCATE)');

    } else if (mode === 'factory_reset') {
      // Factory reset: re-migrates and re-initializes cleanly while saving baseline admin
      // 1. Extract existing admin credentials
      let adminUser = null;
      try {
        adminUser = tenantDb.prepare("SELECT * FROM users WHERE role = 'academy_admin' ORDER BY id ASC LIMIT 1").get();
      } catch (e) {}

      tenantDb.pragma('foreign_keys = OFF');

      // Drop all existing tables
      const allTables = tenantDb.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();

      const dropTx = tenantDb.transaction(() => {
        for (const t of allTables) {
          tenantDb.prepare(`DROP TABLE IF EXISTS "${t.name}"`).run();
          tablesCleared.push(t.name);
        }
      });
      dropTx();

      tenantDb.pragma('foreign_keys = ON');

      // Re-run migrations
      runMigrations(tenantDb, 'tenant');

      // Re-seed tenant_settings
      tenantDb.prepare("INSERT OR REPLACE INTO tenant_settings (key, value) VALUES ('academy_id', ?)").run(String(id));
      if (academy.name) tenantDb.prepare("INSERT OR REPLACE INTO tenant_settings (key, value) VALUES ('academy_name', ?)").run(academy.name);
      if (academy.slug) tenantDb.prepare("INSERT OR REPLACE INTO tenant_settings (key, value) VALUES ('academy_code', ?)").run(academy.slug);

      // Re-seed default academy roles
      const defaultRoles = [
        { name: 'academy_admin', display: 'Academy Administrator', perms: ['all'] },
        { name: 'coach', display: 'Coach / Instructor', perms: ['view_students', 'mark_attendance', 'view_batches', 'view_schedule'] },
        { name: 'academy_staff', display: 'Academy Staff', perms: ['view_students', 'view_batches', 'view_inquiries'] },
        { name: 'front_desk', display: 'Front Desk & Receptionist', perms: ['view_students', 'create_students', 'view_inquiries', 'create_inquiries', 'collect_fees'] },
        { name: 'accountant', display: 'Accounts & Finance Officer', perms: ['view_fees', 'collect_fees', 'manage_payroll', 'view_reports'] }
      ];

      for (const r of defaultRoles) {
        tenantDb.prepare(`
          INSERT OR IGNORE INTO academy_roles (name, display_name, description, permissions)
          VALUES (?, ?, ?, ?)
        `).run(r.name, r.display, `${r.display} role`, JSON.stringify(r.perms));
      }

      // Re-seed default branch
      tenantDb.prepare(`
        INSERT INTO branches (name, code, address, city, academy_id)
        VALUES ('Main Campus', 'MAIN', ?, ?, ?)
      `).run(academy.address || 'Main Campus Ground', academy.city || 'Vadodara', id);

      // Re-seed primary admin user
      const adminEmail = adminUser?.email || academy.contact_email || `admin@${academy.slug}.internationalsportssolutions.test`;
      const adminName = adminUser?.name || 'Academy Admin';
      const adminHash = adminUser?.password_hash || '$2a$10$wT5g8XfK0e3mYQ9yD9Kxe.4o1f9/h8H0A1vV2gJ6p.dO5l3/mZ6Oe'; // default password123

      tenantDb.prepare(`
        INSERT INTO users (name, email, password_hash, role, academy_id, status)
        VALUES (?, ?, ?, 'academy_admin', ?, 'active')
      `).run(adminName, adminEmail, adminHash, id);

      tenantDb.pragma('wal_checkpoint(TRUNCATE)');

    } else if (mode === 'selective') {
      if (!Array.isArray(selectedTables) || selectedTables.length === 0) {
        throw new Error('At least one table must be selected for selective cleanup');
      }

      // Prohibit dropping migration or SQLite internal tables
      const forbidden = ['_migrations', 'sqlite_sequence', 'sqlite_stat1', 'tenant_settings'];
      const validTables = selectedTables.filter(t => !forbidden.includes(t.toLowerCase().trim()));

      tenantDb.pragma('foreign_keys = OFF');
      const tx = tenantDb.transaction(() => {
        for (const table of validTables) {
          const exists = tenantDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
          if (exists) {
            const count = tenantDb.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get().c;
            tenantDb.prepare(`DELETE FROM "${table}"`).run();
            try {
              tenantDb.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
            } catch (err) {}
            deletedRowCounts[table] = count;
            tablesCleared.push(table);
          }
        }
      });
      tx();
      tenantDb.pragma('foreign_keys = ON');
      tenantDb.pragma('wal_checkpoint(TRUNCATE)');
    }

    // 2. Audit Trail in Central Database
    const auditDetails = JSON.stringify({
      academyId: id,
      academyName: academy.name,
      mode,
      backupFile: backupFilename,
      tablesClearedCount: tablesCleared.length,
      tablesCleared,
      deletedRowCounts
    });

    centralDb.prepare(`
      INSERT INTO central_audit_logs (user_id, user_email, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, 'TENANT_CLEANUP', 'academies', ?, ?, ?)
    `).run(
      operatorUser?.userId || null,
      operatorUser?.email || 'super_admin@system',
      String(id),
      auditDetails,
      ipAddress
    );

    return {
      success: true,
      mode,
      academyId: id,
      academyName: academy.name,
      backupFile: backupFilename,
      tablesCleared,
      deletedRowCounts,
      message: `Tenant database for '${academy.name}' successfully cleaned up in '${mode}' mode.`
    };
  }
}
