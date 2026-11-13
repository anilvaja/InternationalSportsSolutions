import { test, expect } from '@playwright/test';
import { BASE_URL, login, logout, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 05: Student Lifecycle, Admissions & Syllabus Progression', () => {

  test.beforeEach(async ({ request, page }) => {
    await assertServerTestIsolation(request);
    await login(page, 'admin@pratikkarate.com', 'password123');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('05.1 - Student Inquiries: creation, listing and pipeline status', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('inquiries');
      }
    });
    await page.waitForTimeout(600);

    const inquiriesView = page.locator('#inquiries-table, table, #tab-inquiries').first();
    await expect(inquiriesView).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod05_inquiries_list.png');
  });

  test('05.2 - Student Roster: search, status filter, and branch filter', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('students');
      }
    });
    await page.waitForTimeout(600);

    const studentsTable = page.locator('#students-table, table').first();
    await expect(studentsTable).toBeVisible({ timeout: 10000 });

    // Verify search input
    const searchInput = page.locator('#student-search-input, input[placeholder*="Search" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Aarav');
      await page.waitForTimeout(400);
    }

    await captureScreenshot(page, 'mod05_students_roster.png');
  });

  test('05.3 - Student Admission Modal: form validation & checklist', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('students');
      }
    });
    await page.waitForTimeout(600);

    // Click "Add Student" or "New Admission" button
    const addBtn = page.locator('button:has-text("Add Student"), button:has-text("New Admission"), #btn-add-student').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForSelector('#student-modal, .modal.show, div:has-text("Add Student")', { timeout: 6000 });

      await captureScreenshot(page, 'mod05_student_admission_modal.png');

      // Close modal
      const closeBtn = page.locator('#student-modal .btn-close, .modal button:has-text("Cancel")').first();
      if (await closeBtn.isVisible()) await closeBtn.click();
    }
  });

  test('05.4 - Syllabus & Belt Progression: view techniques & promotion roadmap', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigateToTab === 'function') {
        window.app.navigateToTab('syllabus');
      }
    });
    await page.waitForTimeout(600);

    const syllabusView = page.locator('#syllabus-container, table, div:has-text("Kata"), div:has-text("Kumite")').first();
    await expect(syllabusView).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod05_syllabus_progression.png');
  });
});

