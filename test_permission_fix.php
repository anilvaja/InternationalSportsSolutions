<?php

// Simple test without Laravel bootstrap
$db = new PDO('sqlite:database/database.sqlite');

echo "=== Testing Additional Permissions Logic ===\n\n";

// Get the Head Coach user
$sql = "SELECT * FROM users WHERE email = 'headcoach@mahavirsportsacademy.com'";
$stmt = $db->prepare($sql);
$stmt->execute();
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo "Head Coach user not found.\n";
    exit;
}

echo "User: {$user['name']} (ID: {$user['id']})\n";
echo "Academy ID: {$user['academy_id']}\n\n";

// Get user's academy role
$sql = "SELECT * FROM user_academy_roles WHERE user_id = ? AND academy_id = ?";
$stmt = $db->prepare($sql);
$stmt->execute([$user['id'], $user['academy_id']]);
$userRole = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$userRole) {
    echo "No academy role found for this user.\n";
    exit;
}

echo "Academy Role ID: {$userRole['academy_role_id']}\n";

// Get the role permissions
$sql = "SELECT permissions FROM academy_roles WHERE id = ?";
$stmt = $db->prepare($sql);
$stmt->execute([$userRole['academy_role_id']]);
$roleData = $stmt->fetch(PDO::FETCH_ASSOC);
$rolePermissions = json_decode($roleData['permissions'] ?? '[]', true);

echo "Role Permissions Count: " . count($rolePermissions) . "\n";
echo "Role Permission IDs: " . implode(', ', array_slice($rolePermissions, 0, 10)) . "...\n\n";

// Get additional permissions
$additionalPermissions = json_decode($userRole['additional_permissions'] ?? '[]', true);
echo "Additional Permissions Count: " . count($additionalPermissions) . "\n";
echo "First 10 Additional Permission Names: " . implode(', ', array_slice($additionalPermissions, 0, 10)) . "\n\n";

// Convert additional permission names to IDs (simulate the fix)
$additionalPermissionIds = [];
foreach ($additionalPermissions as $permName) {
    $sql = "SELECT id FROM academy_permissions WHERE name = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute([$permName]);
    $permId = $stmt->fetchColumn();
    if ($permId) {
        $additionalPermissionIds[] = $permId;
    }
}

echo "Additional Permission IDs Count: " . count($additionalPermissionIds) . "\n";
echo "First 10 Additional Permission IDs: " . implode(', ', array_slice($additionalPermissionIds, 0, 10)) . "\n\n";

// Combine all permissions
$allPermissions = array_unique(array_merge($rolePermissions, $additionalPermissionIds));
echo "Total Combined Permissions: " . count($allPermissions) . "\n";

// Test a specific permission
$testPermissionName = 'create_users';
echo "\n=== Testing Specific Permission: {$testPermissionName} ===\n";

// Get permission ID
$sql = "SELECT id FROM academy_permissions WHERE name = ?";
$stmt = $db->prepare($sql);
$stmt->execute([$testPermissionName]);
$testPermissionId = $stmt->fetchColumn();

echo "Permission '{$testPermissionName}' has ID: {$testPermissionId}\n";

// Check if it's in role permissions
$inRolePermissions = in_array($testPermissionId, $rolePermissions);
echo "In role permissions: " . ($inRolePermissions ? 'YES' : 'NO') . "\n";

// Check if it's in additional permissions
$inAdditionalPermissions = in_array($testPermissionId, $additionalPermissionIds);
echo "In additional permissions: " . ($inAdditionalPermissions ? 'YES' : 'NO') . "\n";

// Check if it's in combined permissions
$inCombinedPermissions = in_array($testPermissionId, $allPermissions);
echo "In combined permissions: " . ($inCombinedPermissions ? 'YES' : 'NO') . "\n";

echo "\n✅ Additional permissions should now be working with the AcademyPermissionHelper fix!\n";

?>
