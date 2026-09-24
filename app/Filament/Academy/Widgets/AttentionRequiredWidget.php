<?php

namespace App\Filament\Academy\Widgets;

use App\Models\StaffAttendanceCorrection;
use App\Models\StaffLeave;
use App\Models\Fee;
use App\Models\Batch;
use App\Models\BatchAttendance;
use App\Support\AcademyPermissionHelper;
use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Auth;

class AttentionRequiredWidget extends Widget
{
    protected static string $view = 'filament.academy.widgets.attention-required-widget';

    protected int | string | array $columnSpan = 'full';

    protected static ?int $sort = -8;

    public function getAttentionItems(): array
    {
        $user = Auth::user();
        if (!$user) return [];

        $academyId = $user->academy_id;
        $branchId = session('dashboard_selected_branch_id', 'all');
        $items = [];

        // 1. Pending Staff Attendance Corrections
        if (AcademyPermissionHelper::can('view_staff_attendance_corrections')) {
            $query = StaffAttendanceCorrection::where('academy_id', $academyId)->where('status', 'pending');
            $count = $query->count();
            if ($count > 0) {
                $items[] = [
                    'severity' => 'danger',
                    'icon' => 'heroicon-o-exclamation-triangle',
                    'title' => 'Pending Attendance Corrections',
                    'count' => $count,
                    'label' => "{$count} staff attendance correction requests awaiting review",
                    'url' => url('/academy/staff-attendance-corrections'),
                    'action_label' => 'Review Requests',
                    'bg_color' => 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60',
                    'text_color' => 'text-rose-700 dark:text-rose-300',
                    'badge_bg' => 'bg-rose-600 text-white',
                ];
            }
        }

        // 2. Pending Staff Leave Approvals
        if (AcademyPermissionHelper::can('view_staff_leaves')) {
            $query = StaffLeave::where('academy_id', $academyId)->where('status', 'pending');
            $count = $query->count();
            if ($count > 0) {
                $items[] = [
                    'severity' => 'warning',
                    'icon' => 'heroicon-o-calendar-days',
                    'title' => 'Staff Leave Requests',
                    'count' => $count,
                    'label' => "{$count} staff leave requests awaiting approval",
                    'url' => url('/academy/staff-leaves'),
                    'action_label' => 'Approve Leaves',
                    'bg_color' => 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/60',
                    'text_color' => 'text-orange-700 dark:text-orange-300',
                    'badge_bg' => 'bg-orange-600 text-white',
                ];
            }
        }

        // 3. Overdue Student Fees
        if (AcademyPermissionHelper::can('view_fees')) {
            $feesQuery = Fee::where('academy_id', $academyId)->where('status', 'overdue');
            if ($branchId !== 'all') {
                $feesQuery->where('branch_id', $branchId);
            }
            $count = $feesQuery->count();
            if ($count > 0) {
                $items[] = [
                    'severity' => 'warning',
                    'icon' => 'heroicon-o-banknotes',
                    'title' => 'Overdue Student Fees',
                    'count' => $count,
                    'label' => "{$count} student fee records are overdue for payment",
                    'url' => url('/academy/fee-collections'),
                    'action_label' => 'View Overdue',
                    'bg_color' => 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60',
                    'text_color' => 'text-amber-700 dark:text-amber-300',
                    'badge_bg' => 'bg-amber-600 text-white',
                ];
            }
        }

        // 4. Today's Batches Without Attendance Marked
        if (AcademyPermissionHelper::can('view_attendances')) {
            $dayOfWeek = now()->englishDayOfWeek;
            $batchesQuery = Batch::where('academy_id', $academyId)->where('is_active', true);
            if ($branchId !== 'all') {
                $batchesQuery->where('branch_id', $branchId);
            }
            $allActiveBatches = $batchesQuery->get();
            $todayBatchesCount = $allActiveBatches->filter(function ($batch) use ($dayOfWeek) {
                if (empty($batch->days)) return true;
                $days = is_array($batch->days) ? $batch->days : (json_decode($batch->days, true) ?? []);
                if (empty($days)) return true;
                return in_array($dayOfWeek, (array) $days) || str_contains((string) json_encode($days), $dayOfWeek);
            })->count();

            $markedBatchesCount = BatchAttendance::where('academy_id', $academyId)
                ->whereDate('class_date', now()->toDateString())
                ->count();

            $unmarkedCount = max(0, $todayBatchesCount - $markedBatchesCount);
            if ($unmarkedCount > 0) {
                $items[] = [
                    'severity' => 'info',
                    'icon' => 'heroicon-o-clipboard-document-check',
                    'title' => "Today's Unmarked Attendance",
                    'count' => $unmarkedCount,
                    'label' => "{$unmarkedCount} of {$todayBatchesCount} batches scheduled today need attendance marked",
                    'url' => url('/academy/attendances'),
                    'action_label' => 'Mark Now',
                    'bg_color' => 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/60',
                    'text_color' => 'text-sky-700 dark:text-sky-300',
                    'badge_bg' => 'bg-sky-600 text-white',
                ];
            }
        }

        // 5. Batches Without Coach Assigned
        if (AcademyPermissionHelper::can('view_batches')) {
            $unassignedQuery = Batch::where('academy_id', $academyId)->where('is_active', true)->whereNull('coach_id');
            if ($branchId !== 'all') {
                $unassignedQuery->where('branch_id', $branchId);
            }
            $unassignedCount = $unassignedQuery->count();
            if ($unassignedCount > 0) {
                $items[] = [
                    'severity' => 'info',
                    'icon' => 'heroicon-o-user-minus',
                    'title' => 'Unassigned Batches',
                    'count' => $unassignedCount,
                    'label' => "{$unassignedCount} active batches have no primary coach assigned",
                    'url' => url('/academy/batches'),
                    'action_label' => 'Assign Coach',
                    'bg_color' => 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/60',
                    'text_color' => 'text-indigo-700 dark:text-indigo-300',
                    'badge_bg' => 'bg-indigo-600 text-white',
                ];
            }
        }

        return $items;
    }
}
