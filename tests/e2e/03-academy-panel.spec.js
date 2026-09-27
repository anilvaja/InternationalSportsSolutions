import { test, expect } from '@playwright/test';
import { BASE_URL, CREDENTIALS, ROUTES } from './helpers/constants.js';
import { loginAsAcademyAdmin, navigateAndEnsureAuth } from './helpers/auth.js';
import { testResourceCrudLifecycle } from './helpers/crud-runner.js';

test.describe('Module 3: Academy Panel Complete CRUD & Page Suite', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAcademyAdmin(page);
  });

  test('Academy Admin Dashboard UI View', async ({ page }) => {
    await navigateAndEnsureAuth(page, ROUTES.academy.dashboard, CREDENTIALS.academyAdmin);
    await expect(page.locator('body')).toBeVisible();
    expect(page.url().includes('/academy')).toBeTruthy();
  });

  const academyResources = [
    {
      resourceName: 'Branches',
      basePath: ROUTES.academy.branches,
      createFields: { name: 'E2E Branch', code: 'E2EBR' },
      editFields: { name: 'E2E Branch Updated' },
    },
    {
      resourceName: 'Batches',
      basePath: ROUTES.academy.batches,
      createFields: { name: 'E2E Batch', code: 'E2EBA' },
      editFields: { name: 'E2E Batch Updated' },
    },
    {
      resourceName: 'Students',
      basePath: ROUTES.academy.students,
      createFields: { first_name: 'E2E Academy Student', email: 'e2estudent1@test.com' },
      editFields: { first_name: 'E2E Academy Student Updated' },
    },
    {
      resourceName: 'Attendance',
      basePath: ROUTES.academy.attendances,
      createFields: { remarks: 'Test Attendance' },
      editFields: { remarks: 'Updated Attendance' },
    },
    {
      resourceName: 'Fees Management',
      basePath: ROUTES.academy.fees,
      createFields: { amount: '1000' },
      editFields: { amount: '1500' },
    },
    {
      resourceName: 'Event Fees',
      basePath: ROUTES.academy.eventFees,
      createFields: { amount: '500' },
      editFields: { amount: '750' },
    },
    {
      resourceName: 'Events',
      basePath: ROUTES.academy.events,
      createFields: { name: 'E2E Sports Tournament', location: 'Main Ground' },
      editFields: { name: 'E2E Sports Tournament Updated' },
    },
    {
      resourceName: 'Academy Roles',
      basePath: ROUTES.academy.roles,
      createFields: { name: 'E2E Role' },
      editFields: { name: 'E2E Role Updated' },
    },
    {
      resourceName: 'Permissions',
      basePath: ROUTES.academy.permissions,
      createFields: { name: 'view_e2e' },
      editFields: { name: 'edit_e2e' },
    },
    {
      resourceName: 'Staff & Coaches',
      basePath: ROUTES.academy.users,
      createFields: { name: 'E2E Staff Member', email: 'e2estaff@test.com' },
      editFields: { name: 'E2E Staff Member Updated' },
    },
    {
      resourceName: 'Audit Logs',
      basePath: ROUTES.academy.audits,
      hasCreate: false,
      hasEdit: false,
      hasDelete: false,
    },
  ];

  for (const res of academyResources) {
    test(`Academy Panel - ${res.resourceName} CRUD Lifecycle`, async ({ page }) => {
      const results = await testResourceCrudLifecycle(page, {
        module: 'Academy Panel',
        resourceName: res.resourceName,
        basePath: res.basePath,
        createFields: res.createFields,
        editFields: res.editFields,
        hasCreate: res.hasCreate !== false,
        hasEdit: res.hasEdit !== false,
        hasDelete: res.hasDelete !== false,
      });

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.error(`❌ [Academy Panel - ${res.resourceName}] Failures encountered:`, failures);
      }
      expect(failures.length, `Failures in ${res.resourceName}: ${JSON.stringify(failures)}`).toBe(0);
    });
  }
});
