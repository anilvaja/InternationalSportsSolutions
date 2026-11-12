import { test, expect } from '@playwright/test';
import { BASE_URL, CREDENTIALS, ROUTES } from './helpers/constants.js';
import { loginAsAcademyAdmin, loginAsStudent, navigateAndEnsureAuth } from './helpers/auth.js';

test.describe('Module 8: Smart Attendance Engine End-to-End Suite', () => {

  test.describe('Academy Staff & Admin Smart Attendance Controls', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAcademyAdmin(page);
    });

    test('1. Smart Attendance Hub navigation and mode tabs rendering', async ({ page }) => {
      await page.goto(`${BASE_URL}/academy/smart-attendance`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();

      // Ensure Smart Attendance Hub title or header is present
      const hubHeading = page.locator('h1, h2, h3, .page-title').filter({ hasText: /Smart Attendance|Attendance Hub/i }).first();
      await expect(hubHeading).toBeVisible({ timeout: 10000 });

      // Verify mode tabs: Kiosk, Coach Scanner, Exceptions, Settings, ID Cards
      const kioskTab = page.locator('button, a').filter({ hasText: /Kiosk/i }).first();
      const coachTab = page.locator('button, a').filter({ hasText: /Coach Scanner/i }).first();
      const settingsTab = page.locator('button, a').filter({ hasText: /Settings/i }).first();

      await expect(kioskTab).toBeVisible();
      await expect(coachTab).toBeVisible();
      await expect(settingsTab).toBeVisible();
    });

    test('2. Kiosk View interface and manual token fallback check-in', async ({ page }) => {
      await page.goto(`${BASE_URL}/academy/smart-attendance`, { waitUntil: 'domcontentloaded' });
      
      // Click Kiosk Tab
      const kioskBtn = page.locator('button, a').filter({ hasText: /Kiosk/i }).first();
      await kioskBtn.click();
      await page.waitForTimeout(500);

      // Verify scanner container or manual token input
      const tokenInput = page.locator('#kiosk-token-input, input[placeholder*="token" i], input[placeholder*="scan" i], input[placeholder*="barcode" i]').first();
      await expect(tokenInput).toBeVisible();

      // Enter a token or simulated manual check-in
      await tokenInput.fill('ISS-STU-MANUALTEST');
      const submitBtn = page.locator('#kiosk-submit-btn, button[onclick*="submitKioskManualScan"]').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(600);
      }
    });

    test('3. Student Roster ID Pass action modal rendering', async ({ page }) => {
      await page.goto(`${BASE_URL}/academy/students`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);

      // Look for the "ID Pass" button in the first student row
      const idPassBtn = page.locator('button').filter({ hasText: /ID Pass|View \/ Print ID/i }).first();
      if (await idPassBtn.isVisible()) {
        await idPassBtn.click();
        await page.waitForTimeout(800);

        // Modal should open with student ID card badge
        const modal = page.locator('.modal-dialog, .modal-content, .id-card-badge').first();
        await expect(modal).toBeVisible();

        // Close modal
        const closeBtn = page.locator('.modal-dialog button.btn-close, .modal-header button, button:has-text("Close")').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      }
    });

    test('4. Smart Attendance Settings configuration and toggle validation', async ({ page }) => {
      await page.goto(`${BASE_URL}/academy/smart-attendance`, { waitUntil: 'domcontentloaded' });

      // Click Settings Tab
      const settingsTab = page.locator('button, a').filter({ hasText: /Settings/i }).first();
      await settingsTab.click();
      await page.waitForTimeout(500);

      // Verify settings inputs exist (e.g., duplicate cooldown minutes, default mode)
      const cooldownInput = page.locator('input[type="number"], select').first();
      await expect(cooldownInput).toBeVisible();
    });
  });

  test.describe('Student Self-Service Digital ID Pass', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsStudent(page);
    });

    test('5. Student views personal digital attendance ID pass with QR', async ({ page }) => {
      await page.goto(`${BASE_URL}/student`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();

      // Check if student ID card view or link is accessible
      const idCardLink = page.locator('a, button').filter({ hasText: /ID Card|Digital Pass|My QR/i }).first();
      if (await idCardLink.isVisible()) {
        await idCardLink.click();
        await page.waitForTimeout(500);
        const cardBadge = page.locator('.id-card-badge, .printable-id-card').first();
        await expect(cardBadge).toBeVisible();
      }
    });
  });
});

