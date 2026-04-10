<?php

$pdo = new PDO('sqlite:database/database.sqlite');
echo "=== Academy Role Analysis ===\n\n";

// Check the structure of academy_roles table
$stmt = $pdo->query('PRAGMA table_info(academy_roles)');
$columns = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "📋 Academy Roles Table Structure:\n";
foreach ($columns as $column) {
    echo "  {$column['name']} ({$column['type']})";
    if ($column['notnull']) echo " NOT NULL";
    if ($column['dflt_value']) echo " DEFAULT {$column['dflt_value']}";
    echo "\n";
}

// Check current roles
$stmt = $pdo->query('SELECT * FROM academy_roles WHERE academy_id = 1');
$roles = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "\n🎯 Current Academy Roles:\n";
foreach ($roles as $role) {
    echo "  ID {$role['id']}: {$role['display_name']} ({$role['name']})";
    echo " - Active: " . ($role['is_active'] ? 'Yes' : 'No');
    if (array_key_exists('is_default', $role)) echo " - Default: " . ($role['is_default'] ? 'Yes' : 'No');
    if (array_key_exists('is_removable', $role)) echo " - Removable: " . ($role['is_removable'] ? 'Yes' : 'No');
    echo "\n";
}

// Check if there are any specific constraints that might prevent editing
echo "\n🔍 Potential Edit Restrictions:\n";
foreach ($roles as $role) {
    $restrictions = [];
    if (array_key_exists('is_default', $role) && $role['is_default']) {
        $restrictions[] = "Default role";
    }
    if (array_key_exists('is_removable', $role) && !$role['is_removable']) {
        $restrictions[] = "Not removable";
    }
    
    if (empty($restrictions)) {
        echo "  {$role['display_name']}: ✅ No restrictions\n";
    } else {
        echo "  {$role['display_name']}: ⚠️ " . implode(', ', $restrictions) . "\n";
    }
}

?>
