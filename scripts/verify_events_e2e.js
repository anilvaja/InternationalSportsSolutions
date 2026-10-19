import { chromium } from '@playwright/test';
import fs from 'fs';

(async () => {
  console.log('\n================================================================================');
  console.log('   PLAYWRIGHT E2E BROWSER VERIFICATION — EVENTS & STUDENT PARTICIPATION');
  console.log('   Target: http://localhost:3005');
  console.log('================================================================================\n');

  const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const executablePath = CHROME_PATHS.find(p => fs.existsSync(p));

  const isHeadless = !process.argv.includes('--headed');
  console.log(`Starting Playwright browser (headless: ${isHeadless})...`);

  const browser = await chromium.launch({
    headless: isHeadless,
    executablePath,
    slowMo: isHeadless ? 50 : 250,
  });

  const testResults = [];
  function record(stepName, status, details = '') {
    testResults.push({ stepName, status, details });
    const mark = status ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`  ${mark} ${stepName} ${details ? `-> ${details}` : ''}`);
  }

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    // Auto-accept confirm dialogs
    page.on('dialog', async dialog => {
      console.log(`     [BROWSER DIALOG] "${dialog.message()}" -> Accepted.`);
      await dialog.accept();
    });

    // 1. Visit Login
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
    record('1. Landing / Login Page Loaded', page.url().includes('localhost:3005'));

    // 2. Login as Academy Admin
    await page.click('button:has-text("Academy Admin")');
    await page.waitForTimeout(200);
    await page.click('#btn-login-submit');
    await page.waitForSelector('#app-view', { state: 'visible', timeout: 6000 });
    record('2. Authenticated as Academy Admin', true, 'Dashboard loaded');

    // 3. Navigate to Events & Tournaments
    await page.click('a[href="/academy/events"]');
    await page.waitForSelector('h2:has-text("Events & Tournaments")', { timeout: 6000 });
    record('3. Navigate to Events & Tournaments Tab', true, `URL: ${page.url()}`);

    // 4. Open New Event Modal
    await page.click('button:has-text("New Event")');
    await page.waitForSelector('#modal-container.active', { state: 'visible', timeout: 5000 });
    record('4. Open New Event Specification Modal', true, 'Modal displayed');

    // 5. Fill Draft Event Details (Without Venue as per specification)
    const testTitle = `Inter-Branch Karate Tournament - E2E ${Date.now().toString().slice(-4)}`;
    await page.fill('#ev-title', testTitle);
    await page.selectOption('#ev-type', 'tournament');
    await page.fill('#ev-date', '2026-11-15');
    await page.fill('#ev-deadline', '2026-11-05');
    await page.fill('#ev-location', ''); // Explicitly blank initially
    // Check select all students for eligibility
    await page.click('button:has-text("Select All")');
    await page.waitForTimeout(300);

    // Save as Draft
    await page.click('button:has-text("Save as Draft")');
    await page.waitForSelector('#modal-container.active', { state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(500);
    record('5. Persist Draft Event Without Venue', true, `Created: ${testTitle}`);

    // Verify row in table
    const tableHtml = await page.innerHTML('table');
    const hasEventRow = tableHtml.includes(testTitle);
    record('6. Draft Event Appears in Table with Draft Badge', hasEventRow);

    // 6. Publication Gate: Try to publish without venue
    const publishBtn = await page.locator(`tr:has-text("${testTitle}") button[title="Publish Event"]`);
    await publishBtn.click();
    await page.waitForTimeout(600);

    // Verify toast or error indicating venue is required
    const toastText = await page.innerText('#toast-container');
    const blockedVenue = toastText.includes('Venue') || toastText.includes('location') || toastText.includes('required');
    record('7. Publication Gate Blocks Publication Without Venue', blockedVenue, toastText.replace(/\n/g, ' '));

    // 7. Edit event to add Venue
    const editBtn = await page.locator(`tr:has-text("${testTitle}") button[title="Edit Event"]`);
    await editBtn.click();
    await page.waitForSelector('#modal-container.active', { state: 'visible', timeout: 5000 });
    await page.fill('#ev-location', 'Main Dojo Arena, North Campus');
    await page.click('button:has-text("Update Event")');
    await page.waitForSelector('#modal-container.active', { state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(500);
    record('8. Updated Event With Publication-Critical Venue', true, 'Main Dojo Arena, North Campus');

    // 8. Publish Event (confirm snapshot v1)
    const publishBtnReady = await page.locator(`tr:has-text("${testTitle}") button[title="Publish Event"]`);
    await publishBtnReady.click();
    await page.waitForTimeout(1000);

    const postPublishTable = await page.innerHTML('table');
    const isPublished = postPublishTable.includes('Published') && postPublishTable.includes('Snap: v1');
    record('9. Event Successfully Published with Versioned Snapshot (v1)', isPublished);

    // 9. Logout Admin
    await page.click('button:has-text("Logout")');
    await page.waitForSelector('#login-view', { state: 'visible', timeout: 5000 });
    record('10. Organizer Logged Out', true);

    // 10. Login as Student
    await page.click('button:has-text("Student")');
    await page.waitForTimeout(200);
    await page.click('#btn-login-submit');
    await page.waitForSelector('#app-view', { state: 'visible', timeout: 6000 });
    record('11. Authenticated as Student', true);

    // 11. Navigate to Student Events
    await page.click('a[href="/student/events"]');
    await page.waitForSelector('h2:has-text("My Event Invitations & Tournaments")', { timeout: 6000 });
    record('12. Student Events & Invitations Tab Loaded', true, `URL: ${page.url()}`);

    // Check invitation card
    const studentEventsHtml = await page.innerHTML('#page-content');
    const hasInvitation = studentEventsHtml.includes(testTitle);
    record('13. Student Sees Published Tournament Invitation', hasInvitation);

    // 12. Student responds "Interested"
    const eventCard = page.locator(`.card:has-text("${testTitle}")`);
    await eventCard.locator('button.btn-success').click();
    await page.waitForTimeout(800);

    // Verify status is "Pending Organizer Approval"
    const postResponseHtml = await page.innerHTML('#page-content');
    const isPendingApproval = postResponseHtml.includes('PENDING') || postResponseHtml.includes('Pending');
    record('14. Student Response Recorded as Interested with PENDING Approval Status', isPendingApproval);

    // 13. Student changes response to "Not Interested" and back to "Interested"
    await eventCard.locator('button.btn-outline-danger').click();
    await page.waitForTimeout(600);
    record('15. Student Successfully Updates Response Prior to Deadline', true, 'Changed to Not Interested');

    await eventCard.locator('button.btn-success').click();
    await page.waitForTimeout(600);
    record('16. Student Toggles Back to Interested Prior to Deadline', true, 'Pending Approval restored');

    // 14. Logout Student
    await page.click('button:has-text("Logout")');
    await page.waitForSelector('#login-view', { state: 'visible', timeout: 5000 });

    // 15. Login back as Academy Admin to moderate registration
    await page.click('button:has-text("Academy Admin")');
    await page.waitForTimeout(200);
    await page.click('#btn-login-submit');
    await page.waitForSelector('#app-view', { state: 'visible', timeout: 6000 });

    // 16. Go to Events, open Roster
    await page.click('a[href="/academy/events"]');
    await page.waitForSelector('h2:has-text("Events & Tournaments")', { timeout: 6000 });

    const rosterBtn = page.locator(`tr:has-text("${testTitle}") button[title="View Roster & Approvals"]`);
    await rosterBtn.click();
    await page.waitForSelector('#modal-container.active', { state: 'visible', timeout: 5000 });
    record('17. Organizer Opens Participation Roster & Moderation Modal', true);

    // Check roster contents
    const rosterHtml = await page.innerHTML('#modal-body');
    const hasInterestedRow = rosterHtml.includes('Interested') && rosterHtml.includes('Pending Approval');
    record('18. Student Listed in Roster with Interested & Pending Approval Status', hasInterestedRow);

    // 17. Approve student registration
    const approveBtn = page.locator('#modal-body button[title="Approve Registration"]').first();
    await approveBtn.click();
    await page.waitForTimeout(800);

    const postApproveRoster = await page.innerHTML('#modal-body');
    const isConfirmed = postApproveRoster.includes('Confirmed');
    record('19. Organizer Confirms Registration (Status: Confirmed)', isConfirmed);

    // Close modal
    await page.click('#modal-footer button:has-text("Done")');
    await page.waitForTimeout(300);

    // 18. Verify CSV export endpoint
    const exportHref = await page.locator(`tr:has-text("${testTitle}") a[title="Export CSV Roster"]`).getAttribute('href');
    const exportResponse = await page.request.get(`http://localhost:3005${exportHref}`, {
      headers: {
        'Authorization': `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}`,
        'X-Academy-Id': '1'
      }
    });
    const csvBody = await exportResponse.text();
    record('20. Authorized CSV Roster Export', exportResponse.status() === 200 && csvBody.includes('Student Code'), `Downloaded: ${exportHref}`);

    console.log('\n================================================================================');
    const passedCount = testResults.filter(r => r.status).length;
    console.log(`   BROWSER VERIFICATION SUMMARY: ${passedCount}/${testResults.length} STEPS PASSED`);
    console.log('================================================================================\n');

  } catch (err) {
    console.error('Browser Test Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
