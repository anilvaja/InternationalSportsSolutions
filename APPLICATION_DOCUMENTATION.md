# Application Documentation — InternationalSportsSolutions

Last updated: 2026-07-30

## Purpose
A single consolidated reference document describing the entire application: architecture, key components, setup, common workflows, and refactor recommendations to help you plan and perform a safe refactor.

---

## 1. High-level Overview
- Name: InternationalSportsSolutions (project folder root)
- Framework: Laravel (PHP) with Filament/Livewire admin UIs
- Languages: PHP (backend), JavaScript (Vite, frontend assets)
- Testing: Pest / PHPUnit
- Packaging: Composer, NPM
- Dev tooling: Vite, artisan commands, various project scripts in `scripts/`

## 2. Tech Stack
- PHP 8.x (verify exact version in `composer.json` / `platform` config)
- Laravel (app structure, `artisan` commands)
- Filament (admin panels in `app/Filament`)
- Livewire / Blade UI components
- MySQL / MariaDB or other RDBMS (configured in `config/database.php` and `.env`)
- Queues: configured in `config/queue.php` (use Redis or database drivers)
- Storage: local, S3 (see `config/filesystems.php`)
- Frontend: Vite, Tailwind/CSS assets under `resources/`
- Tests: Pest (`tests/`)

## 3. Repository Layout (key folders)
- `app/` — Application code (Models, Http controllers, Services, Filament panels, Traits, Helpers, Notifications, Channels)
  - `app/Models` — Eloquent models
  - `app/Http` — Controllers, Middleware, Requests
  - `app/Services` — Domain/service layer (business logic)
  - `app/Filament` — Filament resources, panels (admin UI)
  - `app/Notifications` — Notification classes
  - `app/Channels` — Custom messaging channels (e.g., `SmsChannel.php`)
  - `app/Console/Commands` — Artisan custom commands
- `bootstrap/` — Laravel bootstrap files
- `config/` — Application configuration files
- `database/` — Migrations, seeders, factories
- `resources/` — Blade views, JS/CSS source
- `public/` — Publicly served assets
- `routes/` — Route definitions (`web.php`, `tenant.php`, `console.php`)
- `scripts/` — Helpers and test runners (`ui_test_runner.php`, `prepare_test_users.php`)
- `tests/` — Pest/PHPUnit tests
- `vendor/` — Composer dependencies

Files of interest:
- `composer.json` — PHP dependencies and scripts
- `package.json` / `vite.config.js` — Frontend tooling
- `phpunit.xml` — Test config
- `deploy.sh`, `update.sh` — Deployment helpers

## 4. Environment & Setup
Prerequisites:
- PHP (8.x)
- Composer
- Node.js + NPM/Yarn
- Database server (MySQL/MariaDB)

Common local setup commands:

```bash
composer install
cp .env.example .env
# fill .env values (DB, queue, storage, mail, etc.)
php artisan key:generate
php artisan migrate --seed
npm install
npm run dev
php artisan serve
```

Testing:

```bash
# Run tests with Pest (or phpunit)
./vendor/bin/pest
php artisan test
```

Deployment notes:
- `deploy.sh` and `update.sh` exist — inspect for provider-specific steps
- There are GoDaddy deployment guides in the repo (`GODADDY_DEPLOYMENT_GUIDE.md`, `GODADDY_TROUBLESHOOTING.md`) and other deployment docs
- Use built assets (`npm run build`) and ensure storage and permissions are correct on server

## 5. Architecture & Patterns
- The project uses Laravel MVC with an added service/domain layer under `app/Services`.
- Filament provides the admin UI; look for resources and pages inside `app/Filament`.
- Notifications use Laravel Notification system and custom SMS channels under `app/Channels`.
- Background jobs should use Laravel Queues; locate Jobs in `app/Jobs` (if present) or service classes dispatching jobs.
- Third-party integration wrappers likely live in `app/Services` or `app/Support`.

Recommended reading in repo to understand flow:
- [app/Http](app/Http)
- [app/Services](app/Services)
- [app/Filament](app/Filament)
- [routes/web.php](routes/web.php)

## 6. Database & Models
- Models live in `app/Models` and map to migrations in `database/migrations`.
- Seed data in `database/seeders` and factories in `database/factories`.
- Important domain models (examples): `Student`, `Academy`, `Attendance`, `Fee`, etc. (search `app/Models` to list all models).

## 7. Notifications & Channels
- Notifications: `app/Notifications` contains mail and in-app notifications.
- SMS channel: `app/Channels/SmsChannel.php` indicates custom SMS sending logic.
- Ensure secrets and provider credentials are in `.env` and not committed.

## 8. Filament (Admin Panel)
- Filament resources and pages are under `app/Filament`.
- Look for Resources, Pages, Widgets used to build academy/central panels.
- Filament typically uses Resource classes that map to Models — these are good refactor touchpoints if UIs require decoupling.

## 9. Testing Strategy
- Tests under `tests/Feature` and `tests/Unit`.
- Uses Pest helpers (see `tests/Pest.php`) and `TestCase.php` bootstrapping.
- Recommendations: add end-to-end coverage for critical flows (registration, payments, attendance), and use factories for test data.

## 10. Scripts & CI helpers
- `scripts/` contains UI test runners and test preparation scripts.
- Check `package.json` and Composer scripts for any automation tasks.

## 11. Security & Config
- Ensure secrets in `.env` are not committed; verify `.gitignore` covers storage and env files.
- Keep `APP_KEY`, `DB_*`, `MAIL_*`, `SMS_*` secure in deployment environments.
- Ensure correct file/directory permissions for `storage/` and `bootstrap/cache` on deployment.

## 12. Common Refactor Opportunities
These are common improvements and places to consider refactoring first (safer, high ROI):

- Extract and define clear service interfaces
  - Move business logic out of Controllers into `app/Services`.
  - Add interfaces for services and bind them in a service provider for easier testing/mocking.

- Improve Test Coverage
  - Add unit tests for service classes and integration tests for major flows.
  - Ensure factories and seeders provide realistic test data.

- Reduce Fat Models / Controllers
  - Move complex query logic into Repository or Query classes.
  - Use Eloquent Scopes for repeated query patterns.

- Decouple Filament UI from core logic
  - Keep Filament Resources thin (calls to Services), to allow reusing domain logic elsewhere.

- Queue & Job Reliability
  - Ensure long-running tasks use Jobs with idempotency and retry handling.
  - Move external API calls into Jobs or Services with retry/backoff.

- Configuration & Secrets
  - Centralize config keys under `config/` and avoid sprinkling `env()` calls across classes.

- Performance
  - Add caching for expensive queries (use Redis)
  - Eager-load relationships where N+1 queries exist

## 13. Suggested Safe Refactor Plan
1. Add or update unit tests around the small surface you plan to change.
2. Extract logic to a service with an interface. Bind interface in a provider.
3. Run tests and fix regressions.
4. Replace usage sites with the new service.
5. Repeat for the next slice.

This "strangler" approach keeps changes small and reversible.

## 14. Where to Start (Suggested Priorities)
- Critical bugs / security fixes
- Tests for core domain (students, payments, attendance)
- Extract payment and notification logic to services with clear interfaces
- Decouple Filament resources by introducing thin adapters to services

## 15. Useful Commands & Shortcuts
- Run migrations: `php artisan migrate`
- Seed DB: `php artisan db:seed`
- Run tests: `./vendor/bin/pest` or `php artisan test`
- Generate key: `php artisan key:generate`
- Queue worker: `php artisan queue:work`
- View route list: `php artisan route:list`

## 16. Where to Look for Hard-coded or Risky Code
- Search for `env(` usage inside app code (should be in config files only)
- Look for `DB::raw`, complex raw SQL in controllers
- External API keys or credentials committed accidentally

## 17. Next Steps / Action Items
- Run a static grep to list top-level models, services, and Filament resources.
- Create a short list of 5 highest-risk modules to refactor first.
- Add missing unit tests around the primary business flows.

---

## Appendix A — Quick repo pointers
- Filament admin: [app/Filament](app/Filament)
- Services: [app/Services](app/Services)
- Models: [app/Models](app/Models)
- Routes: [routes/web.php](routes/web.php)
- Scripts: [scripts](scripts)
- Tests: [tests](tests)


---

If you want, I can:
- Produce a generated checklist of the top 10 files to inspect for refactor.
- Run a quick code scan (list models, services, controllers) and attach findings.
- Create PR-ready patches for the first refactor slice (with tests).

Would you like me to (choose one):
- generate the top-10 file checklist,
- run a repo scan to list models/services/controllers,
- or start extracting a specific service now? 
