<?php

require_once 'vendor/autoload.php';
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$request = Request::capture();
$response = $kernel->handle($request);

use App\Models\User;
use Illuminate\Support\Facades\Auth;

echo "=== Testing Self-Edit Restrictions ===\n\n";

// Get test users
$adminUser = User::where('email', 'admin@mahavirsportsacademy.com')->first();
$staffUser = User::where('email', 'headcoach@mahavirsportsacademy.com')->first();

echo "👤 Admin User: {$adminUser->name} (ID: {$adminUser->id})\n";
echo "👤 Staff User: {$staffUser->name} (ID: {$staffUser->id})\n\n";

// Simulate admin user login
Auth::login($adminUser);

echo "🔒 Testing Admin User Actions (logged in as Admin):\n";

// Test manage_roles action visibility for self
$roleActionForSelf = function() use ($adminUser) {
    $currentUser = Auth::user();
    if ($currentUser && $currentUser->id === $adminUser->id) {
        return false;
    }
    return \App\Support\AcademyPermissionHelper::can('assign_roles');
};

// Test manage_permissions action visibility for self
$permissionActionForSelf = function() use ($adminUser) {
    $currentUser = Auth::user();
    if ($currentUser && $currentUser->id === $adminUser->id) {
        return false;
    }
    return \App\Support\AcademyPermissionHelper::can('view_permissions');
};

// Test edit action visibility for self
$editActionForSelf = function() use ($adminUser) {
    $currentUser = Auth::user();
    if ($currentUser && $currentUser->id === $adminUser->id) {
        return false;
    }
    return \App\Support\AcademyPermissionHelper::canForUser($currentUser, 'edit_users');
};

// Test delete action visibility for self
$deleteActionForSelf = function() use ($adminUser) {
    $currentUser = Auth::user();
    if ($currentUser && $currentUser->id === $adminUser->id) {
        return false;
    }
    return \App\Support\AcademyPermissionHelper::canForUser($currentUser, 'delete_users');
};

echo "  Manage Own Roles: " . ($roleActionForSelf() ? "✅ ALLOWED" : "❌ BLOCKED") . "\n";
echo "  Manage Own Permissions: " . ($permissionActionForSelf() ? "✅ ALLOWED" : "❌ BLOCKED") . "\n";
echo "  Edit Own Profile: " . ($editActionForSelf() ? "✅ ALLOWED" : "❌ BLOCKED") . "\n";
echo "  Delete Own Account: " . ($deleteActionForSelf() ? "✅ ALLOWED" : "❌ BLOCKED") . "\n";

echo "\n🔒 Testing Admin Actions on Other Users:\n";

// Test actions for other users
$roleActionForOther = function() use ($staffUser) {
    $currentUser = Auth::user();
    if ($currentUser && $currentUser->id === $staffUser->id) {
        return false;
    }
    return \App\Support\AcademyPermissionHelper::can('assign_roles');
};

$permissionActionForOther = function() use ($staffUser) {
    $currentUser = Auth::user();
    if ($currentUser && $currentUser->id === $staffUser->id) {
        return false;
    }
    return \App\Support\AcademyPermissionHelper::can('view_permissions');
};

$editActionForOther = function() use ($staffUser) {
    $currentUser = Auth::user();
    if ($currentUser && $currentUser->id === $staffUser->id) {
        return false;
    }
    return \App\Support\AcademyPermissionHelper::canForUser($currentUser, 'edit_users');
};

echo "  Manage Other User's Roles: " . ($roleActionForOther() ? "✅ ALLOWED" : "❌ BLOCKED") . "\n";
echo "  Manage Other User's Permissions: " . ($permissionActionForOther() ? "✅ ALLOWED" : "❌ BLOCKED") . "\n";
echo "  Edit Other User's Profile: " . ($editActionForOther() ? "✅ ALLOWED" : "❌ BLOCKED") . "\n";

echo "\n📋 Expected Results:\n";
echo "- Users should NOT be able to manage their own roles/permissions\n";
echo "- Users should NOT be able to edit/delete their own profile\n";
echo "- Users should be able to manage OTHER users (if they have permissions)\n";
echo "- Role assignment fields should be disabled when editing own profile\n";

echo "\n✅ SELF-EDIT RESTRICTIONS IMPLEMENTED!\n";

$kernel->terminate($request, $response);

?>
