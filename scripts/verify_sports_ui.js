import { chromium } from '@playwright/test';

async function verifySportsUI() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  console.log('1. Navigating to login...');
  await page.goto('http://localhost:3005');
  await page.waitForSelector('#login-email');

  await page.fill('#login-email', 'john.smith@mahavirsportsacademy.com');
  await page.fill('#login-password', 'password123');
  await page.click('#btn-login-submit');

  await page.waitForSelector('#app-view', { state: 'visible' });
  console.log('2. Logged in successfully');

  // Go to Coaches page
  console.log('3. Navigating to Coaches page...');
  await page.click('a[href="/academy/coaches"]');
  await page.waitForSelector('#coaches-table', { state: 'visible' });

  // Open Add Coach modal
  await page.click('button:has-text("New Coach / Staff")');
  await page.waitForSelector('#add-coach-form', { state: 'visible' });

  // Check sport dropdown options
  const sportOptions = await page.$$eval('#coach-sport option', options => 
    options.map(o => ({ value: o.value, text: o.text.trim() }))
  );
  console.log('Sport Options in Coach Modal:', sportOptions);

  // Check duplicates
  const names = sportOptions.filter(o => o.value !== '').map(o => o.text.split(' ')[0].toLowerCase());
  const uniqueNames = new Set(names);
  if (names.length !== uniqueNames.size) {
    throw new Error(`Duplicate sports detected in dropdown! ${JSON.stringify(names)}`);
  }
  console.log('SUCCESS: No duplicate sports in Coach dropdown!');

  // Check Karate default
  const selectedSport = await page.$eval('#coach-sport', el => {
    const opt = el.options[el.selectedIndex];
    return opt ? opt.text : '';
  });
  console.log('Selected sport by default:', selectedSport);
  if (!selectedSport.toLowerCase().includes('karate')) {
    throw new Error(`Expected Karate to be selected by default, got: ${selectedSport}`);
  }
  console.log('SUCCESS: Karate is auto-selected as the default primary sport!');

  // Check "+ New Sport" button in modal
  const newSportBtn = await page.locator('button:has-text("New Sport")').first();
  const hasNewSportBtn = await newSportBtn.isVisible();
  console.log('"+ New Sport" button visible in modal:', hasNewSportBtn);
  if (!hasNewSportBtn) {
    throw new Error('New Sport button not found in modal');
  }

  // Close modal
  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(300);

  // 4. Navigate to Sports & Disciplines page
  console.log('4. Navigating to Sports & Disciplines page...');
  const sportsNavLink = page.locator('a[href="/academy/sports"]');
  await sportsNavLink.click();
  await page.waitForSelector('text=Sports & Disciplines', { state: 'visible' });

  await page.waitForTimeout(500);
  const karateRow = page.locator('tr:has-text("Karate")').first();
  const hasKarate = await karateRow.isVisible();
  console.log('Karate row visible in Sports table:', hasKarate);
  if (!hasKarate) {
    throw new Error('Karate not found in Sports table');
  }

  // 5. Add a new sport
  console.log('5. Testing Add New Sport modal...');
  await page.click('button:has-text("Add New Sport")');
  await page.waitForSelector('#add-sport-form', { state: 'visible' });

  const dynamicSportName = `Judo Martial Arts ${Date.now().toString().slice(-4)}`;
  await page.fill('#sport-name', dynamicSportName);
  await page.fill('#sport-description', 'Olympic martial art focused on throws, joint locks and grappling.');
  await page.click('button:has-text("Add Sport")');

  // Verify new sport appears in table
  await page.waitForSelector(`text=${dynamicSportName}`);
  console.log(`SUCCESS: Dynamic sport "${dynamicSportName}" added and rendered in table!`);

  // 6. Test Edit Sport
  console.log('6. Testing Edit Sport modal...');
  const sportRow = page.locator(`tr:has-text("${dynamicSportName}")`);
  await sportRow.locator('button[title="Edit Sport"]').click();
  await page.waitForSelector('#edit-sport-form', { state: 'visible' });

  const updatedDesc = 'Updated Olympic Judo Curriculum with Belt Progression';
  await page.fill('#edit-sport-desc', updatedDesc);
  await page.click('button:has-text("Save Changes")');

  await page.waitForSelector(`text=${updatedDesc}`);
  console.log('SUCCESS: Sport description edited successfully!');

  // 7. Test Deactivate toggle
  console.log('7. Testing Deactivate Sport...');
  const updatedRow = page.locator(`tr:has-text("${dynamicSportName}")`);
  await updatedRow.locator('button[title="Deactivate"]').click();
  await page.waitForSelector(`tr:has-text("${dynamicSportName}") span:has-text("Inactive")`);
  console.log('SUCCESS: Sport deactivated!');

  // 8. Test Delete Sport
  console.log('8. Testing Delete unreferenced sport...');
  const inactiveRow = page.locator(`tr:has-text("${dynamicSportName}")`);
  const [dialog] = await Promise.all([
    page.waitForEvent('dialog').then(d => d.accept()),
    inactiveRow.locator('button[title="Delete Sport"]').click()
  ]);
  await page.waitForTimeout(1000);
  const stillInTable = await page.locator(`table tbody tr:has-text("${dynamicSportName}")`).count();
  console.log('Sport deleted, count remaining in table:', stillInTable);
  if (stillInTable !== 0) {
    throw new Error('Sport was not deleted from table');
  }

  console.log('ALL BROWSER E2E TESTS PASSED PERFECTLY!');
  await browser.close();
}

verifySportsUI().catch(err => {
  console.error('Browser test failed:', err);
  process.exit(1);
});
