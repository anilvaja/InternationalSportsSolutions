<?php

$pdo = new PDO('sqlite:database/database.sqlite');

echo "=== Permission ID Mapping ===\n\n";

// Get permission mappings
$stmt = $pdo->query("SELECT id, name, display_name FROM academy_permissions ORDER BY id");
$permissions = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Permission ID -> Name mapping:\n";
foreach ($permissions as $permission) {
    echo "  {$permission['id']}: {$permission['name']} ({$permission['display_name']})\n";
}

echo "\n=== Key Permission IDs ===\n";
$keyPermissions = ['view_students', 'create_students', 'view_batches', 'view_attendances', 'view_fees'];
foreach ($keyPermissions as $permName) {
    $stmt = $pdo->prepare("SELECT id FROM academy_permissions WHERE name = ?");
    $stmt->execute([$permName]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($result) {
        echo "  {$permName}: ID {$result['id']}\n";
    } else {
        echo "  {$permName}: NOT FOUND\n";
    }
}

?>
