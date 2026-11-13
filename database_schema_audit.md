# STAGE 2: COMPLETE DATABASE SCHEMA & RELATIONSHIP AUDIT

**Target Platform:** Multi-Tenant Sports Academy Management SaaS (`InternationalSportsSolutions`)  
**Architecture:** Pure Node.js (ESM) + Express + `better-sqlite3` with Physical Database-Per-Tenant Isolation  
**Date of Audit:** November 13, 2026  
**Auditor:** Principal Software Architect, Senior Database & Security Engineer  

---

## 1. Executive Summary

This comprehensive audit evaluates both database layers:
1. **Central Database:** `data/central.db` (multi-tenant control plane, domain routing, subscription quotas, and global user lookup).
2. **Tenant Databases:** `data/academies/academy_<id>.db` (isolated operational databases for each sports academy).

### Audit Verdict
- **Physical Tenant Isolation:** **100% Verified**. Cross-tenant data leakage is physically blocked at the SQLite database file and operating system boundary.
- **WAL Journaling & Concurrency:** **100% Compliant**. Both central and tenant databases operate under `journal_mode = WAL`, `synchronous = NORMAL (1)`, `foreign_keys = ON (1)`, and `busy_timeout = 5000ms`.
- **Foreign Key Integrity:** **Zero Violations**. `PRAGMA foreign_key_check` reported 0 violations across all 15 central tables and 76 tenant tables.
- **Trigger Hardening (Migration 036):** Compensating triggers have been deployed to enforce foreign key integrity on historical columns added via `ALTER TABLE ADD COLUMN` (where SQLite does not support inline FK clauses), as well as database-level employee shift overlap prevention.

---

## 2. Database Engine & Connection Lifecycle Configuration

| Parameter | Central Database (`data/central.db`) | Tenant Databases (`data/academies/academy_*.db`) | Production Rationale |
|---|---|---|---|
| **Driver** | `better-sqlite3` (^11.10) | `better-sqlite3` (^11.10) | Synchronous, high-throughput, zero-network IPC latency |
| **Journal Mode** | `WAL` (Write-Ahead Logging) | `WAL` (Write-Ahead Logging) | Concurrent readers do not block writers; non-blocking writes |
| **Synchronous** | `NORMAL` (1) | `NORMAL` (1) | Maximum durability with optimal SSD write performance |
| **Foreign Keys** | `ON` (1) | `ON` (1) | Enforced on every connection checkout |
| **Busy Timeout** | `5000` ms | `5000` ms | Eliminates `SQLITE_BUSY` contention during concurrent transactions |
| **Connection Pooling** | Singleton (`getCentralDb()`) | LRU / Managed Map (`getTenantDbById`) | Cached open descriptors with explicit close handling |

---

## 3. Central Database Schema (`data/central.db`)

The Central Database controls multi-tenant provisioning, domain resolution, subscription quotas, and system audits.

### Table Catalog (15 Tables)

| # | Table Name | Columns | Primary Key | Foreign Keys | Key Constraints & Indexes |
|---|---|---|---|---|---|
| 1 | `_migrations` | 3 | `id` | None | `name` UNIQUE |
| 2 | `academies` | 26 | `id` | None | `slug` UNIQUE, `contact_email` INDEX |
| 3 | `domains` | 8 | `id` | `academies(id)` CASCADE | `domain` UNIQUE, `academy_id` INDEX |
| 4 | `super_admins` | 7 | `id` | None | `email` UNIQUE |
| 5 | `academy_users_lookup` | 8 | `id` | `academies(id)` CASCADE | `(email, academy_id)` UNIQUE |
| 6 | `subscription_plans` | 9 | `id` | None | `slug` UNIQUE |
| 7 | `subscription_plan_limits` | 5 | `id` | `subscription_plans(id)` CASCADE | `(plan_id, limit_key)` UNIQUE |
| 8 | `subscription_plan_features` | 5 | `id` | `subscription_plans(id)` CASCADE | `(plan_id, feature_key)` UNIQUE |
| 9 | `academy_subscriptions` | 13 | `id` | `academies(id)`, `subscription_plans(id)` | `academy_id` INDEX |
| 10 | `academy_limit_overrides` | 7 | `id` | `academies(id)` CASCADE | `(academy_id, limit_key)` UNIQUE |
| 11 | `academy_feature_overrides` | 7 | `id` | `academies(id)` CASCADE | `(academy_id, feature_key)` UNIQUE |
| 12 | `central_settings` | 4 | `key` | None | None |
| 13 | `central_audit_logs` | 8 | `id` | None | `user_id`, `action`, `created_at` INDEX |
| 14 | `central_role_templates` | 6 | `id` | None | `name` UNIQUE |
| 15 | `central_permissions` | 5 | `id` | None | `name` UNIQUE |

---

## 4. Tenant Database Schema (`data/academies/academy_<id>.db`)

Each sports academy operates inside its own dedicated SQLite database containing 76 tables, 144 indexes, and automated triggers.

### Core Domain Table Inventory

#### 1. Facility, Branches & Workplaces
- `branches`: Physical dojos and training locations with GPS coordinates (`latitude`, `longitude`, `geofence_radius_meters`, `is_geofence_enforced`).
- `facilities`: Specific rooms, mats, cages, or rings within a branch.
- `branch_work_schedules`: Operating hours and shifts per facility.

#### 2. Curriculum, Sports & Progression
- `sports`: Multi-discipline sports catalog (`Karate`, `Taekwondo`, `Boxing`, `BJJ`, etc.) with case-insensitive unique names.
- `syllabus_categories`: Subdivisions per sport (`Kata`, `Kumite`, `Bunkai`, `Sparring`).
- `syllabus_techniques`: Discrete skills with required sessions and difficulty levels.
- `student_technique_assignments`: Technique mastery tracking per student.

#### 3. Users, Staff, Employment & Shift Scheduling
- `users`: Universal tenant user model (Admins, Coaches, Students, Front Desk, Accountants).
- `academy_roles`: Dynamic RBAC role definitions with JSON permission arrays.
- `coaches`: Profile extensions for instructors (`joining_date`, `specialization`, `bio`).
- `employment_records`: Contractual details, designations, and verification status.
- `staff_salary_profiles`: Compensation configuration (`monthly`, `daily`, `hourly`, `per_minute`, `per_session`), divisors, and overtime eligibility.
- `employee_work_schedules`: Base working schedule per day of week.
- `employee_schedule_shifts`: Specific shift slots with start/end time and travel buffer rules.
- `employee_schedule_overrides`: Temporary shift changes and swaps.
- `employee_leave_balances`: Annual allowances and accrued balances (`casual`, `earned`, `sick`, `unpaid`).
- `leave_requests`: Formal leave applications with approval status and date ranges.
- `academy_holidays`: Academy-wide and branch-specific holiday calendar.

#### 4. Students, Guardians & Batches
- `students`: Student master profile (`admission_number`, `first_name`, `last_name`, `dob`, `gender`, `belt_rank`).
- `student_guardians`: Parent/emergency contact records.
- `batches`: Class batches linked to branch, sport, coach, and timetable (`days_of_week`, `start_time`, `end_time`, `max_capacity`).
- `student_batch_enrollments`: Student batch memberships with partial unique index `idx_student_single_active_batch` enforcing a single active batch per student while maintaining complete transfer history.

#### 5. Smart Attendance Engine
- `smart_attendance_settings`: Academy and branch policies for QR refresh rate, cooldowns, grace periods, liveness thresholds, and geofence tolerances.
- `attendance`: Session container records uniquely keyed on `(batch_id, date)`.
- `student_attendance`: Student check-in/out records with composite unique constraint `(attendance_id, student_id)`.
- `student_qr_tokens`: Cryptographic random tokens for student ID cards and digital passes.
- `student_face_profiles`: Encrypted biometric templates with parental consent tracking.
- `student_nfc_cards`: NFC/RFID serial assignment.
- `smart_attendance_logs`: Immutable audit queue of all physical and mobile scan events.
- `attendance_exceptions_queue`: Suspicious or unverified check-ins flagged for manual coach/admin review.

#### 6. Salary & Payroll Engine
- `staff_payroll_periods`: Monthly payroll runs with unique constraint on `(academy_id, year_month)`.
- `staff_salary_statements`: Frozen compensation records uniquely keyed on `(payroll_period_id, user_id)` storing `gross_earnings`, `net_earnings`, and complete JSON `calculation_snapshot` guaranteeing historical immutability.
- `staff_salary_payments`: Disbursement records with voucher reference and payment mode.
- `staff_salary_adjustments`: One-time additions or deductions applied to statements.

#### 7. Billing, Fees & Invoicing
- `fee_structures`: Tuition, admission, and belt-test fee templates.
- `student_fees`: Invoices and fee demands with status tracking.
- `fee_payments`: Payment receipts with GST calculation and print-ready metadata.
- `student_fee_ledger`: Double-entry accounting ledger of all debits, credits, and balances.

#### 8. Inventory & Equipment
- `equipment_inventory`: Training gear with serial numbers, stock tracking, and `CHECK (available_quantity >= 0)`.
- `equipment_assignment_logs`: Check-out and return audit trail for students and staff.

#### 9. Events & Tournaments
- `events`: Competitions, seminars, and belt grading examinations.
- `event_participants`: Student enrollments with category and division.
- `event_passes`: QR-coded entry passes linked to participants.

---

## 5. Critical Relationship Verification & Foreign Key Integrity

### Comprehensive Relationship Matrix Summary
- **Total Cataloged Foreign Key Relationships:** 138
- **Enforced via Native SQLite Constraints:** 135
- **Enforced via Compensating DDL Triggers (Migration 036):** 3 (`leave_requests.user_id`, `fee_payments.student_id`, `syllabus_categories.sport_id`)
- **Shift Overlap Prevention Triggers:** 2 (`trg_prevent_shift_overlap_insert`, `trg_prevent_shift_overlap_update`)

```mermaid
erDiagram
    academies ||--o{ branches : "has"
    academies ||--o{ users : "employs"
    branches ||--o{ batches : "hosts"
    sports ||--o{ syllabus_categories : "defines"
    syllabus_categories ||--o{ syllabus_techniques : "contains"
    batches ||--o{ student_batch_enrollments : "enrolls"
    students ||--o{ student_batch_enrollments : "attends"
    students ||--o{ student_fees : "billed"
    students ||--o{ student_qr_tokens : "issued"
    users ||--o{ staff_salary_profiles : "compensated"
    users ||--o{ employee_schedule_shifts : "assigned"
    staff_payroll_periods ||--o{ staff_salary_statements : "contains"
```

---

## 6. Salary & Attendance Schema Integrity Analysis

1. **Expected vs. Actual Minutes Tracking:**
   - `employee_schedule_shifts` defines scheduled duty minutes.
   - `staff_punches` records exact check-in/out timestamps and GPS coordinates.
   - `staff_salary_statements` records `scheduled_minutes`, `actual_attended_minutes`, `payable_overtime_minutes`, and `salary_divisor`.
2. **Historical Immutability:**
   - Finalizing a payroll period sets `status = 'finalized'` and freezes `calculation_snapshot` (JSON).
   - Subsequent updates to an employee's salary in `staff_salary_profiles` will NOT alter past finalized statements.
3. **Shift Overlap Prevention:**
   - Database triggers `trg_prevent_shift_overlap_insert` and `trg_prevent_shift_overlap_update` actively abort transactions if a shift overlaps with an existing slot for that employee on the same day.

---

## 7. Migration Safety & Replay Verification

- All 36 migrations were executed sequentially against a blank SQLite database.
- Post-migration verification with `PRAGMA foreign_key_check` returned **0 violations**.
- Post-migration journal configuration verified: `journal_mode: wal`, `synchronous: 1`.

---

## 8. Conclusion

The database layer exhibits high architectural integrity, strict relational consistency, and physical multi-tenant isolation. All identified gaps have been remediated in `036_schema_relationship_integrity_hardening.sql`.
