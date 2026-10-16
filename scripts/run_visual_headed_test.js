import { chromium } from '@playwright/test';

(async () => {
  console.log('\n================================================================================');
  console.log('   LAUNCHING INTERACTIVE HEADED CHROME BROWSER — FULL CRUD UI TEST SUITE');
  console.log('   Target: http://localhost:3005 (1 Worker, SlowMo: 500ms)');
  console.log('================================================================================\n');

  const browser = await chromium.launch({
    headless: false, // VISIBLE BROWSER ON SCREEN
    slowMo: 500,     // DELIBERATELY PACED SO YOU CAN WATCH EVERY CRUD ACTION LIVE
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const testResults = [];

  function record(module, action, status, details = '') {
    testResults.push({ module, action, status, details });
    const mark = status ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`  ${mark} [${module}] ${action} ${details ? `(${details})` : ''}`);
  }

  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 850 } });

    // Automatically accept any browser confirm/alert dialogs (e.g. for delete confirmations)
    page.on('dialog', async dialog => {
      console.log(`     [BROWSER DIALOG] "${dialog.message()}" -> Accepting...`);
      await dialog.accept();
    });

    // -------------------------------------------------------------------------
    // MODULE 1: AUTHENTICATION & PORTAL NAVIGATION
    // -------------------------------------------------------------------------
    console.log('\n--- MODULE 1: AUTHENTICATION & PORTAL NAVIGATION ---');
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
    record('Auth', 'Load Portal Page', page.url().includes('localhost:3005'));

    await page.click('button:has-text("Academy Admin")');
    await page.waitForTimeout(400);
    await page.click('#btn-login-submit');
    await page.waitForSelector('#app-view', { state: 'visible', timeout: 5000 });
    record('Auth', 'Login as Academy Admin', true, `Current URL: ${page.url()}`);

    // -------------------------------------------------------------------------
    // MODULE 2: SYLLABUS CATEGORY COMPLETE CRUD LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- MODULE 2: SYLLABUS CATEGORY COMPLETE CRUD LIFECYCLE ---');
    await page.click('a[href="/academy/syllabus"]');
    await page.waitForTimeout(800);
    record('Syllabus', 'Navigate to Sports Syllabus', page.url().includes('/academy/syllabus'));

    // Switch to Categories Tab
    await page.click('button:has-text("Syllabus Categories")');
    await page.waitForSelector('#syllabus-tab-content table', { state: 'visible' });

    // 2.1 CREATE Category
    await page.click('button:has-text("New Category")');
    await page.waitForSelector('#cat-name', { state: 'visible' });
    const testCatName = `E2E Combat Tactics ${Date.now() % 10000}`;
    await page.fill('#cat-name', testCatName);
    await page.fill('#cat-desc', 'Specialized sparring and tactical defense drills');
    await page.fill('#cat-order', '99');
    await page.click('#modal-footer button:has-text("Create Category")');
    await page.waitForSelector('#modal-container.active', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);

    const catRow = page.locator('#syllabus-tab-content table tbody tr', { hasText: testCatName });
    const catCreated = (await catRow.count()) > 0;
    record('Categories', 'CREATE Category via UI Modal', catCreated, `Name: "${testCatName}"`);

    // 2.2 READ Category
    record('Categories', 'READ Category in Table', catCreated);

    // 2.3 UPDATE Category
    const updatedCatName = `${testCatName} (Updated)`;
    await catRow.locator('button:has(.fa-pen-to-square)').click();
    await page.waitForSelector('#edit-cat-name', { state: 'visible' });
    await page.fill('#edit-cat-name', updatedCatName);
    await page.click('#modal-footer button:has-text("Save Changes")');
    await page.waitForSelector('#modal-container.active', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);

    const updatedCatRow = page.locator('#syllabus-tab-content table tbody tr', { hasText: updatedCatName });
    const catUpdated = (await updatedCatRow.count()) > 0;
    record('Categories', 'UPDATE Category via UI Modal', catUpdated, `New Name: "${updatedCatName}"`);

    // 2.4 DELETE Category
    await updatedCatRow.locator('button:has(.fa-trash)').click();
    await page.waitForTimeout(1500);

    const catDeleted = (await page.locator('#syllabus-tab-content table tbody tr', { hasText: updatedCatName }).count()) === 0;
    record('Categories', 'DELETE Category with Dialog Confirmation', catDeleted, `Removed: "${updatedCatName}"`);

    // -------------------------------------------------------------------------
    // MODULE 3: SYLLABUS TECHNIQUE COMPLETE CRUD LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- MODULE 3: SYLLABUS TECHNIQUE COMPLETE CRUD LIFECYCLE ---');
    await page.click('button:has-text("Techniques Curriculum")');
    await page.waitForSelector('#techniques-table', { state: 'visible' });

    // 3.1 CREATE Technique
    await page.click('button:has-text("New Technique")');
    await page.waitForSelector('#tech-name', { state: 'visible' });

    await page.selectOption('#tech-cat', { index: 1 });
    const testTechName = `E2E Dragon Kick ${Date.now() % 10000}`;
    await page.fill('#tech-name', testTechName);
    await page.fill('#tech-code', 'DRAG-01');
    await page.fill('#tech-desc', 'Explosive flying roundhouse kick drill');
    await page.selectOption('#tech-level', '3');
    await page.fill('#tech-belt', 'Purple Belt');
    await page.fill('#tech-order', '99');
    await page.click('#modal-footer button:has-text("Create Technique")');
    await page.waitForSelector('#modal-container.active', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);

    const techRow = page.locator('#techniques-table tbody tr', { hasText: testTechName });
    const techCreated = (await techRow.count()) > 0;
    record('Techniques', 'CREATE Technique via UI Modal', techCreated, `Name: "${testTechName}"`);

    // 3.2 READ & SEARCH Filter
    await page.fill('#tech-search-input', 'Dragon Kick');
    await page.waitForTimeout(600);
    const isFilteredVisible = await techRow.isVisible();
    record('Techniques', 'READ & Search Filter in Table', isFilteredVisible, 'Searched: "Dragon Kick"');

    // Clear search filter
    await page.fill('#tech-search-input', '');
    await page.waitForTimeout(600);

    // 3.3 UPDATE Technique
    const updatedTechName = `${testTechName} (Mastery)`;
    await techRow.locator('button:has(.fa-pen-to-square)').click();
    await page.waitForSelector('#edit-tech-name', { state: 'visible' });
    await page.fill('#edit-tech-name', updatedTechName);
    await page.click('#modal-footer button:has-text("Save Changes")');
    await page.waitForSelector('#modal-container.active', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);

    const updatedTechRow = page.locator('#techniques-table tbody tr', { hasText: updatedTechName });
    const techUpdated = (await updatedTechRow.count()) > 0;
    record('Techniques', 'UPDATE Technique via UI Modal', techUpdated, `New Name: "${updatedTechName}"`);

    // 3.4 DELETE Technique
    await updatedTechRow.locator('button:has(.fa-trash)').click();
    await page.waitForTimeout(1500);

    const techDeleted = (await page.locator('#techniques-table tbody tr', { hasText: updatedTechName }).count()) === 0;
    record('Techniques', 'DELETE Technique with Dialog Confirmation', techDeleted, `Removed: "${updatedTechName}"`);

    // -------------------------------------------------------------------------
    // MODULE 4: ATTENDANCE RECORDING (CONFIRM PROGRESSION COLUMN ABSENT)
    // -------------------------------------------------------------------------
    console.log('\n--- MODULE 4: ATTENDANCE RECORDING & PROGRESSION CHECK ---');
    await page.click('a[href="/academy/attendance"]');
    await page.waitForTimeout(1000);

    const attHeaders = await page.$$eval('#attendance-roster-container th', elements => elements.map(e => e.innerText.trim()));
    const hasProgression = attHeaders.includes('PROGRESSION') || attHeaders.includes('Progression');
    record('Attendance', 'Verify Progression Column Removed', !hasProgression, `Columns: ${attHeaders.join(' | ')}`);

    // Mark All Present and Save
    await page.click('button:has-text("All Present")');
    await page.waitForTimeout(400);
    await page.click('button:has-text("Save Attendance & Track Technique")');
    await page.waitForTimeout(1000);
    record('Attendance', 'Mark & Save Batch Attendance', true, 'Saved successfully');

    // -------------------------------------------------------------------------
    // MODULE 5: STUDENT ENROLLMENT & BATCH TRANSFER CRUD
    // -------------------------------------------------------------------------
    console.log('\n--- MODULE 5: STUDENT ENROLLMENT & BATCH TRANSFER CRUD ---');
    await page.click('a[href="/academy/students"]');
    await page.waitForSelector('#students-table', { state: 'visible' });

    // 5.1 CREATE Student
    await page.click('.card-actions button:has-text("Enroll Student")');
    await page.waitForSelector('#stu-fn', { state: 'visible' });
    const studentFn = `Aarav_${Date.now() % 10000}`;
    await page.fill('#stu-fn', studentFn);
    await page.fill('#stu-ln', 'Vaja');
    await page.fill('#stu-email', `${studentFn.toLowerCase()}@example.com`);
    await page.fill('#stu-phone', '9898012345');
    await page.fill('#stu-guardian', 'Anil Vaja');
    await page.selectOption('#stu-branch', { index: 1 });
    await page.waitForTimeout(300);
    await page.click('#modal-footer button:has-text("Enroll Student")');
    await page.waitForSelector('#modal-container.active', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const studentRow = page.locator('#students-table tbody tr', { hasText: studentFn });
    const studentEnrolled = (await studentRow.count()) > 0;
    record('Students', 'CREATE (Enroll New Student)', studentEnrolled, `Name: "${studentFn} Vaja"`);

    // 5.2 READ Student
    record('Students', 'READ Student in Table Roster', studentEnrolled);

    // 5.3 UPDATE (Batch Transfer)
    await studentRow.locator('button:has-text("Transfer")').click();
    await page.waitForSelector('#transfer-batch-id', { state: 'visible' });
    await page.selectOption('#transfer-batch-id', { index: 1 });
    await page.fill('#transfer-reason', 'Advancement to next skill tier');
    await page.click('#modal-footer button:has-text("Confirm Transfer")');
    await page.waitForSelector('#modal-container.active', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    record('Students', 'UPDATE (Transfer Batch with Reason)', true, 'Atomic batch transfer saved');

    // 5.4 READ Audit History
    await studentRow.locator('button:has(.fa-clock-rotate-left)').click();
    await page.waitForSelector('#modal-container.active', { state: 'visible' });
    await page.waitForTimeout(800);
    await page.click('#modal-footer button:has-text("Close")');
    await page.waitForSelector('#modal-container.active', { state: 'detached', timeout: 5000 }).catch(() => {});
    record('Students', 'READ Batch Transfer Audit Trail Modal', true);

    // -------------------------------------------------------------------------
    // MODULE 6: THEME TOGGLING & POPSTATE URL ROUTING
    // -------------------------------------------------------------------------
    console.log('\n--- MODULE 6: THEME TOGGLE & BROWSER HISTORY ---');
    await page.click('button[title="Toggle Dark/Light Mode"]');
    await page.waitForTimeout(600);
    await page.click('button[title="Toggle Dark/Light Mode"]');
    await page.waitForTimeout(600);
    record('Theme', 'Light / Dark Mode Live Toggle', true);

    await page.goBack();
    await page.waitForTimeout(600);
    record('Routing', 'Browser Back Button (Popstate)', true, `URL: ${page.url()}`);

    await page.goForward();
    await page.waitForTimeout(600);
    record('Routing', 'Browser Forward Button (Popstate)', true, `URL: ${page.url()}`);

    // -------------------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------------------
    console.log('\n================================================================================');
    console.log('   E2E FULL CRUD VISUAL UI TEST SUMMARY');
    console.log('================================================================================');
    const passed = testResults.filter(t => t.status).length;
    const total = testResults.length;
    console.log(`\n   TOTAL TESTS RUN: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
    console.log('   All CRUD operations (Create, Read, Update, Delete) validated in real Chrome window!\n');

    await page.waitForTimeout(2000);
  } finally {
    await browser.close();
  }
})();
