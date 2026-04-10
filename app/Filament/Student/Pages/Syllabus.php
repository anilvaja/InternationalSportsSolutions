<?php

namespace App\Filament\Student\Pages;

use Filament\Pages\Page;
use Illuminate\Support\Facades\Auth;

class Syllabus extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-academic-cap';
    
    protected static string $view = 'filament.student.pages.syllabus';
    
    protected static ?string $navigationLabel = 'My Syllabus';
    
    protected static ?string $navigationGroup = 'My Learning';
    
    protected static ?int $navigationSort = 1;

    public $syllabusData = [];

    public function mount(): void
    {
        $this->loadSyllabusData();
    }

    protected function loadSyllabusData(): void
    {
        $student = Auth::user();
        
        // Mock syllabus data for now
        $this->syllabusData = [
            'current_belt' => 'White Belt',
            'next_belt' => 'Yellow Belt',
            'progress_percentage' => 65,
            'completed_techniques' => 13,
            'total_techniques' => 20,
            'categories' => [
                [
                    'name' => 'Basic Stances',
                    'description' => 'Fundamental standing positions',
                    'completed' => 5,
                    'total' => 5,
                    'techniques' => [
                        ['name' => 'Horse Stance', 'status' => 'completed', 'learned_date' => '2024-12-01'],
                        ['name' => 'Front Stance', 'status' => 'completed', 'learned_date' => '2024-12-03'],
                        ['name' => 'Back Stance', 'status' => 'completed', 'learned_date' => '2024-12-05'],
                        ['name' => 'Cat Stance', 'status' => 'completed', 'learned_date' => '2024-12-10'],
                        ['name' => 'Natural Stance', 'status' => 'completed', 'learned_date' => '2024-12-15'],
                    ]
                ],
                [
                    'name' => 'Basic Kicks',
                    'description' => 'Fundamental kicking techniques',
                    'completed' => 3,
                    'total' => 6,
                    'techniques' => [
                        ['name' => 'Front Kick', 'status' => 'completed', 'learned_date' => '2024-12-20'],
                        ['name' => 'Side Kick', 'status' => 'completed', 'learned_date' => '2025-01-05'],
                        ['name' => 'Round Kick', 'status' => 'completed', 'learned_date' => '2025-01-10'],
                        ['name' => 'Back Kick', 'status' => 'in_progress', 'learned_date' => null],
                        ['name' => 'Hook Kick', 'status' => 'not_started', 'learned_date' => null],
                        ['name' => 'Axe Kick', 'status' => 'not_started', 'learned_date' => null],
                    ]
                ],
                [
                    'name' => 'Basic Punches',
                    'description' => 'Fundamental punching techniques',
                    'completed' => 5,
                    'total' => 7,
                    'techniques' => [
                        ['name' => 'Straight Punch', 'status' => 'completed', 'learned_date' => '2024-11-15'],
                        ['name' => 'Jab', 'status' => 'completed', 'learned_date' => '2024-11-20'],
                        ['name' => 'Cross', 'status' => 'completed', 'learned_date' => '2024-11-25'],
                        ['name' => 'Hook', 'status' => 'completed', 'learned_date' => '2024-12-01'],
                        ['name' => 'Uppercut', 'status' => 'completed', 'learned_date' => '2024-12-10'],
                        ['name' => 'Hammer Fist', 'status' => 'in_progress', 'learned_date' => null],
                        ['name' => 'Backfist', 'status' => 'not_started', 'learned_date' => null],
                    ]
                ],
                [
                    'name' => 'Basic Blocks',
                    'description' => 'Fundamental blocking techniques',
                    'completed' => 0,
                    'total' => 4,
                    'techniques' => [
                        ['name' => 'High Block', 'status' => 'not_started', 'learned_date' => null],
                        ['name' => 'Middle Block', 'status' => 'not_started', 'learned_date' => null],
                        ['name' => 'Low Block', 'status' => 'not_started', 'learned_date' => null],
                        ['name' => 'Knife Hand Block', 'status' => 'not_started', 'learned_date' => null],
                    ]
                ],
            ]
        ];
    }

    public function getViewData(): array
    {
        return [
            'syllabusData' => $this->syllabusData,
        ];
    }
}
