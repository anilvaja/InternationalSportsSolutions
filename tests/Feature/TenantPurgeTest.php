<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\Coach;
use App\Models\Event;
use App\Models\Fee;
use App\Models\StaffAttendance;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantPurgeTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_purge_tenant_testing_data(): void
    {
        $academy = Academy::create([
            'name' => 'Testing Academy',
            'code' => 'TA1',
            'slug' => 'testing-academy',
            'contact_email' => 'contact@testingacademy.com',
            'status' => 'active',
        ]);

        $adminUser = User::create([
            'name' => 'Academy Admin',
            'email' => 'admin@testingacademy.com',
            'password' => bcrypt('password'),
            'academy_id' => $academy->id,
            'role' => 'academy_admin',
            'is_super_admin' => false,
        ]);

        $coachUser = User::create([
            'name' => 'Coach User',
            'email' => 'coach@testingacademy.com',
            'password' => bcrypt('password'),
            'academy_id' => $academy->id,
            'role' => 'academy_staff',
            'is_super_admin' => false,
        ]);

        $branch = Branch::create([
            'academy_id' => $academy->id,
            'name' => 'Main Branch',
            'code' => 'MB1',
            'address' => '123 Sports Street',
            'city' => 'Mumbai',
            'state' => 'Maharashtra',
            'postal_code' => '400001',
            'country' => 'India',
        ]);

        $batch = Batch::create([
            'academy_id' => $academy->id,
            'branch_id' => $branch->id,
            'name' => 'Morning Batch',
            'batch_code' => 'BAT001',
            'start_date' => '2026-01-01',
            'age_group' => 'under_15',
        ]);

        $student = Student::create([
            'academy_id' => $academy->id,
            'branch_id' => $branch->id,
            'first_name' => 'John',
            'last_name' => 'Doe',
            'student_id' => 'STU001',
            'date_of_birth' => '2010-01-01',
            'gender' => 'male',
            'address' => '123 Test Rd',
            'city' => 'Mumbai',
            'state' => 'Maharashtra',
            'postal_code' => '400001',
            'country' => 'India',
            'parent_name' => 'Parent Doe',
            'parent_phone' => '9876543210',
            'emergency_contact_name' => 'Parent Doe',
            'emergency_contact_phone' => '9876543210',
            'emergency_contact_relationship' => 'Parent',
            'enrollment_date' => '2026-01-01',
            'status' => 'active',
        ]);

        StaffAttendance::create([
            'academy_id' => $academy->id,
            'user_id' => $coachUser->id,
            'attendance_date' => '2026-09-23',
            'check_in_at' => '2026-09-23 09:00:00',
            'check_out_at' => '2026-09-23 17:00:00',
            'status' => 'present',
        ]);

        $this->assertEquals(2, User::where('academy_id', $academy->id)->count());
        $this->assertEquals(1, Student::where('academy_id', $academy->id)->count());
        $this->assertEquals(1, StaffAttendance::where('academy_id', $academy->id)->count());

        // Perform purge with preserveAdminUser = true
        $counts = $academy->purgeTenantData(preserveAdminUser: true);

        // Verify testing data is purged
        $this->assertEquals(0, Student::where('academy_id', $academy->id)->count());
        $this->assertEquals(0, StaffAttendance::where('academy_id', $academy->id)->count());
        $this->assertEquals(0, Branch::where('academy_id', $academy->id)->count());
        $this->assertEquals(0, Batch::where('academy_id', $academy->id)->count());

        // Verify non-admin user is deleted, while admin user is preserved
        $this->assertEquals(1, User::where('academy_id', $academy->id)->count());
        $this->assertEquals($adminUser->id, User::where('academy_id', $academy->id)->first()->id);
    }
}
