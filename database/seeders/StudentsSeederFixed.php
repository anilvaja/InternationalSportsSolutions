<?php

namespace Database\Seeders;

use App\Models\Academy;
use App\Models\Branch;
use App\Models\Student;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Faker\Factory as Faker;

class StudentsSeederFixed extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faker = Faker::create();

        // Get existing academies and branches
        $branches = Branch::all();
        
        if ($branches->isEmpty()) {
            $this->command->warn('No branches found. Please run AcademySeeder first.');
            return;
        }

        // Belt levels for progression
        $beltLevels = [
            'White', 'Yellow', 'Orange', 'Green', 'Blue', 'Brown',
            'Black 1st Dan', 'Black 2nd Dan', 'Black 3rd Dan'
        ];

        $ageGroups = [
            'kids' => ['min' => 5, 'max' => 12],
            'teens' => ['min' => 13, 'max' => 17],
            'adults' => ['min' => 18, 'max' => 45],
            'seniors' => ['min' => 46, 'max' => 65]
        ];

        $students = [];
        $totalStudents = 150;

        for ($i = 0; $i < $totalStudents; $i++) {
            // Randomly select age group
            $ageGroupKey = array_rand($ageGroups);
            $ageGroup = $ageGroups[$ageGroupKey];
            $age = $faker->numberBetween($ageGroup['min'], $ageGroup['max']);
            $birthDate = now()->subYears($age)->subDays($faker->numberBetween(0, 365));

            // Generate student data
            $gender = $faker->randomElement(['male', 'female']); // lowercase to match enum
            $firstName = $gender === 'male' ? $faker->firstNameMale() : $faker->firstNameFemale();
            $lastName = $faker->lastName();
            
            // Belt level based on experience (newer students have lower belts)
            $experienceMonths = $faker->numberBetween(1, 60);
            $beltIndex = min(floor($experienceMonths / 8), count($beltLevels) - 1);
            $currentBelt = $beltLevels[$beltIndex];

            // Student ID format: Academy code + year + sequential number
            $studentId = 'ISS' . date('y') . str_pad($i + 1, 4, '0', STR_PAD_LEFT);

            // Check if minor for parent/guardian info
            $isMinor = $age < 18;

            // Get branch and academy relationship  
            $branch = $branches->random();

            $students[] = [
                'student_id' => $studentId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $faker->unique()->safeEmail(),
                'phone' => '+91 ' . $faker->numerify('##########'),
                'date_of_birth' => $birthDate,
                'gender' => $gender,
                'address' => $faker->address(),
                'city' => 'Mumbai',
                'state' => 'Maharashtra',
                'postal_code' => $faker->postcode(),
                'country' => 'India',
                
                // Parent information (required fields)
                'parent_name' => $faker->name(),
                'parent_phone' => '+91 ' . $faker->numerify('##########'),
                'parent_email' => $faker->optional(0.8)->safeEmail(),
                'parent_relationship' => $isMinor ? 
                    $faker->randomElement(['mother', 'father', 'guardian']) : 'parent',
                
                // Emergency contact
                'emergency_contact_name' => $faker->name(),
                'emergency_contact_phone' => '+91 ' . $faker->numerify('##########'),
                'emergency_contact_relationship' => $faker->randomElement(['mother', 'father', 'spouse', 'sibling', 'guardian']),
                
                // Medical information
                'medical_conditions' => $faker->optional(0.3)->sentence(3),
                'allergies' => $faker->optional(0.2)->word(),
                'medications' => $faker->optional(0.1)->sentence(2),
                'blood_group' => $faker->optional(0.8)->randomElement(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
                'dietary_restrictions' => $faker->optional(0.2)->sentence(3),
                
                // Academy information
                'academy_id' => $branch->academy_id,
                'branch_id' => $branch->id,
                'enrollment_date' => $faker->dateTimeBetween('-2 years', 'now'),
                'status' => $faker->randomElement(['active', 'active', 'active', 'active', 'inactive', 'suspended']), // Weighted towards active
                
                // Belt information
                'belt_level' => $currentBelt,
                'notes' => $faker->optional(0.3)->sentence(8),
                
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        // Insert students in chunks for better performance
        foreach (array_chunk($students, 50) as $chunk) {
            Student::insert($chunk);
        }

        $this->command->info("Students seeder completed successfully. Created {$totalStudents} students.");
    }
}
