import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { runMigrations } from './migrator.js';

let centralDbInstance = null;

export function getCentralDb() {
  if (centralDbInstance && centralDbInstance.open) {
    if (centralDbInstance.name === config.centralDbPath) {
      return centralDbInstance;
    }
    // Database path changed (e.g. switched to test environment)
    try { centralDbInstance.close(); } catch (_) {}
    centralDbInstance = null;
  }

  // Ensure directories exist
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
  if (!fs.existsSync(config.academiesDir)) {
    fs.mkdirSync(config.academiesDir, { recursive: true });
  }
  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(config.backupsDir)) {
    fs.mkdirSync(config.backupsDir, { recursive: true });
  }

  centralDbInstance = new Database(config.centralDbPath, {
    // verbose: config.nodeEnv === 'development' ? console.log : null,
  });

  // Enable WAL mode & foreign keys for high concurrency
  centralDbInstance.pragma('journal_mode = WAL');
  centralDbInstance.pragma('synchronous = NORMAL');
  centralDbInstance.pragma('foreign_keys = ON');
  centralDbInstance.pragma('busy_timeout = 5000');

  // Run central migrations
  runMigrations(centralDbInstance, 'central');

  // If in automated test environment, ensure baseline central test records exist
  if (config.isTest) {
    const admin = centralDbInstance.prepare("SELECT id FROM super_admins WHERE email = 'anilvaja.007@gmail.com'").get();
    if (!admin) {
      centralDbInstance.prepare(`
        INSERT OR REPLACE INTO super_admins (id, name, email, password_hash, status)
        VALUES (1, 'Anil Vaja', 'anilvaja.007@gmail.com', 'test_password_hash', 'active')
      `).run();
    }

    const starterPlan = centralDbInstance.prepare("SELECT id FROM subscription_plans WHERE slug = 'starter'").get();
    if (!starterPlan) {
      const plansToSeed = [
        { id: 1, name: 'Starter', slug: 'starter', description: 'Starter Tier', price: 999, trial_days: 14, is_default: 1, limits: { branches: 1, coaches: 3, batches: 5, students: 75, students_per_batch: 25, users: 5 }, features: { syllabus: 1, facilities: 1, events: 0, payroll: 0 } },
        { id: 2, name: 'Standard', slug: 'standard', description: 'Standard Tier', price: 2499, trial_days: 14, is_default: 0, limits: { branches: 3, coaches: 10, batches: 15, students: 250, students_per_batch: 30, users: 15 }, features: { syllabus: 1, facilities: 1, events: 1, payroll: 1 } },
        { id: 3, name: 'Professional', slug: 'professional', description: 'Professional Tier', price: 4999, trial_days: 30, is_default: 0, limits: { branches: 8, coaches: 25, batches: 40, students: 800, students_per_batch: 40, users: 35 }, features: { syllabus: 1, facilities: 1, events: 1, payroll: 1 } },
        { id: 4, name: 'Enterprise', slug: 'enterprise', description: 'Enterprise Tier', price: 9999, trial_days: 30, is_default: 0, limits: { branches: 25, coaches: 100, batches: 150, students: 3000, students_per_batch: 60, users: 100 }, features: { syllabus: 1, facilities: 1, events: 1, payroll: 1 } },
      ];
      for (const p of plansToSeed) {
        centralDbInstance.prepare(`
          INSERT OR REPLACE INTO subscription_plans (id, name, slug, description, price, billing_interval, trial_days, status, is_default)
          VALUES (?, ?, ?, ?, ?, 'monthly', ?, 'active', ?)
        `).run(p.id, p.name, p.slug, p.description, p.price, p.trial_days, p.is_default);

        for (const [qKey, qVal] of Object.entries(p.limits)) {
          centralDbInstance.prepare(`
            INSERT OR REPLACE INTO subscription_plan_limits (plan_id, quota_key, limit_value, counting_policy)
            VALUES (?, ?, ?, 'active_only')
          `).run(p.id, qKey, qVal);
        }

        for (const [feat, isEn] of Object.entries(p.features)) {
          centralDbInstance.prepare(`
            INSERT OR REPLACE INTO subscription_plan_features (plan_id, feature_key, is_enabled)
            VALUES (?, ?, ?)
          `).run(p.id, feat, isEn);
        }
      }
    }
  }

  return centralDbInstance;
}

export function closeCentralDb() {
  if (centralDbInstance) {
    try { centralDbInstance.close(); } catch (_) {}
    centralDbInstance = null;
  }
}
