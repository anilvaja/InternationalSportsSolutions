<?php

$pdo = new PDO('sqlite:database/database.sqlite');

echo "=== Testing Corrected Permission System ===\n\n";

// Test permission ID conversion directly
echo "🔍 Permission ID Mapping:\n";
$testPermissions = ['view_students', 'create_students', 'view_batches', 'view_attendances', 'view_fees'];

foreach ($testPermissions as $permission) {
    $stmt = $pdo->prepare("SELECT id FROM academy_permissions WHERE name = ?");
    $stmt->execute([$permission]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $permissionId = $result ? $result['id'] : 'NOT FOUND';
    echo "  $permission -> ID: $permissionId\n";
}

// Test admin user's actual stored permissions
echo "\n📋 Admin Role Stored Permissions:\n";
$stmt = $pdo->query("SELECT permissions FROM academy_roles WHERE name = 'admin'");
$adminRole = $stmt->fetch(PDO::FETCH_ASSOC);
if ($adminRole) {
    $permissions = json_decode($adminRole['permissions'], true);
    $permissionIds = array_slice($permissions, 0, 10); // Show first 10
    echo "  Admin role has permission IDs: " . implode(', ', $permissionIds) . "...\n";
    echo "  Total permissions: " . count($permissions) . "\n";
    
    // Check if our test permission IDs are in there
    $testIds = [29, 30, 22, 37, 45]; // view_students, create_students, view_batches, view_attendances, view_fees
    echo "\n🔍 Test Permission ID Check:\n";
    foreach ($testIds as $index => $id) {
        $hasPermission = in_array($id, $permissions);
        $permissionName = $testPermissions[$index];
        $status = $hasPermission ? "✅ FOUND" : "❌ MISSING";
        echo "  ID $id ($permissionName): $status\n";
    }
} else {
    echo "❌ Admin role not found\n";
}

echo "\n🎯 Summary:\n";
echo "- Permission system stores IDs, not names\n";
echo "- AcademyPermissionHelper.can() needs to convert names to IDs\n";
echo "- Admin role should contain all permission IDs for full access\n";

?>
