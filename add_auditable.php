#!/usr/bin/env php
<?php

// Models to add Auditable trait to
$models = [
    'Attendance.php',
    'BatchAttendance.php', 
    'Coach.php',
    'Fee.php',
    'FeeStructure.php',
    'Notification.php',
    'OverdueFeeNotification.php',
    'Setting.php',
    'StudentAttendance.php',
    'StudentFee.php',
    'StudentTechniqueProgress.php',
    'SyllabusCategory.php',
    'SyllabusTechnique.php',
    'AcademyRole.php',
    'AcademyPermission.php',
    'UserAcademyRole.php'
];

foreach ($models as $model) {
    $filePath = "app/Models/{$model}";
    
    if (file_exists($filePath)) {
        $content = file_get_contents($filePath);
        
        // Add import if not exists
        if (strpos($content, 'use App\Traits\Auditable;') === false) {
            $content = str_replace(
                'use Illuminate\Database\Eloquent\Model;',
                "use Illuminate\Database\Eloquent\Model;\nuse App\Traits\Auditable;",
                $content
            );
        }
        
        // Add trait to class if not exists
        if (strpos($content, 'Auditable') === false) {
            // Find existing use statements in class
            if (preg_match('/use\s+([^;]+);/', $content, $matches)) {
                $existingTraits = $matches[1];
                $newTraits = $existingTraits . ', Auditable';
                $content = str_replace("use {$existingTraits};", "use {$newTraits};", $content);
            } else {
                // No existing traits, add new one
                $content = preg_replace(
                    '/class\s+\w+\s+extends\s+\w+\s*\{/',
                    "$0\n    use Auditable;",
                    $content
                );
            }
        }
        
        file_put_contents($filePath, $content);
        echo "Updated: {$model}\n";
    } else {
        echo "Not found: {$model}\n";
    }
}

echo "Audit trait addition completed!\n";
