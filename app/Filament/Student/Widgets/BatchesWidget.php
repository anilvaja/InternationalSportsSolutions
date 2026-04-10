<?php

namespace App\Filament\Student\Widgets;

use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Auth;

class BatchesWidget extends Widget
{
    protected static string $view = 'filament.student.widgets.batches';
    
    protected int | string | array $columnSpan = 1;

    public function getViewData(): array
    {
        $student = Auth::guard('student')->user();
        
        $activeBatches = $student->activeBatches()->with(['branch', 'coach'])->get();
        
        return [
            'activeBatches' => $activeBatches,
        ];
    }
}
