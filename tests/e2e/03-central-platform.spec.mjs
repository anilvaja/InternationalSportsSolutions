import { test, expect } from '@playwright/test';
import { BASE_URL, login, logout, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 03: Central Platform Administration', () => {

  test.beforeEach(async ({ request, page }) => {
    await assertServerTestIsolation(request);
    await login(page, 'anilvaja.007@gmail.com', 'password');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('03.1 - Super Admin platform dashboard and tenant metrics', async ({ page }) => {
    // Navigate to Central Dashboard
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('central-academies');
      }
    });
    await page.waitForTimeout(600);

    const academiesTable = page.locator('#central-academies-table, table').first();
    await expect(academiesTable).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Pratik Karate Academy').first()).toBeVisible();

    await captureScreenshot(page, 'mod03_central_academies_list.png');
  });

  test('03.2 - Central subscription plans and quota limits inspection', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('central-plans');
      }
    });
    await page.waitForTimeout(600);

    // Verify plans container or table
    const plansView = page.locator('#central-plans-view, #central-plans-container, div:has-text("Enterprise")').first();
    await expect(plansView).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod03_subscription_plans.png');
  });

  test('03.3 - Central domain routing and custom domain registry', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('central-domains');
      }
    });
    await page.waitForTimeout(600);

    // Verify domains table
    const domainsTable = page.locator('#central-domains-table, table, div:has-text(".test")').first();
    await expect(domainsTable).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod03_central_domains.png');
  });

  test('03.4 - Super Admin security audit logs inspection', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('central-audit');
      }
    });
    await page.waitForTimeout(600);

    // Verify audit logs table
    const auditTable = page.locator('#central-audit-table, table, div:has-text("Audit")').first();
    await expect(auditTable).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod03_central_audit_logs.png');
  });
});

