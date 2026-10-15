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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy for accurate Host & Subdomain detection
app.set('trust proxy', true);

// Initialize Central Database & check migrations
getCentralDb();

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(authenticateToken);

// Serve Static Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/central', centralRouter);
app.use('/api/academy', academyRouter);
app.use('/api/student', studentRouter);
app.use('/api/public', publicRouter);

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
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  server = app.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(` International Sports Solutions - Multi-Tenant Platform`);
    console.log(` Server running on http://localhost:${config.port}`);
    console.log(` Database: Isolated SQLite per Tenant`);
    console.log(`======================================================\n`);
  });
}

// Graceful Shutdown
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully closing databases and server...`);
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
