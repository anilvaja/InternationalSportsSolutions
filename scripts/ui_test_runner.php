<?php

/**
 * UI Test Runner - Automated Panel & Visual UI Health Diagnostic Tool
 * Run via CLI: php scripts/ui_test_runner.php
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$consoleKernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$consoleKernel->bootstrap();

use Filament\Facades\Filament;
use App\Models\User;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

echo "\n======================================================\n";
echo "       AUTOMATED UI & PANEL TEST RUNNER              \n";
echo "======================================================\n\n";

$results = [
    'passed' => 0,
    'failed' => 0,
    'ui_elements_count' => 0,
];

function reportTest(string $testName, bool $success, string $details = ''): void {
    global $results;
    if ($success) {
        $results['passed']++;
        echo "  [PASS] {$testName}\n";
    } else {
        $results['failed']++;
        echo "  [FAIL] {$testName}";
        if ($details) {
            echo " -> {$details}";
        }
        echo "\n";
    }
}

function inspectUiElements(string $html, array $expectedSelectors = []): array {
    global $results;
    $found = [];
    $missing = [];

    // Count basic UI components
    preg_match_all('/<button[^>]*>/i', $html, $buttons);
    preg_match_all('/<input[^>]*>/i', $html, $inputs);
    preg_match_all('/<form[^>]*>/i', $html, $forms);
    preg_match_all('/class=["\'][^"\']*(fi-|filament-|card|bg-|text-)[^"\']*["\']/i', $html, $components);

    $buttonCount = count($buttons[0]);
    $inputCount = count($inputs[0]);
    $formCount = count($forms[0]);
    $componentCount = count($components[0]);

    $results['ui_elements_count'] += ($buttonCount + $inputCount + $formCount + $componentCount);

    foreach ($expectedSelectors as $label => $needle) {
        if (str_contains($html, $needle)) {
            $found[] = $label;
        } else {
            $missing[] = $label;
        }
    }

    return [
        'buttons' => $buttonCount,
        'inputs' => $inputCount,
        'forms' => $formCount,
        'components' => $componentCount,
        'found' => $found,
        'missing' => $missing,
    ];
}

function checkUiRoute(string $uri, string $name, array $expectedText = [], ?User $asUser = null, string $panelId = '') {
    global $kernel;
    try {
        if ($panelId) {
            Filament::setCurrentPanel(Filament::getPanel($panelId));
        }

        if ($asUser) {
            Auth::guard('web')->setUser($asUser);
            Auth::shouldUse('web');
        }
        
        $req = Request::create($uri, 'GET');
        $res = $kernel->handle($req);
        $status = $res->getStatusCode();
        $html = $res->getContent();
        $kernel->terminate($req, $res);

        if ($asUser) {
            Auth::logout();
        }

        $hasSyntaxError = str_contains($html, 'ParseError') || str_contains($html, 'ErrorException') || str_contains($html, 'SFC Error');
        $isOk = ($status === 200) && !$hasSyntaxError;

        $ui = inspectUiElements($html, $expectedText);
        $missingText = !empty($ui['missing']) ? "Missing UI elements: " . implode(', ', $ui['missing']) : '';
        
        if (!empty($ui['missing'])) {
            $isOk = false;
        }

        $details = "HTTP {$status} | UI Components: {$ui['buttons']} Buttons, {$ui['inputs']} Inputs, {$ui['forms']} Forms";
        if ($missingText) {
            $details .= " | {$missingText}";
        }

        reportTest("GET {$uri} ({$name})", $isOk, $details);
    } catch (\Throwable $e) {
        reportTest("GET {$uri} ({$name})", false, "Exception: " . $e->getMessage());
    }
}

$sysName = Setting::get('system_name', 'International Sports Solutions');

// 1. Check Public Landing Page Route & UI
echo "1. Public Landing Page Checks & UI Impact:\n";
checkUiRoute('/', 'Welcome Page', [
    'Main Title' => $sysName,
    'Admin Card' => 'Admin Panel',
    'Academy Card' => 'Academy Panel',
    'Student Card' => 'Student Panel',
]);

echo "\n2. Filament Panel Login Routes & UI Impact:\n";
checkUiRoute('/admin/login', 'Admin Panel Login UI', [
    'Dynamic System Brand' => $sysName,
]);
checkUiRoute('/academy/login', 'Academy Panel Login UI', [
    'Login Form' => 'login',
]);
checkUiRoute('/student/login', 'Student Portal Login UI', [
    'Dynamic System Brand' => $sysName,
]);

echo "\n3. Authenticated UI & Dashboard Access Checks:\n";

$superAdmin = User::where('is_super_admin', true)->first();
if ($superAdmin) {
    $panel = Filament::getPanel('admin');
    $canAccess = $superAdmin->canAccessPanel($panel);
    reportTest("SuperAdmin ('{$superAdmin->email}') Panel Permission", $canAccess);
} else {
    reportTest("SuperAdmin Panel Permission", false, "No SuperAdmin user found in DB");
}

$academyUser = User::where('is_super_admin', false)->whereNotNull('academy_id')->first();
if ($academyUser) {
    $panel = Filament::getPanel('academy');
    $canAccess = $academyUser->canAccessPanel($panel);
    reportTest("Academy User ('{$academyUser->email}') Panel Permission", $canAccess);
} else {
    reportTest("Academy User Panel Permission", false, "No Academy user found in DB");
}

echo "\n======================================================\n";
echo " Summary: {$results['passed']} Passed, {$results['failed']} Failed\n";
echo " Total Rendered UI Elements Inspected: {$results['ui_elements_count']}\n";
echo "======================================================\n\n";

exit($results['failed'] > 0 ? 1 : 0);
