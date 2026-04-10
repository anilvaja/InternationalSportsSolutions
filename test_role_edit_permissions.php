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
use App\Models\AcademyRole;
use App\Support\AcademyPermissionHelper;
use Illuminate\Support\Facades\Auth;

echo "=== Testing Academy Role Edit Permissions ===\n\n";

// Get admin user and academy role
$adminUser = User::where('email', 'admin@mahavirsportsacademy.com')->first();
if (!$adminUser) {
    echo "❌ Admin user not found\n";
    exit;
}

// Get an academy role to test with
$academyRole = AcademyRole::where('academy_id', $adminUser->academy_id)->first();
if (!$academyRole) {
    echo "❌ No academy role found for testing\n";
    exit;
}

echo "👤 Testing User: {$adminUser->name} ({$adminUser->email})\n";
echo "🎯 Testing Role: {$academyRole->display_name} (ID: {$academyRole->id})\n\n";

// Test permission checks
$permissions = ['view_academy_roles', 'edit_academy_roles', 'delete_academy_roles'];

echo "🔒 Permission Check Results:\n";
foreach ($permissions as $permission) {
    $hasPermission = AcademyPermissionHelper::canForUser($adminUser, $permission);
    $status = $hasPermission ? "✅ ALLOWED" : "❌ DENIED";
    echo "  $permission: $status\n";
}

// Test the actual resource methods by simulating authentication
Auth::login($adminUser);

echo "\n🎯 Resource Method Tests:\n";

// Test canViewAny
$canViewAny = \App\Filament\Academy\Resources\AcademyRoleResource::canViewAny();
echo "  canViewAny(): " . ($canViewAny ? "✅ TRUE" : "❌ FALSE") . "\n";

// Test canEdit
$canEdit = \App\Filament\Academy\Resources\AcademyRoleResource::canEdit($academyRole);
echo "  canEdit(\$role): " . ($canEdit ? "✅ TRUE" : "❌ FALSE") . "\n";

// Test canDelete
$canDelete = \App\Filament\Academy\Resources\AcademyRoleResource::canDelete($academyRole);
echo "  canDelete(\$role): " . ($canDelete ? "✅ TRUE" : "❌ FALSE") . "\n";

echo "\n📋 Diagnosis:\n";
echo "- If canViewAny() is TRUE but canEdit() is FALSE, there's a permission issue\n";
echo "- Check if edit_academy_roles permission is properly assigned\n";
echo "- Verify BaseAcademyResource.canEdit() implementation\n";

$kernel->terminate($request, $response);

?>
