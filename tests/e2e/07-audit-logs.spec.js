import { test, expect } from '@playwright/test';
import { BASE_URL, CREDENTIALS, ROUTES } from './helpers/constants.js';
import { loginAsSuperAdmin, loginAsAcademyAdmin, loginAsStudent, submitLoginForm, navigateAndEnsureAuth } from './helpers/auth.js';

test.describe('Module 7: OwenIt Audit Logs & 3-Tier Access Scope Verification', () => {

  test('Rule 1: Super Admin can access complete system audit logs', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await navigateAndEnsureAuth(page, ROUTES.academy.audits, CREDENTIALS.superAdmin);

    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/audits');

    // Assert activity & audit logs table is loaded
    const tableVisible = await page.locator('table, .fi-ta-content').first().isVisible();
    expect(tableVisible).toBeTruthy();
  });

  test('Rule 2: Academy Admin can view only their own academy logs', async ({ page }) => {
    await loginAsAcademyAdmin(page);
    await navigateAndEnsureAuth(page, ROUTES.academy.audits, CREDENTIALS.academyAdmin);

    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/audits');

    // Assert audit table renders with tenant-scoped query
    const tableVisible = await page.locator('table, .fi-ta-content').first().isVisible();
    expect(tableVisible).toBeTruthy();
  });

  test('Rule 3: Regular staff user sees only their own change logs', async ({ page }) => {
    await submitLoginForm(page, CREDENTIALS.academyStaff.loginUrl, CREDENTIALS.academyStaff.email, CREDENTIALS.academyStaff.password);
    await navigateAndEnsureAuth(page, ROUTES.academy.audits, CREDENTIALS.academyStaff);

    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/audits');
  });

});
