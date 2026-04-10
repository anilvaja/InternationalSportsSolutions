<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel application
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\BatchAttendance;

echo "BatchAttendance table structure:\n";
echo "================================\n";

$columns = DB::select('PRAGMA table_info(batch_attendances)');
foreach($columns as $col) {
    echo $col->name . ' (' . $col->type . ')' . "\n";
}

echo "\nSample BatchAttendance record:\n";
echo "=============================\n";

$sample = BatchAttendance::first();
if ($sample) {
    echo "ID: " . $sample->id . "\n";
    echo "Batch ID: " . $sample->batch_id . "\n";
    echo "Class Date: " . $sample->class_date . "\n";
    echo "Academy ID: " . $sample->academy_id . "\n";
    
    // Check what attributes the model has
    echo "\nModel attributes:\n";
    foreach ($sample->getAttributes() as $key => $value) {
        echo "- $key: $value\n";
    }
} else {
    echo "No batch attendance records found.\n";
}
