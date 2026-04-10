<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use App\Models\Academy;
use App\Models\Student;

echo "Testing Student Limit Visibility...\n\n";

// Test with different user types
$testUsers = [
    ['role' => 'academy_admin', 'name' => 'Sarah Johnson'],
    ['role' => 'academy_staff', 'name' => 'Head Coach'],
    ['role' => 'coach', 'name' => 'John Smith'],
];

foreach ($testUsers as $testUser) {
    $user = User::where('role', $testUser['role'])->first();
    if (!$user) {
        echo "❌ No user found with role: {$testUser['role']}\n";
        continue;
    }
    
    echo "User: {$user->name} (Role: {$user->role})\n";
    echo "Academy: " . ($user->academy->name ?? 'None') . "\n";
    
    if ($user->academy) {
        $currentStudents = Student::where('academy_id', $user->academy->id)->where('status', 'active')->count();
        $maxStudents = $user->academy->max_students;
        
        echo "Current Students: {$currentStudents}\n";
        echo "Max Students: " . ($maxStudents ?? 'Unlimited') . "\n";
        
        // Test visibility condition
        $shouldShowLimits = $user->role === 'academy_admin' || $user->is_super_admin;
        echo "Should Show Limits: " . ($shouldShowLimits ? '✅ YES' : '❌ NO') . "\n";
        
        if ($shouldShowLimits) {
            echo "✅ ADMIN USER - Will see: 'Active Students: {$currentStudents}/{$maxStudents}'\n";
        } else {
            echo "🔒 NON-ADMIN USER - Limit information HIDDEN\n";
        }
    }
    
    echo str_repeat("-", 50) . "\n";
}

echo "\nTest completed!\n";
