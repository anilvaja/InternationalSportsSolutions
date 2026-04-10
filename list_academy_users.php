<?php

$pdo = new PDO('sqlite:database/database.sqlite');
$stmt = $pdo->query('
    SELECT u.name, u.email, ar.name as role_name 
    FROM users u 
    LEFT JOIN user_academy_roles uar ON u.id = uar.user_id 
    LEFT JOIN academy_roles ar ON uar.academy_role_id = ar.id 
    WHERE u.academy_id = 1
');
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Users in Academy 1:\n";
foreach($users as $user) {
    echo $user['name'] . ' (' . $user['email'] . ') - Role: ' . ($user['role_name'] ?? 'None') . PHP_EOL;
}

?>
