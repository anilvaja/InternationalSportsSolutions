<?php

namespace App\Filament\Academy\Widgets;

use App\Models\Fee;
use App\Support\CurrencyHelper;
use App\Support\AcademyPermissionHelper;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\Auth;

class FinanceOverviewStats extends BaseWidget
{
    protected static ?int $sort = -6;

    public static function canView(): bool
    {
        return AcademyPermissionHelper::can('view_fees') || AcademyPermissionHelper::can('view_reports');
    }

    protected function getStats(): array
    {
        $user = Auth::user();
        if (!$user) return [];

        $academyId = $user->academy_id;
        $branchId = session('dashboard_selected_branch_id', 'all');

        $feesQuery = Fee::where('academy_id', $academyId);
        if ($branchId !== 'all') {
            $feesQuery->where('branch_id', $branchId);
        }

        // 1. Today's Collection
        $todaysCollection = (clone $feesQuery)
            ->whereDate('payment_date', now()->toDateString())
            ->sum('paid_amount');

        // 2. This Month Collection
        $monthlyCollection = (clone $feesQuery)
            ->whereYear('payment_date', now()->year)
            ->whereMonth('payment_date', now()->month)
            ->sum('paid_amount');

        // 3. Pending Fees
        $pendingQuery = (clone $feesQuery)->whereIn('status', ['pending', 'partial']);
        $pendingBalance = $pendingQuery->sum('balance_amount');
        $pendingStudentsCount = $pendingQuery->distinct('student_id')->count('student_id');

        // 4. Overdue Fees
        $overdueQuery = (clone $feesQuery)->where('status', 'overdue');
        $overdueBalance = $overdueQuery->sum('balance_amount');
        $overdueStudentsCount = $overdueQuery->distinct('student_id')->count('student_id');

        $formattedToday = CurrencyHelper::format($todaysCollection);
        $formattedMonth = CurrencyHelper::format($monthlyCollection);
        $formattedPending = CurrencyHelper::format($pendingBalance);
        $formattedOverdue = CurrencyHelper::format($overdueBalance);

        return [
            Stat::make("Today's Collection", $formattedToday)
                ->description('Fees collected today')
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('emerald'),

            Stat::make('This Month Collection', $formattedMonth)
                ->description('Current month revenue')
                ->descriptionIcon('heroicon-m-calendar')
                ->color('teal'),

            Stat::make('Pending Fees', $formattedPending)
                ->description($pendingStudentsCount > 0 ? "{$pendingStudentsCount} students awaiting payment" : 'Clear balances')
                ->descriptionIcon('heroicon-m-clock')
                ->color('amber'),

            Stat::make('Overdue Fees', $formattedOverdue)
                ->description($overdueStudentsCount > 0 ? "{$overdueStudentsCount} overdue accounts" : 'No overdue accounts')
                ->descriptionIcon('heroicon-m-exclamation-circle')
                ->color('rose'),
        ];
    }
}
