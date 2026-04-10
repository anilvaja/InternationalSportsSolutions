<?php

namespace App\Filament\Student\Widgets;

use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Auth;

class StudentProfileWidget extends Widget
{
    protected static string $view = 'filament.student.widgets.student-profile';
    
    protected int | string | array $columnSpan = 1;

    public function getViewData(): array
    {
        $student = Auth::guard('student')->user();
        
        return [
            'student' => $student,
            'activeBatches' => $student->activeBatches()->with('branch')->get(),
            'totalBatches' => $student->batches()->count(),
        ];
    }
}
