<?php

// Simple database check
$db = new PDO('sqlite:database/database.sqlite');

echo "=== Checking Additional Permissions in Database ===\n\n";

// Get users with additional permissions
$sql = "SELECT uar.user_id, uar.academy_role_id, uar.additional_permissions, u.name, u.email 
        FROM user_academy_roles uar 
        JOIN users u ON u.id = uar.user_id 
        WHERE uar.additional_permissions IS NOT NULL 
        AND uar.additional_permissions != '[]' 
        AND uar.additional_permissions != 'null'
        LIMIT 10";

$stmt = $db->prepare($sql);
$stmt->execute();
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($results)) {
    echo "No users found with additional permissions.\n";
    
    // Check all user_academy_roles
    $sql = "SELECT uar.user_id, uar.academy_role_id, uar.additional_permissions, u.name, u.email 
            FROM user_academy_roles uar 
            JOIN users u ON u.id = uar.user_id 
            LIMIT 5";
    $stmt = $db->prepare($sql);
    $stmt->execute();
    $allResults = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "\nSample user_academy_roles records:\n";
    foreach ($allResults as $row) {
        echo "User: {$row['name']}, Role ID: {$row['academy_role_id']}, Additional: " . ($row['additional_permissions'] ?: 'NULL') . "\n";
    }
} else {
    echo "Users with additional permissions:\n";
    foreach ($results as $row) {
        echo "User: {$row['name']} ({$row['email']})\n";
        echo "Academy Role ID: {$row['academy_role_id']}\n";
        echo "Additional Permissions: {$row['additional_permissions']}\n";
        echo "Decoded: " . print_r(json_decode($row['additional_permissions'], true), true) . "\n";
        echo "---\n";
    }
}

// Check available permissions
echo "\n=== Sample Academy Permissions ===\n";
$sql = "SELECT id, name, display_name FROM academy_permissions LIMIT 10";
$stmt = $db->prepare($sql);
$stmt->execute();
$permissions = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($permissions as $perm) {
    echo "ID: {$perm['id']}, Name: {$perm['name']}, Display: {$perm['display_name']}\n";
}

echo "\n=== Testing Permission Name to ID Conversion ===\n";
if (!empty($results)) {
    $firstUser = $results[0];
    $additionalPerms = json_decode($firstUser['additional_permissions'], true);
    if (is_array($additionalPerms) && !empty($additionalPerms)) {
        foreach ($additionalPerms as $permName) {
            $sql = "SELECT id FROM academy_permissions WHERE name = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute([$permName]);
            $permId = $stmt->fetchColumn();
            echo "Permission '{$permName}' -> ID: " . ($permId ?: 'NOT FOUND') . "\n";
        }
    }
}

?>
