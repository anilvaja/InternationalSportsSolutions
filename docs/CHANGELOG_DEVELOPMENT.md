# Development Changelog

## [Unreleased] - 2026-11-02

### Removed
- Legacy Laravel/Filament PHP codebase completely removed (-472 files, -58,318 lines of code).
- Removed `composer.json`, `composer.lock`, `phpunit.xml`, `artisan`, `vite.config.js`.
- Removed Laravel Vite plugins and devDependencies from `package.json`.

### Added
- **Security QA Remediation (Findings #1–#11):**
  - Granular `requirePermission` and `requireRole` middleware applied to all mutating `/api/academy/*` routes.
  - Explicit self-role escalation prevention in `PUT /api/academy/users/:id/role`.
  - Non-admin admin account and wildcard `['all']` role creation blocked.
  - Hardened `GET /api/academy/backup` to `academy_admin` only.
  - Sanitized `password_hash` out of student API payloads.
  - Synchronized demo staff accounts to central `academy_users_lookup`.
- **Facility & Equipment Management Module (Section 4):**
  - Tenant migration `027_comprehensive_facility_and_equipment_management.sql`.
  - Equipment CRUD, branch stock tracking, condition monitoring, issue/return checkout logs.
  - Automated unit test suite `tests/Unit/facility_and_equipment_management.test.mjs` (10 tests).
- **Automatic Employee Shift Checkout (Section 6):**
  - `src/services/shiftCheckoutService.js` with configurable grace period, threshold detection, `status = 'auto_closed'` tracking, audit logging, and payroll statement integration.
  - Added routes `GET/PUT /api/academy/shifts/policy` and `POST /api/academy/shifts/auto-checkout`.
  - Automated unit test suite `tests/Unit/automatic_shift_checkout.test.mjs` (5 tests).
- **Customizable Admission Checklist Templates (Section 9):**
  - Tenant migration `028_customizable_admission_checklist_templates.sql`.
  - Checklist template management API (`/api/academy/admission-checklist/templates`).
  - Auto-generation of checklist items upon inquiry admission conversion in `InquiryService`.
  - Automated unit test suite `tests/Unit/customizable_admission_checklist.test.mjs` (5 tests).
- **Organization Documents & Compliance Management (Section 16):**
  - Tenant migration `029_organization_documents_and_compliance.sql`.
  - Document registration for leases, insurance policies, equipment AMC, MOM, and resolutions.
  - Automatic expiry alerts computation endpoint `GET /api/academy/compliance/expiring-alerts`.
  - Automated unit test suite `tests/Unit/compliance_documents_and_expiry.test.mjs` (5 tests).
- **Batches Sample CSV Download (Section 12):**
  - Implemented `GET /api/academy/batches/sample-csv`.
- **My Staff Salary Overlap Bug Fix (Section 2):**
  - Fixed mobile/desktop responsive styles and historical month selector binding.

### Changed
- Standardized all `today` date computations on `DateUtils.getTodayDate('Asia/Kolkata')`.
- Total passing unit tests increased from 286 to **328 passed** (0 failures).
- Verified all 33 role-based Playwright E2E scenarios across all 9 roles with 100% pass rate.
