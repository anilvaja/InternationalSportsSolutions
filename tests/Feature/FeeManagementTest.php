<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\Branch;
use App\Models\Student;
use App\Models\StudentFee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeeManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_fee_record_creation_and_status(): void
    {
        $academy = Academy::create([
            'name' => 'Test Academy',
            'code' => 'TEST',
            'slug' => 'test-academy',
            'contact_email' => 'test@academy.com',
            'contact_phone' => '1234567890',
            'status' => 'active',
        ]);

        $branch = Branch::create([
            'academy_id' => $academy->id,
            'name' => 'Main Branch',
            'code' => 'MAIN',
            'phone' => '1234567890',
            'address' => '123 Test St',
            'city' => 'Testville',
            'state' => 'Teststate',
            'postal_code' => '12345',
            'country' => 'Testland',
        ]);

        $user = User::create([
            'name' => 'Staff User',
            'email' => 'staff@test.com',
            'password' => bcrypt('password'),
            'academy_id' => $academy->id,
        ]);

        $student = Student::create([
            'academy_id' => $academy->id,
            'branch_id' => $branch->id,
            'student_id' => 'STU-0001',
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'date_of_birth' => '2010-01-01',
            'gender' => 'female',
            'phone' => '9876543210',
            'address' => '456 Student Rd',
            'city' => 'Testville',
            'state' => 'Teststate',
            'postal_code' => '12345',
            'country' => 'Testland',
            'enrollment_date' => now()->toDateString(),
            'parent_name' => 'Parent Doe',
            'parent_phone' => '9876543210',
            'emergency_contact_name' => 'Parent Doe',
            'emergency_contact_phone' => '9876543210',
            'emergency_contact_relationship' => 'Parent',
        ]);

        $fee = StudentFee::create([
            'student_id' => $student->id,
            'branch_id' => $branch->id,
            'fees_taken_by' => $user->id,
            'receipt_number' => 'REC-1001',
            'installment_paid' => 5000.00,
            'months_paid' => 1,
            'payment_date' => now()->toDateString(),
            'next_due_date' => now()->addMonth()->toDateString(),
            'total_paid' => 5000.00,
            'monthly_fee_rate' => 5000.00,
            'status' => 'paid',
        ]);

        $this->assertDatabaseHas('student_fees', [
            'id' => $fee->id,
            'receipt_number' => 'REC-1001',
            'status' => 'paid',
        ]);
    }
}

