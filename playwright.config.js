import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';

/**
 * System Browser Path Resolver for Device Guard compliance
 */
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const systemExecutablePath = CHROME_PATHS.find(p => fs.existsSync(p));

/**
 * Visual mode settings:
 * Set SLOW_MO (ms) to slow down actions so user can watch form filling live.
 */
const IS_HEADED = process.argv.includes('--headed') || process.env.HEADED === 'true';
const SLOW_MO = parseInt(process.env.SLOW_MO || (IS_HEADED ? '400' : '0'), 10);
const BASE_URL = process.env.BASE_URL || 'http://internationalsportssolutions.com';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/test-results.json' }]
  ],
  use: {
    baseURL: BASE_URL,

    /* Launch system Chrome in visual headed or headless mode */
    launchOptions: {
      ...(systemExecutablePath ? { executablePath: systemExecutablePath } : {}),
      headless: !IS_HEADED,
      slowMo: SLOW_MO,
    },

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    viewport: { width: 1366, height: 768 },
    actionTimeout: 15 * 1000,
    navigationTimeout: 20 * 1000,
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
