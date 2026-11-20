import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
import { requireSetupIpForHtml } from './src/middleware/setupIpGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy for accurate Host & Subdomain detection
app.set('trust proxy', true);

// Initialize Central Database & check migrations
const centralDb = getCentralDb();

// Self-Healing Platform Baseline Seeder: Automatically initializes Super Admin, Subscription Plans,
// Permissions, and Default Academy (Pratik Karate Academy) if platform databases are fresh or unseeded.
if (process.env.NODE_ENV !== 'test') {
  try {
    const superAdminCount = centralDb.prepare('SELECT COUNT(*) as c FROM super_admins').get()?.c || 0;
    const plansCount = centralDb.prepare('SELECT COUNT(*) as c FROM subscription_plans').get()?.c || 0;
    const academiesCount = centralDb.prepare('SELECT COUNT(*) as c FROM academies').get()?.c || 0;
    const lookupCount = centralDb.prepare('SELECT COUNT(*) as c FROM academy_users_lookup').get()?.c || 0;

    if (superAdminCount === 0 || plansCount === 0 || academiesCount === 0) {
      console.log(`[Auto-Init] Baseline platform data missing (SuperAdmins=${superAdminCount}, Plans=${plansCount}, Academies=${academiesCount}). Running non-destructive platform seeder...`);
      runSeed({ includeDefaultAcademy: academiesCount === 0 });
    }

    if (lookupCount === 0 && academiesCount > 0) {
      const { prepareQaRoleAccounts } = await import('./scripts/prepare_qa_role_accounts.js');
      prepareQaRoleAccounts();
    }
  } catch (err) {
    console.warn('[Auto-Init] Warning during platform baseline check:', err.message);
  }
}

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(authenticateToken);

// Serve Static Assets with no-cache in development to ensure client always gets latest frontend
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
app.use('/storage', express.static(config.storageDir));
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

// Root ("/") Route: Marketing homepage for guests, portal SPA for authenticated users
app.get('/', (req, res) => {
  // If explicitly requesting home or preview
  if (req.query.home !== undefined || req.query.preview !== undefined) {
    return res.sendFile(path.join(__dirname, 'public', 'home.html'));
  }
  // If explicitly requesting portal or login
  if (req.query.portal !== undefined || req.query.login !== undefined) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  let isAuthenticated = false;
  const token = (req.cookies && req.cookies.token) ||
    (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ') && req.headers['authorization'].substring(7));

  if (token) {
    try {
      jwt.verify(token, config.jwtSecret);
      isAuthenticated = true;
    } catch (_) {
      isAuthenticated = false;
    }
  }

  if (isAuthenticated) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  // Marketing homepage for prospective academy owners
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Dedicated Public Marketing Homepage Route
app.get(['/home', '/home.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Dedicated Portal & Login Routes (Serves the SPA Application Shell)
app.get(['/login', '/login.html', '/portal', '/portal.html', '/index', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dedicated Platform Setup & Reset Routes (Authorized Administrative IPs Only: 49.36.72.72 & Localhost)
app.get(['/setup', '/setup.html', '/reset', '/reset.html', '/resetup', '/resetup.html'], requireSetupIpForHtml, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// Dedicated Public Admission Inquiry & Self-Registration Route
app.get(['/inquiry', '/inquiry.html', '/admission', '/join'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'inquiry.html'));
});

// Dedicated Quick-Pay Route
app.get(['/pay', '/pay.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pay.html'));
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
    console.log(` Base Domain URL: http://${config.baseDomain || 'internationalsportssolutions.com'}:${config.port}`);
    console.log(` Database Architecture: Isolated SQLite per Tenant`);
    console.log(` Persistent Storage Base: ${config.dataDir}`);
    console.log(` Central Database Path:   ${config.centralDbPath}`);
    console.log(` Tenant Databases Dir:    ${config.academiesDir}`);
    console.log(` Storage / Backups Dir:   ${config.backupsDir}`);
    console.log(`======================================================\n`);
  });

  // Also bind to default HTTP port 80 so http://internationalsportssolutions.test/ works directly
  if (config.port !== 80) {
    try {
      serverPort80 = app.listen(80, () => {
        console.log(`✔ Direct HTTP Port 80 Active: http://${config.baseDomain || 'internationalsportssolutions.com'}/`);
      });
      serverPort80.on('error', (err) => {
        if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') {
          console.warn(`[Port 80 Notice] ${err.message}`);
        }
      });
    } catch (e) { }
  }
}

// Graceful Shutdown
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully closing databases and server...`);
  if (serverPort80) {
    try { serverPort80.close(); } catch (e) { }
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
