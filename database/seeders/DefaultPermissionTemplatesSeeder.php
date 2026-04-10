<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\AcademyPermissionTemplate;

class DefaultPermissionTemplatesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $templates = [
            [
                'name' => 'Coach Template',
                'description' => 'Standard permissions for academy coaches - can manage students, attendance, and syllabus',
                'permissions' => [
                    'view_students',
                    'create_students',
                    'edit_students',
                    'view_attendance',
                    'manage_attendance',
                    'view_syllabus',
                    'view_reports',
                    'send_notifications',
                ]
            ],
            [
                'name' => 'Manager Template',
                'description' => 'Permissions for academy managers - includes coach permissions plus financial and user management',
                'permissions' => [
                    'view_students',
                    'create_students',
                    'edit_students',
                    'delete_students',
                    'view_attendance',
                    'manage_attendance',
                    'view_syllabus',
                    'manage_syllabus',
                    'view_fees',
                    'manage_fees',
                    'view_payments',
                    'manage_payments',
                    'view_reports',
                    'generate_reports',
                    'send_notifications',
                    'manage_notifications',
                    'view_users',
                    'create_users',
                    'edit_users',
                ]
            ],
            [
                'name' => 'Receptionist Template',
                'description' => 'Basic permissions for front desk staff - student registration and basic operations',
                'permissions' => [
                    'view_students',
                    'create_students',
                    'edit_students',
                    'view_attendance',
                    'view_fees',
                    'manage_payments',
                    'send_notifications',
                ]
            ],
            [
                'name' => 'Accountant Template',
                'description' => 'Financial permissions for academy accountants - full access to fees and payments',
                'permissions' => [
                    'view_students',
                    'view_fees',
                    'manage_fees',
                    'view_payments',
                    'manage_payments',
                    'view_reports',
                    'generate_reports',
                    'manage_financial_reports',
                ]
            ],
            [
                'name' => 'Read Only Template',
                'description' => 'View-only permissions for observers or auditors',
                'permissions' => [
                    'view_students',
                    'view_attendance',
                    'view_syllabus',
                    'view_fees',
                    'view_payments',
                    'view_reports',
                ]
            ]
        ];

        foreach ($templates as $template) {
            AcademyPermissionTemplate::updateOrCreate(
                [
                    'name' => $template['name'],
                    'is_system_template' => true,
                ],
                [
                    'academy_id' => 1, // Will be available to all academies
                    'description' => $template['description'],
                    'permissions' => $template['permissions'],
                    'is_system_template' => true,
                ]
            );
        }
    }
}
