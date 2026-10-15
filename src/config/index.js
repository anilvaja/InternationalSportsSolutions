import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

export const config = {
  port: process.env.PORT || 3005,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'iss_sports_saas_super_secret_jwt_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms

  // Paths
  rootDir: ROOT_DIR,
  dataDir: path.join(ROOT_DIR, 'data'),
  centralDbPath: path.join(ROOT_DIR, 'data', 'central.db'),
  academiesDir: path.join(ROOT_DIR, 'data', 'academies'),
  storageDir: path.join(ROOT_DIR, 'storage'),
  uploadsDir: path.join(ROOT_DIR, 'storage', 'uploads'),
  backupsDir: path.join(ROOT_DIR, 'storage', 'backups'),
};
