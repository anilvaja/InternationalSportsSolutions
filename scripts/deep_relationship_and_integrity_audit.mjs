import { getCentralDb } from '../src/db/centralDb.js';
import { getTenantDbById } from '../src/db/connectionManager.js';
import fs from 'fs';
import path from 'path';

async function auditDatabase() {
  const cDb = getCentralDb();
  const tDb = getTenantDbById(1);

  const findings = [];
  const relationshipMatrix = [];
  const integrityIssues = [];

  function recordIssue({ id, category, severity, table, field, issue, impact, recommendation }) {
    integrityIssues.push({ id, category, severity, table, field, issue, impact, recommendation });
    console.log(`[${severity}] [${category}] ${table}.${field}: ${issue}`);
  }

  function recordRelationship({ sourceTable, sourceColumn, targetTable, targetColumn, relationType, isFkEnforced, onUpdate, onDelete, notes }) {
    relationshipMatrix.push({
      sourceTable,
      sourceColumn,
      targetTable,
      targetColumn,
      relationType,
      isFkEnforced: isFkEnforced ? 'YES' : 'NO',
      onUpdate: onUpdate || 'NO ACTION',
      onDelete: onDelete || 'NO ACTION',
      notes: notes || ''
    });
  }

  console.log('--- 1. AUDITING FOREIGN KEY DEFINITIONS IN SCHEMA ---');
  const tTables = tDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations' ORDER BY name").all();
  
  for (const { name } of tTables) {
    const fks = tDb.prepare(`PRAGMA foreign_key_list("${name}")`).all();
    for (const fk of fks) {
      recordRelationship({
        sourceTable: name,
        sourceColumn: fk.from,
        targetTable: fk.table,
        targetColumn: fk.to || 'id',
        relationType: 'MANY_TO_ONE',
        isFkEnforced: true,
        onUpdate: fk.on_update,
        onDelete: fk.on_delete,
        notes: 'Enforced via SQLite FOREIGN KEY'
      });
    }
  }

  console.log('--- 2. CHECKING FOR MISSING FOREIGN KEY CONSTRAINTS (LOGICAL RELATIONSHIPS) ---');
  // Check known logical relationships where FK definition might be missing in older migrations
  const logicalRelations = [
    { sourceTable: 'students', sourceColumn: 'branch_id', targetTable: 'branches', targetColumn: 'id' },
    { sourceTable: 'coaches', sourceColumn: 'branch_id', targetTable: 'branches', targetColumn: 'id' },
    { sourceTable: 'coaches', sourceColumn: 'user_id', targetTable: 'users', targetColumn: 'id' },
    { sourceTable: 'coaches', sourceColumn: 'sport_id', targetTable: 'sports', targetColumn: 'id' },
    { sourceTable: 'batches', sourceColumn: 'branch_id', targetTable: 'branches', targetColumn: 'id' },
    { sourceTable: 'batches', sourceColumn: 'sport_id', targetTable: 'sports', targetColumn: 'id' },
    { sourceTable: 'batches', sourceColumn: 'coach_id', targetTable: 'coaches', targetColumn: 'id' },
    { sourceTable: 'student_batch_enrollments', sourceColumn: 'student_id', targetTable: 'students', targetColumn: 'id' },
    { sourceTable: 'student_batch_enrollments', sourceColumn: 'batch_id', targetTable: 'batches', targetColumn: 'id' },
    { sourceTable: 'student_attendance', sourceColumn: 'student_id', targetTable: 'students', targetColumn: 'id' },
    { sourceTable: 'student_attendance', sourceColumn: 'batch_id', targetTable: 'batches', targetColumn: 'id' },
    { sourceTable: 'student_fees', sourceColumn: 'student_id', targetTable: 'students', targetColumn: 'id' },
    { sourceTable: 'fee_payments', sourceColumn: 'student_fee_id', targetTable: 'student_fees', targetColumn: 'id' },
    { sourceTable: 'fee_payments', sourceColumn: 'student_id', targetTable: 'students', targetColumn: 'id' },
    { sourceTable: 'syllabus_categories', sourceColumn: 'sport_id', targetTable: 'sports', targetColumn: 'id' },
    { sourceTable: 'syllabus_techniques', sourceColumn: 'category_id', targetTable: 'syllabus_categories', targetColumn: 'id' },
    { sourceTable: 'student_technique_assignments', sourceColumn: 'student_id', targetTable: 'students', targetColumn: 'id' },
    { sourceTable: 'student_technique_assignments', sourceColumn: 'technique_id', targetTable: 'syllabus_techniques', targetColumn: 'id' },
    { sourceTable: 'equipment_inventory', sourceColumn: 'branch_id', targetTable: 'branches', targetColumn: 'id' },
    { sourceTable: 'equipment_assignment_logs', sourceColumn: 'equipment_id', targetTable: 'equipment_inventory', targetColumn: 'id' },
    { sourceTable: 'equipment_assignment_logs', sourceColumn: 'student_id', targetTable: 'students', targetColumn: 'id' },
    { sourceTable: 'equipment_assignment_logs', sourceColumn: 'user_id', targetTable: 'users', targetColumn: 'id' },
    { sourceTable: 'event_participants', sourceColumn: 'event_id', targetTable: 'events', targetColumn: 'id' },
    { sourceTable: 'event_participants', sourceColumn: 'student_id', targetTable: 'students', targetColumn: 'id' },
    { sourceTable: 'event_passes', sourceColumn: 'event_id', targetTable: 'events', targetColumn: 'id' },
    { sourceTable: 'event_passes', sourceColumn: 'student_id', targetTable: 'students', targetColumn: 'id' },
    { sourceTable: 'staff_salary_profiles', sourceColumn: 'user_id', targetTable: 'users', targetColumn: 'id' },
    { sourceTable: 'staff_salary_statements', sourceColumn: 'user_id', targetTable: 'users', targetColumn: 'id' },
    { sourceTable: 'staff_salary_payments', sourceColumn: 'statement_id', targetTable: 'staff_salary_statements', targetColumn: 'id' },
    { sourceTable: 'staff_salary_payments', sourceColumn: 'user_id', targetTable: 'users', targetColumn: 'id' },
    { sourceTable: 'employee_work_schedules', sourceColumn: 'user_id', targetTable: 'users', targetColumn: 'id' },
    { sourceTable: 'employee_work_schedules', sourceColumn: 'branch_id', targetTable: 'branches', targetColumn: 'id' },
    { sourceTable: 'employee_schedule_shifts', sourceColumn: 'user_id', targetTable: 'users', targetColumn: 'id' },
    { sourceTable: 'leave_requests', sourceColumn: 'user_id', targetTable: 'users', targetColumn: 'id' },
    { sourceTable: 'staff_time_punches', sourceColumn: 'user_id', targetTable: 'users', targetColumn: 'id' },
    { sourceTable: 'smart_attendance_logs', sourceColumn: 'student_id', targetTable: 'students', targetColumn: 'id' },
    { sourceTable: 'smart_attendance_logs', sourceColumn: 'device_id', targetTable: 'attendance_devices', targetColumn: 'id' },
    { sourceTable: 'attendance_devices', sourceColumn: 'branch_id', targetTable: 'branches', targetColumn: 'id' },
  ];

  for (const lr of logicalRelations) {
    const fks = tDb.prepare(`PRAGMA foreign_key_list("${lr.sourceTable}")`).all();
    const hasFk = fks.some(f => f.from === lr.sourceColumn && f.table === lr.targetTable);
    if (!hasFk) {
      recordRelationship({
        sourceTable: lr.sourceTable,
        sourceColumn: lr.sourceColumn,
        targetTable: lr.targetTable,
        targetColumn: lr.targetColumn,
        relationType: 'MANY_TO_ONE',
        isFkEnforced: false,
        notes: 'Logical constraint handled at application layer or legacy schema'
      });
      recordIssue({
        id: `FK-${lr.sourceTable}-${lr.sourceColumn}`,
        category: 'Missing FK Constraint',
        severity: 'MEDIUM',
        table: lr.sourceTable,
        field: lr.sourceColumn,
        issue: `Table ${lr.sourceTable} column ${lr.sourceColumn} references ${lr.targetTable}.${lr.targetColumn} logically, but lacks an explicit DDL FOREIGN KEY clause`,
        impact: 'Database engine does not block raw cascade or dangling ID insertion if application checks are bypassed',
        recommendation: `Add explicit foreign key or validation trigger on ${lr.sourceTable}(${lr.sourceColumn}) referencing ${lr.targetTable}(${lr.targetColumn})`
      });
    }
  }

  console.log('--- 3. CHECKING FOR ORPHAN RECORDS IN EXISTING DATABASE (ACADEMY 1) ---');
  // Check batches with non-existent branches
  const orphanBatchesBranch = tDb.prepare("SELECT b.id, b.name, b.branch_id FROM batches b WHERE b.branch_id IS NOT NULL AND b.branch_id NOT IN (SELECT id FROM branches)").all();
  if (orphanBatchesBranch.length > 0) {
    recordIssue({
      id: 'ORPHAN-BATCHES-BRANCH',
      category: 'Orphan Records',
      severity: 'HIGH',
      table: 'batches',
      field: 'branch_id',
      issue: `Found ${orphanBatchesBranch.length} batches referencing non-existent branches: ${orphanBatchesBranch.map(b => b.id).join(',')}`,
      impact: 'Batch navigation or attendance fails when loading branch data',
      recommendation: 'Reassign batches to an active branch or cascade cleanup'
    });
  }

  // Check batches with non-existent sports
  const orphanBatchesSport = tDb.prepare("SELECT b.id, b.name, b.sport_id FROM batches b WHERE b.sport_id IS NOT NULL AND b.sport_id NOT IN (SELECT id FROM sports)").all();
  if (orphanBatchesSport.length > 0) {
    recordIssue({
      id: 'ORPHAN-BATCHES-SPORT',
      category: 'Orphan Records',
      severity: 'HIGH',
      table: 'batches',
      field: 'sport_id',
      issue: `Found ${orphanBatchesSport.length} batches referencing non-existent sports: ${orphanBatchesSport.map(b => b.id).join(',')}`,
      impact: 'Curriculum or timetable displays blank sport discipline',
      recommendation: 'Reassign to primary Karate sport'
    });
  }

  // Check student batch enrollments with non-existent student or batch
  const orphanEnrollments = tDb.prepare("SELECT id, student_id, batch_id FROM student_batch_enrollments WHERE student_id NOT IN (SELECT id FROM students) OR batch_id NOT IN (SELECT id FROM batches)").all();
  if (orphanEnrollments.length > 0) {
    recordIssue({
      id: 'ORPHAN-ENROLLMENTS',
      category: 'Orphan Records',
      severity: 'HIGH',
      table: 'student_batch_enrollments',
      field: 'student_id/batch_id',
      issue: `Found ${orphanEnrollments.length} orphan enrollment records referencing missing students or batches`,
      impact: 'Attendance rosters crash on null student/batch resolution',
      recommendation: 'Delete orphan enrollments'
    });
  }

  // Check multiple active batch enrollments per student
  const multiActiveEnrollments = tDb.prepare(`
    SELECT student_id, count(*) as c
    FROM student_batch_enrollments
    WHERE status = 'active'
    GROUP BY student_id
    HAVING count(*) > 1
  `).all();
  if (multiActiveEnrollments.length > 0) {
    recordIssue({
      id: 'MULTI-ACTIVE-ENROLLMENT',
      category: 'Integrity Violation',
      severity: 'HIGH',
      table: 'student_batch_enrollments',
      field: 'student_id',
      issue: `Found ${multiActiveEnrollments.length} students with multiple active batch enrollments simultaneously: ${multiActiveEnrollments.map(e => e.student_id).join(',')}`,
      impact: 'Breaks single-batch attendance constraints and creates timetable conflicts',
      recommendation: 'Enforce partial unique index on student_id WHERE status = "active"'
    });
  }

  // Check duplicate attendance records for same student + attendance session (or same student + batch + date)
  const duplicateAttendance = tDb.prepare(`
    SELECT sa.student_id, a.batch_id, a.date, count(*) as c
    FROM student_attendance sa
    JOIN attendance a ON a.id = sa.attendance_id
    GROUP BY sa.student_id, a.batch_id, a.date
    HAVING count(*) > 1
  `).all();
  if (duplicateAttendance.length > 0) {
    recordIssue({
      id: 'DUPLICATE-ATTENDANCE',
      category: 'Duplicate Records',
      severity: 'HIGH',
      table: 'student_attendance',
      field: 'student_id,attendance_id',
      issue: `Found ${duplicateAttendance.length} duplicate attendance rows for same student, batch and date`,
      impact: 'Distorts attendance percentage and double-counts student days',
      recommendation: 'Enforce unique constraint on (student_id, attendance_id)'
    });
  }

  // Check overlapping employee shift slots
  const overlappingShifts = tDb.prepare(`
    SELECT s1.user_id, s1.day_of_week, s1.start_time as s1_start, s1.end_time as s1_end, s2.start_time as s2_start, s2.end_time as s2_end
    FROM employee_schedule_shifts s1
    JOIN employee_schedule_shifts s2 ON s1.user_id = s2.user_id 
      AND s1.day_of_week = s2.day_of_week 
      AND s1.id != s2.id
      AND s1.is_working_day = 1 AND s2.is_working_day = 1
      AND (
        (s1.start_time < s2.end_time AND s1.end_time > s2.start_time)
      )
    WHERE s1.id < s2.id
  `).all();
  if (overlappingShifts.length > 0) {
    recordIssue({
      id: 'OVERLAPPING-SHIFTS',
      category: 'Schedule Conflict',
      severity: 'HIGH',
      table: 'employee_schedule_shifts',
      field: 'user_id,day_of_week,start_time,end_time',
      issue: `Found ${overlappingShifts.length} overlapping shift slots for employee on same day of week`,
      impact: 'Causes double-booking in duty rosters and false punch overtime calculations',
      recommendation: 'Reject overlapping shifts via service validation and trigger'
    });
  }

  // Check duplicate finalized payroll periods for same employee
  const duplicatePayroll = tDb.prepare(`
    SELECT s.user_id, p.year_month, count(*) as c
    FROM staff_salary_statements s
    JOIN staff_payroll_periods p ON p.id = s.payroll_period_id
    WHERE p.status IN ('finalized', 'approved', 'paid')
    GROUP BY s.user_id, p.year_month
    HAVING count(*) > 1
  `).all();
  if (duplicatePayroll.length > 0) {
    recordIssue({
      id: 'DUPLICATE-PAYROLL-PERIOD',
      category: 'Payroll Inconsistency',
      severity: 'CRITICAL',
      table: 'staff_salary_statements',
      field: 'user_id,payroll_period_id',
      issue: `Found ${duplicatePayroll.length} multiple finalized/paid salary statements for same employee in same period`,
      impact: 'Overpays employee and falsifies academy financial ledger',
      recommendation: 'Enforce unique index on (user_id, payroll_period_id) for statements'
    });
  }

  // Check syllabus categories with missing sport
  const orphanSyllabusCat = tDb.prepare("SELECT id, name, sport_id FROM syllabus_categories WHERE sport_id IS NOT NULL AND sport_id NOT IN (SELECT id FROM sports)").all();
  if (orphanSyllabusCat.length > 0) {
    recordIssue({
      id: 'ORPHAN-SYLLABUS-CAT',
      category: 'Curriculum Hierarchy',
      severity: 'HIGH',
      table: 'syllabus_categories',
      field: 'sport_id',
      issue: `Found ${orphanSyllabusCat.length} syllabus categories referencing invalid sports`,
      impact: 'Belt progression and grading breaks',
      recommendation: 'Re-associate with valid sport ID'
    });
  }

  // Check syllabus techniques with missing categories
  const orphanTechniques = tDb.prepare("SELECT id, name, category_id FROM syllabus_techniques WHERE category_id NOT IN (SELECT id FROM syllabus_categories)").all();
  if (orphanTechniques.length > 0) {
    recordIssue({
      id: 'ORPHAN-TECHNIQUES',
      category: 'Curriculum Hierarchy',
      severity: 'HIGH',
      table: 'syllabus_techniques',
      field: 'category_id',
      issue: `Found ${orphanTechniques.length} techniques referencing invalid category IDs`,
      impact: 'Class attendance technique snapshots fail',
      recommendation: 'Re-associate with valid category or delete orphan techniques'
    });
  }

  // Check equipment inventory stock vs assignment logs
  const inventoryInconsistencies = tDb.prepare(`
    SELECT eq.id, eq.name, eq.quantity, eq.available_quantity, 
      (SELECT COALESCE(SUM(log.quantity), 0) FROM equipment_assignment_logs log WHERE log.equipment_id = eq.id AND log.action = 'assigned' AND log.actual_return_date IS NULL) as active_assigned
    FROM equipment_inventory eq
    WHERE eq.quantity < (eq.available_quantity + (SELECT COALESCE(SUM(log.quantity), 0) FROM equipment_assignment_logs log WHERE log.equipment_id = eq.id AND log.action = 'assigned' AND log.actual_return_date IS NULL))
  `).all();
  if (inventoryInconsistencies.length > 0) {
    recordIssue({
      id: 'INVENTORY-STOCK-INCONSISTENCY',
      category: 'Inventory Audit',
      severity: 'MEDIUM',
      table: 'equipment_inventory',
      field: 'quantity,available_quantity',
      issue: `Found ${inventoryInconsistencies.length} equipment items where quantity does not match available + assigned count`,
      impact: 'Negative or inaccurate inventory levels displayed to staff',
      recommendation: 'Recalculate available_quantity based on active assignment logs'
    });
  }

  // Check historical salary rate immutability: Does staff_salary_statements store snapshots of base_rate, divisor, deductions?
  const statementCols = tDb.prepare("PRAGMA table_info(staff_salary_statements)").all().map(c => c.name);
  const requiredSnapshotCols = ['salary_mode', 'applicable_rate', 'gross_earnings', 'net_earnings', 'calculation_snapshot'];
  const missingSnapshotCols = requiredSnapshotCols.filter(c => !statementCols.includes(c));
  if (missingSnapshotCols.length > 0) {
    recordIssue({
      id: 'PAYROLL-SNAPSHOT-COLUMNS',
      category: 'Payroll Immutability',
      severity: 'CRITICAL',
      table: 'staff_salary_statements',
      field: missingSnapshotCols.join(','),
      issue: `Missing historical snapshot column(s) in staff_salary_statements: ${missingSnapshotCols.join(', ')}`,
      impact: 'Changing future employee salary structure alters past finalized payslips dynamically',
      recommendation: 'Add missing snapshot columns so finalized salary records remain immutable'
    });
  }

  console.log(`\nAudit completed! Discovered ${integrityIssues.length} issues and cataloged ${relationshipMatrix.length} relationships.`);

  // Write outputs
  fs.writeFileSync('scratch_integrity_issues.json', JSON.stringify(integrityIssues, null, 2));
  fs.writeFileSync('scratch_relationships.json', JSON.stringify(relationshipMatrix, null, 2));
}

auditDatabase().catch(console.error);
