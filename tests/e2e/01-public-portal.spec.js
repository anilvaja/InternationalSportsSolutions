import { test, expect } from '@playwright/test';
import { BASE_URL, ROUTES } from './helpers/constants.js';

test.describe('Module 1: Public Landing Portal E2E Tests', () => {

  test('Should load public landing page with 200 OK and correct title', async ({ page }) => {
    const targetUrl = `${BASE_URL}${ROUTES.public}`;
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);

    const title = await page.title();
    expect(title).toContain('Sports Solutions');
    console.log(`[Public Portal] Landing Page Title verified: "${title}"`);
  });

  test('Should render core branding and layout elements', async ({ page }) => {
    const targetUrl = `${BASE_URL}${ROUTES.public}`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    const pageText = await page.content();
    expect(pageText).toContain('Sports Solutions Admin');
  });

  test('Should render portal login access links (Admin, Academy, Student)', async ({ page }) => {
    const targetUrl = `${BASE_URL}${ROUTES.public}`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    const adminLink = page.locator('a[href*="/admin"]');
    const academyLink = page.locator('a[href*="/academy"]');
    const studentLink = page.locator('a[href*="/student"]');

    await expect(adminLink.first()).toBeVisible();
    await expect(academyLink.first()).toBeVisible();
    await expect(studentLink.first()).toBeVisible();

    console.log(`[Public Portal] All portal navigation buttons verified.`);
  });

  test('Should be responsive across desktop and mobile viewports', async ({ page }) => {
    const targetUrl = `${BASE_URL}${ROUTES.public}`;
    
    // Desktop Viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });
});
