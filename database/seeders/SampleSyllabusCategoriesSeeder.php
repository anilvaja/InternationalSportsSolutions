<?php

namespace Database\Seeders;

use App\Models\Academy;
use App\Models\SyllabusCategory;
use Illuminate\Database\Seeder;

class SampleSyllabusCategoriesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $academies = Academy::all();
        
        $categories = [
            [
                'name' => 'Yoga',
                'description' => 'Traditional yoga practices and poses',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 60,
                'color' => '#10b981',
                'icon' => '🧘‍♀️'
            ],
            [
                'name' => 'Karate',
                'description' => 'Traditional martial arts techniques and forms',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 90,
                'color' => '#f59e0b',
                'icon' => '🥋'
            ],
            [
                'name' => 'Cricket',
                'description' => 'Cricket fundamentals and advanced techniques',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 120,
                'color' => '#3b82f6',
                'icon' => '🏏'
            ],
            [
                'name' => 'Swimming',
                'description' => 'Swimming strokes and water safety',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 60,
                'color' => '#06b6d4',
                'icon' => '🏊‍♂️'
            ],
            [
                'name' => 'Basketball',
                'description' => 'Basketball fundamentals and team play',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 90,
                'color' => '#f97316',
                'icon' => '🏀'
            ],
            [
                'name' => 'Tennis',
                'description' => 'Tennis techniques and court strategies',
                'difficulty_level' => 'beginner',
                'estimated_duration_minutes' => 90,
                'color' => '#84cc16',
                'icon' => '🎾'
            ]
        ];

        foreach ($academies as $academy) {
            foreach ($categories as $categoryData) {
                SyllabusCategory::firstOrCreate(
                    [
                        'academy_id' => $academy->id,
                        'name' => $categoryData['name']
                    ],
                    array_merge($categoryData, [
                        'academy_id' => $academy->id,
                        'status' => 'active',
                        'sort_order' => 0
                    ])
                );
            }
        }

        $this->command->info('Sample syllabus categories created successfully!');
    }
}
