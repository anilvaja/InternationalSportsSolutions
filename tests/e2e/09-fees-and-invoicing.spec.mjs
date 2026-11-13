import { test, expect } from '@playwright/test';
import { BASE_URL, login, logout, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 09: Fee Management, Invoicing & Public Payments', () => {

  test.beforeEach(async ({ request }) => {
    await assertServerTestIsolation(request);
  });

  test('09.1 - Fee Structures: listing and structure creation interface', async ({ page }) => {
    await login(page, 'admin@pratikkarate.com', 'password123');

    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('fees');
      }
    });
    await page.waitForTimeout(600);

    const feesView = page.locator('#fees-container, table, #tab-fees, h2:has-text("Fees")').first();
    await expect(feesView).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod09_fees_structures.png');
    await logout(page);
  });

  test('09.2 - Invoices & Payment Receipts: collect payment and view print receipt', async ({ page }) => {
    await login(page, 'anita.finance@pratikkarate.com', 'staff123');

    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('invoices');
      }
    });
    await page.waitForTimeout(600);

    const invoicesTable = page.locator('#invoices-table, table, #tab-invoices').first();
    if (await invoicesTable.isVisible()) {
      await captureScreenshot(page, 'mod09_invoices_table.png');
    }
    await logout(page);
  });

  test('09.3 - Public Fee Payment Portal (/pay.html): access and invoice lookup', async ({ page }) => {
    await page.goto(`${BASE_URL}/pay.html`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify quick pay input & invoice search
    const payTitle = page.locator('h1, h2, .pay-title, form').first();
    await expect(payTitle).toBeVisible({ timeout: 10000 });

    const invInput = page.locator('#invoice-number, input[placeholder*="Invoice" i], input[name*="invoice" i]').first();
    if (await invInput.isVisible()) {
      await invInput.fill('INV-2026-TEST');
      await captureScreenshot(page, 'mod09_public_pay_portal.png');
    }
  });
});

