<?php

$pdo = new PDO('sqlite:database/database.sqlite');

echo "=== Checking Academy Admin Role ===\n\n";

// Get the admin role details
$stmt = $pdo->query('SELECT * FROM academy_roles WHERE name = "admin"');
$adminRole = $stmt->fetch(PDO::FETCH_ASSOC);

if ($adminRole) {
    echo "📋 Admin Role Details:\n";
    echo "  ID: {$adminRole['id']}\n";
    echo "  Name: {$adminRole['name']}\n";
    echo "  Display Name: {$adminRole['display_name']}\n";
    echo "  Academy ID: {$adminRole['academy_id']}\n\n";
    
    // Check users with admin role
    $stmt = $pdo->prepare('
        SELECT u.name, u.email 
        FROM users u 
        JOIN user_academy_roles uar ON u.id = uar.user_id 
        JOIN academy_roles ar ON uar.academy_role_id = ar.id 
        WHERE ar.name = "admin" AND u.academy_id = ?
    ');
    $stmt->execute([$adminRole['academy_id']]);
    $adminUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "👥 Users with Admin Role:\n";
    foreach ($adminUsers as $user) {
        echo "  - {$user['name']} ({$user['email']})\n";
    }
} else {
    echo "❌ Admin role not found\n";
}

// Test the logic for checking if a user is academy admin
echo "\n🔍 Academy Admin Check Logic:\n";
echo "1. User must have academy_id\n";
echo "2. User must have a role assignment to academy_role with name = 'admin'\n";
echo "3. The role must belong to the same academy as the user\n";

?>
