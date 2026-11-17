import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

export const config = {
  port: process.env.PORT || 3005,
  baseDomain: process.env.BASE_DOMAIN || 'internationalsportssolutions.com',
  baseDomainTest: 'internationalsportssolutions.test',
  jwtSecret: process.env.JWT_SECRET || 'iss_sports_saas_super_secret_jwt_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  rootDir: ROOT_DIR,

  /**
   * Evaluates if current runtime is in automated test mode
   */
  get isTest() {
    return process.env.NODE_ENV === 'test' ||
      (Array.isArray(process.execArgv) && process.execArgv.includes('--test')) ||
      (Array.isArray(process.argv) && process.argv.includes('--test'));
  },

  get nodeEnv() {
    return process.env.NODE_ENV || (this.isTest ? 'test' : 'development');
  },

  /**
   * Root directory for SQLite databases:
   * Supports dedicated persistent volume configurations:
   * - GoDaddy Private Storage: auto-detected at /private/data
   * - DATABASE_STORAGE_PATH: e.g. /private or /home/account/iss-persistent-data
   * - PRODUCTION_DATABASE_STORAGE_PATH / PREVIEW_DATABASE_STORAGE_PATH
   * - DATA_DIR: legacy override
   * - Automated tests: 'data_test'
   * - Default: 'data'
   */
  get dataDir() {
    if (this.isTest) {
      return path.join(ROOT_DIR, 'data_test');
    }
    const envStoragePath = this.nodeEnv === 'production'
      ? (process.env.PRODUCTION_DATABASE_STORAGE_PATH || process.env.DATABASE_STORAGE_PATH)
      : (process.env.PREVIEW_DATABASE_STORAGE_PATH || process.env.DATABASE_STORAGE_PATH);

    if (envStoragePath) {
      return path.resolve(envStoragePath);
    }
    if (process.env.DATA_DIR) {
      return path.resolve(ROOT_DIR, process.env.DATA_DIR);
    }
    // Auto-detect GoDaddy Durable Private Storage (/private) on Linux host
    if (process.platform === 'linux' && fs.existsSync('/private')) {
      try {
        fs.accessSync('/private', fs.constants.W_OK);
        return '/private/data';
      } catch (_) {}
    }
    return path.join(ROOT_DIR, 'data');
  },

  get centralDbPath() {
    if (this.isTest) {
      return path.join(this.dataDir, 'central.db');
    }
    if (process.env.CENTRAL_DATABASE_PATH) {
      return path.resolve(process.env.CENTRAL_DATABASE_PATH);
    }
    if (process.env.CENTRAL_DB_PATH) {
      return path.resolve(ROOT_DIR, process.env.CENTRAL_DB_PATH);
    }
    // Check if central/central.sqlite exists in storage directory, else central.sqlite, else central.db
    const nestedSqlite = path.join(this.dataDir, 'central', 'central.sqlite');
    const flatSqlite = path.join(this.dataDir, 'central.sqlite');
    const flatDb = path.join(this.dataDir, 'central.db');
    if (fs.existsSync(nestedSqlite)) return nestedSqlite;
    if (fs.existsSync(flatSqlite)) return flatSqlite;
    if (fs.existsSync(flatDb)) return flatDb;
    if (process.env.DATABASE_STORAGE_PATH || process.env.PRODUCTION_DATABASE_STORAGE_PATH || process.env.PREVIEW_DATABASE_STORAGE_PATH) {
      return nestedSqlite;
    }
    return flatDb;
  },

  get academiesDir() {
    if (this.isTest) {
      return path.join(this.dataDir, 'academies');
    }
    if (process.env.TENANT_DATABASE_PATH) {
      return path.resolve(process.env.TENANT_DATABASE_PATH);
    }
    if (process.env.ACADEMIES_DIR) {
      return path.resolve(ROOT_DIR, process.env.ACADEMIES_DIR);
    }
    const tenantsDir = path.join(this.dataDir, 'tenants');
    const academiesDir = path.join(this.dataDir, 'academies');
    if (fs.existsSync(tenantsDir)) return tenantsDir;
    if (fs.existsSync(academiesDir)) return academiesDir;
    if (process.env.DATABASE_STORAGE_PATH || process.env.PRODUCTION_DATABASE_STORAGE_PATH || process.env.PREVIEW_DATABASE_STORAGE_PATH) {
      return tenantsDir;
    }
    return academiesDir;
  },

  /**
   * Storage directory for uploads and backups
   */
  get storageDir() {
    if (this.isTest) {
      return path.join(ROOT_DIR, 'storage_test');
    }
    if (process.env.BACKUP_STORAGE_PATH) {
      return path.resolve(process.env.BACKUP_STORAGE_PATH);
    }
    if (process.env.STORAGE_DIR) {
      return path.resolve(ROOT_DIR, process.env.STORAGE_DIR);
    }
    if (process.env.DATABASE_STORAGE_PATH || process.env.PRODUCTION_DATABASE_STORAGE_PATH || process.env.PREVIEW_DATABASE_STORAGE_PATH) {
      return path.join(this.dataDir, 'storage');
    }
    if (process.platform === 'linux' && fs.existsSync('/private')) {
      return '/private/storage';
    }
    return path.join(ROOT_DIR, 'storage');
  },

  get uploadsDir() {
    return path.join(this.storageDir, 'uploads');
  },

  get backupsDir() {
    if (process.env.BACKUP_STORAGE_PATH) {
      return path.resolve(process.env.BACKUP_STORAGE_PATH);
    }
    if (process.env.DATABASE_STORAGE_PATH || process.env.PRODUCTION_DATABASE_STORAGE_PATH || process.env.PREVIEW_DATABASE_STORAGE_PATH) {
      return path.join(this.dataDir, 'backups');
    }
    if (process.platform === 'linux' && fs.existsSync('/private')) {
      return '/private/backups';
    }
    return path.join(this.storageDir, 'backups');
  },
};
