<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AcademyPermission;
use App\Models\AcademyRole;

class CreateFeePermissionsSeeder extends Seeder
{
    public function run()
    {
        // Fee-related permissions
        $permissions = [
            'view_fees' => 'View Fees',
            'create_fees' => 'Create Fees', 
            'edit_fees' => 'Edit Fees',
            'delete_fees' => 'Delete Fees',
            'print_fees' => 'Print Fee Receipts',
            'export_fees' => 'Export Fee Data',
        ];

        foreach ($permissions as $name => $description) {
            $permission = AcademyPermission::firstOrCreate([
                'name' => $name
            ], [
                'display_name' => $description,
                'description' => $description,
                'category' => 'fees'
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
