<?php

namespace App\Notifications\Channels;

use App\Services\SmsService;
use Illuminate\Notifications\Notification;

class SmsChannel
{
    protected $smsService;

    public function __construct(SmsService $smsService)
    {
        $this->smsService = $smsService;
    }

    /**
     * Send the given notification.
     */
    public function send($notifiable, Notification $notification)
    {
        // Get SMS message from notification
        if (!method_exists($notification, 'toSms')) {
            return;
        }

        $message = call_user_func([$notification, 'toSms'], $notifiable);
        
        // Get phone number from notifiable (Student model)
        $phoneNumber = $notifiable->phone ?: $notifiable->parent_phone;
        
        if (!$phoneNumber) {
            return;
        }

        // Send SMS
        return $this->smsService->send($phoneNumber, $message);
    }
}
