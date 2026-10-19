<?php

namespace Database\Seeders;

use App\Models\AcademyPermission;
use Illuminate\Database\Seeder;

class AcademyPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $permissions = [
            // Student Management
            [
                'name' => 'view_students',
                'display_name' => 'View Students',
                'category' => 'students',
                'description' => 'View student list and details'
            ],
            [
                'name' => 'create_students',
                'display_name' => 'Create Students',
                'category' => 'students',
                'description' => 'Add new students to the academy'
            ],
            [
                'name' => 'edit_students',
                'display_name' => 'Edit Students',
                'category' => 'students',
                'description' => 'Modify student information'
            ],
            [
                'name' => 'delete_students',
                'display_name' => 'Delete Students',
                'category' => 'students',
                'description' => 'Remove students from the academy'
            ],
            [
                'name' => 'manage_student_fees',
                'display_name' => 'Manage Student Fees',
                'category' => 'students',
                'description' => 'Handle student fee collection and tracking'
            ],

            // Branch Management
            [
                'name' => 'view_branches',
                'display_name' => 'View Branches',
                'category' => 'branches',
                'description' => 'View branch list and details'
            ],
            [
                'name' => 'create_branches',
                'display_name' => 'Create Branches',
                'category' => 'branches',
                'description' => 'Add new branches to the academy'
            ],
            [
                'name' => 'edit_branches',
                'display_name' => 'Edit Branches',
                'category' => 'branches',
                'description' => 'Modify branch information'
            ],
            [
                'name' => 'delete_branches',
                'display_name' => 'Delete Branches',
                'category' => 'branches',
                'description' => 'Remove branches from the academy'
            ],

            // Syllabus Management
            [
                'name' => 'view_syllabus',
                'display_name' => 'View Syllabus',
                'category' => 'syllabus',
                'description' => 'View syllabus categories and techniques'
            ],
            [
                'name' => 'create_syllabus',
                'display_name' => 'Create Syllabus',
                'category' => 'syllabus',
                'description' => 'Add new syllabus categories and techniques'
            ],
            [
                'name' => 'edit_syllabus',
                'display_name' => 'Edit Syllabus',
                'category' => 'syllabus',
                'description' => 'Modify syllabus content'
            ],
            [
                'name' => 'delete_syllabus',
                'display_name' => 'Delete Syllabus',
                'category' => 'syllabus',
                'description' => 'Remove syllabus items'
            ],

            // Coach Management
            [
                'name' => 'view_coaches',
                'display_name' => 'View Coaches',
                'category' => 'coaches',
                'description' => 'View coach list and details'
            ],
            [
                'name' => 'create_coaches',
                'display_name' => 'Create Coaches',
                'category' => 'coaches',
                'description' => 'Add new coaches'
            ],
            [
                'name' => 'edit_coaches',
                'display_name' => 'Edit Coaches',
                'category' => 'coaches',
                'description' => 'Modify coach information'
            ],
            [
                'name' => 'delete_coaches',
                'display_name' => 'Delete Coaches',
                'category' => 'coaches',
                'description' => 'Remove coaches'
            ],

            // Batch Management
            [
                'name' => 'view_batches',
                'display_name' => 'View Batches',
                'category' => 'batches',
                'description' => 'View batch schedules and details'
            ],
            [
                'name' => 'create_batches',
                'display_name' => 'Create Batches',
                'category' => 'batches',
                'description' => 'Create new training batches'
            ],
            [
                'name' => 'edit_batches',
                'display_name' => 'Edit Batches',
                'category' => 'batches',
                'description' => 'Modify batch information'
            ],
            [
                'name' => 'delete_batches',
                'display_name' => 'Delete Batches',
                'category' => 'batches',
                'description' => 'Remove batches'
            ],

            // Attendance Management
            [
                'name' => 'view_attendance',
                'display_name' => 'View Attendance',
                'category' => 'attendance',
                'description' => 'View attendance records'
            ],
            [
                'name' => 'mark_attendance',
                'display_name' => 'Mark Attendance',
                'category' => 'attendance',
                'description' => 'Mark student attendance'
            ],
            [
                'name' => 'edit_attendance',
                'display_name' => 'Edit Attendance',
                'category' => 'attendance',
                'description' => 'Modify attendance records'
            ],

            // Reports and Analytics
            [
                'name' => 'view_reports',
                'display_name' => 'View Reports',
                'category' => 'reports',
                'description' => 'Access academy reports and analytics'
            ],
            [
                'name' => 'export_reports',
                'display_name' => 'Export Reports',
                'category' => 'reports',
                'description' => 'Export reports to various formats'
            ],

            // User Management
            [
                'name' => 'view_users',
                'display_name' => 'View Users',
                'category' => 'users',
                'description' => 'View academy staff and users'
            ],
            [
                'name' => 'create_users',
                'display_name' => 'Create Users',
                'category' => 'users',
                'description' => 'Add new staff members'
            ],
            [
                'name' => 'edit_users',
                'display_name' => 'Edit Users',
                'category' => 'users',
                'description' => 'Modify user information'
            ],
            [
                'name' => 'delete_users',
                'display_name' => 'Delete Users',
                'category' => 'users',
                'description' => 'Remove users from the academy'
            ],
            [
                'name' => 'manage_user_roles',
                'display_name' => 'Manage User Roles',
                'category' => 'users',
                'description' => 'Assign and manage user roles and permissions'
            ],

            // Settings
            [
                'name' => 'view_settings',
                'display_name' => 'View Settings',
                'category' => 'settings',
                'description' => 'View academy settings'
            ],
            // Events Management
            [
                'name' => 'view_events',
                'display_name' => 'View Events',
                'category' => 'events',
                'description' => 'View academy events and details'
            ],
            [
                'name' => 'create_events',
                'display_name' => 'Create Events',
                'category' => 'events',
                'description' => 'Create new events'
            ],
            [
                'name' => 'edit_events',
                'display_name' => 'Edit Events',
                'category' => 'events',
                'description' => 'Edit event details and configuration'
            ],
            [
                'name' => 'delete_events',
                'display_name' => 'Delete Events',
                'category' => 'events',
                'description' => 'Delete or cancel events'
            ],
            [
                'name' => 'manage_event_eligibility',
                'display_name' => 'Manage Event Eligibility',
                'category' => 'events',
                'description' => 'Configure student eligibility and publish event invitations'
            ],
            [
                'name' => 'view_event_responses',
                'display_name' => 'View Event Responses',
                'category' => 'events',
                'description' => 'View student responses and participation status'
            ],
            [
                'name' => 'approve_event_registration',
                'display_name' => 'Approve Event Registration',
                'category' => 'events',
                'description' => 'Approve or reject participant registrations'
            ],
            [
                'name' => 'export_events',
                'display_name' => 'Export Event Rosters',
                'category' => 'events',
                'description' => 'Export participant lists and responses'
            ],
        ];

        foreach ($permissions as $permission) {
            AcademyPermission::firstOrCreate(
                ['name' => $permission['name']],
                $permission
            );
        }
    }
}
