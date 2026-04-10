<?php

$db = new PDO('sqlite:database/database.sqlite');

echo "=== Investigating Coach Role Permissions ===\n\n";

// Find the coach role
$sql = "SELECT * FROM academy_roles WHERE name = 'coach' OR display_name LIKE '%coach%' OR display_name LIKE '%Coach%'";
$stmt = $db->prepare($sql);
$stmt->execute();
$coachRoles = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found coach roles:\n";
foreach ($coachRoles as $role) {
    echo "ID: {$role['id']}, Name: {$role['name']}, Display: {$role['display_name']}\n";
    
    $permissions = json_decode($role['permissions'] ?? '[]', true);
    echo "Permissions count: " . count($permissions) . "\n";
    echo "Permission IDs: " . implode(', ', $permissions) . "\n";
    
    // Convert permission IDs to names
    if (!empty($permissions)) {
        $permissionIds = implode(',', $permissions);
        $sql2 = "SELECT id, name, display_name FROM academy_permissions WHERE id IN ($permissionIds)";
        $stmt2 = $db->prepare($sql2);
        $stmt2->execute();
        $permissionDetails = $stmt2->fetchAll(PDO::FETCH_ASSOC);
        
        echo "\nPermission details:\n";
        foreach ($permissionDetails as $perm) {
            echo "  - {$perm['name']} ({$perm['display_name']})\n";
        }
    }
    echo "\n---\n";
}

// Check if there are users with coach role
echo "\nUsers with coach role:\n";
foreach ($coachRoles as $role) {
    $sql = "SELECT u.name, u.email FROM users u 
            JOIN user_academy_roles uar ON u.id = uar.user_id 
            WHERE uar.academy_role_id = ? AND uar.is_active = 1";
    $stmt = $db->prepare($sql);
    $stmt->execute([$role['id']]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Role '{$role['display_name']}' has " . count($users) . " users:\n";
    foreach ($users as $user) {
        echo "  - {$user['name']} ({$user['email']})\n";
    }
}

// Check what permissions the relevant resources expect
echo "\n=== Expected Permissions for Menu Items ===\n";
$expectedPermissions = [
    'Syllabus' => 'view_syllabus_categories',
    'Syllabus Techniques' => 'view_syllabus_techniques', 
    'Batches' => 'view_batches',
    'Attendance' => 'view_attendances',
    'Events' => 'view_events',
    'Dashboard' => 'view_dashboard'
];

foreach ($expectedPermissions as $menu => $permission) {
    $sql = "SELECT id, display_name FROM academy_permissions WHERE name = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute([$permission]);
    $perm = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($perm) {
        echo "{$menu}: {$permission} (ID: {$perm['id']}) - {$perm['display_name']}\n";
    } else {
        echo "{$menu}: {$permission} - NOT FOUND!\n";
    }
}

?>
