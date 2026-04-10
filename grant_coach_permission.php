<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\AcademyRole;

$coach = AcademyRole::where('name', 'coach')->first();
if ($coach) {
    $coach->givePermission('delete_attendances');
    echo "✅ Granted delete_attendances permission to coach role\n";
} else {
    echo "❌ Coach role not found\n";
}
