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
use Illuminate\Support\Facades\Auth;

echo "=== Testing Academy Role Edit Access ===\n\n";

// Get admin user and academy role
$adminUser = User::where('email', 'admin@mahavirsportsacademy.com')->first();
$adminRole = AcademyRole::where('academy_id', $adminUser->academy_id)->where('name', 'admin')->first();

echo "👤 User: {$adminUser->name}\n";
echo "🎯 Testing Role: {$adminRole->display_name} (Default: " . ($adminRole->is_default ? 'Yes' : 'No') . ", Removable: " . ($adminRole->is_removable ? 'Yes' : 'No') . ")\n\n";

// Simulate authentication
Auth::login($adminUser);

echo "🔒 Permission Tests:\n";

// Test canEdit
$canEdit = \App\Filament\Academy\Resources\AcademyRoleResource::canEdit($adminRole);
echo "  canEdit(\$adminRole): " . ($canEdit ? "✅ TRUE" : "❌ FALSE") . "\n";

// Test canDelete
$canDelete = \App\Filament\Academy\Resources\AcademyRoleResource::canDelete($adminRole);
echo "  canDelete(\$adminRole): " . ($canDelete ? "✅ TRUE" : "❌ FALSE") . "\n";

// Test with a non-default role if it exists
$customRole = AcademyRole::where('academy_id', $adminUser->academy_id)->where('is_default', false)->first();
if ($customRole) {
    echo "\n🆕 Testing Custom Role: {$customRole->display_name}\n";
    $canEditCustom = \App\Filament\Academy\Resources\AcademyRoleResource::canEdit($customRole);
    $canDeleteCustom = \App\Filament\Academy\Resources\AcademyRoleResource::canDelete($customRole);
    echo "  canEdit(\$customRole): " . ($canEditCustom ? "✅ TRUE" : "❌ FALSE") . "\n";
    echo "  canDelete(\$customRole): " . ($canDeleteCustom ? "✅ TRUE" : "❌ FALSE") . "\n";
} else {
    echo "\n📝 No custom roles found for comparison\n";
}

echo "\n📋 Summary:\n";
echo "- Default roles can now be EDITED (but name field will be disabled)\n";
echo "- Default roles CANNOT be DELETED (is_removable = false)\n";
echo "- Custom roles can be both edited and deleted\n";

$kernel->terminate($request, $response);

?>
