<?php
/**
 * Production Auto-Deployment Webhook Handler for GoDaddy cPanel
 * Trigger URL: https://yourdomain.com/deploy_webhook.php?secret=YOUR_SECRET_TOKEN
 */

// Define a strong secret token (replace with your secret key)
define('DEPLOY_SECRET_TOKEN', 'CHANGE_THIS_TO_YOUR_SECRET_KEY');

// Verify secret token
$requestSecret = $_GET['secret'] ?? $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';

if (empty($requestSecret) || (!hash_equals(DEPLOY_SECRET_TOKEN, $_GET['secret'] ?? ''))) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized token access']);
    exit;
}

header('Content-Type: text/plain');
echo "🚀 Starting Automated Deployment on GoDaddy Server...\n\n";

$projectPath = dirname(__DIR__);
chdir($projectPath);

$output = [];
$returnVar = 0;

// Execute deployment script
exec("bash scripts/deploy.sh 2>&1", $output, $returnVar);

echo implode("\n", $output) . "\n";

if ($returnVar === 0) {
    echo "\n✅ Deployment succeeded!";
} else {
    echo "\n❌ Deployment failed with exit code: {$returnVar}";
}
