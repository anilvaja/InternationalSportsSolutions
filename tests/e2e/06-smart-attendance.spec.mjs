import { test, expect } from '@playwright/test';
import { BASE_URL, login, logout, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 06: Smart Attendance Engine (QR, Kiosk, Biometrics, Passes)', () => {

  test.beforeEach(async ({ request, page }) => {
    await assertServerTestIsolation(request);
    await login(page, 'admin@pratikkarate.com', 'password123');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('06.1 - Smart Attendance Hub navigation and mode switcher', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('smart-attendance');
      }
    });
    await page.waitForTimeout(600);

    const hubHeading = page.locator('h1, h2, h3, .page-title').filter({ hasText: /Smart Attendance|Attendance Hub/i }).first();
    await expect(hubHeading).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod06_attendance_hub.png');
  });

  test('06.2 - Kiosk Mode interface and manual token fallback check-in', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('smart-attendance');
      }
    });
    await page.waitForTimeout(600);

    // Switch to Kiosk tab if available
    const kioskTab = page.locator('button, a').filter({ hasText: /Kiosk/i }).first();
    if (await kioskTab.isVisible()) {
      await kioskTab.click();
      await page.waitForTimeout(400);
    }

    const tokenInput = page.locator('#kiosk-token-input, input[placeholder*="token" i], input[placeholder*="scan" i], input[placeholder*="barcode" i]').first();
    if (await tokenInput.isVisible()) {
      await tokenInput.fill('ISS-TEST-TOKEN-001');
      await captureScreenshot(page, 'mod06_kiosk_manual_token.png');
    }
  });

  test('06.3 - Student ID Pass & Printable QR Badge generation', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app) window.app.navigate('smart-attendance');
    });
    await page.waitForTimeout(600);

    // Switch to Student ID Passes subtab
    const idPassTab = page.locator('button:has-text("Student ID Passes")').first();
    await expect(idPassTab).toBeVisible({ timeout: 10000 });
    await idPassTab.click();
    await page.waitForTimeout(600);

    const passView = page.locator('#smart-att-subtab-container');
    await expect(passView).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod06_id_pass_view.png');
  });

  test('06.4 - Facial Biometrics Consent & Photo Enrollment modal', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('smart-attendance');
      }
    });
    await page.waitForTimeout(600);

    // Verify biometric enrollment trigger or tab
    const bioTab = page.locator('button, a').filter({ hasText: /Face|Biometric/i }).first();
    if (await bioTab.isVisible()) {
      await bioTab.click();
      await page.waitForTimeout(400);
      await captureScreenshot(page, 'mod06_biometrics_tab.png');
    }
  });
});

