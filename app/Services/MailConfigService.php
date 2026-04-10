<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;

class MailConfigService
{
    /**
     * Configure mail settings from database
     */
    public static function configure()
    {
        // Only configure if mail settings exist in database
        if (!Setting::where('key', 'like', 'mail_%')->exists()) {
            return;
        }

        $driver = Setting::get('mail_driver', 'smtp');
        $host = Setting::get('mail_host', '');
        $port = Setting::get('mail_port', 587);
        $username = Setting::get('mail_username', '');
        $password = Setting::get('mail_password', '');
        $encryption = Setting::get('mail_encryption', 'tls');
        $fromAddress = Setting::get('mail_from_address', '');
        $fromName = Setting::get('mail_from_name', '');

        // Only proceed if we have the essential settings
        if (empty($host) || empty($username) || empty($password)) {
            return;
        }

        // Update mail configuration
        Config::set([
            'mail.default' => $driver,
            'mail.mailers.smtp.host' => $host,
            'mail.mailers.smtp.port' => $port,
            'mail.mailers.smtp.encryption' => $encryption,
            'mail.mailers.smtp.username' => $username,
            'mail.mailers.smtp.password' => $password,
            'mail.from.address' => $fromAddress,
            'mail.from.name' => $fromName,
        ]);

        // Clear any cached mail manager instance
        Mail::purge();
    }

    /**
     * Test mail configuration
     */
    public static function test($toEmail, $subject = 'Test Email', $message = 'This is a test email from your academy system.')
    {
        try {
            // Configure mail first
            self::configure();

            // Send test email
            Mail::raw($message, function ($mail) use ($toEmail, $subject) {
                $mail->to($toEmail)
                     ->subject($subject);
            });

            return ['success' => true, 'message' => 'Test email sent successfully'];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Send notification email
     */
    public static function sendNotification($to, $subject, $message, $data = [])
    {
        try {
            // Configure mail first
            self::configure();

            // Check if mail is enabled
            if (!Setting::get('mail_enabled', false)) {
                return ['success' => false, 'error' => 'Email service is disabled'];
            }

            Mail::send('emails.notification', compact('message', 'data'), function ($mail) use ($to, $subject) {
                $mail->to($to)->subject($subject);
            });

            return ['success' => true, 'message' => 'Email sent successfully'];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
