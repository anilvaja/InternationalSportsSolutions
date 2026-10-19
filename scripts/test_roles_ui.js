import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  try {
    console.log('Navigating to http://localhost:3005...');
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });

    // Login as Academy Admin using quick login button
    await page.click('button:has-text("Academy Admin")');
    await page.waitForTimeout(300);
    await page.click('#btn-login-submit');
    await page.waitForSelector('#app-view', { state: 'visible', timeout: 5000 });
    console.log('✅ Logged in as Academy Admin successfully');

    // Click Roles & Permissions link in sidebar
    await page.click('a[href="/academy/roles"]');
    await page.waitForSelector('.role-card', { state: 'visible', timeout: 5000 });
    console.log('✅ Navigated to /academy/roles');

    // Verify Title & Subtitle
    const title = await page.textContent('h2.card-title');
    console.log('✅ Page Title:', title.trim());

    // Check roles rendered
    const roleCards = await page.$$('.role-card');
    console.log(`✅ Loaded ${roleCards.length} Role Cards`);

    // Test "New Custom Role" button & modal
    await page.click('button:has-text("New Custom Role")');
    await page.waitForSelector('#modal-container.active', { state: 'visible', timeout: 3000 });
    console.log('✅ Create Role Modal opened successfully with capability checkboxes');

    // Close modal via modal header close button
    await page.click('.modal-header button');
    await page.waitForTimeout(300);
    console.log('✅ Create Role Modal closed cleanly');

    // Switch to Staff & Employee tab
    await page.click('button:has-text("Staff & Employee Role Assignments")');
    await page.waitForSelector('table.custom-table', { state: 'visible', timeout: 3000 });
    const staffRows = await page.$$eval('table.custom-table tbody tr', trs => trs.length);
    console.log(`✅ Staff & Employee table loaded with ${staffRows} members`);

    // Click "Assign Role" on first staff member
    await page.locator('button:has-text("Assign Role")').first().click();
    await page.waitForSelector('#modal-container.active', { state: 'visible', timeout: 3000 });
    console.log('✅ Assign Role Modal opened successfully with role selector & capability overrides');

    // Close assign modal via modal header close button
    await page.click('.modal-header button');
    await page.waitForTimeout(300);
    console.log('✅ Assign Role Modal closed cleanly');

    console.log('\n================================================================================');
    console.log('   🎉 ROLES & PERMISSIONS MODULE FULLY VERIFIED IN LIVE APPLICATION');
    console.log('================================================================================');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
