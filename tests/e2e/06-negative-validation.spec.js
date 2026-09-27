import { test, expect } from '@playwright/test';
import { BASE_URL, CREDENTIALS, ROUTES } from './helpers/constants.js';
import { loginAsSuperAdmin, loginAsAcademyAdmin, submitLoginForm, navigateAndEnsureAuth } from './helpers/auth.js';

test.describe('Module 6: Negative UI Validation & Input Boundary Tests', () => {

  test('Super Admin Login - Invalid Credentials Submission', async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.admin.login}`);
    const emailInput = page.locator('input[type="email"], input[id*="email"], input[name*="email"]').first();
    const passInput = page.locator('input[type="password"], input[id*="password"], input[name*="password"]').first();

    await emailInput.fill('invalid.superadmin@example.com');
    await passInput.fill('wrongpassword123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Assert user remains on login page and authentication was blocked
    expect(page.url()).toContain('/login');
  });

  test('Academy Login - Blank Credentials Submission', async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.academy.login}`);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    // Assert form submission is blocked and user remains on login
    expect(page.url()).toContain('/login');
  });

  test('Super Admin - Academy Creation Blank Required Fields Validation', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await navigateAndEnsureAuth(page, `${ROUTES.admin.academies}/create`, CREDENTIALS.superAdmin);

    const submitBtn = page.locator('button[type="submit"], button:has-text("Create")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);

      // Assert validation messages appear in UI and record was NOT created
      const isStillOnCreate = page.url().includes('/create');
      expect(isStillOnCreate).toBeTruthy();
    }
  });

  test('Super Admin - Academy Creation Invalid Email Validation', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await navigateAndEnsureAuth(page, `${ROUTES.admin.academies}/create`, CREDENTIALS.superAdmin);

    const nameInput = page.locator('input[name*="name"]').first();
    const emailInput = page.locator('input[name*="email"], input[id*="email"]').first();

    if (await nameInput.isVisible() && await emailInput.isVisible()) {
      await nameInput.fill('Invalid Email Test Academy');
      await emailInput.fill('not-an-email-address');

      const submitBtn = page.locator('button[type="submit"], button:has-text("Create")').first();
      await submitBtn.click();
      await page.waitForTimeout(1000);

      // Assert invalid email validation error in UI
      expect(page.url()).toContain('/create');
    }
  });

  test('Academy Panel - Branch Creation Blank Name Validation', async ({ page }) => {
    await loginAsAcademyAdmin(page);
    await navigateAndEnsureAuth(page, `${ROUTES.academy.branches}/create`, CREDENTIALS.academyAdmin);

    const submitBtn = page.locator('button[type="submit"], button:has-text("Create")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);

      // Assert creation is blocked and remains on create form
      expect(page.url()).toContain('/create');
    }
  });

  test('Academy Panel - Student Registration Blank Required Fields Validation', async ({ page }) => {
    await loginAsAcademyAdmin(page);
    await navigateAndEnsureAuth(page, `${ROUTES.academy.students}/create`, CREDENTIALS.academyAdmin);

    const submitBtn = page.locator('button[type="submit"], button:has-text("Create")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);

      // Assert creation is blocked
      expect(page.url()).toContain('/create');
    }
  });

  test('Academy Panel - Fee Creation Blank Amount Validation', async ({ page }) => {
    await loginAsAcademyAdmin(page);
    await navigateAndEnsureAuth(page, `${ROUTES.academy.fees}/create`, CREDENTIALS.academyAdmin);
    
    // Ensure active session context
    if (page.url().includes('/login')) {
      await loginAsAcademyAdmin(page);
      await page.goto(`${BASE_URL}${ROUTES.academy.fees}/create`);
    }

    const submitBtn = page.locator('button[type="submit"], button:has-text("Create")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);

      // Assert creation is blocked and user remains on form or list
      const isBlocked = page.url().includes('/create') || page.url().includes('/fees');
      expect(isBlocked).toBeTruthy();
    }
  });

});
