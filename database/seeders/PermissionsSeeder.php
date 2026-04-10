<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AcademyPermission;
use Spatie\Permission\Models\Permission;

class PermissionsSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Get all permissions from AcademyPermission (single source of truth)
        $permissions = AcademyPermission::getAllPermissions();

        // Optionally, clear old permissions
        Permission::query()->delete();

        // Seed all permissions
        foreach ($permissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission['name'],
            ], [
                'name' => $permission['name'],
                'guard_name' => 'web',
            ]);
        }

        $this->command->info('Unified permissions seeder completed successfully.');
    }
}
