import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
const SCREENSHOT_DIR = path.resolve('policy_settings_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function loginAsAdmin(page) {
  await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
  });
  await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', 'admin@pratikkarate.com');
  await page.fill('#login-password', 'password123');
  await page.click('#btn-login-submit');
  await page.waitForSelector('#app-view', { state: 'visible', timeout: 12000 });
  await page.waitForTimeout(600);
}

test.describe('Academy Policy Settings Comprehensive Audit', () => {

  test('01. UI Rendering: Load Policy Settings page and verify all 5 sections & controls', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to Policy Settings tab
    await page.evaluate(() => {
      if (window.app && typeof window.app.navigate === 'function') {
        window.app.navigate('policy-settings');
      }
    });
    await page.waitForTimeout(800);

    // Verify page container
    const container = page.locator('.policy-settings-container');
    await expect(container).toBeVisible({ timeout: 10000 });

    // Section 1: Attendance Window
    await expect(page.locator('text=Attendance Window & Session Recording Rules')).toBeVisible();
    await expect(page.locator('#setting-cutoff')).toBeVisible();
    await expect(page.locator('#setting-cutoff-slider')).toBeVisible();
    await expect(page.locator('.policy-toggle-switch:has(#setting-future-attendance)')).toBeVisible();

    // Section 2: Overtime Tracking
    await expect(page.locator('text=Overtime Tracking & Approval Thresholds')).toBeVisible();
    await expect(page.locator('#setting-ot-thresh')).toBeVisible();
    await expect(page.locator('input[name="ot_mode_radio"]').first()).toBeVisible();

    // Section 3: Payroll Timeline
    await expect(page.locator('text=Staff Payroll Timeline & Statement Visibility')).toBeVisible();
    await expect(page.locator('#setting-vis-day')).toBeVisible();
    await expect(page.locator('#setting-payday')).toBeVisible();

    // Section 3.5: Salary Calculation Settings
    await expect(page.locator('text=Monthly Salary Calculation Settings')).toBeVisible();
    await expect(page.locator('input[name="salary_divisor_radio"]').first()).toBeVisible();
    await expect(page.locator('input[name="paid_leave_radio"]').first()).toBeVisible();
    await expect(page.locator('input[name="short_attendance_radio"]').first()).toBeVisible();

    // Section 4: Timezone & Localization
    await expect(page.locator('text=Regional Operating Timezone & Localization')).toBeVisible();
    await expect(page.locator('#setting-timezone-select')).toBeVisible();
    await expect(page.locator('#live-tz-clock')).toBeVisible();

    // Section 5: Brand Identity & Default Color Theme
    await expect(page.locator('text=Academy Brand Identity & Default Color Theme')).toBeVisible();
    await expect(page.locator('.theme-swatch-grid')).toBeVisible();

    // Form Action Buttons
    await expect(page.locator('#btn-save-policy')).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_initial_page_render.png'), fullPage: true });
  });

  test('02. Live Previews: Sliders, presets, and radio choices dynamically update preview elements', async ({ page }) => {
    await loginAsAdmin(page);
    await page.evaluate(() => window.app.navigate('policy-settings'));
    await page.waitForTimeout(600);

    // Test Quick Preset Cutoff (5 Days)
    const preset5 = page.locator('button.policy-preset-pill:has-text("Flexible (5 Days)")').first();
    await preset5.click();
    await page.waitForTimeout(200);
    expect(await page.inputValue('#setting-cutoff')).toBe('5');
    await expect(page.locator('#cutoff-badge-display')).toHaveText('5 Calendar Day(s)');

    // Test Overtime Threshold Preset (45 Mins)
    const otPreset45 = page.locator('button.policy-preset-pill:has-text("45 Mins")').first();
    await otPreset45.click();
    await page.waitForTimeout(200);
    expect(await page.inputValue('#setting-ot-thresh')).toBe('45');
    await expect(page.locator('#preview-ot-text')).toContainText('45 mins approval');

    // Test Future Attendance toggle
    const futureToggleLabel = page.locator('.policy-toggle-switch:has(#setting-future-attendance)');
    await futureToggleLabel.click();
    await page.waitForTimeout(200);
    await expect(page.locator('#future-attendance-status-box')).toContainText('Forward-dating enabled');

    // Test Statement Visibility Day
    await page.fill('#setting-vis-day', '28');
    await page.waitForTimeout(200);
    await expect(page.locator('#preview-vis-text')).toHaveText('28th of Month');

    // Test Expected Payday
    await page.fill('#setting-payday', '5');
    await page.waitForTimeout(200);
    await expect(page.locator('#preview-pay-text')).toHaveText('5th of Month');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_live_preview_updates.png'), fullPage: false });
  });

  test('03. Save & Persistence: Form submission saves values, shows toast, and persists across reload', async ({ page }) => {
    await loginAsAdmin(page);
    await page.evaluate(() => window.app.navigate('policy-settings'));
    await page.waitForTimeout(600);

    // Set specific values
    await page.fill('#setting-cutoff', '4');
    await page.fill('#setting-ot-thresh', '45');
    await page.fill('#setting-vis-day', '27');
    await page.fill('#setting-payday', '3');
    
    // Choose Overtime Mode: Overtime Premium (1.5x)
    await page.locator('.policy-choice-card:has-text("Overtime Premium (1.5x)")').click();
    
    // Choose Timezone: Asia/Dubai
    await page.selectOption('#setting-timezone-select', 'Asia/Dubai');

    // Choose Theme: Emerald
    await page.locator('#policy-swatch-emerald').click();

    // Click Save
    await page.click('#btn-save-policy');

    // Verify Toast
    const toast = page.locator('#toast-container .toast, .toast').first();
    await expect(toast).toBeVisible({ timeout: 6000 });
    await expect(toast).toContainText(/updated and enforced successfully|updated successfully/i);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_saved_success_toast.png'), fullPage: false });

    // Hard Reload page & check persisted values
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-view', { state: 'visible', timeout: 12000 });
    await page.evaluate(() => window.app.navigate('policy-settings'));
    await page.waitForTimeout(800);

    expect(await page.inputValue('#setting-cutoff')).toBe('4');
    expect(await page.inputValue('#setting-ot-thresh')).toBe('45');
    expect(await page.inputValue('#setting-vis-day')).toBe('27');
    expect(await page.inputValue('#setting-payday')).toBe('3');
    expect(await page.inputValue('#setting-timezone-select')).toBe('Asia/Dubai');
    expect(await page.inputValue('#setting-default-theme')).toBe('emerald');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_persisted_values_after_reload.png'), fullPage: true });
  });

  test('04. Input Validation: Backend independently rejects invalid values with HTTP 400', async ({ request }) => {
    // Authenticate API
    const authRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@pratikkarate.com', password: 'password123' }
    });
    const { token } = await authRes.json();

    // Test negative cutoff
    const resCutoff = await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { attendance_cutoff_days: -5 }
    });
    expect(resCutoff.status()).toBe(400);
    const bodyCutoff = await resCutoff.json();
    expect(bodyCutoff.error).toContain('attendance_cutoff_days');

    // Test invalid overtime threshold (> 240)
    const resOt = await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { overtime_threshold_minutes: 500 }
    });
    expect(resOt.status()).toBe(400);

    // Test invalid payday (> 31)
    const resPay = await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { expected_payday: 35 }
    });
    expect(resPay.status()).toBe(400);

    // Test invalid timezone string
    const resTz = await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { timezone: 'Mars/Colony_Zone' }
    });
    expect(resTz.status()).toBe(400);
    const bodyTz = await resTz.json();
    expect(bodyTz.error).toContain('timezone');
  });

  test('05. Business Impact: attendance_cutoff_days and allow_future_attendance enforce actual attendance check', async ({ request }) => {
    // 1. Admin logs in and configures policy: cutoff = 1, future attendance = 0
    const authRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@pratikkarate.com', password: 'password123' }
    });
    const { token: adminToken } = await authRes.json();

    await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { attendance_cutoff_days: 1, allow_future_attendance: 0 }
    });

    // 2. Coach Rajesh logs in (assigned to Batch 10004)
    const coachRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'rajesh.kumite@pratikkarate.com', password: 'coach123' }
    });
    const { token: coachToken } = await coachRes.json();

    // 3. Attempt coach attendance for 3 days ago (exceeding cutoff 1)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const pastDateStr = threeDaysAgo.toISOString().split('T')[0];

    const attPastRes = await request.post(`${BASE_URL}/api/academy/attendance`, {
      headers: { 'Authorization': `Bearer ${coachToken}` },
      data: {
        batch_id: 10004,
        date: pastDateStr,
        entries: [{ student_id: 1, status: 'present' }]
      }
    });
    // Expected rejection: past cutoff exceeded (HTTP 403 for coach without approved correction)
    expect([400, 403]).toContain(attPastRes.status());
    const pastJson = await attPastRes.json();
    expect(pastJson.error || pastJson.message).toMatch(/cutoff|previous 1 calendar days|correction request/i);

    // 4. Attempt attendance for tomorrow with future attendance disabled (0)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const attFutRes = await request.post(`${BASE_URL}/api/academy/attendance`, {
      headers: { 'Authorization': `Bearer ${coachToken}` },
      data: {
        batch_id: 10004,
        date: tomorrowStr,
        entries: [{ student_id: 1, status: 'present' }]
      }
    });
    // Expected rejection: future attendance prohibited (HTTP 400)
    expect([400, 422]).toContain(attFutRes.status());
    const futJson = await attFutRes.json();
    expect(futJson.error || futJson.message).toMatch(/Future attendance is prohibited/i);

    // 5. Now update policy to allow future attendance (1)
    await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { allow_future_attendance: 1 }
    });

    // Attempt future attendance again -> should now pass validation
    const attFutAllowedRes = await request.post(`${BASE_URL}/api/academy/attendance`, {
      headers: { 'Authorization': `Bearer ${coachToken}` },
      data: {
        batch_id: 10004,
        date: tomorrowStr,
        entries: [{ student_id: 1, status: 'present' }]
      }
    });
    expect([200, 201]).toContain(attFutAllowedRes.status());

    // Clean up: reset to defaults
    await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { reset_to_defaults: true }
    });
  });

  test('06. RBAC Enforcement: Non-admin roles cannot view or update policy settings', async ({ request }) => {
    const coachRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'rajesh.kumite@pratikkarate.com', password: 'coach123' }
    });
    const { token: coachToken } = await coachRes.json();

    // Coach GET -> 403 Forbidden
    const coachGet = await request.get(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${coachToken}` }
    });
    expect(coachGet.status()).toBe(403);

    // Coach PUT -> 403 Forbidden
    const coachPut = await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${coachToken}` },
      data: { attendance_cutoff_days: 7 }
    });
    expect(coachPut.status()).toBe(403);
  });

  test('07. Multi-Tenant Isolation: Academy 1 policy mutations cannot affect Academy 2', async ({ request }) => {
    // Login as Admin of Academy 1
    const a1Res = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@pratikkarate.com', password: 'password123' }
    });
    const { token: a1Token } = await a1Res.json();

    // Set Academy 1 cutoff to 7
    await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${a1Token}` },
      data: { attendance_cutoff_days: 7 }
    });

    // Check Academy 1 policy
    const a1PolicyRes = await request.get(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${a1Token}` }
    });
    const a1Policy = (await a1PolicyRes.json()).policy;
    expect(a1Policy.attendance_cutoff_days).toBe(7);

    // Attempt cross-tenant mutation on Academy 2 using Academy 1's token
    const crossRes = await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: {
        'Authorization': `Bearer ${a1Token}`,
        'X-Academy-Id': '2'
      },
      data: { attendance_cutoff_days: 10 }
    });
    // Expected: 403 Cross-tenant forbidden
    expect(crossRes.status()).toBe(403);
  });

  test('08. Audit Trail & Reset: Audit log records previous/updated state and reset restores defaults', async ({ page, request }) => {
    const authRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@pratikkarate.com', password: 'password123' }
    });
    const { token } = await authRes.json();

    // Reset policies to recommended defaults
    const resetRes = await request.put(`${BASE_URL}/api/academy/settings/policy`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { reset_to_defaults: true }
    });
    expect(resetRes.status()).toBe(200);
    const resetData = await resetRes.json();
    expect(resetData.policy.attendance_cutoff_days).toBe(2);
    expect(resetData.policy.overtime_threshold_minutes).toBe(30);
    expect(resetData.policy.timezone).toBe('Asia/Kolkata');

    // Verify in UI
    await loginAsAdmin(page);
    await page.evaluate(() => window.app.navigate('policy-settings'));
    await page.waitForTimeout(600);

    expect(await page.inputValue('#setting-cutoff')).toBe('2');
    expect(await page.inputValue('#setting-ot-thresh')).toBe('30');
    expect(await page.inputValue('#setting-vis-day')).toBe('25');
    expect(await page.inputValue('#setting-payday')).toBe('1');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_restored_defaults.png'), fullPage: true });
  });

  test('09. Mobile & Responsive Layout: Verify policy settings form on mobile viewport (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);
    await page.evaluate(() => window.app.navigate('policy-settings'));
    await page.waitForTimeout(600);

    const container = page.locator('.policy-settings-container');
    await expect(container).toBeVisible({ timeout: 10000 });

    // Verify sections and save button are accessible on mobile
    await expect(page.locator('#setting-cutoff')).toBeVisible();
    await expect(page.locator('#btn-save-policy')).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_mobile_viewport_390x844.png'), fullPage: true });
  });

});

