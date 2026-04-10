<?php

namespace App\Filament\Academy\Widgets;

use App\Models\EventFee;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\Auth;
use App\Support\CurrencyHelper;

class EventFeeStats extends BaseWidget
{
    protected function getStats(): array
    {
        $user = Auth::user();
        
        // Base query for academy filtering
        $query = EventFee::query();
        
        // Filter by academy if user has academy_id
        if ($user && $user->academy_id) {
            $query->join('events', 'event_fees.event_id', '=', 'events.id')
                  ->join('students', 'event_fees.student_id', '=', 'students.id')
                  ->where('events.academy_id', $user->academy_id)
                  ->where('students.academy_id', $user->academy_id)
                  ->select('event_fees.*');
        } elseif ($user && !$user->is_super_admin) {
            // If user has no academy_id and is not super admin, show no records
            $query->whereRaw('1 = 0');
        }
        
        return [
            Stat::make('Total Revenue', CurrencyHelper::format((clone $query)->where('payment_status', 'paid')->sum('final_amount')))
                ->description('Total collected from event fees')
                ->descriptionIcon('heroicon-m-arrow-trending-up')
                ->color('success'),
                
            Stat::make('Pending Payments', CurrencyHelper::format((clone $query)->where('payment_status', 'pending')->sum('final_amount')))
                ->description('Awaiting payment')
                ->descriptionIcon('heroicon-m-clock')
                ->color('warning'),
                
            Stat::make('Overdue Payments', CurrencyHelper::format((clone $query)->where('payment_status', 'overdue')->sum('final_amount')))
                ->description('Past due date')
                ->descriptionIcon('heroicon-m-exclamation-triangle')
                ->color('danger'),
                
            Stat::make('Total Fees Created', (clone $query)->count())
                ->description('All fee records')
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('info'),
        ];
    }
}
