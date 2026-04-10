<?php

namespace Database\Seeders;

use App\Models\Academy;
use App\Models\AcademyRole;
use App\Models\AcademyPermission;
use Illuminate\Database\Seeder;

class DefaultAcademyRolesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $academies = Academy::all();
        $allPermissions = AcademyPermission::pluck('name')->toArray();

        // Define default roles with their permissions
        $defaultRoles = [
            [
                'name' => 'admin',
                'display_name' => 'Admin',
                'description' => 'Full access to all academy features and settings',
                'permissions' => $allPermissions, // Admin gets all permissions
            ],
            [
                'name' => 'manager',
                'display_name' => 'Manager',
                'description' => 'Manages students, coaches, and operations but limited settings access',
                'permissions' => [
                    'view_students', 'create_students', 'edit_students', 'delete_students', 'manage_student_fees',
                    'view_branches', 'create_branches', 'edit_branches',
                    'view_syllabus', 'create_syllabus', 'edit_syllabus',
                    'view_coaches', 'create_coaches', 'edit_coaches',
                    'view_batches', 'create_batches', 'edit_batches', 'delete_batches',
                    'view_attendance', 'mark_attendance', 'edit_attendance',
                    'view_reports', 'export_reports',
                    'view_users', 'create_users', 'edit_users',
                    'view_settings',
                ],
            ],
            [
                'name' => 'coach',
                'display_name' => 'Coach',
                'description' => 'Handles training, attendance, and student progress',
                'permissions' => [
                    'view_students', 'edit_students',
                    'view_branches',
                    'view_syllabus',
                    'view_batches', 'edit_batches',
                    'view_attendance', 'mark_attendance', 'edit_attendance',
                    'view_reports',
                ],
            ],
            [
                'name' => 'staff',
                'display_name' => 'Staff',
                'description' => 'Basic access for administrative support',
                'permissions' => [
                    'view_students', 'create_students', 'edit_students', 'manage_student_fees',
                    'view_branches',
                    'view_attendance', 'mark_attendance',
                    'view_reports',
                ],
            ],
        ];

        foreach ($academies as $academy) {
            foreach ($defaultRoles as $roleData) {
                AcademyRole::firstOrCreate(
                    [
                        'academy_id' => $academy->id,
                        'name' => $roleData['name'],
                    ],
                    [
                        'display_name' => $roleData['display_name'],
                        'description' => $roleData['description'],
                        'permissions' => $roleData['permissions'],
                        'is_active' => true,
                    ]
                );
            }
        }
    }
}
