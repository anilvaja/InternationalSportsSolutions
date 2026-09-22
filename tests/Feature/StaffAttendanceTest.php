<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\StaffAttendance;
use App\Models\StaffPayroll;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private Academy $academy;

    protected function setUp(): void
    {
        parent::setUp();

        $this->academy = Academy::create([
            'name' => 'Sports Academy',
            'code' => 'SPORTS',
            'slug' => 'sports-academy',
            'contact_email' => 'contact@sports.com',
            'contact_phone' => '123456789',
            'status' => 'active',
        ]);
    }

    public function test_hourly_salary_calculation(): void
    {
        $staff = User::create([
            'name' => 'Hourly Staff',
            'email' => 'hourly@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'hourly',
            'hourly_rate' => 25.00,
        ]);

        $checkIn = Carbon::parse('2026-09-22 09:00:00');
        $checkOut = Carbon::parse('2026-09-22 17:00:00'); // 8 hours = 480 minutes

        $attendance = StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'attendance_date' => '2026-09-22',
            'check_in_at' => $checkIn,
            'check_out_at' => $checkOut,
            'break_duration_minutes' => 30, // Worked: 450 minutes (7.5 hours)
            'status' => 'present',
        ]);

        $this->assertEquals(450, $attendance->total_worked_minutes);
        // 7.5 * 25.00 = 187.50
        $this->assertEquals(187.50, (float) $attendance->calculated_pay);
    }

    public function test_minutly_salary_calculation(): void
    {
        $staff = User::create([
            'name' => 'Minutly Staff',
            'email' => 'minutly@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'minutly',
            'minutly_rate' => 0.5000,
        ]);

        $checkIn = Carbon::parse('2026-09-22 10:00:00');
        $checkOut = Carbon::parse('2026-09-22 12:00:00'); // 120 minutes

        $attendance = StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'attendance_date' => '2026-09-22',
            'check_in_at' => $checkIn,
            'check_out_at' => $checkOut,
            'break_duration_minutes' => 0,
            'status' => 'present',
        ]);

        $this->assertEquals(120, $attendance->total_worked_minutes);
        // 120 * 0.5000 = 60.00
        $this->assertEquals(60.00, (float) $attendance->calculated_pay);
    }

    public function test_monthly_salary_calculation(): void
    {
        $staff = User::create([
            'name' => 'Monthly Staff',
            'email' => 'monthly@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'monthly',
            'monthly_salary' => 2600.00,
            'standard_daily_hours' => 8.00,
        ]);

        // Daily rate = 2600 / 26 = 100.00 per standard 8h day
        $checkIn = Carbon::parse('2026-09-22 09:00:00');
        $checkOut = Carbon::parse('2026-09-22 17:00:00'); // 8 hours = 480 mins

        $attendance = StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'attendance_date' => '2026-09-22',
            'check_in_at' => $checkIn,
            'check_out_at' => $checkOut,
            'break_duration_minutes' => 0,
            'status' => 'present',
        ]);

        $this->assertEquals(480, $attendance->total_worked_minutes);
        $this->assertEquals(100.00, (float) $attendance->calculated_pay);
    }

    public function test_payroll_generation_from_attendances(): void
    {
        $staff = User::create([
            'name' => 'Coach Alex',
            'email' => 'alex@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'hourly',
            'hourly_rate' => 30.00,
        ]);

        // Day 1: 4 hours = $120
        StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'attendance_date' => '2026-09-01',
            'check_in_at' => '2026-09-01 09:00:00',
            'check_out_at' => '2026-09-01 13:00:00',
            'status' => 'present',
        ]);

        // Day 2: 5 hours = $150
        StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'attendance_date' => '2026-09-02',
            'check_in_at' => '2026-09-02 09:00:00',
            'check_out_at' => '2026-09-02 14:00:00',
            'status' => 'present',
        ]);

        $payroll = StaffPayroll::generateForUser($staff, '2026-09-01', '2026-09-30');

        $this->assertEquals(2, $payroll->total_days_worked);
        $this->assertEquals(540, $payroll->total_worked_minutes); // 240 + 300
        $this->assertEquals(270.00, (float) $payroll->base_salary_amount);
        $this->assertEquals(270.00, (float) $payroll->net_salary);
    }
}
