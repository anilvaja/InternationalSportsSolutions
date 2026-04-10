<?php

require_once 'vendor/autoload.php';

// Boot Laravel
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Student;
use App\Models\StudentFee;

echo "=== Student Fee Debug Information ===\n";

$student = Student::find(128);
if (!$student) {
    echo "Student 128 not found!\n";
    exit;
}

echo "Student: {$student->email}\n";
echo "Student Name: {$student->first_name} {$student->last_name}\n\n";

// Check StudentFee records
echo "=== StudentFee Records ===\n";
$studentFees = $student->studentFees()->get();
echo "Total StudentFee records: " . $studentFees->count() . "\n";

if ($studentFees->count() > 0) {
    echo "\nStatus breakdown:\n";
    $statuses = $studentFees->groupBy('status');
    foreach ($statuses as $status => $fees) {
        echo "- {$status}: " . $fees->count() . " records\n";
    }

    echo "\nFirst 5 records:\n";
    foreach ($studentFees->take(5) as $fee) {
        echo "- ID: {$fee->id}, Status: {$fee->status}, Amount: {$fee->installment_paid}, Date: {$fee->payment_date}\n";
    }

    echo "\nPayment years:\n";
    $years = $studentFees->groupBy(function($fee) {
        return $fee->payment_date ? $fee->payment_date->year : 'null';
    });
    foreach ($years as $year => $fees) {
        echo "- {$year}: " . $fees->count() . " records\n";
    }
}

// Check regular Fee records as well
echo "\n=== Fee Records ===\n";
$fees = $student->fees()->get();
echo "Total Fee records: " . $fees->count() . "\n";

if ($fees->count() > 0) {
    echo "\nFirst 3 Fee records:\n";
    foreach ($fees->take(3) as $fee) {
        echo "- ID: {$fee->id}, Status: {$fee->status}, Amount: {$fee->fees_amount}, Date: {$fee->payment_date}\n";
    }
}

echo "\n=== End Debug ===\n";
