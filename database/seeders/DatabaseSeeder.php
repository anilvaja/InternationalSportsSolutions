<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Academy;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        // Create Super Admin (update if exists)
        User::updateOrCreate(
            ['email' => 'anilvaja.007@gmail.com'],
            [
                'name' => 'anilvaja',
                'password' => bcrypt('123'),
                'is_super_admin' => true,
            ]
        );
        
        // Run all seeders in proper order
        $this->call([
            AcademySeeder::class,
            AcademyPermissionSeeder::class, // Seed academy permissions first
            PermissionsSeeder::class, // Then create Spatie permissions from academy permissions
            RolesSeeder::class,
            AssignAdminRolesSeeder::class,
            AssignRolesToExistingUsersSeeder::class,
            DefaultAcademyRolesSeeder::class,          
            // Comprehensive permission seeder for all resources
            AllResourcePermissionsSeeder::class, // Creates all resource permissions and assigns to admin

            // Legacy permission seeders (kept for backward compatibility but not needed)
            // CreateFeePermissionsSeeder::class,
            // CreateEventPermissionsSeeder::class,
            // CreateAttendancePermissionSeeder::class,
            // CreateMissingPermissionsSeeder::class,
            
            AssignAllPermissionsToAdminRoleSeeder::class, // Assign all permissions to admin roles
            BranchSeeder2::class, // Use BranchSeeder2 since BranchSeeder is empty
            SyllabusCategorySeeder::class,
            SyllabusTechniqueSeeder::class,
            StudentsSeeder::class, // Skip until fixed
            BatchSeeder::class, // Skip until coach issue fixed
            SettingsSeeder::class, // Add default settings
        ]);
        
        // Note: Academy admin users can now be created via the admin UI
        // No longer auto-creating academy admin users in seeder
    }
}
