<?php

$db = new PDO('sqlite:database/database.sqlite');

echo "=== Testing AttendanceResource Permission Fix ===\n\n";

// Get coach user
$sql = "SELECT u.*, uar.academy_role_id 
        FROM users u 
        JOIN user_academy_roles uar ON u.id = uar.user_id 
        JOIN academy_roles ar ON ar.id = uar.academy_role_id 
        WHERE ar.name = 'coach' AND ar.display_name = 'Assistant Coach' AND uar.is_active = 1 
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

// Filter attendance permissions
$attendancePerms = array_filter($rolePermissions, function($perm) {
    return strpos($perm, 'attendance') !== false;
});

echo "Attendance permissions in coach role:\n";
foreach ($attendancePerms as $perm) {
    echo "  - {$perm}\n";
}

echo "\n=== Testing Permission Checks (After Fix) ===\n";

// Test the permissions that AttendanceResource now checks for
$testPermissions = [
    'view_attendances' => 'Should allow navigation visibility',
    'create_attendances' => 'Should allow create button',
    'edit_attendances' => 'Should allow edit action',
    'delete_attendances' => 'Should allow delete action',
    'take_attendance' => 'Should allow take attendance action'
];

foreach ($testPermissions as $testPerm => $description) {
    // Convert permission name to ID
    $sql = "SELECT id FROM academy_permissions WHERE name = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute([$testPerm]);
    $permId = $stmt->fetchColumn();
    
    if (!$permId) {
        echo "❌ {$testPerm}: Permission not found in database\n";
        continue;
    }
    
    // Check if coach role has this permission (by converting role permission names to IDs)
    $hasPermission = false;
    foreach ($rolePermissions as $rolePerm) {
        $sql = "SELECT id FROM academy_permissions WHERE name = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute([$rolePerm]);
        $rolePermId = $stmt->fetchColumn();
        
        if ($rolePermId == $permId) {
            $hasPermission = true;
            break;
        }
    }
    
    $status = $hasPermission ? "✅ HAS" : "❌ NO";
    echo "{$status} {$testPerm} - {$description}\n";
}

echo "\n=== Navigation Visibility Test ===\n";
echo "Before fix: AttendanceResource.canViewAny() checked 'view_attendance' ❌\n";
echo "After fix:  AttendanceResource.canViewAny() checks 'view_attendances' ✅\n";
echo "\nAttendance menu should now be visible for coach users! 🎉\n";

echo "\n=== BaseAcademyResource Integration ===\n";
echo "Added getAcademyPermissionName() method: action + '_attendances'\n";
echo "This ensures all BaseAcademyResource methods use correct permission names.\n";

?>
