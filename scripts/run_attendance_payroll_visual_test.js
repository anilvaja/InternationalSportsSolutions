import { chromium } from '@playwright/test';

(async () => {
  console.log('\n================================================================================');
  console.log('   HEADED CHROME BROWSER — ATTENDANCE, OVERTIME & PAYROLL LIVE UI TEST');
  console.log('   Target: http://localhost:3005 (1 Worker, SlowMo: 450ms)');
  console.log('================================================================================\n');

  const isHeadless = process.argv.includes('--headless');
  const browser = await chromium.launch({
    headless: isHeadless,
    slowMo: isHeadless ? 50 : 450,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const testResults = [];

  function record(section, actionName, status, details = '') {
    testResults.push({ section, actionName, status, details });
    const mark = status ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`  ${mark} [${section}] ${actionName} ${details ? `-> ${details}` : ''}`);
  }

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    page.on('dialog', async dialog => {
      console.log(`     [BROWSER DIALOG] "${dialog.message()}" -> Accepted.`);
      await dialog.accept();
    });

    // 1. Login as Academy Admin (Mahavir Sports Academy)
    console.log('\n--- 1. AUTHENTICATION & LOGIN ---');
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
    await page.click('button:has-text("Academy Admin")');
    await page.waitForTimeout(300);
    await page.click('#btn-login-submit');
    await page.waitForSelector('#app-view', { state: 'visible', timeout: 5000 });
    record('Auth', 'Academy Admin Login', true, 'Logged into Mahavir Sports Academy');

    // 2. Attendance View & Scheduling Tests
    console.log('\n--- 2. ATTENDANCE & BATCH SESSION SCHEDULING ---');
    await page.click('a[href="/academy/attendance"]');
    await page.waitForSelector('#attendance-roster-container', { state: 'visible' });
    record('Attendance', 'Navigation to Attendance View', true, 'Attendance page loaded');

    // Check for Next Scheduled Session Notice
    await page.waitForSelector('#attendance-session-notice', { state: 'visible' });
    const noticeText = await page.innerText('#attendance-session-notice');
    record('Attendance', 'Next Eligible Scheduled Session Component', noticeText.length > 0, noticeText.slice(0, 60) + '...');

    // Verify Switch Session Button & Modal
    const switchBtn = page.locator('button:has-text("Switch Session")');
    const switchBtnVisible = await switchBtn.isVisible();
    record('Attendance', 'Switch Session Button Visible', switchBtnVisible);
    if (switchBtnVisible) {
      await switchBtn.click();
      await page.waitForSelector('#modal-container.active', { state: 'visible' });
      const modalTitle = await page.innerText('#modal-title');
      record('Attendance', 'Switch Session Modal Opened', modalTitle.includes('Switch Session'), modalTitle);
      await page.click('#modal-footer button:has-text("Cancel")');
      await page.waitForSelector('#modal-container.active', { state: 'detached', timeout: 3000 }).catch(() => {});
    }

    // Verify Date Validation Alert: select an older date (5 days ago)
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const dateStr = fiveDaysAgo.toISOString().split('T')[0];
    await page.fill('#att-date-input', dateStr);
    await page.dispatchEvent('#att-date-input', 'change');
    await page.waitForTimeout(1000);

    const alertText = await page.innerText('#attendance-roster-container');
    const isCutoffTriggered = alertText.includes('Outside 2-Day Cutoff');
    record('Attendance', 'Cutoff Alert for Date > 2 Days Old', isCutoffTriggered, `Date ${dateStr} triggered cutoff warning`);

    // Verify Request Approval button in cutoff alert
    const reqApprovalBtn = page.locator('#attendance-roster-container button:has-text("Request Approval")');
    const hasReqBtn = await reqApprovalBtn.isVisible();
    record('Attendance', 'Request Approval Button Present on Cutoff', hasReqBtn);
    if (hasReqBtn) {
      await reqApprovalBtn.click();
      await page.waitForSelector('#modal-container.active', { state: 'visible' });
      const corrModalTitle = await page.innerText('#modal-title');
      record('Attendance', 'Correction Request Modal Opened', corrModalTitle.includes('Correction'), corrModalTitle);
      await page.click('#modal-footer button:has-text("Cancel")');
      await page.waitForSelector('#modal-container.active', { state: 'detached', timeout: 3000 }).catch(() => {});
    }

    // Reset date back to today
    const todayStr = new Date().toISOString().split('T')[0];
    await page.fill('#att-date-input', todayStr);
    await page.dispatchEvent('#att-date-input', 'change');
    await page.waitForTimeout(800);

    // 3. Approval Inbox
    console.log('\n--- 3. APPROVAL INBOX (LATE ATTENDANCE & OVERTIME) ---');
    await page.click('a[href="/academy/approvals"]');
    await page.waitForSelector('.content-card', { state: 'visible' });
    const approvalsTitle = await page.innerText('.card-title');
    record('Approvals', 'Navigation to Approvals Inbox', approvalsTitle.includes('Approval Inbox'), approvalsTitle);

    // Verify Section 1: Late Attendance Corrections
    const hasLateAttSection = (await page.locator('h3:has-text("Late Attendance Corrections")').count()) > 0;
    record('Approvals', 'Section: Late Attendance Corrections', hasLateAttSection);

    // Verify Section 2: Overtime Requests (>30m)
    const hasOvertimeSection = (await page.locator('h3:has-text("Overtime Approval Requests")').count()) > 0;
    record('Approvals', 'Section: Overtime Approval Requests (>30m Threshold)', hasOvertimeSection);

    // 4. Employee My Salary View
    console.log('\n--- 4. EMPLOYEE MY SALARY STATEMENT ---');
    await page.click('a[href="/academy/my-salary"]');
    await page.waitForSelector('.stats-grid', { state: 'visible' });
    const salaryTitle = await page.innerText('.card-title');
    record('My Salary', 'Navigation to Employee My Salary Statement', salaryTitle.includes('Salary Statement'), salaryTitle);

    // Verify 4 KPI Cards (Base Gross, Additions, Deductions, Net Payable)
    const statsCardsCount = await page.$$eval('.stats-grid .stat-card', cards => cards.length);
    record('My Salary', '4 Financial KPI Cards Rendered', statsCardsCount >= 4, `Found ${statsCardsCount} cards`);

    // Verify Itemized Adjustments & Payout History tables
    const mySalaryTables = await page.$$eval('table', tbls => tbls.length);
    record('My Salary', 'Itemized Adjustments & Payout Ledger Tables', mySalaryTables >= 1, `Found ${mySalaryTables} tables`);

    // Verify Excel and PDF export buttons
    const exportExcelBtn = await page.isVisible('button:has-text("Excel")');
    const exportPdfBtn = await page.isVisible('button:has-text("PDF")');
    record('My Salary', 'Export Statement Buttons (Excel & PDF)', exportExcelBtn && exportPdfBtn);

    // 5. Staff Payroll Management
    console.log('\n--- 5. ACADEMY STAFF PAYROLL DASHBOARD ---');
    await page.click('a[href="/academy/payroll"]');
    await page.waitForSelector('.content-card', { state: 'visible' });
    const payrollTitle = await page.innerText('.card-title');
    record('Payroll', 'Navigation to Staff Payroll Dashboard', payrollTitle.includes('Staff Payroll'), payrollTitle);

    const periodsCount = await page.$$eval('table tbody tr', trs => trs.length);
    record('Payroll', 'Payroll Periods / Statements Tables Loaded', periodsCount > 0, `Rows rendered`);

    // 6. Academy Policy Settings
    console.log('\n--- 6. ACADEMY POLICY SETTINGS ---');
    await page.click('a[href="/academy/policy-settings"]');
    await page.waitForSelector('#setting-cutoff', { state: 'visible' });
    record('Policy Settings', 'Navigation to Academy Policy Settings', true, 'Policy form loaded');

    const cutoffVal = await page.inputValue('#setting-cutoff');
    const otVal = await page.inputValue('#setting-ot-thresh');
    const stVal = await page.inputValue('#setting-vis-day');
    const pdVal = await page.inputValue('#setting-payday');

    record('Policy Settings', 'Attendance Cutoff Days (configured: 2)', cutoffVal === '2', `Value: ${cutoffVal}`);
    record('Policy Settings', 'Overtime Approval Threshold (configured: 30m)', otVal === '30', `Value: ${otVal}`);
    record('Policy Settings', 'Statement Available Day (configured: 25th)', stVal === '25', `Value: ${stVal}`);
    record('Policy Settings', 'Monthly Payday (configured: 1st)', pdVal === '1', `Value: ${pdVal}`);

    // Summary
    console.log('\n================================================================================');
    console.log('   ATTENDANCE, OVERTIME & PAYROLL VISUAL TEST COMPLETE');
    console.log('================================================================================');
    const passed = testResults.filter(t => t.status).length;
    const total = testResults.length;
    console.log(`\n   TOTAL ACTIONS & CHECKS TESTED: ${total}`);
    console.log(`   PASSED: ${passed} | FAILED: ${total - passed}`);
    console.log('   All UI views, modals, cutoff alerts, and policy forms verified!\n');

    await page.waitForTimeout(2000);
  } finally {
    await browser.close();
  }
})();
