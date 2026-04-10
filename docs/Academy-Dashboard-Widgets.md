# Academy Dashboard Widgets

This document describes the new dashboard widgets created for the Academy panel to provide better visibility and management of daily operations.

## Overview

The Academy Dashboard now includes two main widgets:

1. **Today's Batches** - Shows all batch schedules for the current day
2. **Absentee Students** - Tracks students with consecutive absences and provides notification capabilities

## 1. Today's Batches Widget

### Purpose
Displays all batches scheduled for today with their current attendance status and quick action buttons.

### Features
- **Batch Information**: Shows batch name, code, time slot, coach, and location
- **Student Count**: Displays current enrollment vs maximum capacity
- **Attendance Status**: Real-time status (Pending, Completed, Cancelled, Not Scheduled)
- **Quick Actions**:
  - Take Attendance (for scheduled classes)
  - View Students (batch details)
  - Schedule Today (for unscheduled batches)

### Columns
- Batch Name & Code
- Time Slot
- Assigned Coach
- Student Count (current/max)
- Attendance Status (with color-coded badges)
- Location/Room

### Auto-refresh
- Updates every 30 seconds to show real-time status changes

## 2. Absentee Students Widget

### Purpose
Identifies students who have been absent from their batches and provides notification capabilities to contact parents/guardians.

### Features
- **Absence Tracking**: Shows students with multiple absences in recent sessions
- **Contact Information**: Displays phone numbers and email addresses
- **Notification System**: Send email/SMS to parents about attendance concerns
- **Bulk Actions**: Send notifications to multiple families at once

### Columns
- Student Name & ID
- Batch Name
- Consecutive Absences (count)
- Last Attendance Date
- Contact Information
- Notification Status

### Actions
- **Send Notification**: Individual notification to parent/guardian
- **View Student**: Navigate to student details
- **Bulk Notifications**: Send to multiple selected students

### Notification Content
The system sends professional messages via:
- **Email**: Detailed message with academy branding
- **SMS**: Concise message about attendance concern

## Technical Implementation

### Database Queries
- **Today's Batches**: Filters batches by current day of week and academy
- **Absentee Students**: Analyzes attendance patterns over the last 30 days

### Route Integration
- Integrates with existing Filament resources (AttendanceResource, StudentResource, BatchResource)
- Uses proper route names for navigation

### SQLite Compatibility
- Queries optimized for SQLite database
- Uses proper string concatenation and date functions

### Notification System
- Leverages existing SMS service and notification infrastructure
- Queued notifications for better performance
- Tracks notification history to prevent spam

## Configuration

### Dashboard Layout
```php
// In Dashboard.php
public function getWidgets(): array
{
    return [
        TodaysBatches::class,
        AbsenteeStudents::class,
    ];
}
```

### Widget Positioning
- **Today's Batches**: Full width, high priority
- **Absentee Students**: Full width, lower priority

### Polling Intervals
- **Today's Batches**: 30 seconds
- **Absentee Students**: 60 seconds

## Usage Guidelines

### For Academy Staff
1. **Morning Routine**: Check Today's Batches for daily schedule
2. **Attendance Management**: Use quick action buttons to take attendance
3. **Absence Monitoring**: Review absentee list and send notifications as needed

### For Academy Administrators
1. **Monitor Trends**: Track attendance patterns across batches
2. **Parent Communication**: Use automated notifications for attendance concerns
3. **Resource Planning**: View capacity and scheduling information

## Troubleshooting

### Common Issues
1. **Route Not Found**: Ensure Filament resources are properly registered
2. **SQL Errors**: Check database compatibility (SQLite vs MySQL)
3. **Permission Errors**: Verify user has access to academy panel

### Performance Considerations
- Widgets auto-refresh, so large academies may want to adjust polling intervals
- Notification queues prevent blocking of UI operations
- Queries are optimized for reasonable response times

## Future Enhancements

### Planned Features
1. **Attendance Analytics**: Charts and trends
2. **Automated Reminders**: Scheduled notifications for upcoming classes
3. **Mobile Optimization**: Better responsive design
4. **Custom Filters**: Date ranges and batch-specific views

### Integration Opportunities
1. **Payment Integration**: Link attendance to fee collection
2. **Parent Portal**: Self-service attendance viewing
3. **Reporting**: Export capabilities for attendance reports
