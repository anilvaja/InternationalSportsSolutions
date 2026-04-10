<?php

$db = new PDO('sqlite:database/database.sqlite');

echo "=== Investigating Attendance Permissions ===\n\n";

// Check all attendance-related permissions in the database
$sql = "SELECT id, name, display_name, category FROM academy_permissions WHERE name LIKE '%attendance%' ORDER BY name";
$stmt = $db->prepare($sql);
$stmt->execute();
$attendancePermissions = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found attendance permissions in database:\n";
foreach ($attendancePermissions as $perm) {
    echo "ID: {$perm['id']}, Name: {$perm['name']}, Display: {$perm['display_name']}, Category: {$perm['category']}\n";
}

echo "\n=== Checking Coach Role Permissions ===\n";
// Get coach role permissions to see what attendance permissions they have
$sql = "SELECT ar.id, ar.display_name, ar.permissions 
        FROM academy_roles ar 
        WHERE ar.name = 'coach' AND ar.display_name = 'Assistant Coach'";
$stmt = $db->prepare($sql);
$stmt->execute();
$coachRole = $stmt->fetch(PDO::FETCH_ASSOC);

if ($coachRole) {
    echo "Coach role: {$coachRole['display_name']}\n";
    $permissions = json_decode($coachRole['permissions'], true);
    
    $attendancePerms = array_filter($permissions, function($perm) {
        return strpos($perm, 'attendance') !== false;
    });
    
    echo "Attendance-related permissions in coach role:\n";
    foreach ($attendancePerms as $perm) {
        echo "  - {$perm}\n";
        
        // Check if this permission exists in database
        $sql = "SELECT id FROM academy_permissions WHERE name = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute([$perm]);
        $permId = $stmt->fetchColumn();
        
        if ($permId) {
            echo "    ✅ Exists in database (ID: {$permId})\n";
        } else {
            echo "    ❌ NOT FOUND in database\n";
        }
    }
} else {
    echo "Coach role not found.\n";
}

echo "\n=== What AttendanceResource expects ===\n";
echo "AttendanceResource.canViewAny() checks for: 'view_attendance' (singular)\n";

// Check if view_attendance exists
$sql = "SELECT id FROM academy_permissions WHERE name = 'view_attendance'";
$stmt = $db->prepare($sql);
$stmt->execute();
$viewAttendanceId = $stmt->fetchColumn();

if ($viewAttendanceId) {
    echo "✅ 'view_attendance' exists in database (ID: {$viewAttendanceId})\n";
} else {
    echo "❌ 'view_attendance' NOT FOUND in database\n";
}

// Check if view_attendances exists
$sql = "SELECT id FROM academy_permissions WHERE name = 'view_attendances'";
$stmt = $db->prepare($sql);
$stmt->execute();
$viewAttendancesId = $stmt->fetchColumn();

if ($viewAttendancesId) {
    echo "✅ 'view_attendances' exists in database (ID: {$viewAttendancesId})\n";
} else {
    echo "❌ 'view_attendances' NOT FOUND in database\n";
}

?>
