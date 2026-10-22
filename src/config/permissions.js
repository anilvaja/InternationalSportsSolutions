/**
 * Complete list of all granular and bundled permissions across all 19 platform modules.
 * Accurately assigned to Academy Admin role.
 */
export const ALL_ACADEMY_PERMISSIONS = [
  // 1. Batches & Schedules
  'view_batches',
  'create_batches',
  'edit_batches',
  'delete_batches',
  'export_batches',
  'import_batches',
  'download_batches_sample',

  // 2. Branches & Locations
  'view_branches',
  'create_branches',
  'edit_branches',
  'delete_branches',
  'export_branches',
  'import_branches',
  'download_branches_sample',
  'manage_branches',

  // 3. Students & Admissions
  'view_students',
  'create_students',
  'edit_students',
  'delete_students',
  'transfer_students',
  'export_students',
  'import_students',
  'download_students_sample',
  'manage_students',

  // 4. Coaches & Staff Management
  'view_coaches',
  'create_coaches',
  'edit_coaches',
  'delete_staff',
  'export_staff',
  'import_staff',
  'download_staff_sample',
  'assign_user_roles',
  'manage_staff_payroll',
  'manage_coaches',

  // 5. Class Attendance & Progression
  'view_attendance',
  'mark_attendance',
  'edit_attendance',
  'delete_attendance',
  'export_attendance',
  'download_attendance_report',
  'approve_late_attendance',

  // 6. Sports & Disciplines
  'view_sports',
  'create_sports',
  'edit_sports',
  'delete_sports',
  'export_sports',
  'import_sports',
  'download_sports_sample',
  'manage_sports',

  // 7. Sports Syllabus & Belt Grading
  'view_syllabus',
  'create_syllabus',
  'edit_syllabus',
  'delete_syllabus',
  'evaluate_progression',
  'export_syllabus',
  'import_syllabus',
  'download_syllabus_sample',
  'manage_syllabus',

  // 8. Inquiries & Admission Leads
  'view_inquiries',
  'create_inquiries',
  'edit_inquiries',
  'delete_inquiries',
  'convert_inquiries',
  'export_inquiries',
  'import_inquiries',
  'download_inquiries_sample',
  'manage_inquiries',

  // 9. Fee Collection & Invoices
  'view_fees',
  'collect_fees',
  'edit_fees',
  'delete_fees',
  'override_fees',
  'pause_fees',
  'export_fees',
  'download_fee_receipts',

  // 10. Staff Payroll & Overtime
  'view_payroll',
  'view_my_salary',
  'calculate_payroll',
  'finalize_payroll',
  'record_payroll_payment',
  'approve_overtime',
  'export_payroll',
  'download_salary_slip',

  // 11. Staff Leaves & Approvals
  'view_leaves',
  'apply_leave',
  'edit_leaves',
  'delete_leaves',
  'manage_leaves',
  'export_leaves',

  // 12. Staff Attendance & GPS Self-Punch
  'punch_attendance',
  'view_my_punches',
  'view_staff_punches',
  'edit_punches',
  'export_punches',

  // 13. Events & Tournaments
  'view_events',
  'create_events',
  'edit_events',
  'delete_events',
  'approve_event_registrations',
  'export_events',
  'download_event_roster',
  'manage_events',

  // 14. Holiday Calendar
  'view_holidays',
  'create_holidays',
  'edit_holidays',
  'delete_holidays',
  'export_holidays',
  'manage_holidays',

  // 15. Facilities & Equipment
  'view_facilities',
  'create_facilities',
  'edit_facilities',
  'delete_facilities',
  'export_facilities',
  'manage_facilities',

  // 16. Roles & Access Control
  'view_roles',
  'create_roles',
  'edit_roles',
  'delete_roles',
  'export_roles',
  'manage_roles',

  // 17. Tenant Audit Log & Security
  'view_audit_logs',
  'export_audit_logs',

  // 18. Academy Settings & Policies
  'view_academy_settings',
  'edit_academy_settings',
  'manage_policies',

  // 19. Branding & Dynamic Themes
  'customize_theme',
  'manage_branding',

  // Universal super capability
  'all'
];
