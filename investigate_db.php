<?php

$db = new PDO('sqlite:database/database.sqlite');

echo "=== Database Investigation ===\n\n";

// Check table structure
echo "1. user_academy_roles table structure:\n";
$sql = "PRAGMA table_info(user_academy_roles)";
$stmt = $db->prepare($sql);
$stmt->execute();
$columns = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($columns as $col) {
    echo "  {$col['name']} ({$col['type']}) - {$col['dflt_value']}\n";
}

echo "\n2. Sample user_academy_roles records:\n";
$sql = "SELECT user_id, academy_role_id, additional_permissions, LENGTH(additional_permissions) as perm_length 
        FROM user_academy_roles 
        LIMIT 10";
$stmt = $db->prepare($sql);
$stmt->execute();
$records = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($records as $record) {
    echo "User ID: {$record['user_id']}, Role ID: {$record['academy_role_id']}, ";
    echo "Permissions Length: {$record['perm_length']}, ";
    echo "Content: " . substr($record['additional_permissions'] ?? 'NULL', 0, 100) . "\n";
}

echo "\n3. Looking for any non-null additional_permissions:\n";
$sql = "SELECT COUNT(*) as total, 
               COUNT(CASE WHEN additional_permissions IS NOT NULL THEN 1 END) as not_null,
               COUNT(CASE WHEN additional_permissions != '[]' THEN 1 END) as not_empty_array,
               COUNT(CASE WHEN LENGTH(additional_permissions) > 10 THEN 1 END) as substantial
        FROM user_academy_roles";
$stmt = $db->prepare($sql);
$stmt->execute();
$stats = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Total records: {$stats['total']}\n";
echo "Not null: {$stats['not_null']}\n";
echo "Not empty array: {$stats['not_empty_array']}\n";
echo "Substantial content (>10 chars): {$stats['substantial']}\n";

echo "\n4. Checking for the specific user we saw earlier:\n";
$sql = "SELECT u.name, u.email, uar.additional_permissions 
        FROM user_academy_roles uar 
        JOIN users u ON u.id = uar.user_id 
        WHERE u.email = 'headcoach@mahavirsportsacademy.com'";
$stmt = $db->prepare($sql);
$stmt->execute();
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user) {
    echo "Found user: {$user['name']} ({$user['email']})\n";
    echo "Additional permissions: " . ($user['additional_permissions'] ?? 'NULL') . "\n";
} else {
    echo "User not found\n";
}

echo "\n5. Let's check if we can add some additional permissions manually for testing:\n";
$sql = "SELECT id FROM users WHERE email = 'headcoach@mahavirsportsacademy.com'";
$stmt = $db->prepare($sql);
$stmt->execute();
$userId = $stmt->fetchColumn();

if ($userId) {
    echo "Found user ID: {$userId}\n";
    
    // Add some test additional permissions
    $testPermissions = json_encode(['create_users', 'edit_users', 'view_reports']);
    $sql = "UPDATE user_academy_roles 
            SET additional_permissions = ? 
            WHERE user_id = ?";
    $stmt = $db->prepare($sql);
    $result = $stmt->execute([$testPermissions, $userId]);
    
    echo "Updated additional permissions: " . ($result ? 'SUCCESS' : 'FAILED') . "\n";
    echo "Test permissions added: {$testPermissions}\n";
} else {
    echo "User not found for adding test permissions\n";
}

?>
