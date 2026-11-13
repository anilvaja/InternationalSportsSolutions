#!/usr/bin/env node
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

const MODULES = [
  { id: '1', key: 'setup', name: 'Module 01: Setup Wizard & Academy Onboarding', file: 'tests/e2e/01-setup-and-onboarding.spec.mjs' },
  { id: '2', key: 'auth', name: 'Module 02: Universal Auth, 8 Roles RBAC & Security', file: 'tests/e2e/02-auth-and-rbac.spec.mjs' },
  { id: '3', key: 'central', name: 'Module 03: Central Platform Admin & Tenants', file: 'tests/e2e/03-central-platform.spec.mjs' },
  { id: '4', key: 'academy', name: 'Module 04: Academy Core Ops (Branches, Sports, Batches)', file: 'tests/e2e/04-academy-operations.spec.mjs' },
  { id: '5', key: 'students', name: 'Module 05: Student Lifecycle, Admissions & Syllabus', file: 'tests/e2e/05-students-and-admissions.spec.mjs' },
  { id: '6', key: 'attendance', name: 'Module 06: Smart Attendance Engine (QR, Face, Kiosk)', file: 'tests/e2e/06-smart-attendance.spec.mjs' },
  { id: '7', key: 'staff', name: 'Module 07: Staff, Multi-Shifts & Overlap Guard', file: 'tests/e2e/07-staff-and-shifts.spec.mjs' },
  { id: '8', key: 'payroll', name: 'Module 08: Salary, Attendance & Payroll Engine', file: 'tests/e2e/08-salary-and-payroll.spec.mjs' },
  { id: '9', key: 'fees', name: 'Module 09: Fee Management, Invoicing & Quick Pay', file: 'tests/e2e/09-fees-and-invoicing.spec.mjs' },
  { id: '10', key: 'events', name: 'Module 10: Inventory, Equipment & Events', file: 'tests/e2e/10-inventory-and-events.spec.mjs' },
  { id: '11', key: 'student-portal', name: 'Module 11: Student Self-Service Portal', file: 'tests/e2e/11-student-portal.spec.mjs' },
];

const args = process.argv.slice(2);
const isHeaded = args.includes('--headed');
const isAll = args.includes('--all');
const moduleArg = args.find(a => a.startsWith('--module=') || a.startsWith('-m='))?.split('=')[1] ||
                  (args.indexOf('-m') !== -1 ? args[args.indexOf('-m') + 1] : null);

console.log('======================================================================');
console.log(' 🥋 INTERNATIONAL SPORTS SOLUTIONS — MASTER UI TEST RUNNER');
console.log(' 🔒 TARGET: http://localhost:3005/ (ISOLATED IN data_test)');
console.log('======================================================================\n');

// 1. Verify Local Server & Test Data Isolation
async function checkServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3005/api/public/system-mode', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ running: true, dataDirName: json.dataDirName, isTest: json.isTest });
        } catch (_) {
          resolve({ running: true, dataDirName: 'unknown', isTest: false });
        }
      });
    });
    req.on('error', () => resolve({ running: false }));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ running: false });
    });
  });
}

const serverStatus = await checkServer();

if (!serverStatus.running) {
  console.log('⚠️ Local server on http://localhost:3005 is not currently running.');
  console.log('👉 Please start the isolated test server in another terminal:');
  console.log('     npm run server:test\n');
  console.log('Or let this runner start it automatically...');
  
  // Auto-start test server
  console.log('🚀 Spawning isolated test server with DATA_DIR=data_test...');
  const serverProc = spawn('node', ['scripts/start_test_server.mjs'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    detached: true
  });
  serverProc.unref();
  
  // Wait for server to become responsive
  let ready = false;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const st = await checkServer();
    if (st.running && st.dataDirName === 'data_test') {
      ready = true;
      break;
    }
  }
  if (!ready) {
    console.error('❌ Failed to start isolated test server automatically. Please run: npm run server:test');
    process.exit(1);
  }
  console.log('✅ Isolated test server is now online and active on http://localhost:3005.\n');
} else {
  if (serverStatus.dataDirName !== 'data_test') {
    console.error(`❌ CRITICAL SECURITY ERROR: Running server on http://localhost:3005 is using '${serverStatus.dataDirName}', NOT 'data_test'!`);
    console.error('To protect your actual development/production databases from test mutations:');
    console.error('1. Stop the currently running server.');
    console.error('2. Start the isolated test server:');
    console.error('     npm run server:test\n');
    process.exit(1);
  }
  console.log('✅ Connected to isolated test server on http://localhost:3005 (data_test verified).\n');
}

// 2. Select Modules to Execute
let targets = [];
if (isAll) {
  targets = MODULES;
} else if (moduleArg) {
  const match = MODULES.find(m => m.id === moduleArg || m.key.toLowerCase() === moduleArg.toLowerCase());
  if (!match) {
    console.error(`❌ Unknown module: '${moduleArg}'. Available modules: 1 to 11 (or keys: ${MODULES.map(m => m.key).join(', ')})`);
    process.exit(1);
  }
  targets = [match];
} else {
  console.log('📋 AVAILABLE MODULE UI TEST SUITES:');
  MODULES.forEach(m => {
    console.log(`   [${m.id.padStart(2, '0')}] ${m.name}`);
    console.log(`        Command: npx playwright test ${m.file} ${isHeaded ? '--headed' : ''}`);
    console.log(`        Shortcut: npm run test:ui:${m.key}\n`);
  });
  console.log('💡 How to run:');
  console.log('   Run ALL modules:             node tests/e2e/run_ui_tests.mjs --all');
  console.log('   Run ALL modules (Headed):    node tests/e2e/run_ui_tests.mjs --all --headed');
  console.log('   Run specific module:         node tests/e2e/run_ui_tests.mjs --module=1');
  console.log('   Run specific module by key:  node tests/e2e/run_ui_tests.mjs --module=attendance --headed\n');
  process.exit(0);
}

// 3. Execute Selected Modules via Playwright
console.log(`🎬 Executing ${targets.length} test suite(s)... [Headed Mode: ${isHeaded ? 'ON (Watch Live Chrome)' : 'OFF (Headless)'}]\n`);

const results = [];

for (const mod of targets) {
  console.log(`▶ Starting ${mod.name}...`);
  const startTime = Date.now();
  
  const pwArgs = [
    'playwright',
    'test',
    mod.file,
    '--reporter=list',
  ];
  if (isHeaded) pwArgs.push('--headed');

  const exitCode = await new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'npx.cmd' : 'npx';
    const proc = spawn(cmd, pwArgs, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, BASE_URL: 'http://localhost:3005' }
    });
    proc.on('close', (code) => resolve(code));
    proc.on('error', (err) => {
      console.error('Process error:', err);
      resolve(1);
    });
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const status = exitCode === 0 ? 'PASS' : 'FAIL';
  results.push({ ...mod, status, durationSec });
  console.log(`🏁 ${mod.name} -> [${status}] (${durationSec}s)\n`);
}

// Write stage3_modulewise_execution_results.csv
try {
  const csvRows = ['Module_ID,Module_Name,Key,Test_File,Duration_Sec,Status,Data_Environment,Screenshots_Dir'];
  results.forEach(r => {
    csvRows.push(`"${r.id}","${r.name}","${r.key}","${r.file}","${r.durationSec}","${r.status}","data_test","tests/e2e/screenshots"`);
  });
  fs.writeFileSync(path.join(ROOT_DIR, 'stage3_modulewise_execution_results.csv'), csvRows.join('\n'), 'utf8');
  console.log('📄 Exported execution results to stage3_modulewise_execution_results.csv');
} catch (e) {
  console.error('Failed to write CSV:', e.message);
}

// 4. Print Summary Report
console.log('\n======================================================================');
console.log(' 📊 MASTER UI TEST EXECUTION SUMMARY REPORT');
console.log('======================================================================');
console.log('| #  | Module Name                                    | Status | Time   |');
console.log('|----|------------------------------------------------|--------|--------|');
let allPassed = true;
results.forEach(r => {
  const icon = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
  if (r.status !== 'PASS') allPassed = false;
  console.log(`| ${r.id.padStart(2, ' ')} | ${r.name.padEnd(46, ' ')} | ${icon} | ${r.durationSec.padStart(5, ' ')}s |`);
});
console.log('======================================================================');
console.log(`🎉 OVERALL RESULT: ${allPassed ? 'ALL MODULES PASSED (100% OPERATIONAL)' : 'SOME TESTS FAILED'}`);
console.log(`📁 Visual Screenshots Saved in: tests/e2e/screenshots/`);
console.log(`🔒 Data Isolation: All operations safely confined inside 'data_test'`);
console.log('======================================================================\n');

process.exit(allPassed ? 0 : 1);
