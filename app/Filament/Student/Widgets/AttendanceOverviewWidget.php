<?php

namespace App\Filament\Student\Widgets;

use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class AttendanceOverviewWidget extends Widget
{
    protected static string $view = 'filament.student.widgets.attendance-overview';
    
    protected int | string | array $columnSpan = 1;

    public function getViewData(): array
    {
        $student = Auth::guard('student')->user();
        
        // Get attendance for current month
        $currentMonth = Carbon::now()->startOfMonth();
        $endOfMonth = Carbon::now()->endOfMonth();
        
        $attendances = $student->studentAttendances()
            ->whereBetween('date', [$currentMonth, $endOfMonth])
            ->with('batch')
            ->get();
            
        $totalClasses = $attendances->count();
        $presentClasses = $attendances->whereIn('status', ['present', 'late'])->count();
        $absentClasses = $attendances->where('status', 'absent')->count();
        $attendanceRate = $totalClasses > 0 ? round(($presentClasses / $totalClasses) * 100, 1) : 0;
        
        return [
            'totalClasses' => $totalClasses,
            'presentClasses' => $presentClasses,
            'absentClasses' => $absentClasses,
            'attendanceRate' => $attendanceRate,
            'currentMonth' => $currentMonth->format('F Y'),
        ];
    }
}
