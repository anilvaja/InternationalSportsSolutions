<?php

require_once 'vendor/autoload.php';

/**
 * Test script to verify navigation menu visibility is working properly
 */

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\AcademyRole;
use App\Models\AcademyPermission;

// Test with user john.smith (should have no access)
echo "=== Testing Navigation Visibility ===\n\n";

// Connect to database
$pdo = new PDO('sqlite:database/database.sqlite');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Find john.smith user
$stmt = $pdo->prepare("
    SELECT u.*, ar.name as role_name 
    FROM users u 
    LEFT JOIN academy_role_user aru ON u.id = aru.user_id
    LEFT JOIN academy_roles ar ON aru.academy_role_id = ar.id
    WHERE u.email = 'john.smith@mahavirsportsacademy.com'
");
$stmt->execute();
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo "❌ User john.smith@mahavirsportsacademy.com not found!\n";
    exit;
}

echo "👤 User: {$user['name']} ({$user['email']})\n";
echo "🏫 Academy ID: " . ($user['academy_id'] ?? 'None') . "\n";
echo "👥 Role: " . ($user['role_name'] ?? 'No role assigned') . "\n\n";

// Test permissions for key resources
$testPermissions = [
    'view_students',
    'create_students', 
    'view_batches',
    'create_batches',
    'view_attendances',
    'create_attendances',
    'view_fees',
    'create_fees'
];

echo "🔒 Permission Check Results:\n";
foreach ($testPermissions as $permission) {
    // Check if user has this permission through any role
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as has_permission
        FROM users u
        JOIN academy_role_user aru ON u.id = aru.user_id
        JOIN academy_roles ar ON aru.academy_role_id = ar.id
        JOIN academy_permission_role apr ON ar.id = apr.academy_role_id
        JOIN academy_permissions ap ON apr.academy_permission_id = ap.id
        WHERE u.id = ? AND ap.name = ? AND u.academy_id = ar.academy_id
    ");
    $stmt->execute([$user['id'], $permission]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $hasPermission = $result['has_permission'] > 0;
    $status = $hasPermission ? "✅ ALLOWED" : "❌ DENIED";
    echo "  $permission: $status\n";
}

echo "\n";

// Also test with a user who SHOULD have permissions
echo "=== Testing with Academy Admin User ===\n\n";

$stmt = $pdo->prepare("
    SELECT u.*, ar.name as role_name 
    FROM users u 
    JOIN academy_role_user aru ON u.id = aru.user_id
    JOIN academy_roles ar ON aru.academy_role_id = ar.id
    WHERE ar.name = 'Academy Admin'
    LIMIT 1
");
$stmt->execute();
$adminUser = $stmt->fetch(PDO::FETCH_ASSOC);

if ($adminUser) {
    echo "👤 Admin User: {$adminUser['name']} ({$adminUser['email']})\n";
    echo "🏫 Academy ID: {$adminUser['academy_id']}\n";
    echo "👥 Role: {$adminUser['role_name']}\n\n";
    
    echo "🔒 Permission Check Results for Admin:\n";
    foreach ($testPermissions as $permission) {
        // Check if user has this permission through any role
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as has_permission
            FROM users u
            JOIN academy_role_user aru ON u.id = aru.user_id
            JOIN academy_roles ar ON aru.academy_role_id = ar.id
            JOIN academy_permission_role apr ON ar.id = apr.academy_role_id
            JOIN academy_permissions ap ON apr.academy_permission_id = ap.id
            WHERE u.id = ? AND ap.name = ? AND u.academy_id = ar.academy_id
        ");
        $stmt->execute([$adminUser['id'], $permission]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $hasPermission = $result['has_permission'] > 0;
        $status = $hasPermission ? "✅ ALLOWED" : "❌ DENIED";
        echo "  $permission: $status\n";
    }
} else {
    echo "❌ No Academy Admin user found\n";
}

echo "\n🎯 Summary:\n";
echo "- john.smith user should see NO menu items (has no role)\n"; 
echo "- Academy Admin user should see ALL menu items (has full permissions)\n";
echo "- Navigation visibility is controlled by shouldRegisterNavigation() in BaseAcademyResource\n";

?>
