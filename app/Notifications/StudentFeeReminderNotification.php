<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use App\Services\SmsService;
use App\Channels\SmsChannel;

class StudentFeeReminderNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $studentName,
        public float $amount,
        public string $dueDate,
        public string $feeType = 'Monthly Fee'
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database']; // Always save to database
        
        // Add email if student has email
        if ($notifiable->email) {
            $channels[] = 'mail';
        }
        
        // Add SMS if student has phone and SMS is enabled
        if ($notifiable->phone && app(SmsService::class)->isEnabled()) {
            $channels[] = SmsChannel::class;
        }
        
        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Fee Payment Reminder - ' . $this->feeType)
            ->greeting('Hello ' . $this->studentName . '!')
            ->line('This is a reminder that your ' . $this->feeType . ' payment is due.')
            ->line('Amount Due: ₹' . number_format($this->amount, 2))
            ->line('Due Date: ' . $this->dueDate)
            ->line('Please make your payment at the earliest to avoid any inconvenience.')
            ->action('View Fee Details', route('filament.student.pages.fees'))
            ->line('Thank you for your prompt attention to this matter.');
    }

    public function toSms(object $notifiable): string
    {
        return "Fee Reminder: {$this->feeType} of ₹{$this->amount} is due on {$this->dueDate}. Please pay at the earliest. Thank you!";
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => 'Fee Payment Reminder',
            'message' => "Your {$this->feeType} of ₹" . number_format($this->amount, 2) . " is due on {$this->dueDate}.",
            'type' => 'fee_reminder',
            'icon' => 'heroicon-o-currency-rupee',
            'action_url' => route('filament.student.pages.fees'),
            'amount' => $this->amount,
            'due_date' => $this->dueDate,
            'fee_type' => $this->feeType,
        ];
    }

    public function toArray(object $notifiable): array
    {
        return $this->toDatabase($notifiable);
    }
}