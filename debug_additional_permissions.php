<?php

require_once 'bootstrap/app.php';

use App\Models\User;
use App\Models\AcademyPermission;
use App\Support\AcademyPermissionHelper;
use Illuminate\Support\Facades\Auth;

echo "=== Testing Additional Permissions System ===\n\n";

try {
    // Create the application instance
    $app = require_once 'bootstrap/app.php';
    $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

    // Find a user with academy roles
    $testUser = User::whereHas('userAcademyRoles', function($query) {
        $query->where('is_active', true);
    })->first();

    if (!$testUser) {
        echo "No users with academy roles found.\n";
        exit;
    }

    echo "Testing User: {$testUser->name} ({$testUser->email})\n";
    echo "Academy ID: {$testUser->academy_id}\n";

    // Get the user's academy role
    $userRole = $testUser->userAcademyRoles()->where('academy_id', $testUser->academy_id)->first();
    if ($userRole) {
        $academyRole = $userRole->academyRole;
        echo "Role: " . ($academyRole ? $academyRole->display_name : 'No role') . "\n";
        
        // Show role permissions
        $rolePermissions = $academyRole ? $academyRole->permissions : [];
        echo "Role Permissions Count: " . count($rolePermissions) . "\n";
        
        // Show additional permissions
        $additionalPermissions = $userRole->additional_permissions ?? [];
        echo "Additional Permissions: " . json_encode($additionalPermissions) . "\n";
        echo "Additional Permissions Count: " . count($additionalPermissions) . "\n";
        
        // Test permission checking
        Auth::login($testUser);
        
        // Get all permissions through the helper
        $allPermissions = AcademyPermissionHelper::getUserPermissions();
        echo "Total Permissions via Helper: " . count($allPermissions) . "\n";
        echo "Permissions: " . json_encode($allPermissions) . "\n";
        
        // Test a specific permission check
        if (!empty($additionalPermissions)) {
            $testPermission = $additionalPermissions[0];
            echo "\nTesting permission: {$testPermission}\n";
            
            // Get permission ID
            $permissionId = AcademyPermissionHelper::getPermissionId($testPermission);
            echo "Permission ID: " . ($permissionId ?: 'NOT FOUND') . "\n";
            
            // Test permission check
            $hasPermission = AcademyPermissionHelper::can($testPermission);
            echo "Has Permission: " . ($hasPermission ? 'YES' : 'NO') . "\n";
        }
        
        // List some available permissions for reference
        echo "\n--- Available Permissions Sample ---\n";
        $availablePermissions = AcademyPermission::take(10)->get();
        foreach ($availablePermissions as $perm) {
            echo "ID: {$perm->id}, Name: {$perm->name}, Display: {$perm->display_name}\n";
        }
        
    } else {
        echo "No academy role found for this user.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}
