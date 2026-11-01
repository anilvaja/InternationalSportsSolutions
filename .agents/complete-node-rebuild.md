## Additional Mandatory Task: Remove Laravel and Retain Only the Node.js Project

### Objective
Our current Git branch may contain Laravel/PHP-based project files alongside our Node.js-based application.

We want to retain only the Node.js-based application as the active project. Remove all obsolete Laravel/PHP application code, dependencies, configurations, and references after carefully identifying them.

### Phase 1: Inspect the Current Branch
1. Identify the current Git branch and working-tree status.
2. Inspect the complete repository structure.
3. Identify:
   - The actual Node.js application and its entry points.
   - Laravel/PHP application directories and files.
   - PHP Composer dependencies and Laravel configurations.
   - Duplicate implementations of the same features.
   - Shared assets, documentation, database files, uploads, and environment configurations.
4. Identify which application currently runs and which one is the intended Node.js application.
5. Create a detailed removal plan before deleting anything.

### Phase 2: Protect Existing Work
1. Create a backup or dedicated Git checkpoint before modifications.
2. Do not overwrite uncommitted user changes.
3. Do not delete production databases, uploaded files, user records, receipts, or other business data.
4. Never delete files merely because they have a Laravel-related name; inspect their actual usage first.
5. Preserve all working Node.js functionality.

### Phase 3: Remove Laravel/PHP Completely
After confirming file ownership and dependencies, remove obsolete Laravel-related components, including:
- Laravel application directories.
- PHP controllers, models, middleware, providers and services.
- Laravel routes and Blade templates.
- PHP-specific migrations and seeders that are not needed by Node.js.
- Composer configuration and dependencies, if no longer required.
- Laravel-specific environment variables and configuration.
- Laravel-specific deployment scripts and build instructions.
- Obsolete Laravel-related documentation and duplicate implementations.

Search the entire repository for references to:
- Laravel
- PHP
- Composer
- Artisan
- Blade
- Eloquent
- Laravel-specific package dependencies and commands.

Remove obsolete references, but preserve historical documentation where deletion would destroy useful project history.

### Phase 4: Node.js-Only Architecture
1. Ensure the Node.js application is the sole active application.
2. Verify package.json, lockfile, scripts, dependencies and environment configuration.
3. Verify the database connection, authentication, authorization, storage and background jobs.
4. Ensure all required modules work through the Node.js implementation.
5. Remove duplicate or conflicting configurations.
6. Update README, installation instructions, development instructions and deployment documentation.
7. Ensure a new developer can clone the repository, install dependencies, configure the environment and run the application without installing PHP or Laravel.

Do not rewrite working Node.js modules unnecessarily.

### Phase 5: Full Verification
Perform actual verification after cleanup:

- Install dependencies from the Node.js lockfile.
- Run linting and type checking where configured.
- Run database migrations safely.
- Run unit and integration tests.
- Start the Node.js application.
- Verify all important pages through the browser.
- Test authentication and every role.
- Test permissions, CRUD operations, reports, exports, imports and financial calculations.
- Check for missing files, broken imports, missing environment variables and runtime errors.
- Verify that no active application functionality depends on Laravel/PHP.

### Phase 6: Final Acceptance Criteria

Do not mark this task complete until:

1. The Node.js application builds and starts successfully.
2. All required application modules work.
3. No active Laravel/PHP application code or dependencies remain.
4. No broken imports or obsolete Laravel commands remain in active scripts.
5. Database records and existing user data are preserved.
6. Browser-based verification passes.
7. Existing automated tests pass or documented pre-existing failures are resolved.
8. Documentation describes the Node.js-only architecture.

### Required Deliverables
Update:
- docs/TECHNOLOGY_MIGRATION_REPORT.md
- docs/REMOVED_LARAVEL_FILES.csv
- docs/NODEJS_ARCHITECTURE.md
- docs/BUG_TRACKER.csv
- docs/TEST_EXECUTION_LOG.md

For every removed file, record its original path, reason for removal and verification that it was not required by the Node.js application.

**Important:** Node.js-only means the active application must not require Laravel or PHP. Do not claim success merely because Laravel folders have been deleted. Prove that the remaining Node.js application works independently.


# MANDATORY: CONTINUOUS 24×7 DEVELOPMENT, TESTING, REWORK & ZERO-REGRESSION PROTOCOL

## 1. Primary Objective

Work continuously on the current Node.js-based project for the authorized 24-hour execution window.

Your responsibilities include:

- Analyse the entire application.
- Understand existing architecture and business logic.
- Identify missing requirements and defects.
- Improve existing modules where justified.
- Develop missing functionality.
- Test every implementation through the actual application UI.
- Fix identified defects.
- Retest fixes.
- Perform regression testing.
- Repeat this cycle until all achievable requirements are verified.

Do not stop after completing an initial audit or implementing the first round of fixes.

Continue the analysis → development → testing → correction → regression cycle throughout the execution window.

## 2. Highest Priority: Zero Regression

Existing correctly working functionality must not be disturbed.

Before changing any existing feature:

1. Understand how it currently works.
2. Identify all related modules, database relationships, permissions and dependencies.
3. Record its existing behaviour.
4. Create or identify regression test scenarios.
5. Understand what other modules might be affected.
6. Implement the smallest safe change that satisfies the requirement.
7. Verify both the modified functionality and related existing functionality.

Never rewrite a working module simply because a different implementation looks cleaner.

Never remove working functionality without explicit justification and approval.

Never change established business rules without confirming their impact.

**A new feature is not considered successful if it breaks an existing feature.**

## 3. Continuous Improvement Cycle

Repeat this complete cycle:

### Step A — Analyse
- Inspect requirements and existing implementation.
- Inspect frontend, backend, APIs, database and relationships.
- Identify incomplete functionality.
- Identify incorrect calculations and business rules.
- Identify permission and security problems.
- Identify UI/UX issues.
- Identify performance and reliability problems.

### Step B — Prioritise
Classify issues:

- P0: Data loss, security vulnerability, cross-academy data access, serious financial corruption.
- P1: Incorrect salary, fees, attendance, permissions or core business functionality.
- P2: Broken workflows, missing functionality and important usability problems.
- P3: UI improvements, performance improvements and minor enhancements.

Fix P0 and P1 before cosmetic improvements.

### Step C — Develop
- Implement one logically related improvement at a time.
- Follow existing Node.js project architecture.
- Reuse established components and services.
- Avoid unnecessary dependencies.
- Validate inputs on the server.
- Use transactions for financial and multi-record operations.
- Apply authorization on both UI and backend.
- Maintain audit trails for important changes.
- Preserve existing database records.

### Step D — Test
Test:
- Actual browser UI.
- Backend APIs.
- Database persistence.
- Validation and error handling.
- Authentication and permissions.
- Role-specific workflows.
- Desktop and mobile layouts.
- Related modules and integrations.

Do not rely exclusively on unit tests or automated scripts.

### Step E — Fix
For every failure:
1. Record the issue.
2. Reproduce it.
3. Identify its root cause.
4. Fix the root cause rather than hiding the symptom.
5. Retest the original scenario.
6. Test related scenarios.
7. Run regression tests.

### Step F — Repeat
Return to Step A and identify the next highest-priority improvement.

Do not declare a module complete just because its primary screen opens.

## 4. Strict Change Management

Use the following rules:

- Maintain Git checkpoints after meaningful stable milestones.
- Keep a clean distinction between verified and unverified changes.
- Never silently discard user changes.
- Do not run destructive database commands.
- Do not reset databases containing useful records.
- Do not replace existing working modules unnecessarily.
- Do not change production configuration without authorization.
- Do not introduce breaking schema changes without migration and rollback planning.
- Do not weaken permissions to make tests pass.
- Do not use fake data to conceal incorrect calculations.
- Do not suppress errors instead of fixing them.

For every significant change, record:
- What changed.
- Why it changed.
- Files affected.
- Modules affected.
- Database changes.
- Potential regression risks.
- Test scenarios executed.
- Test results.

## 5. Existing Behaviour Protection

Create a baseline of important existing workflows before major changes.

Examples:

- Login, logout and password recovery.
- Academy and branch access.
- User management and role assignment.
- Student admission and inquiry conversion.
- Batch management.
- Attendance and attendance adjustment.
- Salary calculations and staff shifts.
- Fees, concessions and receipts.
- Inventory.
- Events and event attendance.
- Reports and exports.
- Documents and compliance.
- Notifications and reminders.

For each workflow, record its expected behaviour and test it after relevant changes.

If an existing feature fails after a change:
- Mark the change as a regression.
- Investigate immediately.
- Correct it before proceeding to unrelated improvements, unless blocked by a higher-priority security or data-integrity issue.

## 6. Continuous Role-Based UI Testing

Use actual browser sessions for every applicable role.

Verify:
- Correct login and logout.
- Correct dashboard.
- Correct navigation.
- Correct module visibility.
- Correct record-level access.
- Correct branch and academy restrictions.
- Correct create, view, edit and delete permissions.
- Correct import, export and download permissions.
- Correct approvals and rejections.
- Correct direct URL access restrictions.
- Correct backend authorization.

A hidden button does not prove that permission enforcement works.

Test unauthorized direct URL and API access as well.

## 7. Financial and Data Accuracy

Financial functionality must receive special attention.

Reconcile:
- Attendance against salary.
- Shifts against working hours.
- Leave and holidays against salary.
- Overtime against approval.
- Fees against payment records.
- Discounts against fee rules.
- Receipts against actual payments.
- Inventory issues against stock.
- Reports against database totals.

Verify calculations with independently calculated expected values.

Never mark financial functionality verified based solely on the absence of an error message.

## 8. Continuous Test and Bug Tracking

Maintain these files throughout the task:

- docs/QUALITY_ASSURANCE_MASTER_REPORT.md
- docs/BUG_TRACKER.csv
- docs/FEATURE_VERIFICATION.csv
- docs/TEST_EXECUTION_LOG.md
- docs/REGRESSION_TEST_MATRIX.csv
- docs/CHANGELOG_DEVELOPMENT.md
- docs/CONTINUOUS_WORK_CHECKPOINT.md

Every bug must have:
- Unique ID.
- Module.
- Severity.
- Reproduction steps.
- Expected result.
- Actual result.
- Root cause.
- Fix applied.
- Retest result.
- Regression result.
- Evidence or screenshot where applicable.

Use these statuses:

- Not Started
- Analysing
- In Progress
- Fixed – Pending Retest
- Retested – Passed
- Failed – Reopened
- Blocked
- Verified Complete

Never mark something Verified Complete without evidence.

## 9. 24-Hour Execution and Recovery

Use the authorized 24-hour execution window as follows:

- Initial phase: Repository discovery, Node.js consolidation and baseline.
- Next phase: Architecture, permissions and security.
- Next phase: Attendance, salary, shifts and financial calculations.
- Next phase: Students, admissions, batches and fees.
- Next phase: Inventory, events, holidays and compliance.
- Next phase: UI/UX and reports.
- Final phase: Full regression, role-based verification and final documentation.

However, do not stop testing merely because a phase has ended.

If a new regression is discovered, return to the affected module.

Maintain a persistent checkpoint containing:
- Last completed task.
- Current task.
- Remaining tasks.
- Current Git branch and commit.
- Last stable checkpoint.
- Current failures.
- Pending retests.
- Next exact action.

If the IDE, agent, computer or execution session stops, resume from the checkpoint without repeating completed work unnecessarily.

Do not claim background execution if the agent is no longer running.

## 10. Completion Criteria

A module is complete only when:

1. Its stated requirements are implemented.
2. Its UI works.
3. Its backend works.
4. Its data is correctly saved and retrieved.
5. Its permissions work for authorised and unauthorised users.
6. Its calculations and business rules are verified.
7. Its relevant regression tests pass.
8. Its errors are handled properly.
9. Its test evidence is documented.

At the end of the 24-hour window, provide:
- Completed modules.
- Partially completed modules.
- Unresolved defects.
- Fixed and retested defects.
- Regressions discovered and resolved.
- Regression tests passed and failed.
- Security and permission findings.
- Financial calculation verification.
- Database integrity findings.
- Git changes and checkpoints.
- Remaining work with exact next steps.

## FINAL NON-NEGOTIABLE RULE

Your objective is not to make the maximum number of code changes.

Your objective is to deliver the most accurate, stable, secure and requirement-compliant Node.js application while preserving all existing correctly working behaviour.

Continue the development and verification cycle for the entire authorized execution period, within the available execution and resource limits.

Never sacrifice existing functionality for a new feature. Never sacrifice data integrity for speed. Never report unverified work as complete.


# MASTER PROJECT ASSIGNMENT – PRATIK KARATE ACADEMY / SPORTS ACADEMY SaaS

**Assigned to:** Antigravity AI Development Agent  
**Project owner:** Anil Sir  
**Development coordination:** Pratik  
**Maximum working window:** 24 continuous hours  
**Primary objective:** Complete application audit, requirements implementation, bug fixing, UI verification, regression testing and quality improvement.

---

# 1. YOUR MISSION

You are responsible for improving the entire existing Academy SaaS application.

Do not treat this as a request to implement a few new features.

Your responsibility is to:

1. Understand the complete existing application.
2. Inspect the current database schema and relationships.
3. Inspect every module and its actual functionality.
4. Compare existing implementation against all project requirements.
5. Identify missing, incomplete, incorrectly implemented and broken features.
6. Prepare a detailed bug and requirement report.
7. Fix issues systematically.
8. Verify every fix using the actual application UI.
9. Repeat testing until all identified issues are resolved or documented with a genuine blocker.
10. Improve usability, responsiveness, security and maintainability without breaking existing functionality.

**You have up to 24 hours. Use the entire available working window productively. Do not stop after completing the first round of fixes.**

Do not sacrifice correctness just to finish quickly.

# 2. FIRST: UNDERSTAND THE EXISTING PROJECT

Before modifying anything:

- Inspect the entire repository.
- Identify framework, Laravel version, PHP version, Filament version, database and frontend technologies.
- Inspect routes, controllers, models, migrations, services, policies, middleware, jobs and scheduled commands.
- Inspect all database relationships.
- Inspect all modules and navigation.
- Inspect existing automated tests.
- Inspect existing users, roles and permissions.
- Inspect existing academy and branch data.
- Inspect payroll and attendance calculations.
- Inspect existing deployment and environment configuration.

Create a project architecture report.

Do not rewrite existing modules unnecessarily.

Do not create duplicate tables, duplicate business logic or alternative implementations when an existing correct architecture can be extended.

Never expose production credentials or modify production data.

# 3. STRICT DATA AND TENANT RULES

The application must initially remain focused on Karate.

Required hierarchy:

Academy → Branches → Batches → Coaches / Staff / Students.

Rules:

- One branch belongs to one academy.
- One batch belongs to one branch.
- A student belongs to one academy and one current batch at a time.
- A staff member must have appropriate academy and branch assignments.
- Academy data must never leak to another academy.
- Branch administrators must only access authorized branches.
- Super Admin can manage multiple academies and subscription plans.

Use the existing academy named **Pratik Karate Academy** as the primary test academy.

Do not create unnecessary duplicate academies or tenants.

Do not delete existing records.

Create additional realistic test data only through a controlled, repeatable seeder or authorized preview-data mechanism.

Seed operations must be idempotent and must not duplicate existing records.

# 4. ROLES AND PERMISSIONS – COMPLETE AUDIT

Verify every role separately.

Expected roles include:

1. Super Admin
2. Academy Admin
3. Branch Admin
4. Branch Head Coach
5. Trainer / Coach
6. Other Staff
7. Student / Student Portal users, if supported.

Check permissions for every module and every action:

- View
- Create
- Edit
- Delete
- Restore
- Import
- Export
- Download
- Print
- Approve
- Reject
- Adjust
- Assign
- Manage
- Configure
- View reports

Important:

Permission must apply to both UI and backend.

Hiding a button is not sufficient.

Direct URL access, API calls, record IDs and unauthorized branch/academy data must also be protected.

Check:

- Unauthorized actions.
- Unauthorized records.
- Unauthorized financial information.
- Unauthorized salary information.
- Unauthorized student information.
- Permission inheritance.
- Role assignment restrictions.
- Permission changes and audit history.

Super Admin must manage subscription plans and academy-specific quotas.

Illustrative Standard plan limits:

| Resource | Limit |
|---|---:|
| Users | 10 |
| Branches | 2 |
| Batches | 10 |
| Students | 200 |
| Students per batch | 30 |
| Coaches/trainers | 5 |

These must be configurable plan limits, not hardcoded restrictions.

Dashboard login/logout must remain accessible to authorized application users.

# 5. USERS AND STAFF MANAGEMENT

Inspect and improve:

- User creation.
- Staff profiles.
- Role assignment.
- Branch assignment.
- Salary assignment.
- Compensation type.
- Shift assignment.
- Joining date.
- Employment status.
- Optional personal information.
- Education and qualifications.
- Address and contact details.
- Documents and photographs.
- Employment history.

Every salary or role change must record:

- Previous value.
- New value.
- Effective date.
- Changed by.
- Change timestamp.
- Reason for change.

A person who has not joined must not incorrectly appear as an active employee.

Display appropriate joining-date or Not Employed information.

# 6. STAFF COMPENSATION, SHIFTS AND PAYROLL

This is a high-priority financial module.

Support:

- Fixed monthly salary.
- Hourly salary.
- Per-minute salary.
- Employee-specific working hours.
- Multiple daily shifts.
- Paid leave.
- Unpaid leave.
- Holidays.
- Weekly off days.
- Absence deductions.
- Overtime.
- Salary adjustments.
- Advance payments.
- Salary payments.
- Monthly payslips.

Example:

An employee may work:

- 10 AM–12 PM.
- 4 PM–9 PM.

The system must calculate working time correctly across both shifts.

## Automatic employee logout / checkout

Implement configurable automatic shift-end handling.

Requirements:

1. Every employee can have assigned working shifts.
2. Each shift has start time and end time.
3. Admin can configure a grace period.
4. System identifies active attendance sessions.
5. At the configured shift-end threshold, automatically closes the attendance session where policy permits.
6. Record system-generated checkout separately from manual checkout.
7. Store scheduled end time, actual checkout time and automatic checkout reason.
8. Do not create duplicate checkout records.
9. Do not close another future shift.
10. Support overnight shifts if the application permits them.
11. Handle missed checkouts.
12. Maintain complete audit history.
13. Allow authorized admin corrections.
14. Recalculate salary correctly after approved corrections.

IMPORTANT:

Application session logout and attendance checkout are separate concepts.

Implement both separately. A user should not lose an attendance record simply because their browser session expires.

## Payroll verification

Test:

- Full attendance month.
- Partial attendance month.
- Employee joining mid-month.
- Employee leaving mid-month.
- Paid holidays.
- Unpaid holidays.
- Weekly off days.
- Absence.
- Leave.
- Overtime.
- Multiple shifts.
- Missing checkout.
- Attendance adjustments.

Salary should display the correct selected historical month, not an incorrectly reused previous month's data.

Implement provisional salary through the 25th and final salary after month-end, according to the existing business rules.

Investigate and fix the reported My Staff Salary overlap issue.

Verify all salary totals against manually calculated expected values.

# 7. ATTENDANCE MANAGEMENT

Regular student attendance must support:

A. Manual attendance.

B. QR-code/card attendance.

C. Student self-attendance with suitable restrictions and approval.

D. Photo capture attendance.

E. Face recognition as an optional future integration, subject to consent, privacy, accuracy and legal safeguards.

Do not confuse simple photo capture with automated face recognition.

Attendance rules:

- Students must appear according to their assigned batch.
- Prevent duplicate attendance.
- Correct batch/date association.
- Track Present, Absent and Leave.
- Maintain attendance history.
- Record who marked attendance.
- Record who modified attendance.
- Maintain adjustment reasons.
- Require approval for late attendance beyond the configured two-day limit.
- Academy Admin or Branch Admin may approve according to permissions.
- Support authorized batch changes.
- Do not silently overwrite attendance.

## Technique and syllabus progression

Relationship must be accurate:

Sports & Disciplines → Syllabus Categories → Syllabus Techniques.

Requirements:

- Ordered techniques.
- Reordering.
- Student's current technique level.
- Technique progression.
- Upgrade/downgrade.
- History of learned techniques.
- Attendance days.
- Technique-learning days.
- Coach changes during attendance.

Students in the same batch may have different technique levels.

Verify all calculations and historical records.

# 8. HOLIDAY CALENDAR

Implement academy-wise and branch-wise holiday configuration.

Examples:

- Dashera.
- Diwali.
- Uttarayan.
- Republic Day.
- Independence Day.

Support:

- Add.
- Edit.
- Delete.
- Recurring holidays.
- Paid holidays.
- Unpaid holidays.
- Branch-specific holidays.
- Holiday descriptions.
- Calendar display.

Ensure correct interaction with attendance and payroll.

# 9. ADMISSIONS AND INQUIRY MANAGEMENT

Verify:

- Add inquiry.
- Edit inquiry.
- Branch selection.
- Inquiry follow-up.
- Admission conversion.
- Student creation.
- Batch assignment.
- Fee assignment.
- Discount assignment.
- Admission documents.
- Customizable admission checklist.

Admission conversion must not duplicate students or fees.

Checklist items should be configurable instead of permanently hardcoded.

# 10. FEES AND CONCESSIONS

Verify:

- Monthly fees.
- Multiple-month fees.
- Batch-specific fees.
- Student-specific fees.
- Fixed discounts.
- Percentage discounts.
- Maximum discount of 20%, according to existing policy.
- Installment schedules.
- Due dates.
- Payment history.
- Pending amounts.
- Advance payments.
- Fee pauses.
- Dropout and rejoining.
- Authorized skip approvals.

Example:

A student paying for one month should receive the next installment date correctly.

Prevent incorrect overlapping fee periods.

Verify all financial calculations using manually calculated test examples.

# 11. RECEIPTS, INVOICES AND PDF

Verify previously marked Done items:

- Invoice heading removal.
- GST presentation/removal according to the approved requirement.
- Concession/discount calculations.
- Receipt printing.
- PDF generation.

Test:

- Correct student information.
- Correct academy information.
- Correct branch.
- Payment date.
- Receipt number.
- Amount.
- Discount.
- Remaining balance.
- Print layout.
- PDF layout.
- Duplicate receipt prevention.

Do not mark any item Done without actually testing its generated output.

# 12. BATCH CSV IMPORT

Implement a complete CSV import workflow.

Requirements:

1. Download sample CSV.
2. Upload CSV.
3. Validate column names.
4. Validate mandatory fields.
5. Validate branch and batch relationships.
6. Validate duplicate students.
7. Display import preview.
8. Show invalid rows and error reasons.
9. Allow correction and re-upload.
10. Import valid records safely.
11. Display import summary.
12. Maintain import history.

Do not create partial or duplicate student records because of an import failure.

# 13. EVENTS AND COMPETITIONS

Support:

- Academy tournaments.
- Inter-branch tournaments.
- School games.
- KMK.
- Karate examinations.
- Workshops.
- Training camps.

Event workflow:

1. Admin creates an event.
2. Selects category.
3. Selects eligible branches/batches/students.
4. Students respond Interested / Not Interested.
5. Admin confirms participants.
6. Event attendance is recorded separately.
7. QR/card scanning can be used for check-in.
8. Generate participant and attendance reports.

Regular class attendance and event attendance must never be mixed.

# 14. FACILITY AND EQUIPMENT MANAGEMENT

Implement branch-wise inventory.

Examples:

- Karate kits.
- Uniforms.
- Belts.
- Training equipment.
- Mats.
- Protective equipment.

Support:

- Categories.
- Equipment details.
- Stock quantity.
- Purchase cost.
- Supplier.
- Purchase date.
- Branch assignment.
- Stock transfers.
- Issue to student/staff.
- Issued by.
- Received by.
- Issue date.
- Return date.
- Damage/loss.
- Maintenance.
- Stock adjustment.
- Inventory reports.

Track who gave an item, whom it was given to, and its cost.

Apply proper academy and branch permissions.

# 15. DYNAMIC SPORTS AND ACTIVITY CATEGORIES

The initial product remains Karate-focused, but architecture must support other sports in the future.

Do not hardcode every activity.

Allow authorized admins to create categories and activities.

Examples:

- KMK.
- School Games.
- Inter-school competitions.
- Special programs.
- Other academy activities.

Records must be sorted according to the configured category order.

Maintain proper category relationships and permissions.

# 16. FACILITIES, DOCUMENTS AND COMPLIANCE

Review the existing system and add missing support where appropriate:

- Academy documents.
- Branch documents.
- Agreements.
- Certificates.
- Insurance.
- Equipment AMC.
- Compliance reminders.
- Expiry dates.
- Renewal notifications.
- Meeting records.
- AGM/MOM.
- Resolutions.

Provide reminders before expiry dates.

Do not invent legal compliance requirements. Configurable document tracking should be provided.

# 17. DASHBOARD AND USER EXPERIENCE

Review all dashboards.

Potential dashboard widgets:

- Total students.
- Active students.
- New admissions.
- Pending inquiries.
- Current fee dues.
- Upcoming fee dues.
- Today's batches.
- Today's attendance.
- Staff on leave.
- Staff birthdays.
- Student birthdays.
- Pending approvals.
- Payroll summary.
- Inventory alerts.
- Upcoming events.

Display only data the logged-in user is authorized to see.

Improve:

- Responsive layouts.
- Mobile navigation.
- Tables.
- Filters.
- Search.
- Pagination.
- Forms.
- Validation.
- Empty states.
- Error messages.
- Confirmation dialogs.
- Loading states.

Use dd/mm/yyyy consistently throughout the application, including date pickers, backend validation, display and exports.

Investigate the previously reported date-format-related save failures.

# 18. COMPLETE UI-BASED TESTING – MANDATORY

Do not rely only on unit tests, feature tests or API tests.

Use browser automation such as Playwright to interact with the actual running application.

For every relevant role:

1. Log in.
2. Open dashboard.
3. Navigate to each authorized module.
4. Test available actions.
5. Attempt unauthorized actions.
6. Verify record-level restrictions.
7. Create realistic records.
8. Edit them.
9. Verify saved results.
10. Verify calculations.
11. Verify print/PDF/download.
12. Log out.
13. Log in as the next role.

Test actual UI behavior.

A passing backend test does not prove that the user interface works.

Verify:

- All navigation links.
- All buttons.
- All dropdowns.
- All filters.
- All forms.
- All modal dialogs.
- All actions.
- All validation messages.
- All calculations.
- All approval workflows.
- All generated documents.

Use screenshots and browser evidence for important results.

# 19. BUG TRACKING AND RE-TESTING

Maintain a permanent working report inside the project, preferably:

`docs/QUALITY_ASSURANCE_MASTER_REPORT.md`

Also maintain:

`docs/BUG_TRACKER.csv`

`docs/FEATURE_VERIFICATION.csv`

`docs/TEST_EXECUTION_LOG.md`

Each bug must include:

- Unique ID.
- Module.
- User role.
- Steps to reproduce.
- Expected result.
- Actual result.
- Screenshot/evidence.
- Severity.
- Root cause.
- Fix applied.
- Retest result.
- Regression result.

Use these statuses:

- Not Started.
- In Progress.
- Fixed – Pending Retest.
- Retested – Passed.
- Failed – Reopened.
- Blocked.
- Verified Complete.

Never mark a bug fixed merely because code was changed.

# 20. THE 24-HOUR WORKING SCHEDULE

Use the available time as follows.

**Phase 1 – Hours 0–2: Discovery and Audit**

- Understand architecture.
- Inspect modules.
- Inspect database.
- Inspect permissions.
- Run existing tests.
- Start the application.
- Prepare the gap report.

**Phase 2 – Hours 2–5: Critical Bugs**

- Fix login issues.
- Fix permissions.
- Fix tenant isolation.
- Fix navigation.
- Fix salary display.
- Fix date handling.
- Fix existing Done items that fail verification.

**Phase 3 – Hours 5–10: Core Financial and Staff Features**

- Staff compensation.
- Shift management.
- Automatic checkout/logout.
- Payroll calculations.
- Salary history.
- Holiday calendar.
- Fee calculations.
- Receipt/PDF verification.

**Phase 4 – Hours 10–14: Academy Operations**

- Inquiry and admissions.
- Admission checklist.
- Batch CSV import.
- Student attendance.
- Attendance adjustment.
- Syllabus progression.
- Event attendance.

**Phase 5 – Hours 14–17: Additional Modules**

- Facility and equipment.
- Inventory.
- Dynamic categories.
- Documents and compliance.
- Dashboard improvements.

**Phase 6 – Hours 17–21: Full Regression Testing**

- Every role.
- Every module.
- Every permission.
- Every relevant UI action.
- Financial calculations.
- Attendance.
- Payroll.
- Import/export.
- PDF/print.
- Mobile and desktop layouts.

**Phase 7 – Hours 21–24: Final Improvement Cycle**

- Reopen all failed tests.
- Fix newly discovered bugs.
- Repeat failed scenarios.
- Check for regressions.
- Review database consistency.
- Prepare final delivery report.

This schedule is a guide, not permission to leave critical failures unresolved. Reprioritize based on actual findings.

# 21. CONTINUOUS IMPROVEMENT LOOP

This is the most important instruction.

Follow this cycle continuously:

AUDIT → IDENTIFY → PRIORITIZE → IMPLEMENT → TEST UI → VERIFY DATABASE → REGRESSION TEST → DOCUMENT → REPEAT.

For every issue:

1. Reproduce it.
2. Find its actual root cause.
3. Fix the root cause.
4. Test the original scenario.
5. Test related scenarios.
6. Test other relevant roles.
7. Check for regressions.
8. Update the report.

If a fix creates another problem, reopen the issue.

Do not hide errors, bypass validation or weaken permissions to make tests pass.

Do not delete failing tests just to achieve a green test suite.

# 22. IMPORTANT DEVELOPMENT RULES

- Preserve existing working functionality.
- Do not perform destructive database operations.
- Do not reset production databases.
- Do not remove existing users or records.
- Do not weaken authentication or authorization.
- Do not hardcode academy-specific assumptions into reusable modules.
- Do not introduce unnecessary dependencies.
- Do not duplicate existing business logic.
- Do not silently change financial calculations.
- Use database transactions for critical financial operations.
- Maintain audit logs.
- Add migrations safely.
- Follow existing project conventions.
- Keep code maintainable.
- Ensure date/time calculations use the correct configured timezone.
- Verify background jobs and scheduled tasks.
- Do not claim a feature is completed without evidence.

For any requirement that depends on an unresolved client decision, document the alternatives and do not silently choose a financially or operationally risky interpretation.

# 23. 24-HOUR AUTONOMOUS EXECUTION RULE

You must continue working on the project for the entire available 24-hour assignment window.

Do not stop because:

- The first implementation is complete.
- Existing automated tests pass.
- The main dashboard looks correct.
- One user role works.
- A feature page exists.
- No obvious errors are visible.

Continue searching for incomplete requirements, edge cases, incorrect calculations, permission gaps, UI issues and regressions.

If a task is blocked by missing client information, credentials, external hardware or unavailable services:

1. Document the blocker.
2. Complete all independent work.
3. Build a safe testable implementation where possible.
4. Add explicit pending acceptance criteria.
5. Continue with the next task.

Use checkpoints and preserve work after each major phase.

If the IDE or computer is about to sleep, prevent interruptions where permitted.

Do not assume that a prompt alone guarantees 24-hour execution. Keep the agent and required development environment running, with the necessary permissions and execution limits configured. If the agent stops or reaches a usage limit, save its state and resume from the latest checkpoint.

# 24. FINAL DELIVERY REQUIREMENTS

At the end of the assignment, provide:

1. Complete architecture report.
2. Complete feature comparison against requirements.
3. All verified Done items.
4. All fixed bugs.
5. All remaining bugs.
6. All blocked items and reasons.
7. All partially implemented features.
8. Role-wise permission verification.
9. UI testing results.
10. Payroll calculation verification with examples.
11. Attendance verification.
12. Fee and discount verification.
13. Database integrity results.
14. CSV import/export verification.
15. PDF/receipt verification.
16. Desktop and mobile verification.
17. Screenshots of important workflows.
18. List of changed files and migrations.
19. Deployment and migration instructions.
20. Exact final project status.

Every completed item must have supporting test evidence.

Do not report 100% completion if any mandatory requirement remains unimplemented, unverified or blocked.

# FINAL INSTRUCTION FROM ANIL SIR

Your goal is not merely to make the application look complete.

Your goal is to make it function like a reliable, production-ready Academy Management SaaS.

Think about how an actual academy owner, branch administrator, coach, trainer, employee and student will use the system every day.

Prioritize correctness, security, accurate financial calculations, proper attendance records, easy workflows and maintainable architecture.

**Continue auditing, developing, fixing, testing and improving until the 24-hour working window ends.**

At the end, deliver a truthful report of what is actually working, what has been verified and what still needs attention.

Do not fake completion. Do not skip testing. Do not stop after the first successful test.

**Start with a complete audit, then work continuously through the entire improvement cycle.**


 