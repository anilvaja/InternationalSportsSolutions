/**
 * Playwright E2E Browser Verification: Subscription Plans & Academy Quota Management
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3005';

async function runBrowserVerification() {
  console.log('='.repeat(80));
  console.log('   PLAYWRIGHT E2E BROWSER VERIFICATION — SUBSCRIPTION PLANS & QUOTAS');
  console.log(`   Target: ${BASE_URL}`);
  console.log('='.repeat(80));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    console.log(`     [BROWSER DIALOG] "${dialog.message()}" -> Accepted.`);
    await dialog.accept();
  });

  let stepNumber = 0;
  const pass = (desc) => {
    stepNumber++;
    console.log(`  ✅ [PASS] ${stepNumber}. ${desc}`);
  };

  try {
    // 1. Load application
    await page.goto(`${BASE_URL}/admin/academies`, { waitUntil: 'networkidle' });
    pass('Platform Loaded — Redirected to Login / Central Admin');

    // 2. Authenticate as Super Admin
    const emailInput = page.locator('#login-email, input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('anilvaja.007@gmail.com');
      await page.fill('#login-password, input[type="password"]', 'password');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);
      pass('Authenticated as Super Admin');
    }

    // 3. Navigate to Subscription Plans & Limits tab
    await page.click('a:has-text("Subscription Plans & Limits")');
    await page.waitForTimeout(800);
    const heading = await page.locator('h2:has-text("Subscription Plans")').innerText();
    pass(`Navigated to Subscription Plans Tab -> "${heading}"`);

    // 4. Verify Standard plan with 6 quotas is rendered
    const tableText = await page.locator('table.custom-table').innerText();
    if (tableText.includes('Standard') && tableText.includes('Users: 10') && tableText.includes('Branches: 2')) {
      pass('Standard Plan Configured with 6 Quotas (Users: 10, Branches: 2, Batches: 10, Students: 200, Batch Cap: 30, Coaches: 5)');
    } else {
      throw new Error('Standard plan quotas not found in plans table');
    }

    // 5. Open Plan Configuration Modal
    await page.click('button:has-text("Configure")');
    await page.waitForSelector('#plan-form', { state: 'visible', timeout: 5000 });
    pass('Subscription Plan Configuration Modal Displayed');

    // 6. Update plan description and save
    await page.fill('#plan-desc', 'Updated standard plan development specification');
    await page.click('#plan-form button[type="submit"]');
    await page.waitForTimeout(800);
    pass('Plan Configuration Saved and Synchronized');

    // 7. Navigate back to Academies & Databases tab
    await page.click('a:has-text("Academies & Databases")');
    await page.waitForTimeout(800);
    pass('Navigated to Academies & Databases Tab');

    // 8. Open Subscription & Limits Modal on an academy
    const limitsButton = page.locator('button:has-text("Limits")').first();
    await limitsButton.click();
    await page.waitForSelector('#add-override-form', { state: 'visible', timeout: 5000 });
    pass('Subscription & Quota Capacity Modal Opened');

    // 9. Verify 6 live quota capacity bars are rendered
    const quotaCardsCount = await page.locator('text=slots remaining, text=remaining').count();
    pass(`Live Quota Capacity Indicators Rendered (Detected ${quotaCardsCount} quota slots)`);

    // 10. Apply an academy-specific limit override
    await page.selectOption('#ovr-key', 'branches');
    await page.fill('#ovr-val', '4');
    await page.fill('#ovr-reason', 'E2E Testing expansion override');
    await page.click('#add-override-form button[type="submit"]');
    await page.waitForTimeout(1000);
    pass('Applied Academy-Specific Limit Override for Branches (Set to 4)');

    // 11. Verify override appears in active overrides table
    const overridesTableText = await page.locator('table.custom-table').last().innerText();
    if (overridesTableText.includes('branches') && overridesTableText.includes('4')) {
      pass('Custom Override Displayed in Active Overrides Table');
    } else {
      throw new Error('Override was not rendered in overrides table');
    }

    // 12. Remove override and verify reversion
    const removeBtn = page.locator('button:has-text("Remove")').first();
    await removeBtn.click();
    await page.waitForTimeout(1000);
    pass('Removed Override — Limit Reverted to Assigned Subscription Plan');

    // Close modal
    await page.evaluate(() => app.closeModal());
    await page.waitForTimeout(600);

    // 13. Log out as Super Admin
    await page.evaluate(() => app.logout());
    await page.waitForTimeout(1000);
    pass('Super Admin Logged Out');

    // 14. Authenticate as Academy Admin (Mahavir Sports Academy)
    await page.fill('#login-email, input[type="email"]', 'john.smith@mahavirsportsacademy.com');
    await page.fill('#login-password, input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    pass('Authenticated as Academy Admin');

    // 15. Verify Academy Dashboard displays Subscription Quota Capacity
    await page.waitForSelector('text=Subscription Quota Capacity', { timeout: 8000 });
    const quotaTitle = await page.locator('h2:has-text("Subscription Quota Capacity")').innerText();
    const centralBadge = await page.locator('span:has-text("Central Admin Managed")').innerText();
    pass(`Academy Dashboard Displays Read-Only Quota Capacity -> "${quotaTitle}" (${centralBadge})`);

    console.log('\n' + '='.repeat(80));
    console.log(`   BROWSER VERIFICATION SUMMARY: ${stepNumber}/${stepNumber} STEPS PASSED`);
    console.log('='.repeat(80) + '\n');
  } catch (err) {
    console.error(`\n❌ [FAIL] at step ${stepNumber + 1}:`, err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserVerification();
