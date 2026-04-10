<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\SyllabusCategory;

class SyllabusCategorySeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Basic Techniques',
                'slug' => 'basic-techniques',
                'description' => 'Fundamental movement patterns and basic techniques for beginners',
                'academy_id' => 1,
                'sort_order' => 1,
                'belt_level' => 'White',
                'age_group' => 'all',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 480,
                'status' => 'active',
            ],
            [
                'name' => 'Intermediate Techniques',
                'slug' => 'intermediate-techniques',
                'description' => 'More complex techniques building on basic foundations',
                'academy_id' => 1,
                'sort_order' => 2,
                'belt_level' => 'Orange',
                'age_group' => 'all',
                'difficulty_level' => 'intermediate',
                'estimated_duration_minutes' => 720,
                'status' => 'active',
            ],
            [
                'name' => 'Advanced Techniques',
                'slug' => 'advanced-techniques',
                'description' => 'Advanced technical skills for experienced practitioners',
                'academy_id' => 1,
                'sort_order' => 3,
                'belt_level' => 'Blue',
                'age_group' => 'all',
                'difficulty_level' => 'advanced',
                'estimated_duration_minutes' => 960,
                'status' => 'active',
            ],
            [
                'name' => 'Combat Applications',
                'slug' => 'combat-applications',
                'description' => 'Practical application of techniques in sparring and competition',
                'academy_id' => 1,
                'sort_order' => 4,
                'belt_level' => 'Green',
                'age_group' => 'teens',
                'difficulty_level' => 'intermediate',
                'estimated_duration_minutes' => 600,
                'status' => 'active',
            ],
            [
                'name' => 'Self Defense',
                'slug' => 'self-defense',
                'description' => 'Practical self-defense techniques and scenarios',
                'academy_id' => 1,
                'sort_order' => 5,
                'belt_level' => 'Yellow',
                'age_group' => 'all',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 360,
                'status' => 'active',
            ],
            [
                'name' => 'Forms/Kata',
                'slug' => 'forms-kata',
                'description' => 'Traditional forms and patterns for skill development',
                'academy_id' => 1,
                'sort_order' => 6,
                'belt_level' => 'Yellow',
                'age_group' => 'all',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 540,
                'status' => 'active',
            ],
            [
                'name' => 'Weapons Training',
                'slug' => 'weapons-training',
                'description' => 'Training with traditional martial arts weapons',
                'academy_id' => 1,
                'sort_order' => 7,
                'belt_level' => 'Brown',
                'age_group' => 'adults',
                'difficulty_level' => 'advanced',
                'estimated_duration_minutes' => 720,
                'status' => 'active',
            ],
            [
                'name' => 'Conditioning',
                'slug' => 'conditioning',
                'description' => 'Physical conditioning and strength training exercises',
                'academy_id' => 1,
                'sort_order' => 8,
                'belt_level' => 'White',
                'age_group' => 'all',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 240,
                'status' => 'active',
            ],
            [
                'name' => 'Flexibility & Mobility',
                'slug' => 'flexibility-mobility',
                'description' => 'Stretching routines and mobility exercises',
                'academy_id' => 1,
                'sort_order' => 9,
                'belt_level' => 'White',
                'age_group' => 'all',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 180,
                'status' => 'active',
            ],
            [
                'name' => 'Mental Training',
                'slug' => 'mental-training',
                'description' => 'Meditation, focus, and mental preparation techniques',
                'academy_id' => 1,
                'sort_order' => 10,
                'belt_level' => 'Green',
                'age_group' => 'all',
                'difficulty_level' => 'intermediate',
                'estimated_duration_minutes' => 300,
                'status' => 'active',
            ],
        ];

        foreach ($categories as $category) {
            SyllabusCategory::firstOrCreate(
                ['name' => $category['name'], 'slug' => $category['slug']],
                $category
            );
        }
    }
}
