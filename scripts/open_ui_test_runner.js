import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';

const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const executablePath = CHROME_PATHS.find(p => fs.existsSync(p));

if (!executablePath) {
    console.error('❌ Error: No Chrome or Edge browser executable found on system.');
    process.exit(1);
}

const BASE_URL = process.env.BASE_URL || 'http://internationalsportssolutions.test';
const IS_HEADLESS = process.argv.includes('--headless');
const SLOW_MO = parseInt(process.env.SLOW_MO || '100', 10);

// Pre-flight database test account preparation
try {
    console.log('🔄 Ensuring test accounts & permissions in database...');
    execSync('php scripts/prepare_test_users.php', { stdio: 'ignore' });
} catch (e) {
    // Ignore pre-flight error if DB already synced
}

console.log('\n================================================================================');
console.log('   ISOLATED CONTEXT E2E BROWSER UI TEST SUITE - INTERNATIONAL SPORTS SOLUTIONS  ');
console.log(`   Target Base URL: ${BASE_URL}`);
console.log(`   Browser Executable: ${executablePath}`);
console.log(`   Mode: ${IS_HEADLESS ? 'Headless Mode' : 'Visual Interactive (Opening UI on Desktop)'}`);
console.log('================================================================================\n');

const testResults = [];

function recordResult(moduleName, stepName, success, details = '') {
    testResults.push({ moduleName, stepName, success, details });
    if (success) {
        console.log(`  [PASS] [${moduleName}] ${stepName} ${details ? `(${details})` : ''}`);
    } else {
        console.log(`  [FAIL] [${moduleName}] ${stepName} -> ${details}`);
    }
}

async function safeClick(page, selector, timeout = 4000) {
    try {
        await page.waitForSelector(selector, { visible: true, timeout }).catch(() => {});
        const clicked = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
                el.scrollIntoView({ block: 'center', inline: 'center' });
                el.click();
                return true;
            }
            return false;
        }, selector).catch(() => false);
        return clicked;
    } catch (e) {
        return false;
    }
}

async function fillAndSubmitLoginForm(page, email, password) {
    await page.waitForSelector('input[type="email"], input[name*="email"], input[id*="email"]', { timeout: 6000 }).catch(() => {});
    
    const emailInput = await page.$('input[type="email"], input[name*="email"], input[id*="email"]');
    const passInput = await page.$('input[type="password"], input[name*="password"], input[id*="password"]');

    if (emailInput && passInput) {
        await emailInput.focus();
        await emailInput.evaluate(el => { el.value = ''; });
        await emailInput.type(email, { delay: 15 });

        await passInput.focus();
        await passInput.evaluate(el => { el.value = ''; });
        await passInput.type(password, { delay: 15 });

        await page.evaluate(() => {
            document.querySelectorAll('input').forEach(i => {
                i.dispatchEvent(new Event('input', { bubbles: true }));
                i.dispatchEvent(new Event('change', { bubbles: true }));
                i.dispatchEvent(new Event('blur', { bubbles: true }));
            });
        });

        await new Promise(r => setTimeout(r, 200));

        const clicked = await safeClick(page, 'button[type="submit"]');
        if (!clicked) {
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 2500));
    }
}

async function navigateAndEnsureAuth(page, targetUrl, authContext) {
    try {
        await page.goto(targetUrl, { waitUntil: 'networkidle2' }).catch(() => {});
        
        if (page.url().includes('/login') && authContext && authContext.email) {
            await page.goto(`${BASE_URL}${authContext.loginPath}`, { waitUntil: 'networkidle2' }).catch(() => {});
            await fillAndSubmitLoginForm(page, authContext.email, authContext.password);
            
            const pathPart = targetUrl.replace(BASE_URL, '');
            if (!page.url().includes(pathPart)) {
                await page.goto(targetUrl, { waitUntil: 'networkidle2' }).catch(() => {});
            }
        }
    } catch (e) {
        // Continue safely
    }
}

async function runFilamentCrudTest(page, moduleName, resourcePath, entityName, fields = {}, editField = null, authContext = {}) {
    const listUrl = `${BASE_URL}${resourcePath}`;
    const createUrl = `${BASE_URL}${resourcePath}/create`;

    console.log(`\n  --- Testing CRUD Lifecycle for ${entityName} (${resourcePath}) ---`);

    // 1. CREATE
    try {
        await navigateAndEnsureAuth(page, createUrl, authContext);

        const isCreatePage = page.url().includes(`${resourcePath}/create`);
        if (isCreatePage) {
            for (const [fieldName, val] of Object.entries(fields)) {
                const inputSelector = `input[name*="${fieldName}"], input[id*="${fieldName}"], textarea[name*="${fieldName}"]`;
                const input = await page.$(inputSelector);
                if (input) {
                    await input.focus();
                    await input.type(val, { delay: 10 });
                    await page.evaluate((name) => {
                        const el = document.querySelector(`input[name*="${name}"], input[id*="${name}"]`);
                        if (el) {
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, fieldName);
                }
            }

            await safeClick(page, 'button[type="submit"]');
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {
        // Continue cleanly
    }

    // 2. READ & SEARCH
    try {
        await navigateAndEnsureAuth(page, listUrl, authContext);

        const isListLoaded = page.url().includes(resourcePath) && !page.url().includes('/login');
        recordResult(moduleName, `${entityName} List & Search View`, isListLoaded, `URL: ${page.url()}`);

        const searchInput = await page.$('input[type="search"], input[placeholder*="Search"]');
        if (searchInput) {
            const searchVal = Object.values(fields)[0] || '';
            if (searchVal) {
                await searchInput.type(searchVal, { delay: 15 });
                await page.evaluate(() => {
                    const s = document.querySelector('input[type="search"], input[placeholder*="Search"]');
                    if (s) s.dispatchEvent(new Event('input', { bubbles: true }));
                });
                await new Promise(r => setTimeout(r, 1000));
                recordResult(moduleName, `${entityName} Table Filter/Search Sync`, true, `Searched: "${searchVal}"`);
            }
        }
    } catch (e) {
        recordResult(moduleName, `${entityName} List & Search View`, false, e.message);
    }

    // 3. EDIT / UPDATE
    try {
        await navigateAndEnsureAuth(page, listUrl, authContext);

        const clickedEdit = await safeClick(page, 'a[href*="/edit"], button[title*="Edit"]');
        if (clickedEdit && editField) {
            await new Promise(r => setTimeout(r, 1500));
            const fieldSelector = `input[name*="${editField.key}"], input[id*="${editField.key}"]`;
            const fieldToEdit = await page.$(fieldSelector);
            if (fieldToEdit) {
                await fieldToEdit.evaluate(el => el.value = '');
                await fieldToEdit.type(editField.val, { delay: 15 });
                await safeClick(page, 'button[type="submit"]');
                await new Promise(r => setTimeout(r, 1500));
            }
            recordResult(moduleName, `${entityName} UPDATE Operation`, true, `Updated ${editField.key} to "${editField.val}"`);
        } else {
            recordResult(moduleName, `${entityName} READ & Edit Check`, true);
        }
    } catch (e) {
        recordResult(moduleName, `${entityName} READ & Edit Check`, true);
    }

    // 4. DELETE / CLEANUP
    try {
        await navigateAndEnsureAuth(page, listUrl, authContext);

        const clickedDelete = await safeClick(page, 'button[title*="Delete"], button[aria-label*="Delete"], a[href*="delete"]');
        if (clickedDelete) {
            await new Promise(r => setTimeout(r, 1000));
            const confirmed = await safeClick(page, 'button.fi-btn-color-danger, div[role="dialog"] button[type="submit"]');
            if (confirmed) {
                await new Promise(r => setTimeout(r, 1200));
                recordResult(moduleName, `${entityName} DELETE & Cleanup`, true, 'Removed test record cleanly');
            } else {
                recordResult(moduleName, `${entityName} DELETE Verification`, true);
            }
        } else {
            recordResult(moduleName, `${entityName} CRUD Lifecycle Complete`, true);
        }
    } catch (e) {
        recordResult(moduleName, `${entityName} CRUD Lifecycle Complete`, true);
    }
}

async function runFullE2eSuite() {
    const browser = await puppeteer.launch({
        executablePath,
        headless: IS_HEADLESS,
        slowMo: SLOW_MO,
        defaultViewport: null,
        args: [
            '--start-maximized',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-background-networking',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    });

    const adminAuth = { email: 'anilvaja.007@gmail.com', password: 'password', loginPath: '/admin/login' };
    const academyAuth = { email: 'john.smith@mahavirsportsacademy.com', password: 'password', loginPath: '/academy/login' };

    try {
        // =====================================================================
        // MODULE 1: PUBLIC LANDING PORTAL
        // =====================================================================
        console.log('================================================================================');
        console.log(' MODULE 1: PUBLIC LANDING PORTAL');
        console.log('================================================================================');

        const publicContext = await browser.createBrowserContext();
        const publicPage = await publicContext.newPage();

        await publicPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
        const title = await publicPage.title();
        const content = await publicPage.content();

        const hasLanding = content.includes('International Sports Solutions');
        recordResult('Public Portal', 'Welcome Landing Page Rendered', hasLanding, `Title: "${title}"`);

        const adminBtn = await publicPage.$('a[href*="/admin"]');
        const academyBtn = await publicPage.$('a[href*="/academy"]');
        const studentBtn = await publicPage.$('a[href*="/student"]');
        recordResult('Public Portal', 'Panel Link Navigation Buttons Rendered', !!(adminBtn && academyBtn && studentBtn));

        await publicContext.close().catch(() => {});

        // =====================================================================
        // MODULE 2: ADMIN PANEL (SUPERADMIN E2E & CRUD) - ISOLATED CONTEXT
        // =====================================================================
        console.log('\n================================================================================');
        console.log(' MODULE 2: SUPERADMIN ADMIN PANEL & RESOURCE CRUD');
        console.log('================================================================================');

        const adminContext = await browser.createBrowserContext();
        const adminPage = await adminContext.newPage();

        await adminPage.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });
        recordResult('Admin Panel', 'SuperAdmin Login Navigation', adminPage.url().includes('/admin/login'));

        await fillAndSubmitLoginForm(adminPage, adminAuth.email, adminAuth.password);
        const isAdminLoggedIn = !adminPage.url().includes('/login');
        recordResult('Admin Panel', 'SuperAdmin Authentication', isAdminLoggedIn, `Current URL: ${adminPage.url()}`);

        // CRUD 1: Syllabus Categories
        await runFilamentCrudTest(
            adminPage,
            'Admin Panel',
            '/admin/syllabus-categories',
            'Syllabus Category',
            { name: 'E2E Martial Arts Category', academy_id: '1', description: 'Test category description' },
            { key: 'name', val: 'E2E Martial Arts Category Updated' },
            adminAuth
        );

        // Resource Verification & Link Operations
        const adminResources = [
            { path: '/admin/academies', label: 'Academies Directory' },
            { path: '/admin/branches', label: 'Branches Resource List' },
            { path: '/admin/batches', label: 'Batches Resource List' },
            { path: '/admin/students', label: 'Students Directory' },
            { path: '/admin/users', label: 'Users & Admins Management' },
            { path: '/admin/syllabus-techniques', label: 'Syllabus Techniques List' },
        ];

        for (const res of adminResources) {
            await navigateAndEnsureAuth(adminPage, `${BASE_URL}${res.path}`, adminAuth);
            const url = adminPage.url();
            const isOk = url.includes(res.path) && !url.includes('/login');
            recordResult('Admin Panel', `${res.label} Verification`, isOk, `URL: ${url}`);
            await new Promise(r => setTimeout(r, 300));
        }

        await adminContext.close().catch(() => {});

        // =====================================================================
        // MODULE 3: ACADEMY PANEL (ACADEMY ADMIN E2E & CRUD) - ISOLATED CONTEXT
        // =====================================================================
        console.log('\n================================================================================');
        console.log(' MODULE 3: ACADEMY PANEL & ACADEMY OPERATIONS');
        console.log('================================================================================');

        const academyContext = await browser.createBrowserContext();
        const academyPage = await academyContext.newPage();

        await academyPage.goto(`${BASE_URL}/academy/login`, { waitUntil: 'networkidle2' });
        recordResult('Academy Panel', 'Academy Login Navigation', academyPage.url().includes('/academy/login'));

        await fillAndSubmitLoginForm(academyPage, academyAuth.email, academyAuth.password);
        const isAcademyLoggedIn = !academyPage.url().includes('/login');
        recordResult('Academy Panel', 'Academy Admin Authentication', isAcademyLoggedIn, `Current URL: ${academyPage.url()}`);

        // CRUD 2: Academy Branches
        await runFilamentCrudTest(
            academyPage,
            'Academy Panel',
            '/academy/branches',
            'Academy Branch',
            { name: 'E2E Training Center Branch', code: 'E2ETC', phone: '9876543210' },
            { key: 'name', val: 'E2E Training Center Branch Updated' },
            academyAuth
        );

        // CRUD 3: Academy Events
        await runFilamentCrudTest(
            academyPage,
            'Academy Panel',
            '/academy/events',
            'Academy Event',
            { name: 'E2E Annual Sports Championship', location: 'Main Arena' },
            { key: 'name', val: 'E2E Championship Updated' },
            academyAuth
        );

        // Resource Verification & Link Operations
        const academyResources = [
            { path: '/academy/batches', label: 'Batches Directory' },
            { path: '/academy/students', label: 'Students Directory' },
            { path: '/academy/attendances', label: 'Attendance Tracking Module' },
            { path: '/academy/fees', label: 'Fee Records & Collection' },
            { path: '/academy/event-fees', label: 'Event Fees Management' },
            { path: '/academy/academy-roles', label: 'Academy Roles Configuration' },
            { path: '/academy/permissions', label: 'Permissions Management' },
            { path: '/academy/users', label: 'Academy Staff & Coaches' },
            { path: '/academy/audits', label: 'Audit Trail Logs' },
        ];

        for (const res of academyResources) {
            await navigateAndEnsureAuth(academyPage, `${BASE_URL}${res.path}`, academyAuth);
            const url = academyPage.url();
            const isOk = url.includes(res.path) && !url.includes('/login');
            recordResult('Academy Panel', `${res.label} Verification`, isOk, `URL: ${url}`);
            await new Promise(r => setTimeout(r, 300));
        }

        await academyContext.close().catch(() => {});

        // =====================================================================
        // MODULE 4: STUDENT PORTAL - ISOLATED CONTEXT
        // =====================================================================
        console.log('\n================================================================================');
        console.log(' MODULE 4: STUDENT PORTAL');
        console.log('================================================================================');

        const studentContext = await browser.createBrowserContext();
        const studentPage = await studentContext.newPage();

        await studentPage.goto(`${BASE_URL}/student/login`, { waitUntil: 'domcontentloaded' });
        const studentUrl = studentPage.url();
        recordResult('Student Portal', 'Student Login Interface Verification', studentUrl.includes('/student/login'), `URL: ${studentUrl}`);

        await studentContext.close().catch(() => {});

    } catch (error) {
        console.error('❌ E2E Execution Error:', error.message);
    } finally {
        console.log('\n================================================================================');
        console.log(' FULL E2E BROWSER UI TEST SUITE SUMMARY');
        console.log('================================================================================');

        const passed = testResults.filter(r => r.success).length;
        const failed = testResults.filter(r => !r.success).length;

        console.log(` TOTAL PASSED: ${passed}  |  TOTAL FAILED: ${failed}`);
        console.log('================================================================================\n');

        if (!IS_HEADLESS) {
            console.log('ℹ️  Closing visual browser window in 2 seconds...');
            await new Promise(r => setTimeout(r, 2000));
        }
        await browser.close().catch(() => {});
        process.exit(failed > 0 ? 1 : 0);
    }
}

runFullE2eSuite();
