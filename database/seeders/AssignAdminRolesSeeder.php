<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\AcademyRole;
use Illuminate\Database\Seeder;

class AssignAdminRolesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Assign admin roles to academy admin users who don't have roles yet
        $academyAdmins = User::whereNotNull('academy_id')
            ->where('is_super_admin', false)
            ->whereDoesntHave('activeAcademyRoles')
            ->get();

        foreach ($academyAdmins as $user) {
            $adminRole = AcademyRole::where('academy_id', $user->academy_id)
                ->where('name', 'admin')
                ->first();

            if ($adminRole) {
                $user->assignAcademyRole($adminRole);
                $this->command->info("Assigned admin role to: {$user->name} for academy {$user->academy_id}");
            } else {
                $this->command->warn("No admin role found for academy {$user->academy_id}");
            }
        }

        $this->command->info('Admin role assignment completed!');
    }
}
