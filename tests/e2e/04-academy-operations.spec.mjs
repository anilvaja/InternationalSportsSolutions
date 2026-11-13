import { test, expect } from '@playwright/test';
import { BASE_URL, login, logout, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 04: Academy Core Operations (Branches, Sports, Batches)', () => {

  test.beforeEach(async ({ request, page }) => {
    await assertServerTestIsolation(request);
    await login(page, 'admin@pratikkarate.com', 'password123');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('04.1 - Academy Dashboard metrics and quick action cards', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('overview');
      }
    });
    await page.waitForTimeout(600);

    // Verify stats cards
    const statsContainer = page.locator('#stats-container, .metrics-grid, div:has-text("Total Students")').first();
    await expect(statsContainer).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod04_academy_overview.png');
  });

  test('04.2 - Branch Management: listing and branch creation interface', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('branches');
      }
    });
    await page.waitForTimeout(600);

    // Verify branches table and primary dojo
    const branchesTable = page.locator('#branches-table, table').first();
    await expect(branchesTable).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Navrangpura Main Dojo').first()).toBeVisible();

    await captureScreenshot(page, 'mod04_branches_roster.png');
  });

  test('04.3 - Sports & Disciplines: management and syllabus categories', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('sports');
      }
    });
    await page.waitForTimeout(600);

    // Verify sports table
    const sportsTable = page.locator('#sports-table, table').first();
    await expect(sportsTable).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Karate').first()).toBeVisible();

    await captureScreenshot(page, 'mod04_sports_list.png');
  });

  test('04.4 - Batches & Timetables: roster, schedules, and coach assignments', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('batches');
      }
    });
    await page.waitForTimeout(600);

    // Verify batches table
    const batchesTable = page.locator('#batches-table, table').first();
    await expect(batchesTable).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod04_batches_roster.png');
  });
});

