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
    // Navigate to Central Academies
    await page.evaluate(() => {
      if (window.app) window.app.navigate('central-academies');
    });
    await page.waitForTimeout(800);

    const academiesTable = page.locator('#central-academies-table, table, .table-responsive').first();
    await expect(academiesTable).toBeVisible({ timeout: 10000 });
    await expect(academiesTable.locator('text=Pratik').first()).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod03_central_academies_list.png');
  });

  test('03.2 - Central subscription plans and quota limits inspection', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app) window.app.navigate('central-plans');
    });
    await page.waitForTimeout(800);

    // Verify plans container or table
    const plansView = page.locator('#central-plans-view, #central-plans-container, div:has-text("Enterprise"), div:has-text("Standard")').first();
    await expect(plansView).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod03_subscription_plans.png');
  });

  test('03.3 - Central platform analytics and metrics inspection', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app) window.app.navigate('central-stats');
    });
    await page.waitForTimeout(800);

    // Verify stats view
    const statsView = page.locator('#central-stats-view, div:has-text("Metrics"), div:has-text("Academies")').first();
    await expect(statsView).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod03_central_stats.png');
  });

  test('03.4 - Super Admin security audit logs inspection', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app) window.app.navigate('central-audit');
    });
    await page.waitForTimeout(800);

    // Verify audit logs table
    const auditTable = page.locator('#central-audit-table, table, div:has-text("Audit")').first();
    await expect(auditTable).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod03_central_audit_logs.png');
  });
});

