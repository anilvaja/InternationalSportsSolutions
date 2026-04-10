<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Student;
use App\Notifications\StudentWelcomeNotification;

$student = Student::find(128);

if ($student) {
    echo "Sending notification to: " . $student->first_name . " " . $student->last_name . "\n";
    
    $student->notify(new StudentWelcomeNotification(
        $student->first_name . ' ' . $student->last_name,
        'International Sports Solutions'
    ));
    
    echo "Notification sent successfully!\n";
    echo "Total notifications for this student: " . $student->notifications()->count() . "\n";
} else {
    echo "Student not found!\n";
}
