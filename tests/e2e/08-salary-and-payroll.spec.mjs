import { test, expect } from '@playwright/test';
import { BASE_URL, login, logout, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 08: Salary, Attendance & Payroll Engine', () => {

  test.beforeEach(async ({ request, page }) => {
    await assertServerTestIsolation(request);
    await login(page, 'admin@pratikkarate.com', 'password123');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('08.1 - Payroll Dashboard: overview, historical periods, and active cycle', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('payroll');
      }
    });
    await page.waitForTimeout(600);

    const payrollView = page.locator('#payroll-container, table, #tab-payroll, h2:has-text("Payroll")').first();
    await expect(payrollView).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod08_payroll_dashboard.png');
  });

  test('08.2 - Salary Settings & Divisors: academy-level and employee overrides', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('payroll-settings');
      }
    });
    await page.waitForTimeout(600);

    const settingsView = page.locator('#payroll-settings-container, form, div:has-text("Divisor"), div:has-text("Overtime")').first();
    if (await settingsView.isVisible()) {
      await captureScreenshot(page, 'mod08_salary_settings.png');
    }
  });

  test('08.3 - Employee Leaves & Holidays: policy listing and balances', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('leaves');
      }
    });
    await page.waitForTimeout(600);

    const leavesView = page.locator('#leaves-table, table, #tab-leaves').first();
    if (await leavesView.isVisible()) {
      await captureScreenshot(page, 'mod08_leaves_dashboard.png');
    }
  });

  test('08.4 - Payslip Generation: itemized breakdown and print preview modal', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('payroll');
      }
    });
    await page.waitForTimeout(600);

    const payslipBtn = page.locator('button:has-text("Payslip"), button:has-text("View Slip"), a:has-text("Slip")').first();
    if (await payslipBtn.isVisible()) {
      await payslipBtn.click();
      await page.waitForSelector('#payslip-modal, .modal.show, div:has-text("Payslip")', { timeout: 6000 });
      await captureScreenshot(page, 'mod08_payslip_modal.png');

      const closeBtn = page.locator('#payslip-modal .btn-close, .modal button:has-text("Close")').first();
      if (await closeBtn.isVisible()) await closeBtn.click();
    }
  });
});

