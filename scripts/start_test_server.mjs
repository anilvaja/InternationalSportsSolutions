import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');

// 1. Force test isolation environment variables
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = 'data_test';
process.env.PORT = process.env.PORT || '3005';

const DATA_TEST_DIR = path.join(ROOT_DIR, 'data_test');
const ACADEMIES_TEST_DIR = path.join(DATA_TEST_DIR, 'academies');

if (!fs.existsSync(ACADEMIES_TEST_DIR)) {
  fs.mkdirSync(ACADEMIES_TEST_DIR, { recursive: true });
}

console.log('====================================================');
console.log('🔒 INITIALIZING TEST ENVIRONMENT (ISOLATED DATA_TEST)');
console.log(`📁 Data Directory: ${DATA_TEST_DIR}`);
console.log('====================================================');

// Dynamic import to load config after setting environment variables
const { config } = await import('../src/config/index.js');
const { runSeed } = await import('../src/db/seed.js');
const { prepareQaRoleAccounts } = await import('./prepare_qa_role_accounts.js');

// Ensure central test database is seeded
console.log('🌱 Seeding central test database & standard roles...');
try {
  runSeed({ includeDefaultAcademy: true });
  prepareQaRoleAccounts();
  console.log('✅ Test fixtures initialized successfully in data_test.');
} catch (err) {
  console.warn('⚠️ Seeding note:', err.message);
}

// Check if port is already running
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/public/system-mode`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ inUse: true, isTest: json.dataDirName === 'data_test' });
        } catch (_) {
          resolve({ inUse: true, isTest: false });
        }
      });
    });
    req.on('error', () => resolve({ inUse: false, isTest: false }));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve({ inUse: false, isTest: false });
    });
  });
}

const status = await checkPort(process.env.PORT);
if (status.inUse) {
  if (status.isTest) {
    console.log(`\n✅ Test server is ALREADY RUNNING on http://localhost:${process.env.PORT} pointing to data_test.`);
    console.log('You can run the UI tests immediately!\n');
    process.exit(0);
  } else {
    console.error(`\n❌ Error: Port ${process.env.PORT} is already occupied by a non-test server (pointing to production/dev data/).`);
    console.error('Please stop the current server process before starting the test server.\n');
    process.exit(1);
  }
}

// Start Express server
console.log(`\n🚀 Launching isolated test server on port ${process.env.PORT}...`);
const { default: app } = await import('../server.js');
const server = app.listen(process.env.PORT, () => {
  console.log(`\n======================================================`);
  console.log(` 🔒 TEST SERVER RUNNING ON http://localhost:${process.env.PORT}`);
  console.log(` 📁 ISOLATION: DATA_DIR=data_test (data/ is untouched)`);
  console.log(`======================================================\n`);
});

// Keep process alive and handle shutdown
function shutdown() {
  console.log('\nClosing test server...');
  server.close(() => {
    console.log('Test server closed cleanly.');
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
