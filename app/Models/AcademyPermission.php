<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;

class AcademyPermission extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'name',
        'display_name',
        'category',
        'description',
    ];

    // Define all available permissions by category (Based on actual Academy Filament Resources)
    public static function getPermissionsByCategory(): array
    {
        return [
            // Core User Management (UserResource)
            'users' => [
                'view_users' => 'View Users',
                'create_users' => 'Create Users',
                'edit_users' => 'Edit Users',
                'delete_users' => 'Delete Users',
                'export_users' => 'Export Users',
                'manage_user_roles' => 'Manage User Roles',
            ],
            
            // Academy Role Management (AcademyRoleResource)
            'academy_roles' => [
                'view_academy_roles' => 'View Academy Roles',
                'create_academy_roles' => 'Create Academy Roles',
                'edit_academy_roles' => 'Edit Academy Roles',
                'delete_academy_roles' => 'Delete Academy Roles',
                'assign_academy_roles' => 'Assign Academy Roles',
            ],
            
            // Permission Management (PermissionResource)
            'permissions' => [
                'view_permissions' => 'View Permissions',
                'create_permissions' => 'Create Permissions',
                'edit_permissions' => 'Edit Permissions',
                'delete_permissions' => 'Delete Permissions',
                'manage_permissions' => 'Manage Permissions',
            ],
            
            // Branch Management (BranchResource)
            'branches' => [
                'view_branches' => 'View Branches',
                'create_branches' => 'Create Branches',
                'edit_branches' => 'Edit Branches',
                'delete_branches' => 'Delete Branches',
                'export_branches' => 'Export Branches',
            ],
            
            // Batch Management (BatchResource)
            'batches' => [
                'view_batches' => 'View Batches',
                'create_batches' => 'Create Batches',
                'edit_batches' => 'Edit Batches',
                'delete_batches' => 'Delete Batches',
                'export_batches' => 'Export Batches',
                'manage_batch_students' => 'Manage Batch Students',
                'view_batch_schedules' => 'View Batch Schedules',
            ],
            
            // Student Management (StudentResource)
            'students' => [
                'view_students' => 'View Students',
                'create_students' => 'Create Students',
                'edit_students' => 'Edit Students',
                'delete_students' => 'Delete Students',
                'export_students' => 'Export Students',
                'view_student_details' => 'View Student Details',
                'manage_student_enrollment' => 'Manage Student Enrollment',
                'view_student_progress' => 'View Student Progress',
            ],
            
            // Attendance Management (AttendanceResource)
            'attendances' => [
                'view_attendances' => 'View Attendances',
                'create_attendances' => 'Create Attendances',
                'edit_attendances' => 'Edit Attendances',
                'delete_attendances' => 'Delete Attendances',
                'export_attendances' => 'Export Attendances',
                'take_attendance' => 'Take Attendance',
                'view_attendance_reports' => 'View Attendance Reports',
                'mark_bulk_attendance' => 'Mark Bulk Attendance',
            ],

            // Staff Attendance Management (StaffAttendanceResource)
            'staff_attendances' => [
                'view_staff_attendances' => 'View Staff Attendances',
                'create_staff_attendances' => 'Create Staff Attendances',
                'edit_staff_attendances' => 'Edit Staff Attendances',
                'delete_staff_attendances' => 'Delete Staff Attendances',
                'export_staff_attendances' => 'Export Staff Attendances',
            ],

            // Staff Attendance Rules (StaffAttendanceSettingResource)
            'staff_attendance_settings' => [
                'view_staff_attendance_settings' => 'View Staff Attendance Rules',
                'create_staff_attendance_settings' => 'Create Staff Attendance Rules',
                'edit_staff_attendance_settings' => 'Edit Staff Attendance Rules',
                'delete_staff_attendance_settings' => 'Delete Staff Attendance Rules',
                'export_staff_attendance_settings' => 'Export Staff Attendance Rules',
            ],

            // Staff Attendance Corrections (StaffAttendanceCorrectionResource)
            'staff_attendance_corrections' => [
                'view_staff_attendance_corrections' => 'View Staff Attendance Corrections',
                'create_staff_attendance_corrections' => 'Create Staff Attendance Corrections',
                'edit_staff_attendance_corrections' => 'Edit Staff Attendance Corrections',
                'delete_staff_attendance_corrections' => 'Delete Staff Attendance Corrections',
                'export_staff_attendance_corrections' => 'Export Staff Attendance Corrections',
                'approve_staff_attendance_corrections' => 'Approve Staff Attendance Corrections',
            ],

            // Staff Leaves & Approvals (StaffLeaveResource)
            'staff_leaves' => [
                'view_staff_leaves' => 'View Staff Leaves',
                'create_staff_leaves' => 'Create Staff Leaves',
                'edit_staff_leaves' => 'Edit Staff Leaves',
                'delete_staff_leaves' => 'Delete Staff Leaves',
                'export_staff_leaves' => 'Export Staff Leaves',
                'approve_staff_leaves' => 'Approve Staff Leaves',
            ],

            // Organization Holidays (OrganizationHolidayResource)
            'organization_holidays' => [
                'view_organization_holidays' => 'View Organization Holidays',
                'create_organization_holidays' => 'Create Organization Holidays',
                'edit_organization_holidays' => 'Edit Organization Holidays',
                'delete_organization_holidays' => 'Delete Organization Holidays',
                'export_organization_holidays' => 'Export Organization Holidays',
            ],

            // Academy Administrators (AdminResource)
            'admins' => [
                'view_admins' => 'View Academy Admins',
                'create_admins' => 'Create Academy Admins',
                'edit_admins' => 'Edit Academy Admins',
                'delete_admins' => 'Delete Academy Admins',
                'export_admins' => 'Export Academy Admins',
            ],

            // Staff Payroll Management (StaffPayrollResource)
            'staff_payrolls' => [
                'view_staff_payrolls' => 'View Staff Payrolls',
                'create_staff_payrolls' => 'Create Staff Payrolls',
                'edit_staff_payrolls' => 'Edit Staff Payrolls',
                'delete_staff_payrolls' => 'Delete Staff Payrolls',
                'export_staff_payrolls' => 'Export Staff Payrolls',
            ],
            
            // Fee Management (FeeResource)
            'fees' => [
                'view_fees' => 'View Fees',
                'create_fees' => 'Create Fees',
                'edit_fees' => 'Edit Fees',
                'delete_fees' => 'Delete Fees',
                'export_fees' => 'Export Fees',
                'collect_payments' => 'Collect Payments',
                'view_fee_reports' => 'View Fee Reports',
                'manage_fee_structures' => 'Manage Fee Structures',
                'process_refunds' => 'Process Refunds',
            ],
            
            // Event Management (EventResource)
            'events' => [
                'view_events' => 'View Events',
                'create_events' => 'Create Events',
                'edit_events' => 'Edit Events',
                'delete_events' => 'Delete Events',
                'export_events' => 'Export Events',
                'manage_event_participants' => 'Manage Event Participants',
                'view_event_reports' => 'View Event Reports',
            ],
            
            // Event Fee Management (EventFeeResource)
            'event_fees' => [
                'view_event_fees' => 'View Event Fees',
                'create_event_fees' => 'Create Event Fees',
                'edit_event_fees' => 'Edit Event Fees',
                'delete_event_fees' => 'Delete Event Fees',
                'export_event_fees' => 'Export Event Fees',
                'collect_event_payments' => 'Collect Event Payments',
            ],
            
            // Syllabus Category Management (SyllabusCategoryResource)
            'syllabus_categories' => [
                'view_syllabus_categories' => 'View Syllabus Categories',
                'create_syllabus_categories' => 'Create Syllabus Categories',
                'edit_syllabus_categories' => 'Edit Syllabus Categories',
                'delete_syllabus_categories' => 'Delete Syllabus Categories',
                'export_syllabus_categories' => 'Export Syllabus Categories',
            ],
            
            // Syllabus Technique Management (SyllabusTechniqueResource)
            'syllabus_techniques' => [
                'view_syllabus_techniques' => 'View Syllabus Techniques',
                'create_syllabus_techniques' => 'Create Syllabus Techniques',
                'edit_syllabus_techniques' => 'Edit Syllabus Techniques',
                'delete_syllabus_techniques' => 'Delete Syllabus Techniques',
                'export_syllabus_techniques' => 'Export Syllabus Techniques',
                'manage_technique_progress' => 'Manage Technique Progress',
            ],
            
            // Audit & System Logs (AuditResource)
            'audits' => [
                'view_audits' => 'View Audit Logs',
                'export_audits' => 'Export Audit Logs',
                'delete_audits' => 'Delete Audit Logs',
            ],
            
            // Reports & Analytics
            'reports' => [
                'view_reports' => 'View Reports',
                'generate_reports' => 'Generate Reports',
                'export_reports' => 'Export Reports',
                'view_financial_reports' => 'View Financial Reports',
                'view_attendance_analytics' => 'View Attendance Analytics',
                'view_student_analytics' => 'View Student Analytics',
                'view_revenue_analytics' => 'View Revenue Analytics',
            ],
            
            // Academy Settings & Configuration
            'academy_settings' => [
                'view_academy_settings' => 'View Academy Settings',
                'edit_academy_settings' => 'Edit Academy Settings',
                'manage_academy_profile' => 'Manage Academy Profile',
                'view_academy_analytics' => 'View Academy Analytics',
                'manage_subscription' => 'Manage Subscription',
            ],
            
            // Dashboard & Widgets
            'dashboard' => [
                'view_dashboard' => 'View Dashboard',
                'view_widgets' => 'View Dashboard Widgets',
                'customize_dashboard' => 'Customize Dashboard',
                'view_analytics_widgets' => 'View Analytics Widgets',
            ],
            
            // Notifications
            'notifications' => [
                'view_notifications' => 'View Notifications',
                'create_notifications' => 'Create Notifications',
                'send_notifications' => 'Send Notifications',
                'manage_notification_templates' => 'Manage Notification Templates',
                'send_bulk_notifications' => 'Send Bulk Notifications',
            ],
        ];
    }

    public static function getAllPermissions(): array
    {
        $permissions = [];
        foreach (self::getPermissionsByCategory() as $category => $categoryPermissions) {
            foreach ($categoryPermissions as $name => $displayName) {
                $permissions[] = [
                    'name' => $name,
                    'display_name' => $displayName,
                    'category' => $category,
                ];
            }
        }
        return $permissions;
    }

    public static function seedPermissions(): void
    {
        foreach (self::getAllPermissions() as $permission) {
            self::updateOrCreate(
                ['name' => $permission['name']],
                $permission
            );
        }
    }

    // Helper methods
    public function scopeByCategory($query, string $category)
    {
        return $query->where('category', $category);
    }

    public static function getByCategory(): array
    {
        return self::all()->groupBy('category')->toArray();
    }

    // Get permissions grouped by category
    public static function getGroupedPermissions()
    {
        return self::orderBy('category')->orderBy('display_name')->get()->groupBy('category');
    }
}
