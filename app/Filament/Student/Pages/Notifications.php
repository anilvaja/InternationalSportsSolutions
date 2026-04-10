<?php

namespace App\Filament\Student\Pages;

use Filament\Pages\Page;
use Illuminate\Support\Facades\Auth;

class Notifications extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-bell';
    
    protected static string $view = 'filament.student.pages.notifications';
    
    protected static ?string $navigationLabel = 'My Notifications';
    
    protected static ?string $navigationGroup = 'My Dashboard';
    
    protected static ?int $navigationSort = 3;

    public $notifications = [];

    public function mount(): void
    {
        $this->loadNotifications();
    }

    protected function loadNotifications(): void
    {
        /** @var \App\Models\Student $student */
        $student = Auth::user();
        
        // Load actual notifications from database
        $this->notifications = $student->notifications()
            ->latest()
            ->take(50) // Limit to latest 50 notifications
            ->get()
            ->map(function ($notification) {
                $data = $notification->data;
                return [
                    'id' => $notification->id,
                    'type' => $data['type'] ?? 'general',
                    'title' => $data['title'] ?? 'Notification',
                    'message' => $data['message'] ?? '',
                    'icon' => $data['icon'] ?? 'heroicon-o-bell',
                    'action_url' => $data['action_url'] ?? null,
                    'read_at' => $notification->read_at,
                    'created_at' => $notification->created_at,
                    'priority' => $this->getPriority($data['type'] ?? 'general'),
                ];
            })
            ->toArray();
    }

    protected function getPriority($type): string
    {
        return match($type) {
            'urgent', 'fee_reminder' => 'high',
            'attendance_alert', 'schedule_change' => 'medium',
            default => 'low',
        };
    }

    public function markAsRead($notificationId): void
    {
        /** @var \App\Models\Student $student */
        $student = Auth::user();
        
        $notification = $student->notifications()->find($notificationId);
        if ($notification && !$notification->read_at) {
            $notification->markAsRead();
            $this->loadNotifications(); // Refresh the data
        }
    }

    public function markAllAsRead(): void
    {
        /** @var \App\Models\Student $student */
        $student = Auth::user();
        
        $student->unreadNotifications->markAsRead();
        $this->loadNotifications(); // Refresh the data
    }

    public function getViewData(): array
    {
        $unreadCount = collect($this->notifications)->whereNull('read_at')->count();
        
        return [
            'notifications' => $this->notifications,
            'unreadCount' => $unreadCount,
        ];
    }
}
