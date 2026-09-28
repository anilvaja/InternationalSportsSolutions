<?php

namespace App\Filament\Academy\Pages;

use App\Filament\Academy\Widgets\AcademyHeaderWidget;
use App\Filament\Academy\Widgets\AcademyOverviewStats;
use App\Filament\Academy\Widgets\AttentionRequiredWidget;
use App\Filament\Academy\Widgets\QuickLaunchpadWidget;
use App\Filament\Academy\Widgets\TodayOperationsWidget;
use App\Filament\Academy\Widgets\AbsenteeStudents;
use App\Filament\Academy\Widgets\FinanceOverviewStats;
use App\Filament\Academy\Widgets\StaffCheckInWidget;
use App\Filament\Academy\Widgets\StaffPayrollExpensesChart;
use App\Filament\Academy\Widgets\RecentAuditActivity;
use App\Support\AcademyPermissionHelper;
use Filament\Pages\Dashboard as BaseDashboard;

class Dashboard extends BaseDashboard
{
    protected static ?string $title = 'Academy Dashboard';
    protected static ?string $navigationLabel = 'Dashboard';
    protected static ?int $navigationSort = -2;
    
    public function getWidgets(): array
    {
        $widgets = [];

        // 1. Operational Header (Greeting, Branch Selector & Quick Actions)
        $widgets[] = AcademyHeaderWidget::class;

        // 2. Daily Staff Attendance & Self Clock-In Tracker (Daily Attendance Tracker on Top)
        if (AcademyPermissionHelper::can('view_own_staff_attendances') || AcademyPermissionHelper::can('view_staff_attendances')) {
            $widgets[] = StaffCheckInWidget::class;
        }

        // 3. Top Key Performance Indicators (Students, Batches, Staff, Branches)
        if (AcademyPermissionHelper::can('view_students') || AcademyPermissionHelper::can('view_batches')) {
            $widgets[] = AcademyOverviewStats::class;
        }

        // 4. Attention Required Alerts Panel (Immediate Action Items)
        $widgets[] = AttentionRequiredWidget::class;

        // 5. Quick Access Launchpad (Direct feature links & create shortcuts)
        $widgets[] = QuickLaunchpadWidget::class;

        // 6. Today's Operations Hub (Attendance Summary Ring & Batch Timeline)
        if (AcademyPermissionHelper::can('view_attendances') || AcademyPermissionHelper::can('view_batches')) {
            $widgets[] = TodayOperationsWidget::class;
        }

        // 7. Absentee Students Monitor (Consecutive absence alert for retention)
        if (AbsenteeStudents::canView()) {
            $widgets[] = AbsenteeStudents::class;
        }

        // 8. Finance KPIs (Today's Collection, This Month, Pending & Overdue Fees)
        if (FinanceOverviewStats::canView()) {
            $widgets[] = FinanceOverviewStats::class;
        }

        // 9. Staff Payroll Expense Trend Chart
        if (AcademyPermissionHelper::can('view_staff_payrolls') || AcademyPermissionHelper::can('view_reports')) {
            $widgets[] = StaffPayrollExpensesChart::class;
        }

        // 10. Recent Audit & Activity Stream
        if (RecentAuditActivity::canView()) {
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

