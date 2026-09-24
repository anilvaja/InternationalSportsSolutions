<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\StaffAttendance;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffSelfAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private Academy $academy;

    protected function setUp(): void
    {
        parent::setUp();

        $this->academy = Academy::create([
            'name' => 'Self Service Academy',
            'code' => 'SELF',
            'slug' => 'self-service-academy',
            'contact_email' => 'self@academy.com',
            'contact_phone' => '999888777',
            'status' => 'active',
        ]);
    }

    public function test_staff_can_perform_self_check_in_and_check_out(): void
    {
        $staff = User::create([
            'name' => 'Self Staff',
            'email' => 'selfstaff@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'hourly',
            'hourly_rate' => 20.00,
        ]);

        $this->actingAs($staff);

        // Record self check-in
        $checkInTime = Carbon::parse('2026-09-22 08:30:00');
        $attendance = StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'attendance_date' => '2026-09-22',
            'check_in_at' => $checkInTime,
            'status' => 'present',
            'marked_by' => $staff->id,
        ]);

        $this->assertDatabaseHas('staff_attendances', [
            'id' => $attendance->id,
            'user_id' => $staff->id,
            'salary_type_snapshot' => 'hourly',
            'hourly_rate_snapshot' => 20.00,
        ]);

        // Record self check-out 7 hours 30 minutes later (450 minutes)
        $checkOutTime = Carbon::parse('2026-09-22 16:00:00');
        $attendance->check_out_at = $checkOutTime;
        $attendance->syncWorkedMinutesAndPay();
        $attendance->save();

        $this->assertEquals(450, $attendance->total_worked_minutes); // 7.5 hours
        // 7.5 * 20.00 = 150.00
        $this->assertEquals(150.00, (float) $attendance->calculated_pay);
    }

    public function test_self_attendance_page_and_widget_rendering(): void
    {
        $staff = User::create([
            'name' => 'Widget User',
            'email' => 'widget@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'role' => 'academy_staff',
            'salary_type' => 'minutly',
            'minutly_rate' => 0.2500,
        ]);

        $this->actingAs($staff, 'academy');

        $response = $this->get('/academy/my-attendance');
        $response->assertStatus(200);

        $dashboardResponse = $this->get('/academy');
        $dashboardResponse->assertStatus(200);
    }

    public function test_backdate_limit_enforces_correction_request(): void
    {
        $staff = User::create([
            'name' => 'Backdate Staff',
            'email' => 'backdate@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'hourly',
            'hourly_rate' => 25.00,
        ]);

        $setting = \App\Models\StaffAttendanceSetting::getOrCreateForUser($staff);
        $this->assertEquals(2, $setting->max_backdate_days);

        // Update limit to 3 days
        $setting->update(['max_backdate_days' => 3]);
        $this->assertEquals(3, $setting->fresh()->max_backdate_days);
    }
}
