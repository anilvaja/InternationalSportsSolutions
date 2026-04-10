<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Academy;
use App\Models\AcademyRole;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class DefaultAcademyUsersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Creating default academy users...');

        // Get the first academy (for demo purposes)
        $academy = Academy::first();
        
        if (!$academy) {
            $this->command->error('No academy found. Please create an academy first.');
            return;
        }

        // Ensure academy has default roles
        $academy->ensureDefaultRoles();

        $this->command->info("Using academy: {$academy->name} (ID: {$academy->id})");

        // 1. Create Academy Admin User
        $this->createAcademyAdmin($academy);

        // 2. Create Academy Staff Users with different roles but academy_staff in user table
        $this->createAcademyStaffUsers($academy);

        $this->command->info('Default academy users created successfully!');
    }

    private function createAcademyAdmin(Academy $academy): void
    {
        $adminUser = User::updateOrCreate(
            ['email' => 'admin@' . strtolower(str_replace(' ', '', $academy->name)) . '.com'],
            [
                'name' => $academy->name . ' Admin',
                'password' => Hash::make('password123'),
                'academy_id' => $academy->id,
                'role' => 'academy_admin',
                'phone' => '+1234567890',
                'status' => 'active',
                'is_super_admin' => false,
                'is_active' => true,
            ]
        );

        // Find admin role
        $adminRole = $academy->roles()->where('name', 'admin')->first();
        if ($adminRole) {
            // Remove existing role assignments
            $adminUser->userAcademyRoles()->delete();
            
            // Assign admin role
            $adminUser->userAcademyRoles()->create([
                'academy_role_id' => $adminRole->id,
                'academy_id' => $academy->id,
                'is_active' => true,
                'assigned_at' => now(),
            ]);
        }

        $this->command->info("✅ Created Academy Admin: {$adminUser->name} ({$adminUser->email})");
    }

    private function createAcademyStaffUsers(Academy $academy): void
    {
        $staffUsers = [
            [
                'name' => 'Head Coach',
                'email' => 'headcoach@' . strtolower(str_replace(' ', '', $academy->name)) . '.com',
                'academy_role' => 'coach',
                'display_name' => 'Head Coach',
                'permissions' => [
                    // Dashboard & Basic Access
                    'view_dashboard', 'view_widgets',
                    
                    // Student Management
                    'view_students', 'create_students', 'edit_students', 'view_student_details', 'view_student_progress',
                    
                    // Batch Management
                    'view_batches', 'create_batches', 'edit_batches', 'manage_batch_students', 'view_batch_schedules',
                    
                    // Attendance Management
                    'view_attendances', 'create_attendances', 'edit_attendances', 'take_attendance', 'view_attendance_reports',
                    
                    // Syllabus Management
                    'view_syllabus_categories', 'view_syllabus_techniques', 'edit_syllabus_techniques', 'manage_technique_progress',
                    
                    // Events
                    'view_events', 'manage_event_participants',
                    
                    // Reports & Analytics
                    'view_reports', 'generate_reports', 'view_student_analytics', 'view_attendance_analytics',
                ]
            ],
            [
                'name' => 'Reception Staff',
                'email' => 'reception@' . strtolower(str_replace(' ', '', $academy->name)) . '.com',
                'academy_role' => 'staff',
                'display_name' => 'Reception Staff',
                'permissions' => [
                    // Dashboard & Basic Access
                    'view_dashboard', 'view_widgets',
                    
                    // Student Management
                    'view_students', 'create_students', 'edit_students', 'manage_student_enrollment',
                    
                    // Basic Batch Info
                    'view_batches', 'view_batch_schedules',
                    
                    // Attendance - Basic
                    'view_attendances', 'create_attendances', 'take_attendance',
                    
                    // Fee Management
                    'view_fees', 'create_fees', 'collect_payments',
                    
                    // Events
                    'view_events', 'manage_event_participants',
                    
                    // Notifications
                    'view_notifications', 'send_notifications',
                ]
            ],
            [
                'name' => 'Finance Manager',
                'email' => 'finance@' . strtolower(str_replace(' ', '', $academy->name)) . '.com',
                'academy_role' => 'manager',
                'display_name' => 'Finance Manager',
                'permissions' => [
                    // Dashboard & Analytics
                    'view_dashboard', 'view_widgets', 'view_analytics_widgets',
                    
                    // Student Info (for fees)
                    'view_students', 'view_student_details',
                    
                    // Complete Fee Management
                    'view_fees', 'create_fees', 'edit_fees', 'delete_fees', 'export_fees',
                    'collect_payments', 'view_fee_reports', 'manage_fee_structures', 'process_refunds',
                    
                    // Event Fees
                    'view_event_fees', 'create_event_fees', 'edit_event_fees', 'collect_event_payments',
                    
                    // Financial Reports & Analytics
                    'view_reports', 'generate_reports', 'export_reports', 'view_financial_reports', 'view_revenue_analytics',
                    
                    // Academy Analytics
                    'view_academy_analytics',
                ]
            ],
            [
                'name' => 'Assistant Coach',
                'email' => 'assistant@' . strtolower(str_replace(' ', '', $academy->name)) . '.com',
                'academy_role' => 'coach',
                'display_name' => 'Assistant Coach',
                'permissions' => [
                    // Dashboard & Basic Access
                    'view_dashboard', 'view_widgets',
                    
                    // Student Management - View Only
                    'view_students', 'view_student_details', 'view_student_progress',
                    
                    // Batch Management - View Only
                    'view_batches', 'view_batch_schedules',
                    
                    // Attendance Management
                    'view_attendances', 'create_attendances', 'edit_attendances', 'take_attendance',
                    
                    // Syllabus - View & Basic Management
                    'view_syllabus_categories', 'view_syllabus_techniques', 'manage_technique_progress',
                    
                    // Events - View Only
                    'view_events',
                ]
            ],
            [
                'name' => 'Administrative Staff',
                'email' => 'admin-staff@' . strtolower(str_replace(' ', '', $academy->name)) . '.com',
                'academy_role' => 'staff',
                'display_name' => 'Administrative Staff',
                'permissions' => [
                    // Dashboard & Basic Access
                    'view_dashboard', 'view_widgets',
                    
                    // Student Management
                    'view_students', 'create_students', 'edit_students', 'export_students',
                    
                    // Branch Management
                    'view_branches', 'create_branches', 'edit_branches',
                    
                    // Basic Batch Management
                    'view_batches', 'view_batch_schedules',
                    
                    // Attendance - View Only
                    'view_attendances',
                    
                    // Basic Reports
                    'view_reports',
                    
                    // Notifications
                    'view_notifications', 'create_notifications', 'send_notifications',
                    
                    // Academy Settings - Basic
                    'view_academy_settings',
                ]
            ],
        ];

        foreach ($staffUsers as $staffData) {
            $this->createStaffUser($academy, $staffData);
        }
    }

    private function createStaffUser(Academy $academy, array $staffData): void
    {
        // Create user with academy_staff role in user table
        $user = User::updateOrCreate(
            ['email' => $staffData['email']],
            [
                'name' => $staffData['name'],
                'password' => Hash::make('password123'),
                'academy_id' => $academy->id,
                'role' => 'academy_staff', // All non-admin users have academy_staff in user table
                'phone' => '+1234567890',
                'status' => 'active',
                'is_super_admin' => false,
                'is_active' => true,
            ]
        );

        // Find or create academy role
        $academyRole = $academy->roles()->where('name', $staffData['academy_role'])->first();
        
        if (!$academyRole) {
            // Create custom role if it doesn't exist
            $academyRole = $academy->roles()->create([
                'name' => $staffData['academy_role'],
                'display_name' => $staffData['display_name'],
                'description' => "Custom role for {$staffData['display_name']}",
                'permissions' => $staffData['permissions'],
                'is_active' => true,
                'is_default' => false,
                'is_removable' => true,
            ]);
        } else {
            // Update existing role with new permissions
            $academyRole->update([
                'display_name' => $staffData['display_name'],
                'permissions' => $staffData['permissions'],
            ]);
        }

        // Remove existing role assignments for this user in this academy
        $user->userAcademyRoles()->where('academy_id', $academy->id)->delete();
        
        // Assign academy role
        $user->userAcademyRoles()->create([
            'academy_role_id' => $academyRole->id,
            'academy_id' => $academy->id,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        $this->command->info("✅ Created {$staffData['display_name']}: {$user->name} ({$user->email}) - Academy Role: {$academyRole->display_name}");
    }
}
