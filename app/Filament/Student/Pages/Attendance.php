<?php

namespace App\Filament\Student\Pages;

use Filament\Pages\Page;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use App\Models\Student;

class Attendance extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-calendar-days';
    
    protected static string $view = 'filament.student.pages.attendance';
    
    protected static ?string $navigationLabel = 'My Attendance';
    
    protected static ?string $navigationGroup = 'My Records';
    
    protected static ?int $navigationSort = 1;

    public $selectedMonth;
    public $selectedYear;
    public $viewType = 'monthly';
    public $attendanceData = [];

    public function mount(): void
    {
        $this->selectedMonth = Carbon::now()->format('Y-m');
        $this->selectedYear = Carbon::now()->year;
        $this->loadAttendanceData();
    }

    public function updatedSelectedMonth(): void
    {
        $this->loadAttendanceData();
    }

    public function updatedSelectedYear(): void
    {
        $this->loadAttendanceData();
    }

    public function updatedViewType(): void
    {
        $this->loadAttendanceData();
    }

    protected function loadAttendanceData(): void
    {
        /** @var Student $student */
        $student = Auth::user();
        
        // Determine date range based on view type
        switch ($this->viewType) {
            case 'yearly':
                $startDate = Carbon::createFromDate($this->selectedYear, 1, 1)->startOfYear();
                $endDate = $startDate->copy()->endOfYear();
                break;
            case 'all-time':
                $startDate = null;
                $endDate = null;
                break;
            case 'monthly':
            default:
                $startDate = Carbon::createFromFormat('Y-m', $this->selectedMonth)->startOfMonth();
                $endDate = $startDate->copy()->endOfMonth();
                break;
        }

        // Build the query
        $query = $student->studentAttendances()
            ->with(['batchAttendance.batch'])
            ->whereHas('batchAttendance', function ($query) use ($startDate, $endDate) {
                if ($startDate && $endDate) {
                    $query->whereBetween('class_date', [$startDate, $endDate]);
                }
                // For all-time view, no date filtering
            });

        $attendanceRecords = $query->get();

        // Calculate statistics
        $totalClasses = $attendanceRecords->count();
        $presentCount = $attendanceRecords->where('status', 'present')->count();
        $lateCount = $attendanceRecords->where('status', 'late')->count();
        $absentCount = $attendanceRecords->where('status', 'absent')->count();
        $excusedCount = $attendanceRecords->where('status', 'excused')->count();
        
        // Consider both present and late as attendance
        $attendedCount = $presentCount + $lateCount;
        $attendanceRate = $totalClasses > 0 ? round(($attendedCount / $totalClasses) * 100, 1) : 0;

        // Prepare daily attendance data
        $dailyAttendance = [];
        foreach ($attendanceRecords as $record) {
            $batchAttendance = $record->batchAttendance;
            $batch = $batchAttendance->batch;
            
            $dailyAttendance[] = [
                'date' => $batchAttendance->class_date->format('Y-m-d'),
                'day' => $batchAttendance->class_date->format('l'),
                'status' => $record->status,
                'batch_name' => $batch->name ?? 'Unknown Batch',
                'start_time' => $batchAttendance->class_start_time ? 
                    Carbon::parse($batchAttendance->class_start_time)->format('H:i') : null,
                'end_time' => $batchAttendance->class_end_time ? 
                    Carbon::parse($batchAttendance->class_end_time)->format('H:i') : null,
                'actual_arrival_time' => $record->actual_arrival_time ? 
                    Carbon::parse($record->actual_arrival_time)->format('H:i') : null,
                'notes' => $record->notes,
                'participation_level' => $record->participation_level,
            ];
        }

        // Sort by date (newest first for better UX)
        usort($dailyAttendance, function ($a, $b) {
            return strcmp($b['date'], $a['date']);
        });

        $this->attendanceData = [
            'total_classes' => $totalClasses,
            'present' => $presentCount,
            'late' => $lateCount,
            'absent' => $absentCount,
            'excused' => $excusedCount,
            'attended' => $attendedCount,
            'attendance_rate' => $attendanceRate,
            'daily_attendance' => $dailyAttendance,
            'period_info' => $this->getPeriodInfo($startDate, $endDate),
        ];
    }

    protected function getPeriodInfo($startDate, $endDate): array
    {
        switch ($this->viewType) {
            case 'yearly':
                return [
                    'type' => 'yearly',
                    'year' => $this->selectedYear,
                    'description' => "Year {$this->selectedYear}",
                ];
            case 'all-time':
                return [
                    'type' => 'all-time',
                    'description' => 'Complete Academic Journey',
                ];
            case 'monthly':
            default:
                return [
                    'type' => 'monthly',
                    'month' => $this->selectedMonth,
                    'description' => Carbon::createFromFormat('Y-m', $this->selectedMonth)->format('F Y'),
                ];
        }
    }

    public function getViewData(): array
    {
        return [
            'selectedMonth' => $this->selectedMonth,
            'selectedYear' => $this->selectedYear,
            'viewType' => $this->viewType,
            'attendanceData' => $this->attendanceData,
        ];
    }
}
