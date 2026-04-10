<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AcademyPermission;
use App\Models\AcademyRole;

class CreateAttendancePermissionSeeder extends Seeder
{
    public function run()
    {
        // Create the view_attendance permission if it doesn't exist
        $permission = AcademyPermission::firstOrCreate([
            'name' => 'view_attendance'
        ], [
            'description' => 'View attendance records',
            'category' => 'attendance',
            'is_active' => true
        ]);

        echo "Permission 'view_attendance' created/found: " . $permission->id . "\n";

        // Assign to admin role
        $adminRole = AcademyRole::where('name', 'admin')->first();
        if ($adminRole) {
            if (!$adminRole->hasPermission('view_attendance')) {
                $adminRole->givePermission('view_attendance');
                echo "Permission 'view_attendance' assigned to admin role\n";
            } else {
                echo "Permission 'view_attendance' already assigned to admin role\n";
            }
        } else {
            echo "Admin role not found\n";
        }
    }
}
