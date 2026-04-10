<?php

/**
 * Script to check for syntax errors in Academy Resource files
 */

$resourceFiles = glob('app/Filament/Academy/Resources/*.php');

echo "Checking Academy Resource files for syntax errors...\n\n";

foreach ($resourceFiles as $file) {
    $command = "php -l \"$file\"";
    $output = [];
    $returnCode = 0;
    
    exec($command, $output, $returnCode);
    
    if ($returnCode === 0) {
        echo "✅ $file\n";
    } else {
        echo "❌ $file\n";
        foreach ($output as $line) {
            echo "   $line\n";
        }
        echo "\n";
    }
}

echo "\nSyntax check completed!\n";

?>
