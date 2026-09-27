import { expect } from '@playwright/test';
import { BASE_URL, CREDENTIALS } from './constants.js';

/**
 * Robust helper to fill Filament / Laravel login forms
 */
export async function submitLoginForm(page, loginUrl, email, password) {
  const fullUrl = loginUrl.startsWith('http') ? loginUrl : `${BASE_URL}${loginUrl}`;
  await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
  
  const emailSelector = 'input[type="email"], input[name="email"], input[id*="email"]';
  const passSelector = 'input[type="password"], input[name="password"], input[id*="password"]';
  
  try {
    await page.waitForSelector(emailSelector, { timeout: 8000 });
    await page.fill(emailSelector, email);
    await page.fill(passSelector, password);
    
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(2000);
  } catch (e) {
    console.warn(`[Auth Helper] Notice filling login form at ${fullUrl}: ${e.message}`);
  }
}

export async function navigateAndEnsureAuth(page, path, credentials) {
  const targetUrl = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  // If redirected to login page, authenticate and retry navigation
  if (page.url().includes('/login')) {
    await submitLoginForm(page, credentials.loginUrl, credentials.email, credentials.password);
    if (page.url().includes('/login')) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    }
  }
}

export async function loginAsSuperAdmin(page) {
  const { loginUrl, email, password } = CREDENTIALS.superAdmin;
  await submitLoginForm(page, loginUrl, email, password);
}

export async function loginAsAcademyAdmin(page) {
  const { loginUrl, email, password } = CREDENTIALS.academyAdmin;
  await submitLoginForm(page, loginUrl, email, password);
}

export async function loginAsStudent(page) {
  const { loginUrl, email, password } = CREDENTIALS.student;
  await submitLoginForm(page, loginUrl, email, password);
}

export async function logout(page) {
  try {
    const userMenuBtn = page.locator('.fi-user-avatar, button[aria-label*="User"], button:has(.fi-avatar)').first();
    if (await userMenuBtn.isVisible()) {
      await userMenuBtn.click();
      const logoutBtn = page.locator('button:has-text("Sign out"), button:has-text("Log out"), a:has-text("Sign out"), a:has-text("Log out")').first();
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
      }
    }
  } catch (e) {
    // Ignore logout cleanup error
  }
}
