# Overdue Fees Automation Setup

## Overview
This system automatically generates overdue fee entries for students based on:
- Batch start dates (for new students)
- Last payment's next installment date (for existing students)

## Components Created

### 1. Laravel Command
**File:** `app/Console/Commands/GenerateOverdueFees.php`
**Command:** `php artisan fees:generate-overdue`

**Options:**
- `--academy-id=X` - Generate for specific academy only
- Without options - Generate for all academies

### 2. Scheduler Configuration
**File:** `routes/console.php`
- Runs daily at 9:00 AM
- Prevents overlapping executions
- Emails output on failure

### 3. Fee Model Enhancements
**File:** `app/Models/Fee.php`

**New Methods:**
- `getOverdueStudents($academyId)` - Get list of overdue students
- `getOverdueStats($academyId)` - Get overdue statistics for dashboard
- `markAsPaid()` - Helper to mark overdue fees as paid

### 4. Dashboard Widget Updates
**File:** `app/Filament/Academy/Widgets/FeesOverview.php`
- Shows overdue student count
- Shows total overdue amount
- Shows high priority overdue count (60+ days)
- Clickable links to filtered fee lists

## Logic Explanation

### For New Students (No previous payments):
1. Check if batch started more than 7 days ago (grace period)
2. If yes, create overdue entry from batch start date
3. Fee period: Batch start date to +1 month

### For Existing Students (Has previous payments):
1. Find last paid fee record
2. Check if next installment date has passed
3. If yes, create overdue entry from next installment date
4. Fee period: Next installment date to +1 month

### Overdue Entry Details:
- **Status:** 'overdue'
- **Receipt Number:** Auto-generated using same format as manual entries (e.g., 'FEE-1-20250817-0012')
- **Amount:** Monthly fee from batch
- **Payment Date:** Due date (placeholder until actually paid)
- **Payment Mode:** 'cash' (default, updated when paid)

## Setting Up Cron Job

### For Linux/Ubuntu Server:
```bash
# Edit crontab
crontab -e

# Add this line to run Laravel scheduler every minute
* * * * * cd /path/to/your/project && php artisan schedule:run >> /dev/null 2>&1
```

### For Windows Server:
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at any time
4. Set action: Start a program
5. Program: `php`
6. Arguments: `artisan schedule:run`
7. Start in: `C:\path\to\your\project`

### For Shared Hosting:
Add this to your hosting control panel's cron jobs:
```bash
* * * * * /usr/bin/php /home/username/public_html/artisan schedule:run
```

## Manual Testing

### Test the command:
```bash
# Test for all academies
php artisan fees:generate-overdue

# Test for specific academy
php artisan fees:generate-overdue --academy-id=1

# View help
php artisan fees:generate-overdue --help
```

### Check results:
1. Go to Academy Panel → Fees
2. Filter by Status: "Overdue"
3. Check dashboard widgets for updated statistics

## Dashboard Features

### New Widget Stats:
1. **Overdue Students** - Count with total amount due
2. **High Priority** - Students overdue 60+ days
3. **Total Collection** - All-time paid fees
4. **Today's Collection** - Today's payments
5. **This Month** - Monthly collection
6. **Pending Fees** - Awaiting payment

### Clickable Links:
- Overdue Students → Filtered fees list
- Pending Fees → Filtered fees list

## Maintenance

### Regular Tasks:
1. Monitor cron job execution
2. Check for failed notifications (if email is configured)
3. Review overdue reports weekly
4. Update grace period if needed (currently 7 days)

### Troubleshooting:
1. Check Laravel logs: `storage/logs/laravel.log`
2. Verify cron is running: `grep CRON /var/log/syslog`
3. Test command manually if issues occur

## Notes
- Prevents duplicate overdue entries for same student/batch/date
- Grace period of 7 days after batch start for new students
- Monthly fee amount taken from batch settings
- Overdue entries can be converted to paid when payment received
- System works with multi-academy setup
