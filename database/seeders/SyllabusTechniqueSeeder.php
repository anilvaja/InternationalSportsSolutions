<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\SyllabusTechnique;
use App\Models\SyllabusCategory;

class SyllabusTechniqueSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        // Get academy ID
        $academyId = 1; // Elite Sports Academy
        
        // Get categories
        $basicCategory = SyllabusCategory::where('name', 'Basic Techniques')->first();
        $intermediateCategory = SyllabusCategory::where('name', 'Intermediate Techniques')->first();
        $advancedCategory = SyllabusCategory::where('name', 'Advanced Techniques')->first();
        $combatCategory = SyllabusCategory::where('name', 'Combat Applications')->first();
        $selfDefenseCategory = SyllabusCategory::where('name', 'Self Defense')->first();
        $formsCategory = SyllabusCategory::where('name', 'Forms/Kata')->first();

        $techniques = [
            // Basic Techniques
            [
                'name' => 'Jab',
                'slug' => 'jab',
                'description' => 'Basic straight punch with lead hand',
                'category_id' => $basicCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 1,
                'difficulty_level' => 'beginner',
                'estimated_learning_time_minutes' => 30,
                'status' => 'active',
            ],
            [
                'name' => 'Cross',
                'slug' => 'cross',
                'description' => 'Straight punch with rear hand',
                'category_id' => $basicCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 2,
                'difficulty_level' => 'beginner',
                'estimated_learning_time_minutes' => 30,
                'prerequisites' => ['Jab'],
                'status' => 'active',
            ],
            [
                'name' => 'Hook',
                'slug' => 'hook',
                'description' => 'Circular punch targeting the side of opponent',
                'category_id' => $basicCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 3,
                'difficulty_level' => 'beginner',
                'estimated_learning_time_minutes' => 45,
                'prerequisites' => ['Jab', 'Cross'],
                'status' => 'active',
            ],
            [
                'name' => 'Front Kick',
                'slug' => 'front-kick',
                'description' => 'Basic forward kick with ball of foot',
                'category_id' => $basicCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 5,
                'difficulty_level' => 'beginner',
                'estimated_learning_time_minutes' => 60,
                'status' => 'active',
            ],
            [
                'name' => 'Roundhouse Kick',
                'slug' => 'roundhouse-kick',
                'description' => 'Circular kick using shin or instep',
                'category_id' => $basicCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 6,
                'difficulty_level' => 'beginner',
                'estimated_learning_time_minutes' => 90,
                'prerequisites' => ['Front Kick'],
                'status' => 'active',
            ],

            // Intermediate Techniques
            [
                'name' => 'Side Kick',
                'slug' => 'side-kick',
                'description' => 'Lateral kick using heel or blade of foot',
                'category_id' => $intermediateCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 1,
                'difficulty_level' => 'intermediate',
                'estimated_learning_time_minutes' => 120,
                'prerequisites' => ['Front Kick', 'Roundhouse Kick'],
                'status' => 'active',
            ],
            [
                'name' => 'Back Kick',
                'slug' => 'back-kick',
                'description' => 'Backward thrust kick with heel',
                'category_id' => $intermediateCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 2,
                'difficulty_level' => 'intermediate',
                'estimated_learning_time_minutes' => 150,
                'prerequisites' => ['Side Kick'],
                'status' => 'active',
            ],
            [
                'name' => 'Knee Strike',
                'slug' => 'knee-strike',
                'description' => 'Upward strike using knee',
                'category_id' => $intermediateCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 4,
                'difficulty_level' => 'intermediate',
                'estimated_learning_time_minutes' => 90,
                'status' => 'active',
            ],

            // Advanced Techniques
            [
                'name' => 'Flying Kick',
                'slug' => 'flying-kick',
                'description' => 'Aerial kick technique with jump',
                'category_id' => $advancedCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 1,
                'difficulty_level' => 'advanced',
                'estimated_learning_time_minutes' => 300,
                'status' => 'active',
            ],

            // Self Defense
            [
                'name' => 'Wrist Escape',
                'slug' => 'wrist-escape',
                'description' => 'Techniques to escape wrist grabs',
                'category_id' => $selfDefenseCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 1,
                'difficulty_level' => 'beginner',
                'estimated_learning_time_minutes' => 90,
                'status' => 'active',
            ],

            // Forms/Kata
            [
                'name' => 'Basic Form 1',
                'slug' => 'basic-form-1',
                'description' => 'First traditional form with basic techniques',
                'category_id' => $formsCategory?->id,
                'academy_id' => $academyId,
                'sort_order' => 1,
                'difficulty_level' => 'beginner',
                'estimated_learning_time_minutes' => 240,
                'status' => 'active',
            ],
        ];

        foreach ($techniques as $technique) {
            if ($technique['category_id']) {
                SyllabusTechnique::firstOrCreate(
                    [
                        'name' => $technique['name'],
                        'category_id' => $technique['category_id']
                    ],
                    $technique
                );
            }
        }

        $this->command->info('Syllabus Technique seeder completed successfully.');
    }
}
