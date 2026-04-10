<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AcademyPermission;
use App\Models\AcademyRole;

class AllResourcePermissionsSeeder extends Seeder
{
    /**
     * Seed permissions for all academy resources.
     * This seeder ensures all resources have the necessary CRUD permissions.
     */
    public function run()
    {
        echo "Creating permissions for all academy resources...\n";

        // Define all resource permissions
        $resourcePermissions = [
            // Fee Management
            'fees' => [
                'view_fees' => 'View Fees',
                'create_fees' => 'Create Fees',
                'edit_fees' => 'Edit Fees',
                'delete_fees' => 'Delete Fees',
                'print_fees' => 'Print Fee Receipts',
                'export_fees' => 'Export Fee Data',
            ],

            // Event Management
            'events' => [
                'view_events' => 'View Events',
                'create_events' => 'Create Events',
                'edit_events' => 'Edit Events',
                'delete_events' => 'Delete Events',
            ],

            // Event Fee Management
            'event_fees' => [
                'view_event_fees' => 'View Event Fees',
                'create_event_fees' => 'Create Event Fees',
                'edit_event_fees' => 'Edit Event Fees',
                'delete_event_fees' => 'Delete Event Fees',
            ],

            // Attendance Management
            'attendance' => [
                'view_attendance' => 'View Attendance',
                'create_attendance' => 'Create Attendance',
                'edit_attendance' => 'Edit Attendance',
                'delete_attendance' => 'Delete Attendance',
                'export_attendance' => 'Export Attendance Data',
            ],

            // Attendance Management (Plural for Resource compatibility)
            'attendances' => [
                'view_attendances' => 'View Attendances',
                'create_attendances' => 'Create Attendances',
                'edit_attendances' => 'Edit Attendances',
                'delete_attendances' => 'Delete Attendances',
                'export_attendances' => 'Export Attendance Data',
            ],

            // Student Management
            'students' => [
                'view_students' => 'View Students',
                'create_students' => 'Create Students',
                'edit_students' => 'Edit Students',
                'delete_students' => 'Delete Students',
                'export_students' => 'Export Student Data',
            ],

            // Batch Management
            'batches' => [
                'view_batches' => 'View Batches',
                'create_batches' => 'Create Batches',
                'edit_batches' => 'Edit Batches',
                'delete_batches' => 'Delete Batches',
                'export_batches' => 'Export Batch Data',
            ],

            // Branch Management
            'branches' => [
                'view_branches' => 'View Branches',
                'create_branches' => 'Create Branches',
                'edit_branches' => 'Edit Branches',
                'delete_branches' => 'Delete Branches',
            ],

            // Syllabus Category Management
            'syllabus_categories' => [
                'view_syllabus_categories' => 'View Syllabus Categories',
                'create_syllabus_categories' => 'Create Syllabus Categories',
                'edit_syllabus_categories' => 'Edit Syllabus Categories',
                'delete_syllabus_categories' => 'Delete Syllabus Categories',
            ],

            // Syllabus Technique Management
            'syllabus_techniques' => [
                'view_syllabus_techniques' => 'View Syllabus Techniques',
                'create_syllabus_techniques' => 'Create Syllabus Techniques',
                'edit_syllabus_techniques' => 'Edit Syllabus Techniques',
                'delete_syllabus_techniques' => 'Delete Syllabus Techniques',
            ],

            // User Management
            'users' => [
                'view_users' => 'View Users',
                'create_users' => 'Create Users',
                'edit_users' => 'Edit Users',
                'delete_users' => 'Delete Users',
            ],

            // Role Management
            'roles' => [
                'view_roles' => 'View Roles',
                'create_roles' => 'Create Roles',
                'edit_roles' => 'Edit Roles',
                'delete_roles' => 'Delete Roles',
            ],

            // Permission Management
            'permissions' => [
                'view_permissions' => 'View Permissions',
                'create_permissions' => 'Create Permissions',
                'edit_permissions' => 'Edit Permissions',
                'delete_permissions' => 'Delete Permissions',
            ],

            // Audit Management
            'audits' => [
                'view_audits' => 'View Audit Logs',
                'delete_audits' => 'Delete Audit Logs',
                'export_audits' => 'Export Audit Data',
            ],
        ];

        $totalCreated = 0;
        $totalSkipped = 0;

        foreach ($resourcePermissions as $resource => $permissions) {
            echo "\nProcessing {$resource} permissions...\n";
            
            foreach ($permissions as $name => $description) {
                $permission = AcademyPermission::firstOrCreate([
                    'name' => $name
                ], [
                    'display_name' => $description,
                    'description' => $description,
                    'category' => $resource
                ]);

                if ($permission->wasRecentlyCreated) {
                    echo "  ✓ Created: {$name}\n";
                    $totalCreated++;
                } else {
                    echo "  - Exists: {$name}\n";
                    $totalSkipped++;
                }
            }
        }

        echo "\n" . str_repeat("=", 50) . "\n";
        echo "Permission creation summary:\n";
        echo "  Created: {$totalCreated} permissions\n";
        echo "  Skipped: {$totalSkipped} permissions (already exist)\n";
        echo "  Total: " . ($totalCreated + $totalSkipped) . " permissions processed\n";

        // Assign all permissions to admin role
        $this->assignPermissionsToAdminRole();
    }

    /**
     * Assign all permissions to the admin role
     */
    private function assignPermissionsToAdminRole()
    {
        echo "\nAssigning permissions to admin role...\n";

        $adminRole = AcademyRole::where('name', 'admin')->first();
        if (!$adminRole) {
            echo "  ❌ Admin role not found - permissions not assigned\n";
            return;
        }

        $allPermissions = AcademyPermission::all();
        $assignedCount = 0;
        $skippedCount = 0;

        foreach ($allPermissions as $permission) {
            if (!$adminRole->hasPermission($permission->name)) {
                $adminRole->givePermission($permission->name);
                $assignedCount++;
            } else {
                $skippedCount++;
            }
        }

        echo "  ✓ Assigned: {$assignedCount} new permissions to admin role\n";
        echo "  - Skipped: {$skippedCount} permissions (already assigned)\n";
        echo "  Total admin permissions: " . count($adminRole->permissions ?? []) . "\n";
    }
}
