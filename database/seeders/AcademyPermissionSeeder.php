<?php

namespace Database\Seeders;

use App\Models\AcademyPermission;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class AcademyPermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
    // Delete all old permissions
    DB::table('academy_permissions')->truncate();

    // Seed only the up-to-date permissions
    AcademyPermission::seedPermissions();

    $this->command->info('Academy permissions seeded successfully!');
    }
}
