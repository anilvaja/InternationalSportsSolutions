import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { runMigrations } from './migrator.js';

let centralDbInstance = null;

export function getCentralDb() {
  if (centralDbInstance) {
    return centralDbInstance;
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

  return centralDbInstance;
}

export function closeCentralDb() {
  if (centralDbInstance) {
    centralDbInstance.close();
    centralDbInstance = null;
  }
}
