<?php

$db = new PDO('sqlite:database/database.sqlite');

echo "=== Testing Coach Permission Fix ===\n\n";

// Get a user with coach role
$sql = "SELECT u.*, uar.academy_role_id 
        FROM users u 
        JOIN user_academy_roles uar ON u.id = uar.user_id 
        JOIN academy_roles ar ON ar.id = uar.academy_role_id 
        WHERE ar.name = 'coach' AND uar.is_active = 1 
        LIMIT 1";
$stmt = $db->prepare($sql);
$stmt->execute();
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo "No coach user found.\n";
    exit;
}

echo "Testing user: {$user['name']} ({$user['email']})\n";
echo "Academy ID: {$user['academy_id']}\n";
echo "Role ID: {$user['academy_role_id']}\n\n";

// Get the role permissions
$sql = "SELECT permissions, display_name FROM academy_roles WHERE id = ?";
$stmt = $db->prepare($sql);
$stmt->execute([$user['academy_role_id']]);
$roleData = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Role: {$roleData['display_name']}\n";

$rolePermissions = json_decode($roleData['permissions'] ?? '[]', true);
echo "Role permissions (raw): " . json_encode($rolePermissions) . "\n";
echo "Role permissions count: " . count($rolePermissions) . "\n\n";

// Simulate the permission conversion process
echo "=== Permission Conversion Process ===\n";
$convertedPermissions = [];
$conversionDetails = [];

foreach ($rolePermissions as $permission) {
    if (is_numeric($permission)) {
        // Already an ID
        $convertedPermissions[] = $permission;
        $conversionDetails[] = "ID {$permission} -> kept as ID";
    } else {
        // Convert name to ID
        $sql = "SELECT id FROM academy_permissions WHERE name = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute([$permission]);
        $permissionId = $stmt->fetchColumn();
        
        if ($permissionId) {
            $convertedPermissions[] = $permissionId;
            $conversionDetails[] = "{$permission} -> ID {$permissionId} ✅";
        } else {
            $conversionDetails[] = "{$permission} -> NOT FOUND ❌";
        }
    }
}

foreach ($conversionDetails as $detail) {
    echo "  {$detail}\n";
}

echo "\nConverted permissions: " . json_encode($convertedPermissions) . "\n";
echo "Converted count: " . count($convertedPermissions) . "\n\n";

// Test specific permission checks
echo "=== Testing Specific Permission Checks ===\n";
$testPermissions = [
    'view_dashboard',
    'view_students',
    'view_batches',
    'view_attendances',
    'view_events',
    'view_syllabus_categories',
    'view_syllabus_techniques'
];

foreach ($testPermissions as $testPerm) {
    // Get permission ID
    $sql = "SELECT id FROM academy_permissions WHERE name = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute([$testPerm]);
    $permId = $stmt->fetchColumn();
    
    if ($permId) {
        $hasPermission = in_array($permId, $convertedPermissions);
        echo "{$testPerm} (ID: {$permId}): " . ($hasPermission ? "✅ HAS" : "❌ NO") . "\n";
    } else {
        echo "{$testPerm}: ❌ PERMISSION NOT FOUND\n";
    }
}

echo "\n✅ Coach permission fix should now make menu items visible!\n";

?>
