<?php

namespace App\Notifications;

use App\Models\Fee;
use App\Models\Student;
use App\Models\Academy;
use App\Models\Setting;
use App\Services\MailConfigService;
use App\Services\SmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OverdueFeeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $fee;
    public $student;
    public $academy;
    public $daysOverdue;

    /**
     * Create a new notification instance.
     */
    public function __construct(Fee $fee, $daysOverdue = 0)
    {
        $this->fee = $fee;
        $this->student = $fee->student;
        $this->academy = $fee->academy;
        $this->daysOverdue = $daysOverdue;
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        $channels = [];
        
        // Add mail channel if enabled and email is available
        if (Setting::get('mail_enabled', false) && $this->student->email) {
            $channels[] = 'mail';
        }
        
        // Add SMS channel if enabled and phone is available
        if (Setting::get('sms_enabled', false) && ($this->student->phone || $this->student->parent_phone)) {
            $channels[] = 'sms';
        }
        
        return $channels;
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        // Configure mail settings
        MailConfigService::configure();
        
        $academyName = Setting::get('academy_name', $this->academy->name);
        $subject = "Fee Payment Overdue - {$academyName}";
        $studentName = $this->student->first_name . ' ' . $this->student->last_name;
        $amount = '₹' . number_format($this->fee->fees_amount, 2);
        
        // Use template from settings if available
        $useCustomTemplate = Setting::get('use_custom_email_templates', false);
        
        if ($useCustomTemplate) {
            $template = Setting::get('overdue_email_template', 
                "Dear {student_name},\n\nThis is to inform you that your fee payment of {amount} is overdue by {days} days.\n\nFee Details:\n- Amount: {amount}\n- Due Date: {due_date}\n- Days Overdue: {days}\n\nPlease make the payment immediately to avoid any inconvenience.\n\nThank you,\n{academy_name}"
            );
            
            $message = str_replace(
                ['{student_name}', '{amount}', '{days}', '{due_date}', '{academy_name}'],
                [$studentName, $amount, $this->daysOverdue, $this->fee->fees_from_date->format('d-M-Y'), $academyName],
                $template
            );

            return (new MailMessage)
                        ->subject($subject)
                        ->view('emails.notification', [
                            'message' => $message,
                            'data' => [
                                'academy_name' => $academyName,
                                'contact_info' => Setting::get('academy_contact', ''),
                                'additional_info' => "Fee ID: {$this->fee->id}\nStudent ID: {$this->student->id}"
                            ]
                        ]);
        } else {
            // Use default template
            $message = (new MailMessage)
                ->subject($subject)
                ->greeting("Hello {$studentName},")
                ->line("This is a reminder that your fee payment is overdue.")
                ->line("**Academy:** {$academyName}")
                ->line("**Student:** {$studentName}")
                ->line("**Batch:** {$this->fee->batch->name}")
                ->line("**Amount Due:** {$amount}")
                ->line("**Due Date:** {$this->fee->fees_from_date->format('d M Y')}")
                ->line("**Days Overdue:** {$this->daysOverdue} days");

            if ($this->daysOverdue > 30) {
                $message->line("⚠️ **URGENT:** Your payment is significantly overdue. Please make the payment immediately to avoid any inconvenience.");
            }

            $message->line("Please contact the academy office to make your payment as soon as possible.")
                ->line("Thank you for your cooperation.")
                ->salutation("Regards,\n{$academyName} Team");

            return $message;
        }
    }

    /**
     * Get the SMS representation of the notification.
     */
    public function toSms(object $notifiable)
    {
        $smsService = new SmsService();
        return $smsService->sendOverdueFeeNotification($this->student, $this->fee, $this->daysOverdue);
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray(object $notifiable): array
    {
        return [
            'fee_id' => $this->fee->id,
            'student_id' => $this->student->id,
            'academy_id' => $this->academy->id,
            'amount' => $this->fee->fees_amount,
            'days_overdue' => $this->daysOverdue,
            'due_date' => $this->fee->fees_from_date->format('Y-m-d'),
            'message' => "Fee payment overdue for {$this->student->first_name} {$this->student->last_name}",
        ];
    }
}