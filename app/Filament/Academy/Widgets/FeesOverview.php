<?php

namespace App\Filament\Academy\Widgets;

use App\Models\Fee;
use App\Support\AcademyPermissionHelper;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\Auth;

class FeesOverview extends BaseWidget
{
    protected static ?int $sort = 1;
    
    protected int | string | array $columnSpan = 'full';
    
    protected static ?string $pollingInterval = '30s';

    public static function canView(): bool
    {
        return AcademyPermissionHelper::can('view_fees');
    }

    protected function getStats(): array
    {
        $academyId = Auth::user()->academy_id;
        
        // Get overdue statistics
        $overdueStats = Fee::getOverdueStats($academyId);
        
        // Today's collection
        $todayCollection = Fee::where('academy_id', $academyId)
            ->whereDate('payment_date', today())
            ->where('status', 'paid')
            ->sum('fees_amount');

        // This month's collection
        $monthCollection = Fee::where('academy_id', $academyId)
            ->whereMonth('payment_date', now()->month)
            ->whereYear('payment_date', now()->year)
            ->where('status', 'paid')
            ->sum('fees_amount');

        // Pending fees count
        $pendingCount = Fee::where('academy_id', $academyId)
            ->where('status', 'pending')
            ->count();

        // Total collection
        $totalFeesAmount = Fee::where('academy_id', $academyId)
            ->where('status', 'paid')
            ->sum('fees_amount');

        return [
            Stat::make('Today\'s Collection', '₹' . number_format($todayCollection, 2))
                ->description('Fees collected today')
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('success')
                ->chart([7, 3, 4, 5, 6, 3, 5])
                ->chartColor('success'),

            Stat::make('This Month', '₹' . number_format($monthCollection, 2))
                ->description('Monthly collection')
                ->descriptionIcon('heroicon-m-calendar-days')
                ->color('info')
                ->chart([7, 3, 4, 5, 6, 3, 5])
                ->chartColor('info'),

            Stat::make('Overdue Students', $overdueStats['total_overdue_students'])
                ->description('₹' . number_format($overdueStats['total_overdue_amount'], 2) . ' pending')
                ->descriptionIcon('heroicon-m-exclamation-triangle')
                ->color('danger')
                ->url(AcademyPermissionHelper::can('view_fees') ? route('filament.academy.resources.fees.index', ['tableFilters' => ['status' => ['value' => 'overdue']]]) : null),

            Stat::make('High Priority', $overdueStats['high_priority_count'])
                ->description('60+ days overdue')
                ->descriptionIcon('heroicon-m-fire')
                ->color('danger'),

            Stat::make('Pending Fees', $pendingCount)
                ->description('Awaiting payment')
                ->descriptionIcon('heroicon-m-clock')
                ->color('warning')
                ->url(AcademyPermissionHelper::can('view_fees') ? route('filament.academy.resources.fees.index', ['tableFilters' => ['status' => ['value' => 'pending']]]) : null),

            Stat::make('Total Collection', '₹' . number_format($totalFeesAmount, 2))
                ->description('All time collection')
                ->descriptionIcon('heroicon-m-currency-dollar')
                ->color('success'),
        ];
    }
}
