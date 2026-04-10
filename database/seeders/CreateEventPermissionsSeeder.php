<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AcademyPermission;
use App\Models\AcademyRole;

class CreateEventPermissionsSeeder extends Seeder
{
    public function run()
    {
        // Additional event-related permissions that might be missing
        $permissions = [
            'view_events' => 'View Events',
            'create_events' => 'Create Events', 
            'edit_events' => 'Edit Events',
            'delete_events' => 'Delete Events',
            'view_event_fees' => 'View Event Fees',
            'create_event_fees' => 'Create Event Fees',
            'edit_event_fees' => 'Edit Event Fees', 
            'delete_event_fees' => 'Delete Event Fees',
        ];

        foreach ($permissions as $name => $description) {
            $permission = AcademyPermission::firstOrCreate([
                'name' => $name
            ], [
                'display_name' => $description,
                'description' => $description,
                'category' => 'events'
            ]);

            echo "Permission '{$name}' created/found: {$permission->id}\n";
        }

        // Assign all permissions to admin role
        $adminRole = AcademyRole::where('name', 'admin')->first();
        if ($adminRole) {
            foreach (array_keys($permissions) as $permissionName) {
                if (!$adminRole->hasPermission($permissionName)) {
                    $adminRole->givePermission($permissionName);
                    echo "Permission '{$permissionName}' assigned to admin role\n";
                } else {
                    echo "Permission '{$permissionName}' already assigned to admin role\n";
                }
            }
        } else {
            echo "Admin role not found\n";
        }
    }
}
