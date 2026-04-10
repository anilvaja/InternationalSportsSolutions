<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StudentWelcomeNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $studentName,
        public string $academyName
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail']; // Save to database AND send email
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Welcome to ' . $this->academyName)
            ->greeting('Hello ' . $this->studentName . '!')
            ->line('Welcome to ' . $this->academyName . '! Your student portal account has been created successfully.')
            ->line('You can now access your student portal to view your attendance, fees, syllabus, and more.')
            ->action('Access Student Portal', route('filament.student.auth.login'))
            ->line('Thank you for joining our academy!');
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => 'Welcome to ' . $this->academyName,
            'message' => "Welcome {$this->studentName}! Your student portal account has been created successfully.",
            'type' => 'welcome',
            'icon' => 'heroicon-o-academic-cap',
            'action_url' => route('filament.student.pages.dashboard'),
        ];
    }

    public function toArray(object $notifiable): array
    {
        return $this->toDatabase($notifiable);
    }
}