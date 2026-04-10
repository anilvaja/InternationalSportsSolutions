<?php

namespace App\Notifications;

use App\Models\Setting;
use App\Services\MailConfigService;
use App\Services\SmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AbsenteeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    private int $absenceCount;
    private string $batchName;

    public function __construct(private $student, string $batchName, int $absenceCount)
    {
        $this->student = $student;
        $this->batchName = $batchName;
        $this->absenceCount = $absenceCount;
    }

    public function via(object $notifiable): array
    {
        $channels = [];
        if (Setting::get('mail_enabled', false) && ($this->student->email || $this->student->parent_email)) {
            $channels[] = 'mail';
        }
        if (Setting::get('sms_enabled', false) && ($this->student->phone || $this->student->parent_phone)) {
            $channels[] = 'sms';
        }
        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        MailConfigService::configure();
        $academyName = Setting::get('academy_name', config('app.name'));
        $studentName = $this->student->first_name . ' ' . $this->student->last_name;
        $subject = "Student Absence Alert - {$academyName}";
        $useCustomTemplate = Setting::get('use_custom_email_templates', false);

        if ($useCustomTemplate) {
            $template = Setting::get('absence_email_template', 
                "Dear Parent,

This is to inform you that {student_name} has been absent from {batch_name} for {absence_count} consecutive sessions.

Regular attendance is important for your child's progress. Please ensure {student_name} attends all upcoming sessions.

If there are any concerns or if the absence is due to health issues, please contact us.

Thank you for your cooperation.

{academy_name}"
            );
            $message = str_replace(
                ['{student_name}', '{batch_name}', '{absence_count}', '{academy_name}'],
                [$studentName, $this->batchName, $this->absenceCount, $academyName],
                $template
            );

            return (new MailMessage)
                        ->subject($subject)
                        ->view('emails.notification', [
                            'message' => $message,
                            'data' => [
                                'academy_name' => $academyName,
                                'contact_info' => Setting::get('academy_contact', ''),
                                'additional_info' => "Student ID: {$this->student->id}\nBatch: {$this->batchName}"
                            ]
                        ]);
        } else {
            return (new MailMessage)
                ->subject($subject)
                ->greeting("Dear Parent,")
                ->line("We hope this message finds you well.")
                ->line("This is to inform you that **{$studentName}** has been absent from **{$this->batchName}** for **{$this->absenceCount} consecutive sessions**.")
                ->line("Regular attendance is crucial for your child's progress and development.")
                ->line("We encourage you to ensure that {$studentName} attends all upcoming sessions.")
                ->line("If the absence is due to health issues or any other concerns, please do not hesitate to contact us.")
                ->line("We appreciate your cooperation in maintaining regular attendance.")
                ->salutation("Best regards,\n{$academyName} Team");
        }
    }

    public function toSms(object $notifiable)
    {
        $smsService = new SmsService();
        return $smsService->sendAbsenceNotification($this->student, $this->batchName, $this->absenceCount);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'absence_alert',
            'student_id' => $this->student->id,
            'student_name' => $this->student->first_name . ' ' . $this->student->last_name,
            'batch_name' => $this->batchName,
            'absence_count' => $this->absenceCount,
            'message' => "{$this->student->first_name} {$this->student->last_name} has been absent for {$this->absenceCount} consecutive sessions from {$this->batchName}",
        ];
    }
}
