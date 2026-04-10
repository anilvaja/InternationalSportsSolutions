<?php

namespace App\Filament\Student\Widgets;

use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class FeesWidget extends Widget
{
    protected static string $view = 'filament.student.widgets.fees';
    
    protected int | string | array $columnSpan = 1;

    public function getViewData(): array
    {
        $student = Auth::guard('student')->user();
        
        $pendingFees = $student->fees()
            ->where('status', 'pending')
            ->orderBy('fees_from_date')
            ->limit(3)
            ->get();
            
        $overdueFees = $student->fees()
            ->where('status', 'pending')
            ->where('fees_from_date', '<', Carbon::today())
            ->count();
            
        $totalOutstanding = $student->fees()
            ->where('status', 'pending')
            ->sum('fees_amount');
        
        return [
            'pendingFees' => $pendingFees,
            'overdueFees' => $overdueFees,
            'totalOutstanding' => $totalOutstanding,
        ];
    }
}
