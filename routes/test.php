<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use App\Models\Student;
use Illuminate\Support\Facades\Hash;

Route::get('/test-student-login', function () {
    // Test data
    $email = 'alysha08@example.org';
    $password = '123456';
    
    echo "<h1>Student Login Test</h1>";
    
    // Find student
    $student = Student::where('email', $email)->first();
    
    if (!$student) {
        echo "<p style='color: red;'>Student not found!</p>";
        return;
    }
    
    echo "<p style='color: green;'>Student found: ID {$student->id}</p>";
    echo "<p>Email: {$student->email}</p>";
    
    // Test password
    $passwordCheck = Hash::check($password, $student->password);
    echo "<p>Password check: " . ($passwordCheck ? "<span style='color: green;'>PASS</span>" : "<span style='color: red;'>FAIL</span>") . "</p>";
    
    // Test name handling
    echo "<h2>Name Field Testing:</h2>";
    echo "<p>Name field type: " . gettype($student->name) . "</p>";
    echo "<p>Name field value: " . (is_null($student->name) ? 'NULL' : (is_array($student->name) ? json_encode($student->name) : $student->name)) . "</p>";
    echo "<p>First name: " . ($student->first_name ?? 'NULL') . "</p>";
    echo "<p>Last name: " . ($student->last_name ?? 'NULL') . "</p>";
    
    // Test getSafeFullName method
    try {
        $safeName = $student->getSafeFullName();
        echo "<p style='color: green;'>Safe full name: {$safeName}</p>";
    } catch (Exception $e) {
        echo "<p style='color: red;'>Safe full name error: " . $e->getMessage() . "</p>";
    }
    
    // Attempt login
    echo "<h2>Login Attempt:</h2>";
    
    if (Auth::guard('student')->attempt(['email' => $email, 'password' => $password])) {
        echo "<p style='color: green;'>Login successful!</p>";
        
        $authStudent = Auth::guard('student')->user();
        echo "<p>Authenticated student: {$authStudent->email}</p>";
        echo "<p>Authenticated student name: " . $authStudent->getSafeFullName() . "</p>";
        
        // Test accessing profile
        echo "<h3>Profile Access Test:</h3>";
        echo "<a href='/student/profile' target='_blank'>Go to Profile Page</a>";
        
    } else {
        echo "<p style='color: red;'>Login failed!</p>";
    }
});
