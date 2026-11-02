# Node.js Architecture Specification

**Project:** International Sports Solutions — Multi-Tenant Sports SaaS  
**Architecture:** Pure Node.js (ES Modules) + Express + Dedicated SQLite Per Tenant  
**Date:** 2026-11-02  

---

## 1. Core Principles

1. **Zero External Language Dependencies:** No PHP, Composer, or Artisan required. A clean clone requires only `npm install` and `npm start`.
2. **Physical Database-Per-Tenant Isolation:**
   - Central database (`data/central.db`) tracks tenant registration, domains, subscription plans, quotas, and super admin accounts.
   - Each sports academy has a dedicated physical SQLite database (`data/academies/academy_<id>.db`).
   - Cross-tenant data exfiltration is physically blocked at the database connection level.
3. **Role-Based Access Control (RBAC):**
   - Fine-grained permission keys (`view_students`, `assign_user_roles`, `delete_students`, `manage_facilities`, `manage_compliance`).
   - Self-role escalation protection (users cannot modify their own role).
   - Strict wildcard protection (non-admins cannot grant `['all']` permissions).
4. **Timezone Awareness & DD/MM/YYYY Calendar Handling:**
   - Database storage: Normalized ISO format `YYYY-MM-DD`.
   - Client and API layer: Standardized Indian calendar format `DD/MM/YYYY`.
   - Date utilities: `src/utils/dateUtils.js` using `Asia/Kolkata` timezone.

---

## 2. Directory Structure

```
InternationalSportsSolutions/
├── .agents/
│   ├── AGENTS.md                         # Architecture guidelines & agent rules
│   └── complete-node-rebuild.md          # 24-Hour Master Specifications
├── data/
│   ├── central.db                        # Central platform SQLite database
│   └── academies/
│       └── academy_*.db                  # Tenant-specific SQLite databases
├── docs/                                 # Migration, architecture & QA documentation
├── public/
│   ├── index.html                        # Main SPA frontend application
│   ├── pay.html                          # Public fee payment & receipt portal
│   ├── css/style.css                     # Responsive styling & themes
│   └── js/app.js                         # Vanilla JS client logic
├── scripts/
│   ├── prepare_qa_role_accounts.js       # Syncs 9 operational QA role accounts
│   ├── run_migrations.js                 # Database migration runner
│   └── run_visual_headed_test.js         # Visual headed UI validation
├── src/
│   ├── config/                           # Environment & permission configuration
│   ├── db/
│   │   ├── centralDb.js                  # Central database initialization
│   │   ├── connectionManager.js          # Dynamic tenant DB connection manager
│   │   ├── migrator.js                   # Automated migration engine
│   │   ├── migrations/tenant/            # Tenant migrations 001–029
│   │   └── seed.js                       # Platform initialization seeder
│   ├── middleware/
│   │   └── auth.js                       # JWT, authenticateToken, requireRole, requirePermission
│   ├── routes/
│   │   ├── academyRoutes.js              # Academy management endpoints
│   │   ├── authRoutes.js                 # Authentication & profile endpoints
│   │   ├── centralRoutes.js              # Super Admin platform endpoints
│   │   ├── publicRoutes.js               # Public inquiries and online payment endpoints
│   │   ├── staffRoutes.js                # Staff operational endpoints
│   │   └── studentRoutes.js              # Student self-service portal endpoints
│   ├── services/
│   │   ├── attendanceScheduleService.js  # Batch attendance & session switching
│   │   ├── feeService.js                 # Fees, installment ledgers, receipts
│   │   ├── inquiryService.js             # Inquiries & admission conversions
│   │   ├── payrollService.js             # Fixed, hourly, shift & overtime payroll
│   │   ├── quotaService.js               # Subscription tier quota enforcement
│   │   ├── scheduleService.js            # Calendar & working schedules
│   │   ├── shiftCheckoutService.js       # Auto-checkout threshold service
│   │   └── userService.js                # User & staff profile management
│   └── utils/
│       └── dateUtils.js                  # IST & DD/MM/YYYY date utilities
├── storage/                              # Uploaded media & database backups
├── tests/
│   ├── Unit/                             # 328 Node.js native unit tests
│   └── qa/                               # Playwright role QA suite (33 scenarios)
├── package.json
└── server.js                             # Express application server
```

---

## 3. Migration History (Tenant Schema)

- `001–026`: Core schema (sports, syllabus, batches, students, attendance, payroll, fees, inventory, leaves, holidays).
- `027_comprehensive_facility_and_equipment_management.sql`: Facility inventory, issue/return checkout logs, condition tracking.
- `028_customizable_admission_checklist_templates.sql`: Configurable admission checklist templates with dynamic inquiry conversion.
- `029_organization_documents_and_compliance.sql`: Agreements, insurance, certificates, equipment AMC, MOM, and expiry reminder alerts.

