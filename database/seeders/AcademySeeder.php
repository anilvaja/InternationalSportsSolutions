<?php

namespace Database\Seeders;

use App\Models\Academy;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

class AcademySeeder extends Seeder
{
    public function run()
    {
        $academies = [
            [
                'name' => 'Mahavir Sports Academy',
                'slug' => 'mahavir-sports',
                'description' => 'Premier sports training facility offering comprehensive programs for all skill levels.',
                'contact_email' => 'admin@mahavirsports.com',
                'contact_phone' => '+91-2791-234567',
                'address' => '12, Sardar Patel Stadium Complex',
                'city' => 'Ahmedabad',
                'state' => 'Gujarat',
                'country' => 'India',
                'postal_code' => '380009',
                'status' => 'active',
                'logo' => null,
                'max_users' => 50,
                'max_students' => 500,
                'max_branches' => 3,
                'max_coaches' => 25,
                'subscription_starts_at' => now()->toDateString(),
                'subscription_ends_at' => now()->addYear()->toDateString(),
                'settings' => [
                    'timezone' => 'Asia/Kolkata',
                    'currency' => 'INR',
                    'language' => 'en',
                    'allow_online_payments' => true,
                    'enable_notifications' => true,
                ]
            ]
        ];

        foreach ($academies as $academyData) {
            Academy::create($academyData);
        }
    }
}
