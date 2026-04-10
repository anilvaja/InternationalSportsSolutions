<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Student;

$student = Student::find(128);

if ($student) {
    echo "Student: " . $student->first_name . " " . $student->last_name . "\n";
    echo "Email: " . $student->email . "\n\n";
    
    $records = $student->studentAttendances()->with('batchAttendance.batch')->get();
    
    echo "Attendance Records:\n";
    echo "==================\n";
    
    foreach ($records as $record) {
        $batchAttendance = $record->batchAttendance;
        $batch = $batchAttendance->batch ?? null;
        
        echo "Date: " . $batchAttendance->class_date->format('Y-m-d') . "\n";
        echo "Status: " . $record->status . "\n";
        echo "Batch: " . ($batch ? $batch->name : 'No batch name') . "\n";
        echo "Time: " . ($batchAttendance->class_start_time ? $batchAttendance->class_start_time->format('H:i') : 'N/A');
        echo " - " . ($batchAttendance->class_end_time ? $batchAttendance->class_end_time->format('H:i') : 'N/A') . "\n";
        echo "---\n";
    }
    
    echo "\nTotal records: " . $records->count() . "\n";
} else {
    echo "Student not found!\n";
}
