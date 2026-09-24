<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\StaffAttendance;
use App\Models\StaffAttendanceCorrection;
use App\Models\StaffAttendanceSetting;
use App\Models\StaffScheduleSlot;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdvancedSportsAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private Academy $academy;
    private \App\Models\Branch $branch;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->academy = Academy::create([
            'name' => 'Sports Master Academy',
            'code' => 'SMA',
            'slug' => 'sports-master-academy',
            'contact_email' => 'admin@sportsmaster.com',
            'contact_phone' => '1234567890',
            'status' => 'active',
        ]);

        $this->branch = \App\Models\Branch::create([
            'academy_id' => $this->academy->id,
            'name' => 'Main Branch',
            'code' => 'MAIN',
            'phone' => '1234567890',
            'address' => '123 Test St',
            'city' => 'Testville',
            'state' => 'Teststate',
            'postal_code' => '12345',
            'country' => 'Testland',
        ]);

        $this->admin = User::create([
            'name' => 'Academy Admin',
            'email' => 'admin@sportsmaster.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'role' => 'academy_admin',
            'is_super_admin' => false,
        ]);
    }

    public function test_multi_slot_split_shift_attendance_logging(): void
    {
        $trainer = User::create([
            'name' => 'Cricket Coach Rahul',
            'email' => 'rahul@sportsmaster.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'hourly',
            'hourly_rate' => 30.00,
            'max_daily_work_hours' => 10.00,
        ]);

        // Slot 1: Morning 10:00 AM - 12:00 PM (120 mins)
        $slot1 = StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $trainer->id,
            'slot_name' => 'Morning Slot',
            'attendance_date' => '2026-09-23',
            'check_in_at' => '2026-09-23 10:00:00',
            'check_out_at' => '2026-09-23 12:00:00',
            'scheduled_minutes' => 120,
            'status' => 'present',
        ]);

        // Slot 2: Evening 04:00 PM - 09:00 PM (300 mins)
        $slot2 = StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $trainer->id,
            'slot_name' => 'Evening Slot',
            'attendance_date' => '2026-09-23',
            'check_in_at' => '2026-09-23 16:00:00',
            'check_out_at' => '2026-09-23 21:00:00',
            'scheduled_minutes' => 300,
            'status' => 'present',
        ]);

        $dailyTotalMins = StaffAttendance::getDailyWorkedMinutesForUser($trainer->id, '2026-09-23');

        $this->assertEquals(420, $dailyTotalMins); // 120 + 300 = 7 hours
        $this->assertEquals(60.00, (float) $slot1->calculated_pay); // 2h * 30 = $60
        $this->assertEquals(150.00, (float) $slot2->calculated_pay); // 5h * 30 = $150
    }

    public function test_overtime_approval_threshold_and_admin_approval(): void
    {
        $staff = User::create([
            'name' => 'Trainer Amit',
            'email' => 'amit@sportsmaster.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'hourly',
            'hourly_rate' => 20.00,
        ]);

        StaffAttendanceSetting::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'expected_daily_minutes' => 300, // 5 hours scheduled
            'approval_threshold_minutes' => 30, // threshold 30 mins
        ]);

        // Actual worked: 6 hours 15 mins (375 mins) -> Extra: 75 mins > 30 mins threshold
        $attendance = StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'attendance_date' => '2026-09-23',
            'check_in_at' => '2026-09-23 10:00:00',
            'check_out_at' => '2026-09-23 16:15:00',
            'scheduled_minutes' => 300,
            'status' => 'present',
        ]);

        // Should be pending approval because extra time 75 mins > 30 mins threshold
        $this->assertEquals('pending_approval', $attendance->overtime_status);
        $this->assertEquals(0, $attendance->approved_extra_minutes);
        $this->assertEquals(300, $attendance->payable_minutes); // Payable restricted to scheduled 5h until approved
        $this->assertEquals(100.00, (float) $attendance->calculated_pay); // 5h * $20 = $100

        // Admin Approves Overtime
        $attendance->approveOvertime($this->admin);

        $this->assertEquals('approved', $attendance->overtime_status);
        $this->assertEquals(75, $attendance->approved_extra_minutes);
        $this->assertEquals(375, $attendance->payable_minutes); // 6h 15m payable
        $this->assertEquals(125.00, (float) $attendance->calculated_pay); // 6.25h * $20 = $125
    }

    public function test_attendance_correction_request_flow(): void
    {
        $staff = User::create([
            'name' => 'Forgot Checkout Coach',
            'email' => 'forgot@sportsmaster.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
        ]);

        $attendance = StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'attendance_date' => '2026-09-23',
            'check_in_at' => '2026-09-23 09:00:00',
            'check_out_at' => null, // Forgot check out
            'status' => 'present',
        ]);

        $correction = StaffAttendanceCorrection::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'staff_attendance_id' => $attendance->id,
            'request_date' => '2026-09-23',
            'requested_check_in' => '2026-09-23 09:00:00',
            'requested_check_out' => '2026-09-23 17:00:00',
            'reason' => 'Forgot to check out on system',
            'status' => 'pending',
        ]);

        $this->assertEquals('pending', $correction->status);

        // Admin approves correction
        $correction->approve($this->admin);

        $this->assertEquals('approved', $correction->status);
        $attendance->refresh();
        $this->assertEquals('2026-09-23 17:00:00', $attendance->check_out_at->format('Y-m-d H:i:s'));
        $this->assertEquals(480, $attendance->actual_minutes);
    }

    public function test_student_technique_progression_rules_in_attendance(): void
    {
        $student = \App\Models\Student::create([
            'student_id' => 'STU-TEST-001',
            'first_name' => 'Shiv',
            'last_name' => 'Vaja',
            'date_of_birth' => '2012-05-15',
            'gender' => 'male',
            'phone' => '9876543210',
            'address' => '123 Test St',
            'city' => 'Testville',
            'state' => 'Teststate',
            'postal_code' => '12345',
            'country' => 'Testland',
            'enrollment_date' => '2026-01-01',
            'parent_name' => 'Parent Vaja',
            'parent_phone' => '9876543210',
            'emergency_contact_name' => 'Parent Vaja',
            'emergency_contact_phone' => '9876543210',
            'emergency_contact_relationship' => 'Parent',
            'academy_id' => $this->academy->id,
            'branch_id' => $this->branch->id,
            'status' => 'active',
        ]);

        $category = \App\Models\SyllabusCategory::create([
            'academy_id' => $this->academy->id,
            'name' => 'General Syllabus',
            'status' => 'active',
        ]);

        // Create 6 techniques ordered 1 to 6
        for ($i = 1; $i <= 6; $i++) {
            \App\Models\SyllabusTechnique::create([
                'academy_id' => $this->academy->id,
                'category_id' => $category->id,
                'name' => "Technique Level {$i}",
                'sort_order' => $i,
                'status' => 'active',
            ]);
        }

        $batch = \App\Models\Batch::create([
            'academy_id' => $this->academy->id,
            'branch_id' => $this->branch->id,
            'name' => 'Test Batch',
            'batch_code' => 'TB-01',
            'start_date' => '2026-01-01',
            'age_group' => 'kids',
            'is_active' => true,
        ]);

        $allTechs = \App\Models\SyllabusTechnique::where('academy_id', $this->academy->id)->orderBy('sort_order')->get();
        $t5 = $allTechs[4]; // 5th technique

        // Student is currently at 5th technique
        \App\Models\StudentTechniqueProgress::create([
            'student_id' => $student->id,
            'syllabus_technique_id' => $t5->id,
            'batch_id' => $batch->id,
            'status' => 'learning',
        ]);

        // Default technique selected must be 5th technique
        $defaultTechId = \App\Models\SyllabusTechnique::getDefaultTechniqueIdForStudent($student->id, $this->academy->id);
        $this->assertEquals($t5->id, $defaultTechId);

        // Selectable techniques must include 1..5 (previous & current) and 6 (+1 next level max)
        $options = \App\Models\SyllabusTechnique::getSelectableTechniquesForStudent($student->id, $this->academy->id);
        $this->assertCount(6, $options);
        $this->assertArrayHasKey($allTechs[0]->id, $options); // Level 1 (Back level)
        $this->assertArrayHasKey($allTechs[4]->id, $options); // Level 5 (Current level)
        $this->assertArrayHasKey($allTechs[5]->id, $options); // Level 6 (Next level +1 max)
    }
}
