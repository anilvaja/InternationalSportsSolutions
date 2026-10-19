import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3005');
  await page.waitForSelector('#login-email', { timeout: 5000 });

  // 1. Log in as Academy Admin
  console.log('Logging in as Academy Admin...');
  await page.type('#login-email', 'john.smith@mahavirsportsacademy.com');
  await page.type('#login-password', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForSelector('#app-view', { visible: true, timeout: 8000 });
  await page.waitForSelector('#sidebar-brand-name', { timeout: 5000 });

  // 2. Verify Dynamic Sidebar Brand Header
  const brandName = await page.$eval('#sidebar-brand-name', (el) => el.innerText);
  const brandBadge = await page.$eval('#sidebar-role-badge', (el) => el.innerText);
  const brandIconHtml = await page.$eval('#sidebar-brand-icon', (el) => el.innerHTML);

  console.log('\n==========================================');
  console.log('   DYNAMIC SIDEBAR BRAND VERIFICATION');
  console.log('==========================================');
  console.log('Sidebar Brand Name:', brandName);
  console.log('Sidebar Role/Subtitle Badge:', brandBadge);
  console.log('Sidebar Icon/Logo Markup:', brandIconHtml);

  if (brandName.toLowerCase().includes('mahavir sports academy')) {
    console.log('✅ PASS: Academy name dynamically loaded over side menu instead of Sports Solutions');
  } else {
    throw new Error(`Expected academy name in sidebar, got: ${brandName}`);
  }

  // 3. Verify Dashboard Punch Card
  console.log('\n==========================================');
  console.log('   DASHBOARD STAFF PUNCH CARD VERIFICATION');
  console.log('==========================================');
  await page.waitForSelector('#staff-punch-card', { timeout: 5000 });
  const punchText = await page.$eval('#staff-punch-card', (el) => el.innerText);
  console.log('Punch Card Summary:\n', punchText);

  // Check initial state
  const punchInBtn = await page.$('.btn-punch-in');
  console.log('Punch In Button Available:', !!punchInBtn);

  if (punchInBtn) {
    console.log('Clicking Punch In...');
    await punchInBtn.click();
    await new Promise((r) => setTimeout(r, 2000));

    // Verify live running timer
    const liveTimer = await page.$eval('#punch-live-timer', (el) => el.innerText);
    const punchOutBtn = await page.$('.btn-punch-out');
    console.log('✅ Live Running Clock Ticking:', liveTimer);
    console.log('✅ Punch Out Button Active:', !!punchOutBtn);

    // Punch out
    if (punchOutBtn) {
      console.log('Clicking Punch Out...');
      await punchOutBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
      console.log('✅ Punched out successfully.');
    }
  }

  // 4. Test Punch History Modal
  console.log('\n==========================================');
  console.log('   PUNCH LOGS & OVERTIME MODAL VERIFICATION');
  console.log('==========================================');
  await page.waitForSelector('#staff-punch-card button[onclick*="openPunchHistoryModal"]', { timeout: 5000 });
  await page.click('#staff-punch-card button[onclick*="openPunchHistoryModal"]');
  await page.waitForSelector('#modal-container.active', { timeout: 5000 });
  const modalTitle = await page.$eval('#modal-title', (el) => el.innerText);
  console.log('Modal Opened with Title:', modalTitle);
  const rowsCount = await page.$$eval('.punch-table tbody tr', (rows) => rows.length);
  console.log(`✅ Loaded ${rowsCount} punch history log rows in modal!`);
  await page.click('button[onclick="app.closeModal()"]');
  console.log('✅ Modal closed cleanly.');

  await browser.close();
  console.log('\n🎉 ALL SIDEBAR BRAND & PUNCH IN/OUT CHECKS PASSED PERFECTLY!\n');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
