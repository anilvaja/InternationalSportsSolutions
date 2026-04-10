<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // General Settings
        $defaultSettings = [
            // Academy Settings
            'academy_name' => 'International Sports Academy',
            'academy_contact' => 'contact@academy.com',
            'default_currency' => 'INR',
            'timezone' => 'Asia/Kolkata',
            
            // Notification Settings
            'auto_notifications' => true,
            'fee_reminder_days' => 7,
            'absence_alert_days' => 3,
            
            // Email Settings
            'mail_enabled' => false,
            'mail_driver' => 'smtp',
            'mail_host' => '',
            'mail_port' => 587,
            'mail_username' => '',
            'mail_password' => '',
            'mail_encryption' => 'tls',
            'mail_from_address' => '',
            'mail_from_name' => '',
            'use_custom_email_templates' => false,
            
            // SMS Settings
            'sms_enabled' => false,
            'sms_provider' => 'textlocal',
            'sms_api_key' => '',
            'sms_api_url' => 'https://api.textlocal.in/send/',
            'sms_sender_id' => 'ACADEMY',
            'sms_country_code' => '91',
            'use_custom_sms_templates' => false,
            
            // Email Templates
            'overdue_email_template' => "Dear {student_name},\n\nThis is to inform you that your fee payment of {amount} is overdue by {days} days.\n\nFee Details:\n- Amount: {amount}\n- Due Date: {due_date}\n- Days Overdue: {days}\n\nPlease make the payment immediately to avoid any inconvenience.\n\nThank you,\n{academy_name}",
            
            'absence_email_template' => "Dear Parent,\n\nThis is to inform you that {student_name} has been absent from {batch_name} for {absence_count} consecutive sessions.\n\nRegular attendance is important for your child's progress. Please ensure {student_name} attends all upcoming sessions.\n\nIf there are any concerns or if the absence is due to health issues, please contact us.\n\nThank you for your cooperation.\n\n{academy_name}",
            
            // SMS Templates
            'overdue_sms_template' => "Dear {student_name}, your fee payment of {amount} is overdue by {days} days. Due date: {due_date}. Please make payment immediately. - {academy_name}",
            
            'absence_sms_template' => "Dear Parent, {student_name} has been absent from {batch_name} for {absence_count} consecutive sessions. Please ensure regular attendance. - {academy_name}",
        ];

        foreach ($defaultSettings as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => is_bool($value) ? ($value ? '1' : '0') : $value,
                    'type' => $this->getType($value),
                    'group' => $this->getGroup($key),
                ]
            );
        }
    }

    private function getType($value): string
    {
        if (is_bool($value)) {
            return 'boolean';
        } elseif (is_numeric($value)) {
            return 'integer';
        } else {
            return 'string';
        }
    }

    private function getGroup(string $key): string
    {
        if (str_starts_with($key, 'mail_')) {
            return 'email';
        } elseif (str_starts_with($key, 'sms_')) {
            return 'sms';
        } elseif (in_array($key, ['auto_notifications', 'fee_reminder_days', 'absence_alert_days'])) {
            return 'notifications';
        } elseif (str_contains($key, 'template')) {
            return 'templates';
        } else {
            return 'general';
        }
    }
}
