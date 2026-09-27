import { test, expect } from '@playwright/test';
import { BASE_URL, CREDENTIALS, ROUTES } from './helpers/constants.js';
import { loginAsStudent, navigateAndEnsureAuth } from './helpers/auth.js';
import { testResourceCrudLifecycle } from './helpers/crud-runner.js';

test.describe('Module 4: Student Portal Complete Pages Suite', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test('Student Portal Login Page Interface', async ({ page }) => {
    await page.goto(`${BASE_URL}${ROUTES.student.login}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    const emailInput = page.locator('input[type="email"], input[name="email"], input[id*="email"]').first();
    const passInput = page.locator('input[type="password"], input[name="password"], input[id*="password"]').first();

    await expect(emailInput).toBeVisible();
    await expect(passInput).toBeVisible();
  });

  const studentPages = [
    { name: 'Dashboard', path: '/student' },
    { name: 'Attendance View', path: '/student/attendance' },
    { name: 'Events View', path: '/student/events' },
    { name: 'Fees & Payment History', path: '/student/fees' },
    { name: 'Notifications', path: '/student/notifications' },
    { name: 'Student Profile', path: '/student/profile' },
    { name: 'Syllabus & Training Plan', path: '/student/syllabus' },
  ];

  for (const p of studentPages) {
    test(`Student Portal - ${p.name} UI Page View`, async ({ page }) => {
      const results = await testResourceCrudLifecycle(page, {
        module: 'Student Portal',
        resourceName: p.name,
        basePath: p.path,
        hasCreate: false,
        hasEdit: false,
        hasDelete: false,
      });

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.error(`❌ [Student Portal - ${p.name}] Failures:`, failures);
      }
      expect(failures.length, `Failures on ${p.name}: ${JSON.stringify(failures)}`).toBe(0);
    });
  }
});
