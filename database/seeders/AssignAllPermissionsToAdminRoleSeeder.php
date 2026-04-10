<?php

namespace Database\Seeders;

use App\Models\Academy;
use App\Models\AcademyPermission;
use App\Models\AcademyRole;
use Illuminate\Database\Seeder;

class AssignAllPermissionsToAdminRoleSeeder extends Seeder
{
    /**
     * Assign all permissions to the 'admin' role for each academy.
     */
    public function run(): void
    {
        // Get all academy permissions IDs
        $allPermissionIds = AcademyPermission::pluck('id')->toArray();
        
        $this->command->info("Found " . count($allPermissionIds) . " permissions to assign");

        // For each academy, find the admin role and assign all permissions
        foreach (Academy::all() as $academy) {
            $adminRole = AcademyRole::where('academy_id', $academy->id)
                                   ->where('name', 'admin')
                                   ->first();

            if (!$adminRole) {
                $this->command->warn("No admin role found for academy: {$academy->name}");
                continue;
            }

            // Update the admin role with all permissions
            $adminRole->update([
                'permissions' => $allPermissionIds
            ]);

            $this->command->info("✓ Assigned " . count($allPermissionIds) . " permissions to admin role for academy: {$academy->name}");
        }
        
        $this->command->info('All permissions assigned to admin roles for all academies successfully!');
    }
}
