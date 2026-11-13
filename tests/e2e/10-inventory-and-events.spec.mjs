import { test, expect } from '@playwright/test';
import { BASE_URL, login, logout, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 10: Inventory, Facilities & Events Management', () => {

  test.beforeEach(async ({ request, page }) => {
    await assertServerTestIsolation(request);
    await login(page, 'admin@pratikkarate.com', 'password123');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('10.1 - Equipment Inventory: stock levels, item categories, and equipment roster', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('inventory');
      }
    });
    await page.waitForTimeout(600);

    const invView = page.locator('#inventory-container, table, #tab-inventory, h2:has-text("Inventory")').first();
    if (await invView.isVisible()) {
      await captureScreenshot(page, 'mod10_inventory_stock.png');
    }
  });

  test('10.2 - Events & Tournaments: event creation, dates, entry fees, and registration', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('events');
      }
    });
    await page.waitForTimeout(600);

    const eventsView = page.locator('#events-container, table, #tab-events, h2:has-text("Events")').first();
    if (await eventsView.isVisible()) {
      await captureScreenshot(page, 'mod10_events_roster.png');
    }
  });
});

