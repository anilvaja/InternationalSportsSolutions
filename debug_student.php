<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Student;

$student = Student::where('email', 'alysha08@example.org')->first();

if ($student) {
    echo "Student found!\n";
    
    $fields = [
        'student_id', 'first_name', 'last_name', 'email', 'phone', 
        'date_of_birth', 'gender', 'blood_group', 'address', 'city', 
        'state', 'postal_code', 'country', 'parent_name', 'parent_phone', 
        'parent_email', 'parent_relationship', 'emergency_contact_name', 
        'emergency_contact_phone', 'emergency_contact_relationship',
        'medical_conditions', 'allergies', 'medications', 'dietary_restrictions', 
        'photo', 'documents'
    ];
    
    foreach ($fields as $field) {
        $value = $student->{$field};
        $type = gettype($value);
        echo "$field: $type";
        if (is_array($value)) {
            echo " -> " . json_encode($value);
        } elseif (is_string($value) && strlen($value) > 50) {
            echo " -> " . substr($value, 0, 50) . "...";
        } else {
            echo " -> " . var_export($value, true);
        }
        echo "\n";
    }
} else {
    echo "Student not found!\n";
}
