<?php

$db = new PDO('sqlite:database/database.sqlite');

echo "=== Investigating Coach Role Permissions (Fixed) ===\n\n";

// Find the coach role
$sql = "SELECT * FROM academy_roles WHERE name = 'coach' OR display_name LIKE '%coach%' OR display_name LIKE '%Coach%'";
$stmt = $db->prepare($sql);
$stmt->execute();
$coachRoles = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found coach roles:\n";
foreach ($coachRoles as $role) {
    echo "ID: {$role['id']}, Name: {$role['name']}, Display: {$role['display_name']}\n";
    
    $permissionsRaw = $role['permissions'] ?? '[]';
    echo "Raw permissions: {$permissionsRaw}\n";
    
    $permissions = json_decode($permissionsRaw, true);
    echo "Permissions count: " . count($permissions) . "\n";
    
    if (!empty($permissions)) {
        echo "Permissions:\n";
        foreach ($permissions as $index => $permission) {
            // Check if this is an ID (integer) or name (string)
            if (is_numeric($permission)) {
                // It's an ID, look up the name
                $sql2 = "SELECT name, display_name FROM academy_permissions WHERE id = ?";
                $stmt2 = $db->prepare($sql2);
                $stmt2->execute([$permission]);
                $perm = $stmt2->fetch(PDO::FETCH_ASSOC);
                if ($perm) {
                    echo "  {$index}: ID {$permission} -> {$perm['name']} ({$perm['display_name']})\n";
                } else {
                    echo "  {$index}: ID {$permission} -> NOT FOUND\n";
                }
            } else {
                // It's a name, look up the ID
                $sql2 = "SELECT id, display_name FROM academy_permissions WHERE name = ?";
                $stmt2 = $db->prepare($sql2);
                $stmt2->execute([$permission]);
                $perm = $stmt2->fetch(PDO::FETCH_ASSOC);
                if ($perm) {
                    echo "  {$index}: {$permission} -> ID {$perm['id']} ({$perm['display_name']})\n";
                } else {
                    echo "  {$index}: {$permission} -> NOT FOUND!\n";
                }
            }
        }
    }
    echo "\n---\n";
}

// Check what permissions the relevant resources expect
echo "\n=== Expected Permissions for Menu Items ===\n";
$expectedPermissions = [
    'Students' => 'view_students',
    'Batches' => 'view_batches', 
    'Attendance' => 'view_attendances',
    'Events' => 'view_events',
    'Syllabus Categories' => 'view_syllabus_categories',
    'Syllabus Techniques' => 'view_syllabus_techniques',
    'Dashboard' => 'view_dashboard'
];

foreach ($expectedPermissions as $menu => $permission) {
    $sql = "SELECT id, display_name FROM academy_permissions WHERE name = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute([$permission]);
    $perm = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($perm) {
        echo "{$menu}: {$permission} (ID: {$perm['id']}) ✅\n";
    } else {
        echo "{$menu}: {$permission} - ❌ NOT FOUND!\n";
    }
}

?>
