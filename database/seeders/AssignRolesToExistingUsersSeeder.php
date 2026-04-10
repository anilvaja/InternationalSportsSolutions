<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\AcademyRole;
use App\Models\UserAcademyRole;
use Illuminate\Database\Seeder;

class AssignRolesToExistingUsersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get all academy users (non-super admin users with academy_id)
        $academyUsers = User::where('is_super_admin', false)
            ->whereNotNull('academy_id')
            ->get();

        foreach ($academyUsers as $user) {
            // Skip if user already has a role assigned
            $existingRole = UserAcademyRole::where('user_id', $user->id)
                ->where('academy_id', $user->academy_id)
                ->first();

            if ($existingRole) {
                continue;
            }

            // Assign default 'admin' role to academy users
            $adminRole = AcademyRole::where('academy_id', $user->academy_id)
                ->where('name', 'admin')
                ->first();

            if ($adminRole) {
                UserAcademyRole::create([
                    'user_id' => $user->id,
                    'academy_id' => $user->academy_id,
                    'academy_role_id' => $adminRole->id,
                    'is_active' => true,
                    'assigned_at' => now(),
                    'additional_permissions' => [],
                ]);

                $this->command->info("Assigned admin role to user: {$user->name} (ID: {$user->id})");
            }
        }
    }
}
