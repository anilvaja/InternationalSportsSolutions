<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminUserSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        // Create or update the super admin user
        $user = User::updateOrCreate(
            ['email' => 'anilvaja.007@gmail.com'],
            [
                'name' => 'anilvaja',
                'password' => Hash::make('123'),
                'is_super_admin' => true,
                'is_active' => true,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        echo "Super admin user created/updated:\n";
        echo "Name: {$user->name}\n";
        echo "Email: {$user->email}\n";
        echo "Is Super Admin: " . ($user->is_super_admin ? 'Yes' : 'No') . "\n";
        echo "Is Active: " . ($user->is_active ? 'Yes' : 'No') . "\n";
        echo "Status: {$user->status}\n";
    }
}
