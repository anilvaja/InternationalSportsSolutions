<?php

require_once 'vendor/autoload.php';

/**
 * Script to remove custom canAccess methods from Academy resources
 * so they inherit the permission-based canAccess from BaseAcademyResource
 */

$resourceFiles = [
    'app/Filament/Academy/Resources/AuditResource.php',
    'app/Filament/Academy/Resources/BranchResource.php',
    'app/Filament/Academy/Resources/ClaimRequestResource.php',
    'app/Filament/Academy/Resources/CommunicationResource.php',
    'app/Filament/Academy/Resources/EventResource.php',
    'app/Filament/Academy/Resources/FeeResource.php',
    'app/Filament/Academy/Resources/SyllabusResource.php',
    'app/Filament/Academy/Resources/UserResource.php',
    'app/Filament/Academy/Resources/SportResource.php',
    'app/Filament/Academy/Resources/SyllabusCategoryResource.php',
];

foreach ($resourceFiles as $file) {
    if (file_exists($file)) {
        $content = file_get_contents($file);
        
        // Pattern to match canAccess method with various whitespace patterns
        $patterns = [
            '/\s*public\s+static\s+function\s+canAccess\(\)\s*:\s*bool\s*\{[^}]*\}/s',
            '/\s*public\s+static\s+function\s+canAccess\(\)\s*:\s*bool\s*\{[^{}]*\{[^}]*\}[^}]*\}/s',
        ];
        
        $originalContent = $content;
        
        foreach ($patterns as $pattern) {
            $content = preg_replace($pattern, '', $content);
        }
        
        if ($content !== $originalContent) {
            file_put_contents($file, $content);
            echo "Removed canAccess method from: $file\n";
        } else {
            echo "No canAccess method found in: $file\n";
        }
    } else {
        echo "File not found: $file\n";
    }
}

echo "\nCompleted removing custom canAccess methods!\n";
