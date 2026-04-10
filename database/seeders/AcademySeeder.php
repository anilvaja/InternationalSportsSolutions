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
            ],
            [
                'name' => 'Sardar Martial Arts Academy',
                'slug' => 'sardar-martial-arts',
                'description' => 'Traditional martial arts training with modern techniques.',
                'contact_email' => 'info@sardarmartialarts.com',
                'contact_phone' => '+91-2652-987654',
                'address' => '23, Heritage Sports Complex',
                'city' => 'Vadodara',
                'state' => 'Gujarat',
                'country' => 'India',
                'postal_code' => '390001',
                'status' => 'active',
                'logo' => null,
                'max_users' => 30,
                'max_students' => 300,
                'max_branches' => 2,
                'max_coaches' => 15,
                'subscription_starts_at' => now()->toDateString(),
                'subscription_ends_at' => now()->addMonths(6)->toDateString(),
                'settings' => [
                    'timezone' => 'Asia/Kolkata',
                    'currency' => 'INR',
                    'language' => 'en',
                    'allow_online_payments' => true,
                    'enable_notifications' => true,
                ]
            ],
            [
                'name' => 'Lions Basketball Academy',
                'slug' => 'lions-basketball',
                'description' => 'Basketball excellence through professional coaching and training.',
                'contact_email' => 'contact@lionsbasketball.com',
                'contact_phone' => '+91-2832-456789',
                'address' => '45, Bhavnagar Sports Complex',
                'city' => 'Bhavnagar',
                'state' => 'Gujarat',
                'country' => 'India',
                'postal_code' => '364001',
                'status' => 'active',
                'logo' => null,
                'max_users' => 40,
                'max_students' => 400,
                'max_branches' => 2,
                'max_coaches' => 20,
                'subscription_starts_at' => now()->subMonth()->toDateString(),
                'subscription_ends_at' => now()->addMonths(11)->toDateString(),
                'settings' => [
                    'timezone' => 'Asia/Kolkata',
                    'currency' => 'INR',
                    'language' => 'en',
                    'allow_online_payments' => false,
                    'enable_notifications' => true,
                ]
            ],
            [
                'name' => 'Gujarat Swimming Club',
                'slug' => 'gujarat-swimming',
                'description' => 'Professional swimming training for competitive and recreational swimmers.',
                'contact_email' => 'hello@gujaratswimming.com',
                'contact_phone' => '+91-2662-321098',
                'address' => '67, Narmada Aquatic Center',
                'city' => 'Bharuch',
                'state' => 'Gujarat',
                'country' => 'India',
                'postal_code' => '392001',
                'status' => 'inactive',
                'logo' => null,
                'max_users' => 20,
                'max_students' => 150,
                'max_branches' => 1,
                'max_coaches' => 8,
                'subscription_starts_at' => now()->toDateString(),
                'subscription_ends_at' => now()->addDays(14)->toDateString(),
                'settings' => [
                    'timezone' => 'Asia/Kolkata',
                    'currency' => 'INR',
                    'language' => 'en',
                    'allow_online_payments' => true,
                    'enable_notifications' => false,
                ]
            ],
            [
                'name' => 'Rajkot Tennis Academy',
                'slug' => 'rajkot-tennis',
                'description' => 'Tennis excellence through personalized coaching programs.',
                'contact_email' => 'serve@rajkottennis.com',
                'contact_phone' => '+91-2822-567890',
                'address' => '89, Saurashtra Tennis Complex',
                'city' => 'Rajkot',
                'state' => 'Gujarat',
                'country' => 'India',
                'postal_code' => '360001',
                'status' => 'inactive',
                'logo' => null,
                'max_users' => 25,
                'max_students' => 200,
                'max_branches' => 1,
                'max_coaches' => 12,
                'subscription_starts_at' => now()->subMonths(2)->toDateString(),
                'subscription_ends_at' => now()->subMonth()->toDateString(),
                'settings' => [
                    'timezone' => 'Asia/Kolkata',
                    'currency' => 'INR',
                    'language' => 'en',
                    'allow_online_payments' => true,
                    'enable_notifications' => true,
                ]
            ],
            [
                'name' => 'Diamond Cricket Academy',
                'slug' => 'diamond-cricket',
                'description' => 'Cricket coaching academy for all ages and skill levels.',
                'contact_email' => 'info@diamondcricket.com',
                'contact_phone' => '+91-2692-789012',
                'address' => '34, Sabarmati Cricket Ground',
                'city' => 'Gandhinagar',
                'state' => 'Gujarat',
                'country' => 'India',
                'postal_code' => '382010',
                'status' => 'active',
                'logo' => null,
                'max_users' => 35,
                'max_students' => 350,
                'max_branches' => 2,
                'max_coaches' => 18,
                'subscription_starts_at' => now()->toDateString(),
                'subscription_ends_at' => now()->addMonths(8)->toDateString(),
                'settings' => [
                    'timezone' => 'Asia/Kolkata',
                    'currency' => 'INR',
                    'language' => 'en',
                    'allow_online_payments' => true,
                    'enable_notifications' => true,
                ]
            ],
            [
                'name' => 'Kutch Football Academy',
                'slug' => 'kutch-football',
                'description' => 'Football training academy focusing on grassroots development.',
                'contact_email' => 'contact@kutchfootball.com',
                'contact_phone' => '+91-2832-123456',
                'address' => '56, Kutch Sports Stadium',
                'city' => 'Bhuj',
                'state' => 'Gujarat',
                'country' => 'India',
                'postal_code' => '370001',
                'status' => 'active',
                'logo' => null,
                'max_users' => 28,
                'max_students' => 280,
                'max_branches' => 1,
                'max_coaches' => 14,
                'subscription_starts_at' => now()->toDateString(),
                'subscription_ends_at' => now()->addMonths(10)->toDateString(),
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
