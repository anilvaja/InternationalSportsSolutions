<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class SmsService
{
    protected $apiKey;
    protected $apiUrl;
    protected $senderId;
    protected $countryCode;
    protected $enabled;

    public function __construct()
    {
        // Load settings from database first, fallback to config
        $this->enabled = Setting::get('sms_enabled', false);
        $this->apiKey = Setting::get('sms_api_key', config('services.sms.api_key'));
        $this->apiUrl = Setting::get('sms_api_url', config('services.sms.api_url', 'https://api.textlocal.in/send/'));
        $this->senderId = Setting::get('sms_sender_id', config('services.sms.sender_id', 'ACADEMY'));
        $this->countryCode = Setting::get('sms_country_code', '91');
    }

    /**
     * Check if SMS service is enabled
     */
    public function isEnabled(): bool
    {
        return $this->enabled && !empty($this->apiKey);
    }

    /**
     * Send SMS to a phone number
     */
    public function send($phoneNumber, $message)
    {
        try {
            // Check if SMS is enabled
            if (!$this->enabled) {
                Log::info("SMS service is disabled");
                return ['success' => false, 'error' => 'SMS service is disabled'];
            }

            // Clean phone number (remove spaces, dashes, etc.)
            $phoneNumber = preg_replace('/[^0-9]/', '', $phoneNumber);
            
            // Add country code if not present
            if (strlen($phoneNumber) == 10) {
                $phoneNumber = $this->countryCode . $phoneNumber;
            }

            // Log SMS attempt
            Log::info("Sending SMS to {$phoneNumber}: {$message}");

            // If SMS service is not configured, just log and return success
            if (!$this->apiKey) {
                Log::info("SMS API key not configured. SMS would be sent to: {$phoneNumber}");
                return ['success' => true, 'message' => 'SMS logged (API key not configured)'];
            }

            // Prepare SMS data based on provider
            $provider = Setting::get('sms_provider', 'textlocal');
            $result = $this->sendViaProvider($provider, $phoneNumber, $message);

            return $result;

        } catch (\Exception $e) {
            Log::error("SMS sending exception: " . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function sendViaProvider($provider, $phoneNumber, $message)
    {
        switch ($provider) {
            case 'textlocal':
                return $this->sendViaTextLocal($phoneNumber, $message);
            case 'twilio':
                return $this->sendViaTwilio($phoneNumber, $message);
            case 'msg91':
                return $this->sendViaMsg91($phoneNumber, $message);
            default:
                return $this->sendViaCustom($phoneNumber, $message);
        }
    }

    private function sendViaTextLocal($phoneNumber, $message)
    {
        $postData = [
            'apikey' => $this->apiKey,
            'numbers' => $phoneNumber,
            'message' => $message,
            'sender' => $this->senderId,
        ];

        $response = Http::post($this->apiUrl, $postData);

        if ($response->successful()) {
            $result = $response->json();
            Log::info("SMS sent successfully via TextLocal", ['response' => $result]);
            return ['success' => true, 'response' => $result];
        } else {
            Log::error("SMS sending failed via TextLocal", ['response' => $response->body()]);
            return ['success' => false, 'error' => $response->body()];
        }
    }

    private function sendViaTwilio($phoneNumber, $message)
    {
        // Twilio implementation
        $accountSid = $this->apiKey; // For Twilio, we'll use api_key field for Account SID
        $authToken = Setting::get('twilio_auth_token', '');
        
        if (!$authToken) {
            return ['success' => false, 'error' => 'Twilio Auth Token not configured'];
        }

        $response = Http::withBasicAuth($accountSid, $authToken)
            ->post("https://api.twilio.com/2010-04-01/Accounts/{$accountSid}/Messages.json", [
                'From' => $this->senderId,
                'To' => '+' . $phoneNumber,
                'Body' => $message,
            ]);

        if ($response->successful()) {
            $result = $response->json();
            Log::info("SMS sent successfully via Twilio", ['response' => $result]);
            return ['success' => true, 'response' => $result];
        } else {
            Log::error("SMS sending failed via Twilio", ['response' => $response->body()]);
            return ['success' => false, 'error' => $response->body()];
        }
    }

    private function sendViaMsg91($phoneNumber, $message)
    {
        $postData = [
            'authkey' => $this->apiKey,
            'mobiles' => $phoneNumber,
            'message' => $message,
            'sender' => $this->senderId,
            'route' => '4',
        ];

        $response = Http::post('https://api.msg91.com/api/sendhttp.php', $postData);

        if ($response->successful()) {
            $result = $response->body();
            Log::info("SMS sent successfully via MSG91", ['response' => $result]);
            return ['success' => true, 'response' => $result];
        } else {
            Log::error("SMS sending failed via MSG91", ['response' => $response->body()]);
            return ['success' => false, 'error' => $response->body()];
        }
    }

    private function sendViaCustom($phoneNumber, $message)
    {
        $postData = [
            'api_key' => $this->apiKey,
            'phone' => $phoneNumber,
            'message' => $message,
            'sender_id' => $this->senderId,
        ];

        $response = Http::post($this->apiUrl, $postData);

        if ($response->successful()) {
            $result = $response->json();
            Log::info("SMS sent successfully via Custom API", ['response' => $result]);
            return ['success' => true, 'response' => $result];
        } else {
            Log::error("SMS sending failed via Custom API", ['response' => $response->body()]);
            return ['success' => false, 'error' => $response->body()];
        }
    }

    /**
     * Send SMS notification for overdue fees
     */
    public function sendOverdueFeeNotification($student, $fee, $daysOverdue)
    {
        $phoneNumber = $student->phone ?: $student->parent_phone;
        
        if (!$phoneNumber) {
            return ['success' => false, 'error' => 'No phone number available'];
        }

        $studentName = $student->first_name . ' ' . $student->last_name;
        $amount = '₹' . number_format($fee->fees_amount, 2);
        $academyName = Setting::get('academy_name', config('app.name'));
        
        // Use template from settings if available
        $template = Setting::get('overdue_sms_template', 
            "Dear {student_name}, your fee payment of {amount} is overdue by {days} days. Due date: {due_date}. Please make payment immediately. - {academy_name}"
        );
        
        $message = str_replace(
            ['{student_name}', '{amount}', '{days}', '{due_date}', '{academy_name}'],
            [$studentName, $amount, $daysOverdue, $fee->fees_from_date->format('d-M-Y'), $academyName],
            $template
        );
        
        return $this->send($phoneNumber, $message);
    }

    /**
     * Send SMS notification for absent students
     */
    public function sendAbsenceNotification($student, $batchName, $absenceCount)
    {
        $phoneNumber = $student->phone ?: $student->parent_phone;
        
        if (!$phoneNumber) {
            return ['success' => false, 'error' => 'No phone number available'];
        }

        $studentName = $student->first_name . ' ' . $student->last_name;
        $academyName = Setting::get('academy_name', config('app.name'));
        
        // Use template from settings if available
        $template = Setting::get('absence_sms_template', 
            "Dear Parent, {student_name} has been absent from {batch_name} for {absence_count} consecutive sessions. Please ensure regular attendance. - {academy_name}"
        );
        
        $message = str_replace(
            ['{student_name}', '{batch_name}', '{absence_count}', '{academy_name}'],
            [$studentName, $batchName, $absenceCount, $academyName],
            $template
        );
        
        return $this->send($phoneNumber, $message);
    }
}
