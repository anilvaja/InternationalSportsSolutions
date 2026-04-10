<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule the overdue fees generation command to run daily at 9:00 AM
Schedule::command('fees:generate-overdue')
    ->dailyAt('09:00')
    ->withoutOverlapping()
    ->runInBackground()
    ->emailOutputOnFailure('admin@academy.com');

// Schedule notifications for overdue fees (run daily at 10:00 AM)
Schedule::command('fees:generate-overdue --send-notifications --notification-days=7')
    ->dailyAt('10:00')
    ->withoutOverlapping()
    ->runInBackground()
    ->emailOutputOnFailure('admin@academy.com');
