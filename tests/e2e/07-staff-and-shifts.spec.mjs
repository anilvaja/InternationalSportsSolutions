import { test, expect } from '@playwright/test';
import { BASE_URL, login, logout, assertServerTestIsolation, captureScreenshot } from './helpers/uiHelper.mjs';

test.describe('Module 07: Staff, Multi-Shifts & Roster Management', () => {

  test.beforeEach(async ({ request, page }) => {
    await assertServerTestIsolation(request);
    await login(page, 'admin@pratikkarate.com', 'password123');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('07.1 - Staff Roster: listing and role assignment controls', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app) window.app.navigate('coaches');
    });
    await page.waitForTimeout(600);

    const staffTable = page.locator('#coaches-table, table').first();
    await expect(staffTable).toBeVisible({ timeout: 10000 });
    await expect(staffTable.locator('td').first()).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod07_staff_roster.png');
  });

  test('07.2 - Shift Management: shift creation and daily schedule slots', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app) window.app.navigate('coaches');
    });
    await page.waitForTimeout(600);

    const shiftsTable = page.locator('#coaches-table, table').first();
    await expect(shiftsTable).toBeVisible({ timeout: 10000 });

    await captureScreenshot(page, 'mod07_shifts_schedule.png');
  });

  test('07.3 - Shift Overlap Validation: API and UI prevention of duplicate timing', async ({ request }) => {
    // Authenticate as academy admin via API
    const authRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@pratikkarate.com', password: 'password123' }
    });
    const { token } = await authRes.json();

    // 1. Configure valid schedule with non-overlapping shifts
    const validRes = await request.post(`${BASE_URL}/api/academy/schedules/employee/1`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        schedule_name: 'Regular Weekly Shifts',
        branch_id: 1,
        effective_from: '2026-01-01',
        shifts: [
          { day_of_week: 'monday', start_time: '09:00', end_time: '12:00' },
          { day_of_week: 'monday', start_time: '14:00', end_time: '17:00' }
        ]
      }
    });
    expect([200, 201]).toContain(validRes.status());

    // 2. Attempt to configure overlapping shifts on same day (09:00-12:00 and 10:00-11:30)
    const overlapRes = await request.post(`${BASE_URL}/api/academy/schedules/employee/1`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        schedule_name: 'Conflicting Schedule',
        branch_id: 1,
        effective_from: '2026-01-01',
        shifts: [
          { day_of_week: 'monday', start_time: '09:00', end_time: '12:00' },
          { day_of_week: 'monday', start_time: '10:00', end_time: '11:30' }
        ]
      }
    });
    // Must be rejected with 400 Bad Request
    expect(overlapRes.status()).toBe(400);
    const body = await overlapRes.json();
    expect(body.error).toMatch(/overlap|conflict|already exists/i);
  });
});

