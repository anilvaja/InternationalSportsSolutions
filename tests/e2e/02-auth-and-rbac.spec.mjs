import { test, expect } from '@playwright/test';
import { BASE_URL, login, logout, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 02: Universal Authentication, RBAC & Role Boundaries', () => {

  test.beforeEach(async ({ request }) => {
    await assertServerTestIsolation(request);
  });

  test('02.1 - Super Admin login and Central Platform navigation', async ({ page }) => {
    await login(page, 'anilvaja.007@gmail.com', 'password');
    await expect(page.locator('#nav-central, a[href*="central"], button:has-text("Academies")').first()).toBeVisible();
    await captureScreenshot(page, 'mod02_super_admin_view.png');
    await logout(page);
  });

  test('02.2 - Academy Admin login and operational modules access', async ({ page }) => {
    await login(page, 'admin@pratikkarate.com', 'password123');
    await expect(page.locator('#tab-overview, button:has-text("Students"), button:has-text("Batches")').first()).toBeVisible();
    await captureScreenshot(page, 'mod02_academy_admin_view.png');
    await logout(page);
  });

  test('02.3 - Coach login and attendance/syllabus scoped access', async ({ page }) => {
    await login(page, 'rajesh.kumite@pratikkarate.com', 'coach123');
    await expect(page.locator('button:has-text("Attendance"), button:has-text("Batches")').first()).toBeVisible();
    await captureScreenshot(page, 'mod02_coach_view.png');
    await logout(page);
  });

  test('02.4 - Finance Manager login and fee ledger access', async ({ page }) => {
    await login(page, 'anita.finance@pratikkarate.com', 'staff123');
    await expect(page.locator('button:has-text("Fees"), button:has-text("Payroll")').first()).toBeVisible();
    await captureScreenshot(page, 'mod02_finance_manager_view.png');
    await logout(page);
  });

  test('02.5 - Front Desk login and inquiry/admission access', async ({ page }) => {
    await login(page, 'vikram.staff@pratikkarate.com', 'staff123');
    await expect(page.locator('button:has-text("Inquiries"), button:has-text("Students")').first()).toBeVisible();
    await captureScreenshot(page, 'mod02_front_desk_view.png');
    await logout(page);
  });

  test('02.6 - Student login and Student Self-Service Portal access', async ({ page }) => {
    await login(page, 'aarav.mehta@demostudent.iss', 'student123');
    await expect(page.locator('#student-portal-container, h2:has-text("Student Portal"), div:has-text("Attendance")').first()).toBeVisible();
    await captureScreenshot(page, 'mod02_student_portal_view.png');
    await logout(page);
  });

  test('02.7 - Rejection of invalid credentials with security toast', async ({ page }) => {
    await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', 'admin@pratikkarate.com');
    await page.fill('#login-password', 'completelyWrongPass999');
    await page.click('#btn-login-submit');

    const toast = page.locator('#toast-container, .toast, .alert').first();
    await expect(toast).toBeVisible({ timeout: 6000 });
    await expect(toast).toContainText(/Invalid|failed/i);
    await captureScreenshot(page, 'mod02_invalid_credentials_toast.png');
  });

  test('02.8 - Cross-Tenant Access Guard (HTTP 403 Forbidden)', async ({ request }) => {
    // Attempt cross-tenant API request with mismatched X-Academy-Id
    // Login as admin of Academy 1
    const authRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@pratikkarate.com', password: 'password123' }
    });
    const authData = await authRes.json();
    expect(authData.success).toBe(true);

    // Make request claiming access to Academy 9999
    const crossRes = await request.get(`${BASE_URL}/api/academy/dashboard`, {
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'X-Academy-Id': '9999'
      }
    });
    expect(crossRes.status()).toBe(403);
    const body = await crossRes.json();
    expect(body.error).toContain('Cross-tenant');
  });
});

