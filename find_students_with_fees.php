<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel application
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Student;
use App\Models\Fee;

echo "Finding students with fees:\n";

$studentsWithFees = Fee::with('student')->limit(5)->get();

foreach ($studentsWithFees as $fee) {
    if ($fee->student) {
        echo "Student ID: {$fee->student_id} - {$fee->student->first_name} {$fee->student->last_name} - {$fee->receipt_number}\n";
    }
}
