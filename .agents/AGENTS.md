# Project Agent Rules & Customizations

## UI Testing Automation Guidelines

1. **Automated UI Testing Trigger**:
   - Whenever changes are made to Filament resources (`app/Filament/**`), Blade views (`resources/views/**`), or middleware, invoke the `ui-testing-agent` or run `php artisan test --filter=UiPanelTestingTest` to verify that no UI regressions or 403/500 errors were introduced.

2. **Panel Verification Standards**:
   - **Admin Panel (`/admin`)**: Must be accessible by Super Admin users (`is_super_admin = true`).
   - **Academy Panel (`/academy`)**: Must be accessible by active Academy users (`is_super_admin = false`, `academy_id` set, `status = active`).
   - **Student Panel (`/student`)**: Must be accessible by active Student accounts using `student` auth guard.

3. **Validation & Verification**:
   - Always run the UI test suite before declaring UI or access control tasks completed.
