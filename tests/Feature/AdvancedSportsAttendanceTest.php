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
}
