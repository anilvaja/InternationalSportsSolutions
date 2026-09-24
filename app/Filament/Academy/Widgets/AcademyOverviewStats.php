<?php

namespace App\Filament\Academy\Widgets;

use App\Models\Student;
use App\Models\Batch;
use App\Models\User;
use App\Models\Branch;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\Auth;

class AcademyOverviewStats extends BaseWidget
{
    protected static ?int $sort = -9;

    protected function getStats(): array
    {
        $user = Auth::user();
        if (!$user) return [];

        $academyId = $user->academy_id;
        $branchId = session('dashboard_selected_branch_id', 'all');

        // Students Query
        $studentsQuery = Student::where('academy_id', $academyId)->where('status', 'active');
        if ($branchId !== 'all') {
            $studentsQuery->where('branch_id', $branchId);
        }
        $totalStudents = $studentsQuery->count();

        $studentsThisMonth = (clone $studentsQuery)
            ->whereYear('created_at', now()->year)
            ->whereMonth('created_at', now()->month)
            ->count();

        // Active Batches Query
        $batchesQuery = Batch::where('academy_id', $academyId)->where('is_active', true);
        if ($branchId !== 'all') {
            $batchesQuery->where('branch_id', $branchId);
        }
        $activeBatches = $batchesQuery->count();

        // Staff Query
        $staffQuery = User::where('academy_id', $academyId);
        if ($branchId !== 'all') {
            $staffQuery->where('branch_id', $branchId);
        }
        $totalStaff = $staffQuery->count();

        // Branches Query
        $totalBranches = Branch::where('academy_id', $academyId)->count();

        return [
            Stat::make('Total Students', number_format($totalStudents))
                ->description($studentsThisMonth > 0 ? "+{$studentsThisMonth} enrolled this month" : 'Active academy roster')
                ->descriptionIcon('heroicon-m-user-group')
                ->color('primary'),

            Stat::make('Active Batches', number_format($activeBatches))
                ->description('Running class schedules')
                ->descriptionIcon('heroicon-m-rectangle-stack')
                ->color('amber'),

            Stat::make('Coaches & Staff', number_format($totalStaff))
                ->description('Active staff members')
                ->descriptionIcon('heroicon-m-users')
                ->color('sky'),

            Stat::make('Academy Branches', number_format($totalBranches))
                ->description('Operational locations')
                ->descriptionIcon('heroicon-m-building-office')
                ->color('indigo'),
        ];
    }
}
