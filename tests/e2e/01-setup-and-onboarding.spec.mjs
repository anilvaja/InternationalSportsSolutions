import { test, expect } from '@playwright/test';
import { BASE_URL, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 01: Platform Setup Wizard & Academy Onboarding', () => {

  test.beforeEach(async ({ request }) => {
    await assertServerTestIsolation(request);
  });

  test('01.1 - Access /setup and verify clean platform status overview', async ({ page }) => {
    await page.goto(`${BASE_URL}/setup`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify Setup Header & Platform Status
    const title = page.locator('h1, h2, .setup-title').filter({ hasText: /Platform Setup|Setup/i }).first();
    await expect(title).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod01_setup_status.png');
  });

  test('01.2 - Open 10-step wizard and verify progressive navigation through all 10 steps', async ({ page }) => {
    // Open wizard directly via Super Admin or Central Setup Wizard
    await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
    
    // Login as Super Admin
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', 'anilvaja.007@gmail.com');
    await page.fill('#login-password', 'password');
    await page.click('#btn-login-submit');
    await page.waitForSelector('#app-view', { state: 'visible', timeout: 12000 });

    // Open Setup Wizard Modal
    await page.evaluate(() => {
      if (window.app && typeof window.app.openAcademySetupWizard === 'function') {
        window.app.openAcademySetupWizard();
      }
    });

    await page.waitForSelector('#academy-setup-wizard-modal', { state: 'visible', timeout: 8000 });

    // Verify Step 1: Academy Info
    await expect(page.locator('#wiz-step-1')).toBeVisible();
    await page.fill('#wiz-name', 'UI Test Elite Academy');
    await page.fill('#wiz-email', 'contact@eliteacademy.test');
    await page.fill('#wiz-phone', '+91 99887 76655');
    await page.selectOption('#wiz-plan', 'professional');

    // Advance to Step 2: Administrator
    await page.click('#wiz-btn-next');
    await page.waitForTimeout(300);
    await expect(page.locator('#wiz-step-2')).toBeVisible();
    await page.fill('#wiz-admin-name', 'Elite Admin');
    await page.fill('#wiz-admin-email', 'admin@eliteacademy.test');
    await page.fill('#wiz-admin-pass', 'EliteAdmin@2026');

    // Advance to Step 3: Branches
    await page.click('#wiz-btn-next');
    await page.waitForTimeout(300);
    await expect(page.locator('#wiz-step-3')).toBeVisible();
    await page.fill('#wiz-branch-name-0', 'North Satellite Dojo');

    // Advance to Step 4: Sports
    await page.click('#wiz-btn-next');
    await page.waitForTimeout(300);
    await expect(page.locator('#wiz-step-4')).toBeVisible();

    // Advance to Step 5: Batches
    await page.click('#wiz-btn-next');
    await page.waitForTimeout(300);
    await expect(page.locator('#wiz-step-5')).toBeVisible();

    // Advance to Step 6: Staff
    await page.click('#wiz-btn-next');
    await page.waitForTimeout(300);
    await expect(page.locator('#wiz-step-6')).toBeVisible();

    // Advance to Step 7: Attendance
    await page.click('#wiz-btn-next');
    await page.waitForTimeout(300);
    await expect(page.locator('#wiz-step-7')).toBeVisible();

    // Advance to Step 8: Salary
    await page.click('#wiz-btn-next');
    await page.waitForTimeout(300);
    await expect(page.locator('#wiz-step-8')).toBeVisible();

    // Advance to Step 9: Fees
    await page.click('#wiz-btn-next');
    await page.waitForTimeout(300);
    await expect(page.locator('#wiz-step-9')).toBeVisible();

    // Advance to Step 10: Review
    await page.click('#wiz-btn-next');
    await page.waitForTimeout(300);
    await expect(page.locator('#wiz-step-10')).toBeVisible();

    await captureScreenshot(page, 'mod01_wizard_step10_review.png');

    // Close wizard modal cleanly
    await page.click('#academy-setup-wizard-modal .btn-close, #academy-setup-wizard-modal button:has-text("Cancel")');
  });

  test('01.3 - Verify Setup Completeness Audit Dashboard & Readiness Tiers for Active Academy', async ({ page }) => {
    // Login as Academy Admin
    await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', 'admin@pratikkarate.com');
    await page.fill('#login-password', 'password123');
    await page.click('#btn-login-submit');
    await page.waitForSelector('#app-view', { state: 'visible', timeout: 12000 });

    // Open Setup Completeness Modal
    await page.evaluate(() => {
      if (window.app && typeof window.app.showSetupCompletenessModal === 'function') {
        window.app.showSetupCompletenessModal();
      }
    });

    await page.waitForSelector('#setup-completeness-modal', { state: 'visible', timeout: 8000 });

    // Verify readiness tier badge & percentage score
    const scoreElem = page.locator('#completeness-score, .completeness-value, span:has-text("%")').first();
    await expect(scoreElem).toBeVisible();

    await captureScreenshot(page, 'mod01_completeness_dashboard.png');

    // Close modal
    await page.click('#setup-completeness-modal .btn-close, #setup-completeness-modal button:has-text("Close")');
  });
});

