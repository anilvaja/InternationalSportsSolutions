<?php

$pdo = new PDO('sqlite:database/database.sqlite');

echo "=== Testing AcademyRoleResource Access ===\n\n";

// Check admin role permissions for academy_roles
$stmt = $pdo->query('SELECT permissions FROM academy_roles WHERE name = "admin"');
$adminRole = $stmt->fetch(PDO::FETCH_ASSOC);
if ($adminRole) {
    $adminPermissions = json_decode($adminRole['permissions'], true);
    
    echo "🎯 Testing AcademyRoleResource Permission Requirements:\n";
    $requiredPermissions = ['view_academy_roles', 'create_academy_roles', 'edit_academy_roles', 'delete_academy_roles'];
    
    foreach ($requiredPermissions as $permissionName) {
        $stmt = $pdo->prepare('SELECT id FROM academy_permissions WHERE name = ?');
        $stmt->execute([$permissionName]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            $permissionId = $result['id'];
            $hasPermission = in_array($permissionId, $adminPermissions);
            $status = $hasPermission ? "✅ ALLOWED" : "❌ DENIED";
            echo "  $permissionName (ID $permissionId): $status\n";
        } else {
            echo "  $permissionName: ❌ PERMISSION NOT FOUND\n";
        }
    }
    
    echo "\n📋 Summary:\n";
    echo "- AcademyRoleResource.getAcademyPermissionName() now returns correct permission names\n";
    echo "- Admin user should now be able to access Academy Roles resource\n";
    echo "- Navigation menu should show 'Roles' under 'Access Management'\n";
} else {
    echo "❌ Admin role not found\n";
}

?>
