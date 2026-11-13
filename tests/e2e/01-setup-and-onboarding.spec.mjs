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
      if (window.SetupWizardController && typeof window.SetupWizardController.open === 'function') {
        window.SetupWizardController.open();
      } else if (window.app && typeof window.app.openAcademySetupWizard === 'function') {
        window.app.openAcademySetupWizard();
      }
    });

    await page.waitForSelector('#wizard-content', { state: 'visible', timeout: 8000 });

    // Verify Step 1: Academy Info
    await expect(page.locator('#wiz-name')).toBeVisible();
    await page.fill('#wiz-name', 'UI Test Elite Academy');
    await page.fill('#wiz-slug', 'ui-test-elite-academy');
    await page.fill('#wiz-code', 'UTEA');
    await page.selectOption('#wiz-plan', 'professional');

    // Advance to Step 2: Administrator
    await page.click('#wiz-btn-next');
    await page.waitForSelector('#wiz-admin-name', { timeout: 5000 });
    await page.fill('#wiz-admin-name', 'Elite Admin');
    await page.fill('#wiz-admin-email', 'admin@eliteacademy.test');
    await page.fill('#wiz-admin-password', 'EliteAdmin@2026');

    // Advance through steps 3 to 10
    for (let s = 3; s <= 10; s++) {
      if (await page.locator('#wiz-btn-next').isVisible()) {
        await page.click('#wiz-btn-next');
        await page.waitForTimeout(250);
      }
    }

    await page.waitForSelector('#btn-launch-academy, button:has-text("Launch")', { timeout: 8000 });
    await captureScreenshot(page, 'mod01_wizard_step10_review.png');

    // Close wizard modal cleanly
    const closeBtn = page.locator('#modal-container button:has-text("Cancel"), #modal-container button:has-text("Close"), .modal-close').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
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
        window.app.showSetupCompletenessModal(1, 'Pratik Karate Academy');
      }
    });

    await page.waitForSelector('#modal-container:has-text("Checklist"), #modal-container:has-text("Configuration"), h4:has-text("Checklist")', { state: 'visible', timeout: 8000 });

    // Verify readiness tier badge & percentage score
    const scoreElem = page.locator('#modal-container').locator('.badge-success, .badge-primary, .badge-warning, span:has-text("%")').first();
    await expect(scoreElem).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod01_completeness_dashboard.png');

    // Close modal
    const closeBtn = page.locator('#modal-container button:has-text("Close"), .modal-close').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });
});

