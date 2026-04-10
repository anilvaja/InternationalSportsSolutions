<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Existing Batch Attendances:\n";
echo "ID | Batch ID | Date | Academy ID\n";
echo "---+----------+------------+-----------\n";

$attendances = App\Models\BatchAttendance::select('id', 'batch_id', 'class_date', 'academy_id')->get();

foreach ($attendances as $attendance) {
    echo $attendance->id . " | " . $attendance->batch_id . " | " . $attendance->class_date . " | " . $attendance->academy_id . "\n";
}

echo "\nStudent Attendances without academy_id:\n";
$studentAttendances = App\Models\StudentAttendance::whereNull('academy_id')->count();
echo "Count: " . $studentAttendances . "\n";
