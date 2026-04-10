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

echo "=== Testing Settings Page Access Restrictions ===\n\n";

// Test with admin user
$adminUser = User::where('email', 'admin@mahavirsportsacademy.com')->first();
$staffUser = User::where('email', 'headcoach@mahavirsportsacademy.com')->first();

echo "👤 Admin User: {$adminUser->name} ({$adminUser->email})\n";
echo "👤 Staff User: {$staffUser->name} ({$staffUser->email})\n\n";

$settingsPages = [
    'AcademySettings' => \App\Filament\Academy\Pages\AcademySettings::class,
    'CurrencySettings' => \App\Filament\Academy\Pages\CurrencySettings::class,
    'EmailSettings' => \App\Filament\Academy\Pages\EmailSettings::class,
    'SmsSettings' => \App\Filament\Academy\Pages\SmsSettings::class,
];

// Test admin user access
echo "🔒 Testing Admin User Access:\n";
Auth::login($adminUser);
foreach ($settingsPages as $name => $class) {
    $canAccess = $class::canAccess();
    $status = $canAccess ? "✅ ALLOWED" : "❌ DENIED";
    echo "  $name: $status\n";
}

echo "\n🔒 Testing Staff User Access:\n";
Auth::login($staffUser);
foreach ($settingsPages as $name => $class) {
    $canAccess = $class::canAccess();
    $status = $canAccess ? "✅ ALLOWED" : "❌ DENIED";
    echo "  $name: $status\n";
}

echo "\n📋 Expected Results:\n";
echo "- Admin user should have access to ALL settings pages\n";
echo "- Staff user should have NO access to any settings pages\n";
echo "- Settings menu should only be visible to academy_admin role\n";

$kernel->terminate($request, $response);

?>
