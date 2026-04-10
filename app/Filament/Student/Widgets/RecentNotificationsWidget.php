<?php

namespace App\Filament\Student\Widgets;

use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Auth;

class RecentNotificationsWidget extends Widget
{
    protected static string $view = 'filament.student.widgets.recent-notifications';
    
    protected int | string | array $columnSpan = 1;

    public function getViewData(): array
    {
        $student = Auth::guard('student')->user();
        
        $notifications = $student->notifications()
            ->latest()
            ->limit(5)
            ->get();
        
        return [
            'notifications' => $notifications,
        ];
    }
}
