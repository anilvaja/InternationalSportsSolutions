<?php

require_once 'vendor/autoload.php';

use App\Models\Academy;
use App\Models\User;
use App\Models\AcademyRole;
use Illuminate\Support\Facades\DB;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "Testing Attendance Permissions...\n\n";

// Test 1: Check if attendance permissions exist
echo "1. Checking if attendance permissions exist:\n";
$attendancePermissions = [
    'view_attendances',
    'create_attendances', 
    'edit_attendances',
    'delete_attendances'
];

foreach ($attendancePermissions as $permission) {
    $exists = DB::table('permissions')->where('name', $permission)->exists();
    echo "   {$permission}: " . ($exists ? "✅ EXISTS" : "❌ MISSING") . "\n";
}

echo "\n2. Checking coach role permissions:\n";
$coachRole = AcademyRole::where('name', 'coach')->first();
if ($coachRole) {
    echo "   Coach role found: {$coachRole->name}\n";
    foreach ($attendancePermissions as $permission) {
        $hasPermission = $coachRole->hasPermission($permission);
        echo "   Coach has {$permission}: " . ($hasPermission ? "✅ YES" : "❌ NO") . "\n";
    }
} else {
    echo "   ❌ Coach role not found!\n";
}

echo "\n3. Testing AttendanceResource permission checks:\n";
try {
    // We can't easily test this without a user context, but we can check the method exists
    $reflection = new ReflectionClass(\App\Filament\Academy\Resources\AttendanceResource::class);
    $hasMethod = $reflection->hasMethod('getAcademyPermissionName');
    echo "   getAcademyPermissionName method exists: " . ($hasMethod ? "✅ YES" : "❌ NO") . "\n";
    
    if ($hasMethod) {
        $permissionName = \App\Filament\Academy\Resources\AttendanceResource::getAcademyPermissionName('view');
        echo "   Generated permission name for 'view': {$permissionName}\n";
    }
} catch (Exception $e) {
    echo "   ❌ Error testing AttendanceResource: {$e->getMessage()}\n";
}

echo "\nTest completed!\n";
