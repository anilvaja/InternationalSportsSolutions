<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use App\Services\SmsService;
use App\Channels\SmsChannel;

class StudentAnnouncementNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $title,
        public string $message,
        public ?string $actionUrl = null,
        public string $type = 'announcement'
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database']; // Always save to database
        
        // Add email if student has email
        if ($notifiable->email) {
            $channels[] = 'mail';
        }
        
        // Add SMS if student has phone and SMS is enabled (for urgent announcements)
        if ($notifiable->phone && app(SmsService::class)->isEnabled() && $this->type === 'urgent') {
            $channels[] = SmsChannel::class;
        }
        
        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject($this->title)
            ->greeting('Hello ' . $notifiable->first_name . '!')
            ->line($this->message);
            
        if ($this->actionUrl) {
            $mail->action('View Details', $this->actionUrl);
        }
        
        return $mail->line('Thank you for your attention.');
    }

    public function toSms(object $notifiable): string
    {
        return $this->title . ': ' . $this->message;
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => $this->title,
            'message' => $this->message,
            'type' => $this->type,
            'icon' => $this->type === 'urgent' ? 'heroicon-o-exclamation-triangle' : 'heroicon-o-megaphone',
            'action_url' => $this->actionUrl,
        ];
    }

    public function toArray(object $notifiable): array
    {
        return $this->toDatabase($notifiable);
    }
}