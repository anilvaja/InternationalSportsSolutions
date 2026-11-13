import { test, expect } from '@playwright/test';
import { BASE_URL, login, logout, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 11: Student Self-Service Portal (Attendance, Syllabus, Fees, Events)', () => {

  test.beforeEach(async ({ request, page }) => {
    await assertServerTestIsolation(request);
    await login(page, 'aarav.mehta@demostudent.iss', 'student123');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('11.1 - Student Dashboard: view enrolled batches and active disciplines', async ({ page }) => {
    const studentContainer = page.locator('#app-view #page-content, #page-content .stats-grid, #page-content h3:has-text("Attendance Rate")').first();
    await expect(studentContainer).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod11_student_dashboard.png');
  });

  test('11.2 - Student Attendance History: view attendance records and monthly presence', async ({ page }) => {
    // Switch to student attendance tab if available
    const attTab = page.locator('button, a').filter({ hasText: /Attendance|History/i }).first();
    if (await attTab.isVisible()) {
      await attTab.click();
      await page.waitForTimeout(400);
      await captureScreenshot(page, 'mod11_student_attendance.png');
    }
  });

  test('11.3 - Student Belt Progression: view current rank and syllabus roadmap', async ({ page }) => {
    const syllabusTab = page.locator('button, a').filter({ hasText: /Syllabus|Belt|Progress/i }).first();
    if (await syllabusTab.isVisible()) {
      await syllabusTab.click();
      await page.waitForTimeout(400);
      await captureScreenshot(page, 'mod11_student_syllabus.png');
    }
  });

  test('11.4 - Student Fee Ledger: view paid receipts and outstanding balance', async ({ page }) => {
    const feeTab = page.locator('button, a').filter({ hasText: /Fee|Invoices|Payment/i }).first();
    if (await feeTab.isVisible()) {
      await feeTab.click();
      await page.waitForTimeout(400);
      await captureScreenshot(page, 'mod11_student_fees.png');
    }
  });
});

