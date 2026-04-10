<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Define roles and their permissions
        $rolePermissions = [
            'Super Admin' => Permission::all(),

            'Academy Admin' => [
                // User Management
                'users.view', 'users.create', 'users.edit', 'users.delete', 'users.export', 'users.import',
                
                // Academy Management
                'academies.view', 'academies.edit', 'academies.settings', 'academies.export',
                
                // Branch Management
                'branches.view', 'branches.create', 'branches.edit', 'branches.delete', 'branches.export',
                
                // Student Management
                'students.view', 'students.create', 'students.edit', 'students.delete', 
                'students.progress', 'students.fees', 'students.export', 'students.import',
                
                // Batch Management
                'batches.view', 'batches.create', 'batches.edit', 'batches.delete',
                'batches.assign_students', 'batches.assign_coaches', 'batches.schedule', 'batches.export',
                
                // Coach Management
                'coaches.view', 'coaches.create', 'coaches.edit', 'coaches.delete',
                'coaches.assign', 'coaches.performance', 'coaches.export',
                
                // Syllabus Management
                'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.delete',
                'syllabus.categories', 'syllabus.techniques', 'syllabus.export',
                
                // Attendance Management
                'attendance.view', 'attendance.create', 'attendance.edit', 'attendance.delete',
                'attendance.reports', 'attendance.export',
                
                // Events Management
                'events.view', 'events.create', 'events.edit', 'events.delete',
                'events.registrations', 'events.results', 'events.export',
                
                // Fee Management
                'fees.view', 'fees.create', 'fees.edit', 'fees.delete',
                'fees.structures', 'fees.payments', 'fees.reports', 'fees.export',
                
                // Reports & Analytics
                'reports.view', 'reports.financial', 'reports.student_progress',
                'reports.attendance', 'reports.performance', 'reports.custom', 'reports.export',
                
                // Settings & Configuration
                'settings.view', 'settings.edit', 'settings.academy', 'settings.permissions', 'settings.roles',
                
                // Print & Documents
                'print.certificates', 'print.reports', 'print.invoices', 'print.receipts',
                'print.schedules', 'print.student_cards',
                
                // Communication
                'communication.view', 'communication.send_notifications', 'communication.send_emails',
                'communication.send_sms', 'communication.announcements',
            ],

            'Academy Manager' => [
                // User Management (limited)
                'users.view', 'users.create', 'users.edit', 'users.export',
                
                // Academy Management (view only)
                'academies.view',
                
                // Branch Management
                'branches.view', 'branches.create', 'branches.edit', 'branches.export',
                
                // Student Management
                'students.view', 'students.create', 'students.edit', 
                'students.progress', 'students.fees', 'students.export', 'students.import',
                
                // Batch Management
                'batches.view', 'batches.create', 'batches.edit',
                'batches.assign_students', 'batches.assign_coaches', 'batches.schedule', 'batches.export',
                
                // Coach Management
                'coaches.view', 'coaches.create', 'coaches.edit',
                'coaches.assign', 'coaches.performance', 'coaches.export',
                
                // Syllabus Management
                'syllabus.view', 'syllabus.create', 'syllabus.edit',
                'syllabus.categories', 'syllabus.techniques', 'syllabus.export',
                
                // Attendance Management
                'attendance.view', 'attendance.create', 'attendance.edit',
                'attendance.reports', 'attendance.export',
                
                // Events Management
                'events.view', 'events.create', 'events.edit',
                'events.registrations', 'events.results', 'events.export',
                
                // Fee Management
                'fees.view', 'fees.create', 'fees.edit',
                'fees.structures', 'fees.payments', 'fees.reports', 'fees.export',
                
                // Reports & Analytics
                'reports.view', 'reports.financial', 'reports.student_progress',
                'reports.attendance', 'reports.performance', 'reports.export',
                
                // Print & Documents
                'print.certificates', 'print.reports', 'print.invoices', 'print.receipts',
                'print.schedules', 'print.student_cards',
                
                // Communication
                'communication.view', 'communication.send_notifications', 'communication.send_emails',
                'communication.announcements',
            ],

            'Head Coach' => [
                // Student Management
                'students.view', 'students.progress', 'students.export',
                
                // Batch Management
                'batches.view', 'batches.assign_students', 'batches.schedule', 'batches.export',
                
                // Coach Management
                'coaches.view', 'coaches.assign', 'coaches.performance', 'coaches.export',
                
                // Syllabus Management
                'syllabus.view', 'syllabus.create', 'syllabus.edit',
                'syllabus.categories', 'syllabus.techniques', 'syllabus.export',
                
                // Attendance Management
                'attendance.view', 'attendance.create', 'attendance.edit',
                'attendance.reports', 'attendance.export',
                
                // Events Management
                'events.view', 'events.registrations', 'events.results', 'events.export',
                
                // Reports & Analytics
                'reports.view', 'reports.student_progress', 'reports.attendance',
                'reports.performance', 'reports.export',
                
                // Print & Documents
                'print.certificates', 'print.reports', 'print.schedules',
                
                // Communication
                'communication.view', 'communication.send_notifications', 'communication.announcements',
            ],

            'Assistant Coach' => [
                // Student Management
                'students.view', 'students.progress',
                
                // Batch Management
                'batches.view', 'batches.assign_students',
                
                // Syllabus Management
                'syllabus.view', 'syllabus.techniques',
                
                // Attendance Management
                'attendance.view', 'attendance.create', 'attendance.edit',
                
                // Events Management
                'events.view', 'events.registrations',
                
                // Reports & Analytics
                'reports.view', 'reports.student_progress', 'reports.attendance',
                
                // Print & Documents
                'print.certificates', 'print.schedules',
            ],

            'Coach' => [
                // Student Management
                'students.view', 'students.progress',
                
                // Batch Management
                'batches.view',
                
                // Syllabus Management
                'syllabus.view', 'syllabus.techniques',
                
                // Attendance Management
                'attendance.view', 'attendance.create', 'attendance.edit',
                
                // Events Management
                'events.view',
                
                // Reports & Analytics
                'reports.view', 'reports.student_progress', 'reports.attendance',
                
                // Print & Documents
                'print.certificates',
            ],

            'Trainer' => [
                // Student Management
                'students.view', 'students.progress',
                
                // Attendance Management
                'attendance.view', 'attendance.create',
                
                // Syllabus Management
                'syllabus.view',
                
                // Print & Documents
                'print.certificates',
            ],

            'Receptionist' => [
                // Student Management
                'students.view', 'students.create', 'students.edit',
                
                // Fee Management
                'fees.view', 'fees.payments', 'fees.reports',
                
                // Events Management
                'events.view', 'events.registrations',
                
                // Print & Documents
                'print.receipts', 'print.student_cards',
                
                // Communication
                'communication.view', 'communication.send_notifications',
            ],

            'Student' => [
                // Limited access to own data
                'students.view',
                'attendance.view',
                'events.view',
                'syllabus.view',
                'fees.view',
            ],
        ];

        // Create roles and assign permissions
        foreach ($rolePermissions as $roleName => $permissions) {
            $role = Role::firstOrCreate(['name' => $roleName]);
            
            if ($permissions instanceof \Illuminate\Database\Eloquent\Collection) {
                // For Super Admin (all permissions)
                $role->syncPermissions($permissions);
            } else {
                // For other roles (specific permissions)
                $permissionObjects = [];
                foreach ($permissions as $permissionName) {
                    $permission = Permission::where('name', $permissionName)->first();
                    if ($permission) {
                        $permissionObjects[] = $permission;
                    }
                }
                $role->syncPermissions($permissionObjects);
            }
        }

        $this->command->info('Roles seeder completed successfully.');
    }
}
