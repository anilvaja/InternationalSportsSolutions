import path from 'path';
import fs from 'fs';
import { expect } from '@playwright/test';

export const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
export const SCREENSHOT_DIR = path.resolve('tests/e2e/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

/**
 * Ensures running server is isolated in data_test mode
 */
export async function assertServerTestIsolation(request) {
  try {
    const res = await request.get(`${BASE_URL}/api/public/system-mode`);
    if (res.ok()) {
      const json = await res.json();
      if (json.dataDirName !== 'data_test') {
        throw new Error(`CRITICAL ISOLATION ERROR: Server is using '${json.dataDirName}' instead of 'data_test'. Aborting test to protect production data!`);
      }
    }
  } catch (err) {
    if (err.message.includes('CRITICAL ISOLATION ERROR')) throw err;
    // Server might be starting up or direct
  }
}

/**
 * Universal login helper for any role
 */
export async function login(page, email, password) {
  await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
  });
  await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { state: 'visible', timeout: 10000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#btn-login-submit');
  await page.waitForSelector('#app-view', { state: 'visible', timeout: 12000 });
  await page.waitForTimeout(500);
}

/**
 * Universal logout helper
 */
export async function logout(page) {
  try {
    const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout")').first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForTimeout(500);
    }
  } catch (_) {}
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
  });
  await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
}

/**
 * Safe navigation to dynamic tab in SPA
 */
export async function navigateToTab(page, tabId) {
  await page.evaluate((t) => {
    if (window.app) {
      if (typeof window.app.navigate === 'function') {
        window.app.navigate(t);
      } else if (typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab(t);
      }
    }
  }, tabId);
  await page.waitForTimeout(600);
}

/**
 * Toast assertion helper
 */
export async function expectToast(page, pattern, timeout = 6000) {
  const toast = page.locator('#toast-container .toast, .toast, .alert').filter({ hasText: pattern }).first();
  await expect(toast).toBeVisible({ timeout });
}

/**
 * High-resolution screenshot capture
 */
export async function captureScreenshot(page, filename) {
  const target = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: target, fullPage: false });
  return `screenshots/${filename}`;
}

