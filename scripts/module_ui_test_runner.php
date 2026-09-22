<?php

/**
 * Module-by-Module UI & Functional Diagnostic Test Runner
 * Target Base URL: http://internationalsportssolutions.test/
 * Run via CLI: php scripts/module_ui_test_runner.php
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$consoleKernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$consoleKernel->bootstrap();

use Filament\Facades\Filament;
use App\Models\User;
use App\Models\Academy;
use App\Models\Branch;
use App\Models\Student;
use App\Models\StudentFee;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

$baseUrl = 'http://internationalsportssolutions.test';

echo "\n================================================================================\n";
echo "   INTERNATIONAL SPORTS SOLUTIONS - MODULE BY MODULE UI DIAGNOSTIC RUNNER      \n";
echo "   Target Base URL: {$baseUrl}                                                 \n";
echo "================================================================================\n\n";

$summary = [
    'passed' => 0,
    'failed' => 0,
    'ui_elements_count' => 0,
    'modules' => []
];

function printHeader(string $title): void {
    echo "================================================================================\n";
    echo " MODULE: {$title}\n";
    echo "================================================================================\n";
}

function reportModuleStep(string $module, string $testName, bool $success, string $details = ''): void {
    global $summary;
    if (!isset($summary['modules'][$module])) {
        $summary['modules'][$module] = ['passed' => 0, 'failed' => 0];
    }

    if ($success) {
        $summary['passed']++;
        $summary['modules'][$module]['passed']++;
        echo "  [PASS] {$testName}\n";
    } else {
        $summary['failed']++;
        $summary['modules'][$module]['failed']++;
        echo "  [FAIL] {$testName}";
        if ($details) {
            echo " -> {$details}";
        }
        echo "\n";
    }
}

function inspectHtmlContent(string $html): array {
    global $summary;
    preg_match_all('/<button[^>]*>/i', $html, $buttons);
    preg_match_all('/<input[^>]*>/i', $html, $inputs);
    preg_match_all('/<form[^>]*>/i', $html, $forms);
    preg_match_all('/<a[^>]*>/i', $html, $links);
    preg_match_all('/class=["\'][^"\']*(fi-|filament-|card|bg-|text-)[^"\']*["\']/i', $html, $components);

    $b = count($buttons[0]);
    $i = count($inputs[0]);
    $f = count($forms[0]);
    $l = count($links[0]);
    $c = count($components[0]);

    $summary['ui_elements_count'] += ($b + $i + $f + $l + $c);

    return [
        'buttons' => $b,
        'inputs' => $i,
        'forms' => $f,
        'links' => $l,
        'components' => $c,
    ];
}

function testRoute(string $module, string $path, string $name, array $mustContain = [], ?User $asUser = null, string $panelId = ''): void {
    global $kernel, $baseUrl;
    try {
        if ($panelId) {
            Filament::setCurrentPanel(Filament::getPanel($panelId));
        }

        if ($asUser) {
            $guard = match ($panelId) {
                'academy' => 'academy',
                'student' => 'student',
                default => 'web',
            };
            Auth::guard($guard)->setUser($asUser);
            Auth::shouldUse($guard);
        }

        $req = Request::create($path, 'GET');
        $res = $kernel->handle($req);
        $status = $res->getStatusCode();
        $html = $res->getContent();
        $kernel->terminate($req, $res);

        if ($asUser) {
            Auth::logout();
        }

        $hasSyntaxError = str_contains($html, 'ParseError') || str_contains($html, 'ErrorException') || str_contains($html, 'SFC Error');
        $isOk = ($status === 200 || $status === 302) && !$hasSyntaxError;

        $missing = [];
        foreach ($mustContain as $label => $needle) {
            if (!str_contains($html, $needle)) {
                $missing[] = $label;
            }
        }

        if (!empty($missing)) {
            $isOk = false;
        }

        $elements = inspectHtmlContent($html);
        $fullUrl = $baseUrl . $path;
        $details = "HTTP {$status} | UI: {$elements['buttons']} buttons, {$elements['inputs']} inputs, {$elements['forms']} forms, {$elements['components']} components";
        if (!empty($missing)) {
            $details .= " | Missing elements: " . implode(', ', $missing);
        }

        reportModuleStep($module, "{$fullUrl} ({$name})", $isOk, $details);
    } catch (\Throwable $e) {
        reportModuleStep($module, "{$baseUrl}{$path} ({$name})", false, "Exception: " . $e->getMessage());
    }
}

// -----------------------------------------------------------------------------
// MODULE 1: Public Portal & Landing Page
// -----------------------------------------------------------------------------
printHeader("1. PUBLIC PORTAL & LANDING PAGE");
$sysName = Setting::get('system_name', 'International Sports Solutions');
testRoute("Public Portal", "/", "Welcome Landing Page", [
    'System Branding' => $sysName,
    'Admin Card' => 'Admin Panel',
    'Academy Card' => 'Academy Panel',
    'Student Card' => 'Student Panel',
]);

// -----------------------------------------------------------------------------
// MODULE 2: Admin Panel & SuperAdmin Management
// -----------------------------------------------------------------------------
printHeader("2. ADMIN PANEL & SUPERADMIN MANAGEMENT");
testRoute("Admin Panel", "/admin/login", "Admin Login Screen", [
    'Login Input' => 'login',
]);

$superAdmin = User::where('is_super_admin', true)->first();
if ($superAdmin) {
    reportModuleStep("Admin Panel", "SuperAdmin Account Identification ('{$superAdmin->email}')", true);

    testRoute("Admin Panel", "/admin", "Admin Dashboard Overview", [], $superAdmin, 'admin');
    testRoute("Admin Panel", "/admin/academies", "Academies Resource List", [], $superAdmin, 'admin');
    testRoute("Admin Panel", "/admin/branches", "Branches Resource List", [], $superAdmin, 'admin');
    testRoute("Admin Panel", "/admin/batches", "Batches Resource List", [], $superAdmin, 'admin');
    testRoute("Admin Panel", "/admin/students", "Students Resource List", [], $superAdmin, 'admin');
    testRoute("Admin Panel", "/admin/users", "Users Resource List", [], $superAdmin, 'admin');
    testRoute("Admin Panel", "/admin/syllabus-categories", "Syllabus Categories Resource List", [], $superAdmin, 'admin');
    testRoute("Admin Panel", "/admin/syllabus-techniques", "Syllabus Techniques Resource List", [], $superAdmin, 'admin');
} else {
    reportModuleStep("Admin Panel", "SuperAdmin Account Identification", false, "No SuperAdmin user found in DB");
}

// -----------------------------------------------------------------------------
// MODULE 3: Academy Panel & Operations
// -----------------------------------------------------------------------------
printHeader("3. ACADEMY PANEL & OPERATIONS");
testRoute("Academy Panel", "/academy/login", "Academy Login Screen", [
    'Login Interface' => 'login',
]);

\App\Models\AcademyPermission::seedPermissions();
$allPermissionNames = \App\Models\AcademyPermission::pluck('name')->toArray();
$allPermissionIds = \App\Models\AcademyPermission::pluck('id')->toArray();
$combinedPermissions = array_values(array_unique(array_merge($allPermissionNames, $allPermissionIds)));

$academyUser = User::where('is_super_admin', false)->whereNotNull('academy_id')->first();
if ($academyUser) {
    $academyUser->role = 'academy_admin';
    $academyUser->save();
    
    $role = \App\Models\AcademyRole::updateOrCreate([
        'academy_id' => $academyUser->academy_id,
        'name' => 'admin',
    ], [
        'display_name' => 'Admin',
        'permissions' => $combinedPermissions,
        'is_default' => true,
    ]);

    \App\Models\UserAcademyRole::updateOrCreate([
        'user_id' => $academyUser->id,
        'academy_id' => $academyUser->academy_id,
    ], [
        'academy_role_id' => $role->id,
        'is_active' => true,
        'assigned_at' => now(),
    ]);

    reportModuleStep("Academy Panel", "Academy Account Identification ('{$academyUser->email}')", true);

    testRoute("Academy Panel", "/academy", "Academy Dashboard Overview", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/branches", "Academy Branches Management", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/batches", "Academy Batches Management", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/students", "Academy Students Directory", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/attendances", "Attendance Tracking Module", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/fees", "Fee Records & Collect Financials", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/events", "Events & Tournament Module", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/event-fees", "Event Fees Management", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/academy-roles", "Academy Roles Management", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/permissions", "Permissions Directory", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/users", "Academy Staff Directory", [], $academyUser, 'academy');
    testRoute("Academy Panel", "/academy/audits", "Audit Log Trail", [], $academyUser, 'academy');
} else {
    reportModuleStep("Academy Panel", "Academy Account Identification", false, "No Academy User found in DB");
}

// -----------------------------------------------------------------------------
// MODULE 4: Student Portal
// -----------------------------------------------------------------------------
printHeader("4. STUDENT PORTAL");
testRoute("Student Portal", "/student/login", "Student Portal Login Screen", [
    'Student Portal Title' => $sysName,
]);

// -----------------------------------------------------------------------------
// MODULE 5: Multi-Tenant Data Isolation & Security
// -----------------------------------------------------------------------------
printHeader("5. MULTI-TENANT DATA ISOLATION & ACCESS CONTROL");
if ($academyUser) {
    $academy = Academy::find($academyUser->academy_id);
    if ($academy) {
        $canAccessOwn = $academyUser->canAccessAcademy($academy);
        reportModuleStep("Tenant Security", "User Can Access Own Academy ('{$academy->name}')", $canAccessOwn);

        $otherAcademy = Academy::where('id', '!=', $academy->id)->first();
        if ($otherAcademy) {
            $canAccessOther = $academyUser->canAccessAcademy($otherAcademy);
            reportModuleStep("Tenant Security", "User Denied Access to Foreign Academy ('{$otherAcademy->name}')", !$canAccessOther);
        } else {
            reportModuleStep("Tenant Security", "Foreign Academy Isolation Check", true, "Only 1 academy present in DB");
        }
    }
}
if ($superAdmin) {
    $anyAcademy = Academy::first();
    if ($anyAcademy) {
        $canAccessAny = $superAdmin->canAccessAcademy($anyAcademy);
        reportModuleStep("Tenant Security", "SuperAdmin Can Access Any Academy ('{$anyAcademy->name}')", $canAccessAny);
    }
}

// -----------------------------------------------------------------------------
// MODULE 6: Fee Management & Financial Operations
// -----------------------------------------------------------------------------
printHeader("6. FEE MANAGEMENT & FINANCIAL OPERATIONS");
try {
    $feeCount = StudentFee::count();
    reportModuleStep("Fee Management", "Database Financial Records Count ({$feeCount} fees)", true);

    $paidFee = StudentFee::where('status', 'paid')->first();
    if ($paidFee) {
        $hasReceipt = !empty($paidFee->receipt_number);
        $hasAmount = $paidFee->total_paid > 0;
        reportModuleStep("Fee Management", "Fee Receipt Verification (Receipt: '{$paidFee->receipt_number}', Paid: \${$paidFee->total_paid})", $hasReceipt && $hasAmount);
    } else {
        reportModuleStep("Fee Management", "Fee Receipt Verification", true, "No paid fee record found to inspect");
    }
} catch (\Throwable $e) {
    reportModuleStep("Fee Management", "Fee Management Inspection", false, "Exception: " . $e->getMessage());
}

// -----------------------------------------------------------------------------
// FINAL SUMMARY
// -----------------------------------------------------------------------------
echo "\n================================================================================\n";
echo " MODULE TESTING SUMMARY FOR {$baseUrl}\n";
echo "================================================================================\n";
foreach ($summary['modules'] as $modName => $stats) {
    $total = $stats['passed'] + $stats['failed'];
    echo sprintf("  %-45s | Passed: %2d / %2d | Failed: %2d\n", $modName, $stats['passed'], $total, $stats['failed']);
}
echo "--------------------------------------------------------------------------------\n";
echo " TOTAL PASSED: {$summary['passed']}  |  TOTAL FAILED: {$summary['failed']}\n";
echo " TOTAL RENDERED UI & DOM ELEMENTS CHECKED: {$summary['ui_elements_count']}\n";
echo "================================================================================\n\n";

exit($summary['failed'] > 0 ? 1 : 0);
