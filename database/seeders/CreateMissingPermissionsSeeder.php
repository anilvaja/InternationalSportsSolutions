<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AcademyPermission;
use App\Models\AcademyRole;

class CreateMissingPermissionsSeeder extends Seeder
{
    public function run()
    {
        echo "Seeding all permissions from AcademyPermission model...\n";
        
        // Use the model's built-in method to seed all permissions
        AcademyPermission::seedPermissions();
        
        echo "All permissions seeded successfully!\n";

        // Assign all permissions to admin role
        $adminRole = AcademyRole::where('name', 'admin')->first();
        if ($adminRole) {
            $allPermissions = AcademyPermission::getAllPermissions();
            $assignedCount = 0;
            
            foreach ($allPermissions as $permission) {
                if (!$adminRole->hasPermission($permission['name'])) {
                    $adminRole->givePermission($permission['name']);
                    $assignedCount++;
                }
            }
            
            echo "Assigned {$assignedCount} permissions to admin role\n";
            echo "Total permissions in admin role: " . count($adminRole->permissions ?? []) . "\n";
        } else {
            echo "Admin role not found\n";
        }
    }
}
