<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class BatchSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get first academy for testing
        $academy = \App\Models\Academy::first();
        if (!$academy) {
            $this->command->info('No academy found. Please create an academy first.');
            return;
        }

        // Get first branch
        $branch = \App\Models\Branch::where('academy_id', $academy->id)->first();
        if (!$branch) {
            $this->command->info('No branch found. Please create a branch first.');
            return;
        }

        // Get a coach (user with coach role or any user from academy)
        $coach = \App\Models\User::where('academy_id', $academy->id)
            ->where('is_super_admin', false)
            ->first();
            
        // If no coach exists, create some academy users first
        if (!$coach) {
            $this->command->info('No academy users found. Creating sample academy users...');
            
            // Create sample academy users to serve as coaches
            $coaches = [
                [
                    'name' => 'John Smith',
                    'email' => 'john.smith@' . strtolower(str_replace(' ', '', $academy->name)) . '.com',
                    'password' => bcrypt('password123'),
                    'academy_id' => $academy->id,
                    'is_super_admin' => false,
                    'email_verified_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'name' => 'Sarah Johnson',
                    'email' => 'sarah.johnson@' . strtolower(str_replace(' ', '', $academy->name)) . '.com',
                    'password' => bcrypt('password123'),
                    'academy_id' => $academy->id,
                    'is_super_admin' => false,
                    'email_verified_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ];
            
            foreach ($coaches as $coachData) {
                \App\Models\User::create($coachData);
            }
            
            // Get the first created coach
            $coach = \App\Models\User::where('academy_id', $academy->id)
                ->where('is_super_admin', false)
                ->first();
                
            $this->command->info('Created ' . count($coaches) . ' academy users.');
        }

        // Create sample batches
        $batches = [
            [
                'name' => 'Morning Beginners',
                'batch_code' => 'MB-001',
                'description' => 'Morning batch for beginner students focusing on basic techniques and fundamentals.',
                'academy_id' => $academy->id,
                'branch_id' => $branch->id,
                'coach_id' => $coach?->id,
                'start_date' => now(),
                'end_date' => now()->addMonths(6),
                'start_time' => '07:00:00',
                'end_time' => '08:30:00',
                'days_of_week' => ['monday', 'wednesday', 'friday'],
                'max_students' => 25,
                'level' => 'beginner',
                'age_group' => '18+ Adults',
                'fees_amount' => 2500.00,
                'room_location' => 'Ground Floor - Room A1',
                'is_active' => true,
            ],
            [
                'name' => 'Evening Advanced',
                'batch_code' => 'EA-001',
                'description' => 'Advanced evening batch for experienced students working on competition techniques.',
                'academy_id' => $academy->id,
                'branch_id' => $branch->id,
                'coach_id' => $coach?->id,
                'start_date' => now(),
                'end_date' => now()->addMonths(8),
                'start_time' => '18:00:00',
                'end_time' => '19:30:00',
                'days_of_week' => ['tuesday', 'thursday', 'saturday'],
                'max_students' => 15,
                'level' => 'advanced',
                'age_group' => '16+ Teens & Adults',
                'fees_amount' => 3500.00,
                'room_location' => 'Ground Floor - Room A2',
                'is_active' => true,
            ],
        ];

        foreach ($batches as $batchData) {
            \App\Models\Batch::create($batchData);
        }

        $this->command->info('Sample batches created successfully!');
    }
}
