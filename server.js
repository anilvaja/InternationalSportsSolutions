import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './src/config/index.js';
import { getCentralDb, closeCentralDb } from './src/db/centralDb.js';
import { closeAllTenantDbs } from './src/db/connectionManager.js';
import { authenticateToken } from './src/middleware/auth.js';
import { authRouter } from './src/routes/authRoutes.js';
import { centralRouter } from './src/routes/centralRoutes.js';
import { academyRouter } from './src/routes/academyRoutes.js';
import { studentRouter } from './src/routes/studentRoutes.js';
import { publicRouter } from './src/routes/publicRoutes.js';
import { staffRouter } from './src/routes/staffRoutes.js';
import { runSeed } from './src/db/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy for accurate Host & Subdomain detection
app.set('trust proxy', true);

// Initialize Central Database & check migrations
const centralDb = getCentralDb();

// Self-healing Auto-Seed: If database has no super admin, seed default initial data
try {
  const superAdminCount = centralDb.prepare('SELECT COUNT(*) as count FROM super_admins').get()?.count || 0;
  if (superAdminCount === 0) {
    console.log('[Auto-Seed] Empty database detected on startup. Initializing default platform data and super admin...');
    runSeed();
    console.log('[Auto-Seed] Database successfully initialized.');
  }
} catch (seedErr) {
  console.warn('[Auto-Seed] Automatic seed check warning:', seedErr.message);
}

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(authenticateToken);

// Serve Static Assets with no-cache in development to ensure client always gets latest frontend
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/central', centralRouter);
app.use('/api/academy', academyRouter);
app.use('/api/student', studentRouter);
app.use('/api/public', publicRouter);
app.use('/api/staff', staffRouter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    architecture: 'Database-per-Tenant SQLite (better-sqlite3)',
  });
});

// Single Page Application Fallback
app.get('*', (req, res, next) => {
  // If it's an API route or file with extension, don't serve index.html
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('server')
);

let server;
let serverPort80;

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  server = app.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(` International Sports Solutions - Multi-Tenant Platform`);
    console.log(` Server running on http://localhost:${config.port}`);
    console.log(` Base Domain URL: http://internationalsportssolutions.test:${config.port}`);
    console.log(` Database: Isolated SQLite per Tenant`);
    console.log(`======================================================\n`);
  });

  // Also bind to default HTTP port 80 so http://internationalsportssolutions.test/ works directly
  if (config.port !== 80) {
    try {
      serverPort80 = app.listen(80, () => {
        console.log(`✔ Direct HTTP Port 80 Active: http://internationalsportssolutions.test/`);
      });
      serverPort80.on('error', (err) => {
        if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') {
          console.warn(`[Port 80 Notice] ${err.message}`);
        }
      });
    } catch (e) {}
  }
}

// Graceful Shutdown
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully closing databases and server...`);
  if (serverPort80) {
    try { serverPort80.close(); } catch (e) {}
  }
  if (server) {
    server.close(() => {
      closeAllTenantDbs();
      closeCentralDb();
      console.log('All database connections closed cleanly.');
      process.exit(0);
    });
  } else {
    closeAllTenantDbs();
    closeCentralDb();
    process.exit(0);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default app;
