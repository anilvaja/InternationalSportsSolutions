<?php

namespace App\Filament\Academy\Pages;

use App\Filament\Academy\Widgets\AcademyHeaderWidget;
use App\Filament\Academy\Widgets\AcademyOverviewStats;
use App\Filament\Academy\Widgets\AttentionRequiredWidget;
use App\Filament\Academy\Widgets\TodayOperationsWidget;
use App\Filament\Academy\Widgets\FinanceOverviewStats;
use App\Filament\Academy\Widgets\StaffCheckInWidget;
use App\Filament\Academy\Widgets\StaffPayrollExpensesChart;
use App\Filament\Academy\Widgets\RecentAuditActivity;
use App\Support\AcademyPermissionHelper;
use Filament\Pages\Dashboard as BaseDashboard;
use Filament\Widgets;

class Dashboard extends BaseDashboard
{
    protected static ?string $title = 'Academy Dashboard';
    protected static ?string $navigationLabel = 'Dashboard';
    protected static ?int $navigationSort = -2;
    
    public function getWidgets(): array
    {
        $widgets = [];

        // 1. Operational Header (Greeting, Branch Selector & Fast Action Pills)
        $widgets[] = AcademyHeaderWidget::class;

        // 2. Top Key Performance Indicators (Students, Batches, Staff, Branches)
        if (AcademyPermissionHelper::can('view_students') || AcademyPermissionHelper::can('view_batches')) {
            $widgets[] = AcademyOverviewStats::class;
        }

        // 3. Attention Required Alerts Panel (Action-oriented items today)
        $widgets[] = AttentionRequiredWidget::class;

        // 4. Prominent Today's Operations (Today's Attendance Summary & Batch Schedule Timeline)
        if (AcademyPermissionHelper::can('view_attendances') || AcademyPermissionHelper::can('view_batches')) {
            $widgets[] = TodayOperationsWidget::class;
        }

        // 5. Finance KPIs (Today's Collection, This Month, Pending & Overdue Fees in INR)
        if (AcademyPermissionHelper::can('view_fees') || AcademyPermissionHelper::can('view_reports')) {
            $widgets[] = FinanceOverviewStats::class;
        }

        // 6. Daily Staff Attendance & Self Clock-In Tracker
        if (AcademyPermissionHelper::can('view_own_staff_attendances') || AcademyPermissionHelper::can('view_staff_attendances')) {
            $widgets[] = StaffCheckInWidget::class;
        }

        // 7. Staff Payroll Trend Chart
        if (AcademyPermissionHelper::can('view_staff_payrolls') || AcademyPermissionHelper::can('view_reports')) {
            $widgets[] = StaffPayrollExpensesChart::class;
        }

        // 8. Recent Audit Activity Stream
        if (AcademyPermissionHelper::can('view_audits')) {
            $widgets[] = RecentAuditActivity::class;
        }
        
        return $widgets;
    }
    
    public function getColumns(): int | string | array
    {
        return [
            'sm' => 1,
            'md' => 2,
            'lg' => 3,
            'xl' => 3,
            '2xl' => 3,
        ];
    }
}
