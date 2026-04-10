<?php

$db = new PDO('sqlite:database/database.sqlite');

echo "=== Finding Users with Additional Permissions ===\n\n";

// Get all users with non-empty additional_permissions
$sql = "SELECT uar.user_id, uar.academy_role_id, uar.additional_permissions, u.name, u.email 
        FROM user_academy_roles uar 
        JOIN users u ON u.id = uar.user_id 
        WHERE uar.additional_permissions IS NOT NULL 
        AND uar.additional_permissions != '[]' 
        AND uar.additional_permissions != 'null'
        AND LENGTH(uar.additional_permissions) > 10";

$stmt = $db->prepare($sql);
$stmt->execute();
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($results) . " users with additional permissions:\n\n";

foreach ($results as $row) {
    echo "User: {$row['name']} ({$row['email']})\n";
    echo "User ID: {$row['user_id']}\n";
    echo "Academy Role ID: {$row['academy_role_id']}\n";
    
    $additionalPerms = json_decode($row['additional_permissions'], true);
    if (is_array($additionalPerms)) {
        echo "Additional Permissions Count: " . count($additionalPerms) . "\n";
        echo "First 5: " . implode(', ', array_slice($additionalPerms, 0, 5)) . "\n";
    } else {
        echo "Additional Permissions: " . $row['additional_permissions'] . "\n";
    }
    echo "---\n";
}

// Now let's test the permission checking for the first user
if (!empty($results)) {
    echo "\n=== Testing Permission Logic for First User ===\n";
    $testUser = $results[0];
    echo "Testing user: {$testUser['name']}\n";
    
    // Get role permissions
    $sql = "SELECT permissions FROM academy_roles WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute([$testUser['academy_role_id']]);
    $roleData = $stmt->fetch(PDO::FETCH_ASSOC);
    $rolePermissions = json_decode($roleData['permissions'] ?? '[]', true);
    
    echo "Role permissions count: " . count($rolePermissions) . "\n";
    
    // Get additional permissions
    $additionalPerms = json_decode($testUser['additional_permissions'], true);
    echo "Additional permissions count: " . count($additionalPerms) . "\n";
    
    // Convert additional permission names to IDs
    $additionalPermissionIds = [];
    $convertedCount = 0;
    foreach ($additionalPerms as $permName) {
        $sql = "SELECT id FROM academy_permissions WHERE name = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute([$permName]);
        $permId = $stmt->fetchColumn();
        if ($permId) {
            $additionalPermissionIds[] = $permId;
            $convertedCount++;
        }
    }
    
    echo "Successfully converted: {$convertedCount} permission names to IDs\n";
    echo "Combined total: " . count(array_unique(array_merge($rolePermissions, $additionalPermissionIds))) . "\n";
    
    // Test specific permission
    if (!empty($additionalPerms)) {
        $testPerm = $additionalPerms[0];
        $sql = "SELECT id FROM academy_permissions WHERE name = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute([$testPerm]);
        $testPermId = $stmt->fetchColumn();
        
        echo "\nTesting permission: {$testPerm} (ID: {$testPermId})\n";
        echo "Should be found in additional permissions: YES\n";
        echo "Actually found: " . (in_array($testPermId, $additionalPermissionIds) ? 'YES' : 'NO') . "\n";
    }
}

?>
