<?php

namespace App\Filament\Academy\Pages;

use App\Filament\Academy\Widgets\AbsenteeStudents;
use App\Filament\Academy\Widgets\FeesOverview;
use App\Filament\Academy\Widgets\TodaysBatches;
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
        
        // Always show Account Widget
        $widgets[] = Widgets\AccountWidget::class;
        
        // Permission-based widget visibility
        $permissionWidgets = [
            'view_fees' => FeesOverview::class,
            'view_batches' => TodaysBatches::class,
            'view_students' => AbsenteeStudents::class,
            'view_audits' => RecentAuditActivity::class,
        ];
        
        foreach ($permissionWidgets as $permission => $widgetClass) {
            if (AcademyPermissionHelper::can($permission)) {
                $widgets[] = $widgetClass;
            }
        }
        
        // If user has no specific permissions, show basic widgets
        if (count($widgets) === 1) { // Only AccountWidget
            // Show at least batches and students for any academy user
            if (AcademyPermissionHelper::can('view_attendances')) {
                $widgets[] = TodaysBatches::class;
            }
            if (AcademyPermissionHelper::can('view_attendances')) {
                $widgets[] = AbsenteeStudents::class;
            }
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
