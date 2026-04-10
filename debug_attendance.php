<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Current Batch Attendances for Batch ID 1:\n";
echo "ID | Batch ID | Date | Academy ID\n";
echo "---+----------+------------+-----------\n";

$attendances = App\Models\BatchAttendance::where('batch_id', 1)
    ->select('id', 'batch_id', 'class_date', 'academy_id')
    ->orderBy('class_date')
    ->get();

foreach ($attendances as $attendance) {
    echo $attendance->id . " | " . $attendance->batch_id . " | " . $attendance->class_date->format('Y-m-d') . " | " . $attendance->academy_id . "\n";
}

echo "\nSpecifically looking for 2025-08-07 records:\n";
$aug7Records = App\Models\BatchAttendance::where('batch_id', 1)
    ->where('class_date', '2025-08-07')
    ->select('id', 'batch_id', 'class_date', 'academy_id', 'status')
    ->get();

foreach ($aug7Records as $record) {
    echo "ID: {$record->id}, Batch: {$record->batch_id}, Date: {$record->class_date->format('Y-m-d')}, Academy: {$record->academy_id}, Status: {$record->status}\n";
}
