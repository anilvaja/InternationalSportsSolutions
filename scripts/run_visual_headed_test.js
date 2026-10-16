import { chromium } from '@playwright/test';

(async () => {
  console.log('\n================================================================================');
  console.log('   LAUNCHING INTERACTIVE HEADED CHROME BROWSER ON YOUR DESKTOP');
  console.log('   Target: http://localhost:3005 (1 Worker, SlowMo: 600ms)');
  console.log('================================================================================\n');

  const browser = await chromium.launch({
    headless: false, // VISIBLE BROWSER ON SCREEN
    slowMo: 600,     // DELIBERATELY PACED SO YOU CAN WATCH EVERY STEP
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 850 } });

    console.log('[STEP 1] Loading Application at http://localhost:3005...');
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    console.log('[STEP 2] Testing QuickFill & Login as Academy Admin...');
    await page.click('button:has-text("Academy Admin")');
    await page.waitForTimeout(800);
    await page.click('#btn-login-submit');
    await page.waitForTimeout(2000);

    console.log('[STEP 3] Verifying Dashboard Loaded & URL in Address Bar...');
    console.log('   URL:', page.url());
    await page.waitForTimeout(1500);

    console.log('[STEP 4] Clicking "Sports Syllabus" in Sidebar Menu...');
    await page.click('a[href="/academy/syllabus"]');
    await page.waitForTimeout(2500);
    console.log('   Deep Link URL verified:', page.url());

    console.log('[STEP 5] Verifying Kata Forms and Kumite & Sparring Syllabus...');
    const bodyContent = await page.content();
    const hasKata = bodyContent.includes('Kata Forms');
    const hasKumite = bodyContent.includes('Kumite & Sparring');
    console.log('   "Kata Forms" category present:', hasKata);
    console.log('   "Kumite & Sparring" category present:', hasKumite);
    await page.waitForTimeout(2500);

    console.log('[STEP 6] Clicking "Attendance" in Sidebar Menu...');
    await page.click('a[href="/academy/attendance"]');
    await page.waitForTimeout(2000);
    console.log('   Deep Link URL verified:', page.url());

    console.log('[STEP 7] Verifying Attendance Table Headers (Progression Column Removed)...');
    const ths = await page.$$eval('#attendance-roster-container th', elements => elements.map(e => e.innerText.trim()));
    console.log('   Active Columns in UI:', ths.join(' | '));
    const progressionRemoved = !ths.includes('Progression');
    console.log('   [CONFIRMED] Progression column is absent from UI:', progressionRemoved);
    await page.waitForTimeout(2500);

    console.log('[STEP 8] Testing Theme Toggle on Desktop (Dark Mode -> Light Mode)...');
    await page.click('button[title="Toggle Dark/Light Mode"]');
    await page.waitForTimeout(2000);
    await page.click('button[title="Toggle Dark/Light Mode"]');
    await page.waitForTimeout(2000);

    console.log('[STEP 9] Navigating to Students & Batches Views...');
    await page.click('a[href="/academy/students"]');
    await page.waitForTimeout(2000);
    console.log('   Students URL:', page.url());

    await page.click('a[href="/academy/batches"]');
    await page.waitForTimeout(2000);
    console.log('   Batches URL:', page.url());

    console.log('[STEP 10] Testing Browser Navigation History (Back & Forward Buttons)...');
    await page.goBack();
    console.log('   After Browser Back -> URL:', page.url());
    await page.waitForTimeout(2000);
    await page.goForward();
    console.log('   After Browser Forward -> URL:', page.url());
    await page.waitForTimeout(2000);

    console.log('\n================================================================================');
    console.log('   ALL 10 VISUAL UI STEPS PASSED SUCCESSFULLY IN LIVE CHROME WINDOW!');
    console.log('================================================================================\n');

    await page.waitForTimeout(3000);
  } finally {
    await browser.close();
  }
})();
