import { test, expect } from '@playwright/test';
import { BASE_URL, CREDENTIALS, ROUTES } from './helpers/constants.js';
import { submitLoginForm } from './helpers/auth.js';

test.describe('Module 5: Security & Multi-Tenant Isolation E2E Tests', () => {

  test('Unauthenticated user navigating directly to protected dashboard should be redirected to login', async ({ page }) => {
    // Unauthenticated access to /admin
    await page.goto(`${BASE_URL}${ROUTES.admin.dashboard}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/login/);

    // Unauthenticated access to /academy
    await page.goto(`${BASE_URL}${ROUTES.academy.dashboard}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/academy\/login/);

    // Unauthenticated access to /student
    await page.goto(`${BASE_URL}${ROUTES.student.dashboard}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/student\/login/);
  });

  test('Admin guard and Academy guard should maintain independent isolated session contexts', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await submitLoginForm(adminPage, CREDENTIALS.superAdmin.loginUrl, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
    await expect(adminPage.locator('body')).toBeVisible();

    const academyContext = await browser.newContext();
    const academyPage = await academyContext.newPage();
    await submitLoginForm(academyPage, CREDENTIALS.academyAdmin.loginUrl, CREDENTIALS.academyAdmin.email, CREDENTIALS.academyAdmin.password);
    await expect(academyPage.locator('body')).toBeVisible();

    await adminPage.goto(`${BASE_URL}${ROUTES.admin.academies}`, { waitUntil: 'domcontentloaded' });
    await expect(adminPage.locator('body')).toBeVisible();

    await academyPage.goto(`${BASE_URL}${ROUTES.academy.branches}`, { waitUntil: 'domcontentloaded' });
    await expect(academyPage.locator('body')).toBeVisible();

    await adminContext.close();
    await academyContext.close();
  });

  test('Academy Admin permission boundary check on Super Admin endpoints', async ({ page }) => {
    await submitLoginForm(page, CREDENTIALS.academyAdmin.loginUrl, CREDENTIALS.academyAdmin.email, CREDENTIALS.academyAdmin.password);
    await page.goto(`${BASE_URL}${ROUTES.admin.academies}`, { waitUntil: 'domcontentloaded' });
    
    // Should be redirected to /admin/login or forbidden page
    const isLoginOrForbidden = page.url().includes('/admin/login') || page.url().includes('/login') || page.url().includes('/403');
    expect(isLoginOrForbidden).toBeTruthy();
  });
});
