<?php

$pdo = new PDO('sqlite:database/database.sqlite');

echo "=== Role Permissions Check ===\n\n";

// Check what roles-related permissions exist
$stmt = $pdo->query('SELECT id, name, display_name FROM academy_permissions WHERE name LIKE "%role%" ORDER BY name');
$rolePermissions = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "🔍 Available Role Permissions:\n";
foreach ($rolePermissions as $permission) {
    echo "  ID {$permission['id']}: {$permission['name']} ({$permission['display_name']})\n";
}

// Check admin role permissions
$stmt = $pdo->query('SELECT permissions FROM academy_roles WHERE name = "admin"');
$adminRole = $stmt->fetch(PDO::FETCH_ASSOC);
if ($adminRole) {
    $adminPermissions = json_decode($adminRole['permissions'], true);
    echo "\n📋 Admin Role Permission IDs: " . implode(', ', array_slice($adminPermissions, 0, 10)) . "...\n";
    echo "Total permissions: " . count($adminPermissions) . "\n\n";
    
    echo "🔍 Role Permission Check:\n";
    foreach ($rolePermissions as $permission) {
        $hasPermission = in_array($permission['id'], $adminPermissions);
        $status = $hasPermission ? "✅ HAS" : "❌ MISSING";
        echo "  {$permission['name']}: $status\n";
    }
} else {
    echo "❌ Admin role not found\n";
}

// Test the specific permissions that AcademyRoleResource needs
echo "\n🎯 AcademyRoleResource Permission Requirements:\n";
$requiredPermissions = ['view_roles', 'create_roles', 'edit_roles', 'delete_roles'];
foreach ($requiredPermissions as $permissionName) {
    $stmt = $pdo->prepare('SELECT id FROM academy_permissions WHERE name = ?');
    $stmt->execute([$permissionName]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result) {
        $permissionId = $result['id'];
        $hasPermission = in_array($permissionId, $adminPermissions);
        $status = $hasPermission ? "✅ HAS" : "❌ MISSING";
        echo "  $permissionName (ID $permissionId): $status\n";
    } else {
        echo "  $permissionName: ❌ PERMISSION NOT FOUND\n";
    }
}

?>
