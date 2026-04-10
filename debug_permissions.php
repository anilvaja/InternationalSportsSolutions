<?php

$pdo = new PDO('sqlite:database/database.sqlite');

echo "=== Debugging Permission System ===\n\n";

// Check what permissions are actually stored in the admin role
$stmt = $pdo->query("SELECT name, permissions FROM academy_roles WHERE name = 'admin'");
$adminRole = $stmt->fetch(PDO::FETCH_ASSOC);

if ($adminRole) {
    echo "📋 Admin Role Permissions:\n";
    $permissions = json_decode($adminRole['permissions'], true);
    if (is_array($permissions)) {
        foreach ($permissions as $permission) {
            echo "  ✓ $permission\n";
        }
        echo "\nTotal permissions: " . count($permissions) . "\n\n";
    } else {
        echo "❌ Permissions data is not a valid JSON array\n";
        echo "Raw permissions data: " . $adminRole['permissions'] . "\n\n";
    }
} else {
    echo "❌ No admin role found\n\n";
}

// Test a specific permission check manually
echo "🔍 Manual Permission Check:\n";
$stmt = $pdo->prepare("
    SELECT ar.permissions, JSON_EXTRACT(ar.permissions, '$') as extracted_permissions
    FROM users u
    JOIN user_academy_roles uar ON u.id = uar.user_id
    JOIN academy_roles ar ON uar.academy_role_id = ar.id
    WHERE u.email = 'admin@mahavirsportsacademy.com'
");
$stmt->execute();
$result = $stmt->fetch(PDO::FETCH_ASSOC);

if ($result) {
    echo "Raw permissions: " . $result['permissions'] . "\n";
    echo "Extracted permissions: " . $result['extracted_permissions'] . "\n";
    
    // Test if 'view_students' is in the permissions
    $hasViewStudents = strpos($result['permissions'], '"view_students"') !== false;
    echo "Contains 'view_students': " . ($hasViewStudents ? 'YES' : 'NO') . "\n";
}

?>
