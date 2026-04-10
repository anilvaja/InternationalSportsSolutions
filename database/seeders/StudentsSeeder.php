<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Student;
use App\Models\Academy;
use App\Models\Branch;
use Faker\Factory as Faker;

class StudentsSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        $faker = Faker::create('en_IN'); // Use Indian locale
        
        // Get academy and branches
        $academy = Academy::first();
        $branches = Branch::where('academy_id', $academy->id)->get();
        
        if (!$academy || $branches->isEmpty()) {
            $this->command->info('No academy or branches found. Please run academy and branch seeders first.');
            return;
        }

        // Belt levels progression
        $beltLevels = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Brown', 'Black 1st Dan', 'Black 2nd Dan'];

        // Indian names arrays
        $maleNames = ['Arjun', 'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Sai', 'Aryan', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Advik', 'Harsh', 'Karan', 'Parth', 'Rohan', 'Ved', 'Dhruv', 'Ravi', 'Amit', 'Suresh', 'Raj', 'Vikram', 'Ankit', 'Nikhil'];
        $femaleNames = ['Aadhya', 'Ananya', 'Kavya', 'Diya', 'Anika', 'Saanvi', 'Pari', 'Avni', 'Myra', 'Sara', 'Priya', 'Pooja', 'Shreya', 'Riya', 'Nisha', 'Meera', 'Kavita', 'Sita', 'Geeta', 'Asha', 'Sunita', 'Deepika', 'Neha', 'Rani', 'Kiran'];
        $lastNames = ['Patel', 'Shah', 'Modi', 'Desai', 'Joshi', 'Mehta', 'Sharma', 'Trivedi', 'Dave', 'Amin', 'Parikh', 'Vyas', 'Pandya', 'Kothari', 'Shukla', 'Agarwal', 'Thakkar', 'Raval', 'Bhatt', 'Suthar', 'Gohil', 'Solanki', 'Chauhan', 'Rathod', 'Jadeja'];
        
        // Gujarat cities
        $gujaratiCities = ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Bharuch', 'Anand', 'Morbi', 'Nadiad', 'Surendranagar', 'Bhuj', 'Palanpur', 'Vapi', 'Godhra', 'Veraval', 'Porbandar', 'Navsari'];

        // Age groups for realistic data
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

            // Generate student data with Indian names
            $gender = $faker->randomElement(['Male', 'Female']);
            $firstName = $gender === 'Male' ? $faker->randomElement($maleNames) : $faker->randomElement($femaleNames);
            $lastName = $faker->randomElement($lastNames);
            
            // Belt level based on experience (newer students have lower belts)
            $experienceMonths = $faker->numberBetween(1, 60);
            $beltIndex = min(floor($experienceMonths / 8), count($beltLevels) - 1);
            $currentBelt = $beltLevels[$beltIndex];

            // Student ID format: Academy code + year + sequential number
            $studentId = 'ISS' . date('y') . str_pad($i + 1, 4, '0', STR_PAD_LEFT);
            
            // Random Gujarat city
            $city = $faker->randomElement($gujaratiCities);

            $students[] = [
                'academy_id' => $academy->id,
                'branch_id' => $branches->random()->id,
                'student_id' => $studentId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'date_of_birth' => $birthDate->format('Y-m-d'),
                'gender' => $gender,
                'phone' => '+91 ' . $faker->numerify('##########'),
                'email' => strtolower($firstName . '.' . $lastName . $faker->numberBetween(1, 999) . '@gmail.com'),
                'address' => $faker->randomElement(['A-', 'B-', 'C-']) . $faker->numberBetween(1, 500) . ', ' . $faker->randomElement(['Krishna Society', 'Shanti Nagar', 'Ram Nagar', 'Ganesh Complex', 'Sardar Society', 'Patel Colony', 'Ashok Nagar', 'Vijay Park', 'Moti Nagar', 'Shiv Shakti Society']),
                'city' => $city,
                'state' => 'Gujarat',
                'postal_code' => $faker->numberBetween(360001, 399999),
                'country' => 'India',
                'parent_name' => ($gender === 'Male' ? $faker->randomElement(['Ramesh', 'Suresh', 'Mahesh', 'Dinesh', 'Rakesh', 'Hitesh', 'Jignesh', 'Paresh']) : $faker->randomElement(['Sushila', 'Kamala', 'Parvati', 'Savita', 'Usha', 'Meera', 'Gita', 'Rita'])) . ' ' . $lastName,
                'parent_phone' => '+91 ' . $faker->numerify('##########'),
                'parent_email' => $age < 18 ? strtolower('parent.' . $lastName . $faker->numberBetween(1, 99) . '@gmail.com') : null,
                'parent_relationship' => $age < 18 ? $faker->randomElement(['Father', 'Mother', 'Guardian']) : 'Parent',
                'emergency_contact_name' => $faker->randomElement($gender === 'Male' ? $maleNames : $femaleNames) . ' ' . $faker->randomElement($lastNames),
                'emergency_contact_phone' => '+91 ' . $faker->numerify('##########'),
                'emergency_contact_relationship' => $faker->randomElement(['Father', 'Mother', 'Uncle', 'Aunt', 'Grandfather', 'Grandmother', 'Brother', 'Sister']),
                'medical_conditions' => $faker->optional(0.3)->randomElement(['Asthma', 'Diabetes', 'Hypertension', 'None', 'Allergic Rhinitis']),
                'allergies' => $faker->optional(0.2)->randomElement(['Dust', 'Pollen', 'Food allergy', 'None']),
                'medications' => $faker->optional(0.1)->randomElement(['None', 'Inhaler for asthma', 'Insulin', 'Blood pressure medication']),
                'blood_group' => $faker->optional(0.8)->randomElement(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
                'dietary_restrictions' => $faker->optional(0.3)->randomElement(['Vegetarian', 'Jain vegetarian', 'No restrictions', 'Lactose intolerant']),
                'enrollment_date' => $faker->dateTimeBetween('-2 years', 'now')->format('Y-m-d'),
                'status' => $faker->randomElement(['active', 'active', 'active', 'active', 'inactive', 'suspended']), // Weighted towards active
                'belt_level' => $currentBelt,
                'notes' => $faker->optional(0.3)->sentence(8),
                'photo' => null,
                'documents' => null,
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ];
        }

        // Insert students in chunks for better performance
        foreach (array_chunk($students, 50) as $chunk) {
            Student::insert($chunk);
        }

        $this->command->info("Students seeder completed successfully. Created {$totalStudents} students with Indian names and Gujarat locations.");
    }
}
