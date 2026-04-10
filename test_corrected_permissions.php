<?php

require_once 'vendor/autoload.php';

/**
 * Test script to verify the corrected permission system
 */

use App\Support\AcademyPermissionHelper;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

echo "=== Testing Corrected Permission System ===\n\n";

// Simulate user authentication for admin user
$adminUser = User::where('email', 'admin@mahavirsportsacademy.com')->first();
if (!$adminUser) {
    echo "❌ Admin user not found\n";
    exit;
}

// Test permission conversion
$testPermissions = ['view_students', 'create_students', 'view_batches', 'view_attendances', 'view_fees'];

echo "🔍 Permission ID Conversion Test:\n";
foreach ($testPermissions as $permission) {
    $permissionId = AcademyPermissionHelper::getPermissionId($permission);
    echo "  $permission -> ID: $permissionId\n";
}

echo "\n🔒 Permission Check for Admin User (ID: {$adminUser->id}):\n";
foreach ($testPermissions as $permission) {
    $hasPermission = AcademyPermissionHelper::canForUser($adminUser, $permission);
    $status = $hasPermission ? "✅ ALLOWED" : "❌ DENIED";
    echo "  $permission: $status\n";
}

// Test with john.smith (no role)
$johnUser = User::where('email', 'john.smith@mahavirsportsacademy.com')->first();
if ($johnUser) {
    echo "\n🔒 Permission Check for John Smith (ID: {$johnUser->id}):\n";
    foreach ($testPermissions as $permission) {
        $hasPermission = AcademyPermissionHelper::canForUser($johnUser, $permission);
        $status = $hasPermission ? "✅ ALLOWED" : "❌ DENIED";
        echo "  $permission: $status\n";
    }
}

echo "\n🎯 Expected Results:\n";
echo "- Admin user should have ALL permissions (role has permission IDs)\n";
echo "- John Smith should have NO permissions (no role assigned)\n";

?>
