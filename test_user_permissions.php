<?php
require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use App\Support\AcademyPermissionHelper;

echo "🔒 PERMISSION SYSTEM TEST\n";
echo "=========================\n\n";

// Test user
$email = 'john.smith@mahavirsportsacademy.com';
echo "Testing user: {$email}\n\n";

$user = User::where('email', $email)->first();
if (!$user) {
    echo "❌ User not found! This user doesn't exist in the database.\n";
    echo "   Only users created through the seeder have roles assigned.\n\n";
    
    echo "✅ EXISTING USERS WITH ROLES:\n";
    $academyUsers = User::whereNotNull('academy_id')->get();
    foreach ($academyUsers as $academyUser) {
        $userRoles = $academyUser->userAcademyRoles()->with('academyRole')->get();
        echo "   • {$academyUser->name} ({$academyUser->email})\n";
        echo "     Role: {$academyUser->role}\n";
        if ($userRoles->count() > 0) {
            foreach ($userRoles as $userRole) {
                echo "     Academy Role: {$userRole->academyRole->display_name}\n";
                echo "     Permissions: " . count($userRole->academyRole->permissions) . " total\n";
            }
        } else {
            echo "     ❌ No academy roles assigned\n";
        }
        echo "\n";
    }
    
    exit;
}

echo "✅ User found: {$user->name}\n";
echo "   Academy ID: {$user->academy_id}\n";
echo "   System Role: {$user->role}\n";
echo "   Is Super Admin: " . ($user->is_super_admin ? 'Yes' : 'No') . "\n\n";

// Check academy roles
$userRoles = $user->userAcademyRoles()->with('academyRole')->get();
echo "📋 ACADEMY ROLES:\n";
if ($userRoles->count() > 0) {
    foreach ($userRoles as $userRole) {
        echo "   ✅ {$userRole->academyRole->display_name}\n";
        echo "      Permissions: " . count($userRole->academyRole->permissions) . " total\n";
        echo "      Is Active: " . ($userRole->is_active ? 'Yes' : 'No') . "\n";
    }
} else {
    echo "   ❌ NO ACADEMY ROLES ASSIGNED\n";
    echo "   This user will NOT be able to access any academy resources!\n";
}

echo "\n🧪 PERMISSION TESTS:\n";

// Simulate authentication
\Illuminate\Support\Facades\Auth::login($user);

// Test key permissions
$testPermissions = [
    'view_students' => 'View Students',
    'create_students' => 'Create Students', 
    'view_batches' => 'View Batches',
    'create_batches' => 'Create Batches',
    'view_attendances' => 'View Attendances',
    'view_fees' => 'View Fees',
    'view_reports' => 'View Reports'
];

foreach ($testPermissions as $permission => $description) {
    $hasPermission = AcademyPermissionHelper::can($permission);
    $status = $hasPermission ? '✅' : '❌';
    echo "   {$status} {$description} ({$permission})\n";
}

echo "\n🎯 RESULT:\n";
if ($userRoles->count() === 0) {
    echo "   ❌ This user has NO academy roles assigned\n";
    echo "   ❌ User will be BLOCKED from accessing academy resources\n";
    echo "   ✅ Permission system is working correctly!\n";
} else {
    echo "   ✅ User has academy roles and appropriate permissions\n";
}

echo "\n💡 TO FIX ACCESS:\n";
echo "   1. Assign an academy role to the user\n";
echo "   2. Or delete the user if not needed\n";
echo "   3. Use only the seeded users for testing:\n";
echo "      - admin@mahavirsportsacademy.com (Academy Admin)\n";
echo "      - headcoach@mahavirsportsacademy.com (Head Coach)\n";
echo "      - reception@mahavirsportsacademy.com (Reception Staff)\n";
echo "      - finance@mahavirsportsacademy.com (Finance Manager)\n";
echo "      - assistant@mahavirsportsacademy.com (Assistant Coach)\n";
echo "      - admin-staff@mahavirsportsacademy.com (Admin Staff)\n";
