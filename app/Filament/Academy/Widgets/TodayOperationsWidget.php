<?php

namespace App\Filament\Academy\Widgets;

use App\Models\Batch;
use App\Models\BatchAttendance;
use App\Models\StudentAttendance;
use App\Models\Student;
use App\Support\AcademyPermissionHelper;
use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class TodayOperationsWidget extends Widget
{
    protected static string $view = 'filament.academy.widgets.today-operations-widget';

    protected int | string | array $columnSpan = 'full';

    protected static ?int $sort = -7;

    public function getTodayAttendanceData(): array
    {
        $user = Auth::user();
        if (!$user) {
            return [
                'totalEnrolled' => 0,
                'presentCount' => 0,
                'absentCount' => 0,
                'lateCount' => 0,
                'percentage' => 0,
                'recentAbsences' => [],
            ];
        }

        $academyId = $user->academy_id;
        $branchId = session('dashboard_selected_branch_id', 'all');
        $today = now()->toDateString();

        // Get batch attendances for today
        $batchAttendanceIds = BatchAttendance::where('academy_id', $academyId)
            ->whereDate('class_date', $today)
            ->pluck('id');

        $studentAttendanceQuery = StudentAttendance::whereIn('batch_attendance_id', $batchAttendanceIds);

        $presentCount = (clone $studentAttendanceQuery)->where('status', 'present')->count();
        $absentCount = (clone $studentAttendanceQuery)->where('status', 'absent')->count();
        $lateCount = (clone $studentAttendanceQuery)->where('status', 'late')->count();

        $totalMarked = $presentCount + $absentCount + $lateCount;
        $percentage = $totalMarked > 0 ? round((($presentCount + $lateCount) / $totalMarked) * 100, 1) : 0;

        // Recent absentees today or recent days
        $recentAbsences = StudentAttendance::whereIn('batch_attendance_id', $batchAttendanceIds)
            ->where('status', 'absent')
            ->with(['student', 'batchAttendance.batch'])
            ->latest()
            ->take(4)
            ->get();

        return [
            'totalMarked' => $totalMarked,
            'presentCount' => $presentCount,
            'absentCount' => $absentCount,
            'lateCount' => $lateCount,
            'percentage' => $percentage,
            'recentAbsences' => $recentAbsences,
        ];
    }

    public function getTodayBatches(): array
    {
        $user = Auth::user();
        if (!$user) return [];

        $academyId = $user->academy_id;
        $branchId = session('dashboard_selected_branch_id', 'all');
        $dayOfWeek = now()->englishDayOfWeek;

        $batchesQuery = Batch::where('academy_id', $academyId)
            ->where('is_active', true)
            ->with(['coach', 'branch']);

        if ($branchId !== 'all') {
            $batchesQuery->where('branch_id', $branchId);
        }

        $allBatches = $batchesQuery->get();

        $todayBatches = $allBatches->filter(function ($batch) use ($dayOfWeek) {
            if (empty($batch->days)) return true;
            $days = is_array($batch->days) ? $batch->days : (json_decode($batch->days, true) ?? []);
            if (empty($days)) return true;
            return in_array($dayOfWeek, (array) $days) || str_contains((string) json_encode($days), $dayOfWeek);
        })->sortBy('start_time')->values()->all();

        return $todayBatches;
    }
}
