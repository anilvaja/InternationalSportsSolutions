# Overdue Fees Notification System

## Overview
Complete notification system for overdue fees that sends automated email and SMS notifications to students and parents when fees are overdue.

## Components

### 1. Notification Class
**File:** `app/Notifications/OverdueFeeNotification.php`
- **Email Notifications:** Professional email with academy details, amount due, days overdue
- **SMS Notifications:** Concise SMS message with key information
- **Queueable:** Runs in background for better performance

### 2. SMS Service
**File:** `app/Services/SmsService.php`
- **Provider Support:** Ready for TextLocal, Twilio, or other SMS providers
- **Phone Validation:** Auto-formats phone numbers (supports Indian +91)
- **Logging:** Comprehensive logging of all SMS attempts
- **Fallback:** Graceful handling when SMS service not configured

### 3. SMS Channel
**File:** `app/Notifications/Channels/SmsChannel.php`
- **Custom Channel:** Integrates SMS with Laravel notification system
- **Phone Priority:** Uses student phone, falls back to parent phone
- **Service Integration:** Works with SmsService class

## Configuration

### Email Setup
In `.env` file:
```env
# Email Configuration
MAIL_MAILER=smtp
MAIL_HOST=your-smtp-host.com
MAIL_PORT=587
MAIL_USERNAME=your-email@academy.com
MAIL_PASSWORD=your-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@academy.com
MAIL_FROM_NAME="Academy Management"
```

### SMS Setup
In `.env` file:
```env
# SMS Configuration (TextLocal example)
SMS_API_KEY=your-textlocal-api-key
SMS_API_URL=https://api.textlocal.in/send/
SMS_SENDER_ID=ACADEMY

# Alternative SMS Providers
# SMS_API_URL=https://api.twilio.com/2010-04-01/Accounts/YOUR_SID/Messages.json
# SMS_API_URL=https://api.msg91.com/api/sendhttp.php
```

### Queue Configuration (Optional but Recommended)
```env
QUEUE_CONNECTION=database
# or
QUEUE_CONNECTION=redis
```

## Command Usage

### Basic Commands

**Generate overdue fees only:**
```bash
php artisan fees:generate-overdue
```

**Generate with notifications:**
```bash
php artisan fees:generate-overdue --send-notifications
```

**Custom notification threshold:**
```bash
php artisan fees:generate-overdue --send-notifications --notification-days=14
```

**Specific academy:**
```bash
php artisan fees:generate-overdue --academy-id=1 --send-notifications
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--academy-id=X` | Process specific academy only | All academies |
| `--send-notifications` | Send email and SMS notifications | No notifications |
| `--notification-days=X` | Days overdue before notification | 7 days |

## Automation Schedule

### Daily Schedule (defined in `routes/console.php`):

**9:00 AM - Generate Overdue Entries:**
```bash
fees:generate-overdue
```

**10:00 AM - Send Notifications:**
```bash
fees:generate-overdue --send-notifications --notification-days=7
```

### Notification Logic:
1. **New Overdue:** Immediate notification when first marked overdue
2. **Weekly Reminders:** Every 7 days for existing overdue entries
3. **Escalation:** Different message tone for 30+ and 60+ days overdue

## Notification Content

### Email Template Features:
- **Professional Format:** Clean, branded email design
- **Complete Details:** Academy name, student info, batch, amount, due date
- **Urgency Levels:** Different messaging for various overdue periods
- **Contact Information:** Academy contact details included
- **Action Items:** Clear next steps for payment

### SMS Template Features:
- **Concise:** Under 160 characters when possible
- **Key Info:** Student name, amount, days overdue, academy
- **Action Oriented:** Clear call to action
- **Contact Ready:** Encourages immediate contact with academy

## SMS Provider Setup

### TextLocal (India)
1. Register at textlocal.in
2. Get API key from dashboard
3. Configure sender ID (6 characters)
4. Set up in `.env`:
```env
SMS_API_KEY=your-textlocal-api-key
SMS_API_URL=https://api.textlocal.in/send/
SMS_SENDER_ID=ACADMY
```

### Twilio (Global)
1. Register at twilio.com
2. Get Account SID and Auth Token
3. Set up in `.env` and modify SmsService:
```env
SMS_API_KEY=your-auth-token
SMS_SENDER_ID=your-twilio-number
```

### MSG91 (India)
1. Register at msg91.com
2. Get API key and sender ID
3. Configure similar to TextLocal

## Testing Notifications

### Test Email:
```bash
# Test email notifications (will use log driver if MAIL_MAILER=log)
php artisan fees:generate-overdue --academy-id=1 --send-notifications --notification-days=0
```

### Check Email Logs:
```bash
# View email logs
tail -f storage/logs/laravel.log | grep -i mail
```

### Test SMS:
```bash
# Without SMS API key, messages are logged
tail -f storage/logs/laravel.log | grep -i sms
```

## Database Tracking

### Student Model Updates:
- Added `Notifiable` trait for Laravel notifications
- Email sent to student email or parent email
- SMS sent to student phone or parent phone (priority order)

### Fee Model Integration:
- Overdue fees link to notification system
- Tracks notification history in logs
- Status changes from overdue to paid stop notifications

## Monitoring & Maintenance

### Daily Checks:
1. **Cron Job Status:** Ensure scheduler is running
2. **Email Queue:** Check for stuck emails in queue
3. **SMS Logs:** Review SMS delivery status
4. **Failed Jobs:** Monitor failed notification jobs

### Log Locations:
- **Laravel Logs:** `storage/logs/laravel.log`
- **Email Logs:** Search for "mail" in laravel.log
- **SMS Logs:** Search for "sms" in laravel.log
- **Notification Logs:** Search for "OverdueFeeNotification"

### Performance Optimization:
1. **Queue Workers:** Run background queue workers for faster processing
2. **Rate Limiting:** Implement SMS rate limiting if required by provider
3. **Batch Processing:** Process notifications in batches for large academies

## Troubleshooting

### Common Issues:

**Emails not sending:**
1. Check MAIL_* configuration in `.env`
2. Verify SMTP credentials
3. Check firewall/security settings
4. Test with `php artisan tinker` and `Mail::raw()`

**SMS not sending:**
1. Verify SMS_API_KEY in `.env`
2. Check phone number format (should be numeric)
3. Validate SMS provider API endpoint
4. Check SMS provider account balance

**Notifications not triggered:**
1. Ensure students have email/phone numbers
2. Check --notification-days threshold
3. Verify cron job is running
4. Review laravel.log for errors

**Queue jobs stuck:**
1. Restart queue workers: `php artisan queue:restart`
2. Process failed jobs: `php artisan queue:retry all`
3. Check database queue table if using database driver

## Security Considerations

1. **API Keys:** Keep SMS API keys secure in `.env`
2. **Rate Limiting:** Implement rate limiting for SMS to prevent abuse
3. **Data Privacy:** Ensure compliance with local data protection laws
4. **Unsubscribe:** Consider adding unsubscribe option for repeated notifications
5. **Logging:** Be careful not to log sensitive information like phone numbers in plain text

## Future Enhancements

1. **WhatsApp Integration:** Add WhatsApp Business API for notifications
2. **Push Notifications:** Mobile app push notifications
3. **Notification Preferences:** Let students choose notification methods
4. **Templates:** Customizable email/SMS templates per academy
5. **Analytics:** Dashboard showing notification delivery rates
6. **Multilingual:** Support for multiple languages based on student preference
