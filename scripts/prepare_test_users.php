<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$consoleKernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$consoleKernel->bootstrap();

use App\Models\User;
use App\Models\Academy;
use App\Models\AcademyPermission;
use App\Models\AcademyRole;
use App\Models\UserAcademyRole;
use Illuminate\Support\Facades\Hash;

echo "Preparing test user accounts & permissions...\n";

// 1. Super Admin Account
$superAdmin = User::where('is_super_admin', true)->first();
if (!$superAdmin) {
    $superAdmin = User::create([
        'name' => 'Super Admin',
        'email' => 'anilvaja.007@gmail.com',
        'password' => Hash::make('password'),
        'is_super_admin' => true,
        'status' => 'active',
        'is_active' => true,
    ]);
} else {
    $superAdmin->password = Hash::make('password');
    $superAdmin->status = 'active';
    $superAdmin->is_active = true;
    $superAdmin->save();
}

echo "✔ SuperAdmin: {$superAdmin->email} (Password: 'password')\n";

// 2. Academy & Academy Admin Account
$academy = Academy::first();
if (!$academy) {
    $academy = Academy::create([
        'name' => 'Mahavir Sports Academy',
        'code' => 'MSA',
        'slug' => 'mahavir-sports-academy',
        'contact_email' => 'info@mahavirsportsacademy.com',
        'contact_phone' => '9876543210',
        'status' => 'active',
    ]);
}

AcademyPermission::seedPermissions();
$allPermissionNames = AcademyPermission::pluck('name')->toArray();
$allPermissionIds = AcademyPermission::pluck('id')->toArray();
$combinedPermissions = array_values(array_unique(array_merge($allPermissionNames, $allPermissionIds)));

$academyUser = User::where('is_super_admin', false)->whereNotNull('academy_id')->first();
if (!$academyUser) {
    $academyUser = User::create([
        'name' => 'John Smith',
        'email' => 'john.smith@mahavirsportsacademy.com',
        'password' => Hash::make('password'),
        'academy_id' => $academy->id,
        'role' => 'academy_admin',
        'is_super_admin' => false,
        'status' => 'active',
        'is_active' => true,
    ]);
} else {
    $academyUser->password = Hash::make('password');
    $academyUser->role = 'academy_admin';
    $academyUser->status = 'active';
    $academyUser->is_active = true;
    $academyUser->save();
}

$role = AcademyRole::updateOrCreate([
    'academy_id' => $academyUser->academy_id,
    'name' => 'admin',
], [
    'display_name' => 'Admin',
    'permissions' => $combinedPermissions,
    'is_default' => true,
]);

UserAcademyRole::updateOrCreate([
    'user_id' => $academyUser->id,
    'academy_id' => $academyUser->academy_id,
], [
    'academy_role_id' => $role->id,
    'is_active' => true,
    'assigned_at' => now(),
]);

echo "✔ AcademyUser: {$academyUser->email} (Password: 'password')\n";
echo "Test accounts and permissions successfully verified!\n";
