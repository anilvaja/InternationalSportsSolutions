# Application Documentation — InternationalSportsSolutions

Last updated: 2026-07-31

## Purpose
This single document captures the current project structure, architecture, technology stack, development workflow, deployment guidance, and recommended next steps for the InternationalSportsSolutions application.

---

## 1. Project Summary
**InternationalSportsSolutions** is a Laravel 12 multi-tenant SaaS platform built with Filament 3. It targets academy and sports operations with separate panels for:
- **Central Admin** (`/admin`)
- **Academy Tenant** (`/academy`)
- **Student Portal** (`/student`)

The platform supports student management, fee collections, attendance tracking, room/facility scheduling, leave workflows, event management, and dynamic branding.

---

## 2. Technology Stack
### Backend
- PHP 8.2+
- Laravel 12.x
- `stancl/tenancy` ^3.9
- `spatie/laravel-permission` ^6.21
- `barryvdh/laravel-dompdf` ^3.1
- Filament ecosystem: `filament/filament`, `forms`, `tables`, `actions`, `widgets`, `infolists`, `notifications`
- Filament Spatie media library plugin

### Frontend
- Vite
- Tailwind CSS
- Axios
- Puppeteer Core for UI automation

### Dev tooling
- Composer
- Node.js / npm
- Pest PHP / PHPUnit
- Laravel Pint
- concurrently

---

## 3. Application Architecture
### Panel structure
- **Central Admin Panel** (`/admin`): super admin system settings, tenant creation, branding, user management, audit logs
- **Academy Panel** (`/academy`): tenant operational management for students, fees, attendance, rooms, leaves, events
- **Student Portal** (`/student`): student-facing self-service dashboard for attendance, fees, and progress

### Filament locations
- `app/Filament/CentralPanel/` — admin panel resources and pages
- `app/Filament/Academy/` — tenant panel resources, widgets, pages
- `app/Filament/Student/` — student portal pages

### Route files
- `routes/web.php` — public routes, print routes, academy route groups
- `routes/tenant.php` — tenant middleware and tenant-aware route bootstrap
- `routes/console.php` — artisan command routing

### Multi-tenancy
The app uses `stancl/tenancy` for tenant-aware routing, but tenant data protection is primarily enforced by manual query scoping. Most tenant-scoped models define `scopeForAcademy($query, $academyId)` and most Academy Filament resources override `getEloquentQuery()` to filter by `Auth::user()->academy_id`.

---

## 4. Repository Layout
### Key directories
- `app/` — application code
  - `app/Models`
  - `app/Filament`
  - `app/Http`
  - `app/Services`
  - `app/Support`
  - `app/Notifications`
  - `app/Channels`
  - `app/Console/Commands`
- `bootstrap/`
- `config/`
- `database/`
  - `migrations/`
  - `seeders/`
  - `factories/`
- `public/`
- `resources/`
  - `css/`
  - `js/`
  - `views/`
- `routes/`
- `scripts/`
- `storage/`
- `tests/`
- `.agents/`

### Important files
- `composer.json` — PHP dependencies and scripts
- `package.json` — frontend scripts and dev dependencies
- `vite.config.js` — front-end bundling config
- `phpunit.xml` — test runner config
- `APPLICATION_DOCUMENTATION.md` — consolidated project doc
- `.env.example` — environment template
- `deploy.sh`, `update.sh` — deployment helper scripts

---

## 5. Key Models and Data Entities
### Main domain models
- `Academy` — tenant organization data and subscription limits
- `Branch` — physical location or training branch
- `User` — super admins, academy admins, coaches, staff
- `Student` — student profiles
- `Coach` — coach and staff profiles
- `Batch` — batch/class/schedule entity
- `Attendance`, `StudentAttendance`, `BatchAttendance` — attendance logs
- `Fee`, `StudentFee`, `FeeStructure` — fees and installment records
- `AcademyRole`, `UserAcademyRole`, `AcademyPermission` — tenant role and permission schema
- `Setting` — system settings and dynamic branding
- `Audit` — audit trail records
- `OverdueFeeNotification` — overdue payment notifications

### Tenant scoping pattern
Tenant data isolation depends on model query scopes and Filament resource query overrides. A typical pattern is:
- `scopeForAcademy($query, $academyId)` on tenant models
- `getEloquentQuery()` override in Filament Academy resources with `->forAcademy(Auth::user()->academy_id)`

This is critical: a resource missing this override can leak data across academies.

---

## 6. Authorization and Permissions
### Permission architecture
- The project does not use `app/Policies`
- Filament resources instruct permission checks via static methods: `canViewAny()`, `canCreate()`, `canEdit()`, `canDelete()`
- Permission decisions are centralized in `App\Support\AcademyPermissionHelper`

### AcademyPermissionHelper
- Resolves permission names to IDs via `AcademyPermission`
- Combines role permissions with user-specific additional permissions stored in `user_academy_roles`
- Grants all permissions to super admins and academy admins
- Used by resources and widgets throughout `app/Filament/Academy`

### User-side permission checks
- `User::hasPermission()` checks role permissions and extra academy permissions
- `User::canAccessAcademy(Academy $academy)` ensures a user only accesses their own academy or is super admin
- `User::canAccessPanel(Panel $panel)` controls Filament panel access

---

## 7. Primary Features
### Business capabilities
- Dynamic branding and theme management
- Multi-tenant academy onboarding and management
- Student and guardian records
- Coach/staff management and certifications
- Batch and schedule management
- Attendance tracking with exports
- Fee management, installments, receipts, and overdue handling
- Leave requests and approvals
- Event registration and participant management
- Audit logs and reporting widgets

### UI and automation
- Public welcome page with live branding
- Filament-based admin, tenant, and student portals
- Native print routes for permissions, users, attendance, fees, and events
- CLI UI diagnostic runner: `php scripts/ui_test_runner.php`
- Workspace agent guidance in `.agents/`

---

## 8. Setup and Environment
### Requirements
- PHP 8.2+
- Composer
- Node.js 18.x+
- npm
- SQLite for local dev or MySQL/MariaDB in production

### Local setup
```bash
composer install
cp .env.example .env
php artisan key:generate
php -r "file_exists('database/database.sqlite') || touch('database/database.sqlite');"
php artisan migrate:fresh --seed
npm install
npm run dev
php artisan serve
```

### Common scripts
- `composer install`
- `npm install`
- `npm run dev`
- `npm run build`
- `composer run test`
- `php artisan migrate`
- `php artisan db:seed`
- `php artisan test`

---

## 9. Testing and QA
### Test types
- Feature tests under `tests/Feature`
- Unit tests under `tests/Unit`
- Pest PHP testing framework

### Important test suites
- `TenantIsolationTest` — academy boundary checks
- `UiPanelTestingTest` — Filament UI and panel rendering
- `FeeManagementTest` — payment and fee flow validation

### UI validation
- `php scripts/ui_test_runner.php` runs a CLI UI health check
- `npm run test:ui` and `npm run test:ui:headless` run Node-based UI automation

---

## 10. Deployment and Operations
### Deployment notes
- Build frontend assets before production
- Ensure `storage/` and `bootstrap/cache/` are writable
- Keep environment secrets out of source control
- Use `deploy.sh` / `update.sh` for deployment workflows
- Review GoDaddy-specific docs when deploying to that host

### Operational considerations
- Monitor tenant scoping and authorization
- Validate print routes and data exports
- Ensure cron/queue workers are configured for scheduled tasks and notifications

---

## 11. Agents and Workspace Workflow
### Agent files
- `.agents/AGENTS.md` — workspace rules and UI testing guidance
- `.agents/skills/application-agent/SKILL.md` — app development instructions
- `.agents/skills/ui-testing-agent/SKILL.md` — UI testing and diagnostics

### Recommended development workflow
1. Review existing code in the relevant area
2. Keep changes small and scoped
3. Run targeted tests
4. For UI-facing work, run the UI test runner
5. Document assumptions and changes

---

## 12. Recommended Improvements
### Immediate safety checks
- Audit all `app/Filament/Academy/Resources` for tenant query scoping
- Add tests for `AcademyPermissionHelper` and `User` permission methods
- Confirm `Routes/web.php` print routes do not expose unintended data

### Refactor priorities
- Extract repeatable business logic into `app/Services`
- Keep Filament resources thin and delegate to services
- Replace direct database logic in controllers with service/repository layers
- Avoid `env()` in code; use `config()` instead

---

## 13. Directory Reference
```text
InternationalSportsSolutions/
├── .agents/
│   ├── AGENTS.md
│   └── skills/
│       ├── application-agent/SKILL.md
│       └── ui-testing-agent/SKILL.md
├── app/
│   ├── Channels/
│   ├── Console/
│   ├── Exports/
│   ├── Filament/
│   │   ├── Academy/
│   │   ├── CentralPanel/
│   │   ├── Pages/
│   │   ├── Resources/
│   │   └── Student/
│   ├── Helpers/
│   ├── Http/
│   ├── Models/
│   ├── Notifications/
│   ├── Providers/
│   ├── Rules/
│   ├── Services/
│   ├── Support/
│   └── Traits/
├── bootstrap/
├── config/
├── database/
│   ├── factories/
│   ├── migrations/
│   └── seeders/
├── public/
├── resources/
│   ├── css/
│   ├── js/
│   └── views/
├── routes/
├── scripts/
├── storage/
├── tests/
└── vendor/
```

---

## 14. Final Notes
This document provides the full, current overview of the repository and the application. Use it as the reference for development, testing, deployment, and future refactor planning.

If you want, I can also generate a follow-up checklist of the top 10 files and components to inspect first for the next feature or refactor.
