import { test, expect } from '@playwright/test';
import { BASE_URL, CREDENTIALS, ROUTES } from './helpers/constants.js';
import { loginAsSuperAdmin, navigateAndEnsureAuth } from './helpers/auth.js';
import { testResourceCrudLifecycle } from './helpers/crud-runner.js';

test.describe('Module 2: Super Admin Panel Complete CRUD & Page Suite', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('Super Admin Dashboard UI View', async ({ page }) => {
    await navigateAndEnsureAuth(page, ROUTES.admin.dashboard, CREDENTIALS.superAdmin);
    await expect(page.locator('body')).toBeVisible();
    expect(page.url().includes('/admin')).toBeTruthy();
  });

  // Exhaustive list of Central Panel Super Admin resources with CRUD
  const adminResources = [
    {
      resourceName: 'Academies',
      basePath: ROUTES.admin.academies,
      createFields: { name: 'E2E Test Academy', code: 'E2ETA', email: 'test@academy.com' },
      editFields: { name: 'E2E Test Academy Updated' },
    },
    {
      resourceName: 'Branches',
      basePath: ROUTES.admin.branches,
      createFields: { name: 'E2E Test Branch', code: 'E2ETB' },
      editFields: { name: 'E2E Test Branch Updated' },
    },
    {
      resourceName: 'Batches',
      basePath: ROUTES.admin.batches,
      createFields: { name: 'E2E Test Batch', code: 'E2ETBAT' },
      editFields: { name: 'E2E Test Batch Updated' },
    },
    {
      resourceName: 'Students',
      basePath: ROUTES.admin.students,
      createFields: { first_name: 'E2EStudent', email: 'e2estudent@test.com' },
      editFields: { first_name: 'E2EStudentUpdated' },
    },
    {
      resourceName: 'Users & Admins',
      basePath: ROUTES.admin.users,
      createFields: { name: 'E2E Admin User', email: 'e2eadmin@test.com' },
      editFields: { name: 'E2E Admin User Updated' },
    },
    {
      resourceName: 'Syllabus Categories',
      basePath: ROUTES.admin.syllabusCategories,
      createFields: { name: 'E2E Syllabus Category', description: 'Test description' },
      editFields: { name: 'E2E Syllabus Category Updated' },
    },
    {
      resourceName: 'Syllabus Techniques',
      basePath: ROUTES.admin.syllabusTechniques,
      createFields: { name: 'E2E Technique', description: 'Technique description' },
      editFields: { name: 'E2E Technique Updated' },
    },
  ];

  for (const res of adminResources) {
    test(`Admin Panel - ${res.resourceName} Complete CRUD Lifecycle`, async ({ page }) => {
      const results = await testResourceCrudLifecycle(page, {
        module: 'Super Admin Panel',
        resourceName: res.resourceName,
        basePath: res.basePath,
        createFields: res.createFields,
        editFields: res.editFields,
        hasCreate: true,
        hasEdit: true,
        hasDelete: true,
      });

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.error(`❌ [Admin Panel - ${res.resourceName}] Failures encountered:`, failures);
      }
      expect(failures.length, `Failures found in ${res.resourceName}: ${JSON.stringify(failures)}`).toBe(0);
    });
  }
});
