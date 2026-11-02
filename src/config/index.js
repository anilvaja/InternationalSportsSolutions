import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

export const config = {
  port: process.env.PORT || 3005,
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
   * - Automated tests: 'data_test' (completely isolated from real data)
   * - Development / Production: 'data' (or customized via DATA_DIR env)
   */
  get dataDir() {
    if (process.env.DATA_DIR) {
      return path.resolve(ROOT_DIR, process.env.DATA_DIR);
    }
    return path.join(ROOT_DIR, this.isTest ? 'data_test' : 'data');
  },

  get centralDbPath() {
    if (process.env.CENTRAL_DB_PATH) {
      return path.resolve(ROOT_DIR, process.env.CENTRAL_DB_PATH);
    }
    return path.join(this.dataDir, 'central.db');
  },

  get academiesDir() {
    if (process.env.ACADEMIES_DIR) {
      return path.resolve(ROOT_DIR, process.env.ACADEMIES_DIR);
    }
    return path.join(this.dataDir, 'academies');
  },

  /**
   * Storage directory for uploads and backups
   */
  get storageDir() {
    if (process.env.STORAGE_DIR) {
      return path.resolve(ROOT_DIR, process.env.STORAGE_DIR);
    }
    return path.join(ROOT_DIR, this.isTest ? 'storage_test' : 'storage');
  },

  get uploadsDir() {
    return path.join(this.storageDir, 'uploads');
  },

  get backupsDir() {
    return path.join(this.storageDir, 'backups');
  },
};
