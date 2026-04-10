<?php

namespace App\Filament\Student\Pages;

use Filament\Pages\Dashboard as BaseDashboard;
use Illuminate\Support\Facades\Auth;

class Dashboard extends BaseDashboard
{
    protected static ?string $navigationIcon = 'heroicon-o-home';
    
    protected static string $view = 'filament.student.pages.dashboard';
    
    protected static ?string $navigationLabel = 'My Dashboard';
    
    protected static ?string $navigationGroup = 'My Dashboard';
    
    protected static ?int $navigationSort = 1;

    public function getWidgets(): array
    {
        return [
            \App\Filament\Student\Widgets\StudentProfileWidget::class,
            \App\Filament\Student\Widgets\AttendanceOverviewWidget::class,
            \App\Filament\Student\Widgets\BatchesWidget::class,
            \App\Filament\Student\Widgets\FeesWidget::class,
            \App\Filament\Student\Widgets\RecentNotificationsWidget::class,
        ];
    }

    public function getViewData(): array
    {
        return [
            'todayClasses' => 2,
            'attendanceRate' => 95,
            'pendingFees' => 0,
            'activeBatches' => 1,
        ];
    }
}
