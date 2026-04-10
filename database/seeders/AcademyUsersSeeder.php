<?php

namespace Database\Seeders;

use App\Models\Academy;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AcademyUsersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Creating academy users with automatic role assignment...');

        // Get all academies
        $academies = Academy::all();

        foreach ($academies as $academy) {
            $this->command->info("Processing academy: {$academy->name}");

            // Ensure academy has default roles
            $academy->ensureDefaultRoles();
            // Create academy admin if doesn't exist
            $adminEmail = strtolower(str_replace(' ', '.', $academy->name)) . '-admin@internationalsportssolutions.com';
            $admin = User::firstOrCreate(
                ['email' => $adminEmail],
                [
                    'name' => $academy->name . ' Admin',
                    'password' => Hash::make('1'),
                    'academy_id' => $academy->id,
                    'role' => 'academy_admin', // This will auto-assign admin role
                    'is_active' => true,
                    'status' => 'active',
                    'employee_id' => 'ADM' . str_pad($academy->id, 3, '0', STR_PAD_LEFT),
                    'department' => 'Administration',
                ]
            );

            $this->command->info("  ✓ Academy Admin: {$admin->name} ({$admin->email})");
        }

        $this->command->info('Academy users seeding completed!');
        $this->command->info('Default password: admin123');
    }
}
