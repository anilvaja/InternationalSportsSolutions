<?php

namespace App\Filament\Admin\Widgets;

use App\Models\Academy;
use App\Models\Branch;
use App\Models\Coach;
use App\Models\Fee;
use App\Models\Student;
use App\Models\EventFee;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class SuperAdminStatsOverview extends BaseWidget
{
    protected static ?int $sort = 1;

    protected function getStats(): array
    {
        $totalAcademies = Academy::count();
        $activeAcademies = Academy::where('status', 'active')->count();

        $totalStudents = Student::count();
        $activeStudents = Student::where('status', 'active')->count();

        $totalBranches = Branch::count();
        $totalCoaches = Coach::count();

        // Calculate total revenues from paid student fees and event fees across all academies
        $totalStudentFeeRevenue = (float) Fee::where('status', 'paid')->sum('fees_amount');
        $totalEventFeeRevenue = (float) EventFee::where('payment_status', 'paid')->sum('amount');
        $totalRevenue = $totalStudentFeeRevenue + $totalEventFeeRevenue;

        // Calculate current month revenue
        $currentMonthStart = now()->startOfMonth();
        $monthlyStudentFeeRevenue = (float) Fee::where('status', 'paid')
            ->where('payment_date', '>=', $currentMonthStart)
            ->sum('fees_amount');
        $monthlyEventFeeRevenue = (float) EventFee::where('payment_status', 'paid')
            ->where('payment_date', '>=', $currentMonthStart)
            ->sum('amount');
        $monthlyRevenue = $monthlyStudentFeeRevenue + $monthlyEventFeeRevenue;

        return [
            Stat::make('Total Academies', number_format($totalAcademies))
                ->description("{$activeAcademies} Active • " . ($totalAcademies - $activeAcademies) . " Inactive/Suspended")
                ->descriptionIcon('heroicon-m-building-office-2')
                ->color('primary')
                ->chart([3, 5, 8, 12, $totalAcademies]),

            Stat::make('Total System Revenue', '₹' . number_format($totalRevenue, 2))
                ->description('₹' . number_format($monthlyRevenue, 2) . ' Collected This Month')
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('success')
                ->chart([15000, 32000, 45000, 78000, (int)$totalRevenue]),

            Stat::make('Total Students Registered', number_format($totalStudents))
                ->description("{$activeStudents} Active Enrolled Students")
                ->descriptionIcon('heroicon-m-academic-cap')
                ->color('info')
                ->chart([10, 25, 40, 75, $totalStudents]),

            Stat::make('Branches & Coaches', "{$totalBranches} Branches")
                ->description("{$totalCoaches} Registered Coaches Across System")
                ->descriptionIcon('heroicon-m-user-group')
                ->color('warning')
                ->chart([2, 4, 6, 8, $totalBranches]),
        ];
    }
}
