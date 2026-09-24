<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\OrganizationHoliday;
use App\Models\StaffAttendance;
use App\Models\StaffAttendanceSetting;
use App\Models\StaffLeave;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffLeaveAndPayrollSettingsTest extends TestCase
{
    use RefreshDatabase;

    private Academy $academy;

    protected function setUp(): void
    {
        parent::setUp();

        $this->academy = Academy::create([
            'name' => 'Leave & Payroll Academy',
            'code' => 'LPA',
            'slug' => 'leave-payroll-academy',
            'contact_email' => 'payroll@academy.com',
            'contact_phone' => '999111222',
            'status' => 'active',
        ]);
    }

    public function test_salary_calculation_divides_by_configured_working_days(): void
    {
        $staff = User::create([
            'name' => 'Monthly Staff',
            'email' => 'monthly@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'monthly',
            'monthly_salary' => 50000.00,
            'standard_daily_hours' => 5.00,
        ]);

        $setting = StaffAttendanceSetting::getOrCreateForUser($staff);
        $setting->update([
            'working_days_per_month' => 26,
            'salary_visibility_day' => 5,
        ]);

        $attendance = StaffAttendance::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'attendance_date' => '2026-09-20',
            'check_in_at' => '2026-09-20 09:00:00',
            'check_out_at' => '2026-09-20 14:00:00', // 5 hours (300 mins)
            'status' => 'present',
            'marked_by' => $staff->id,
        ]);

        // 50000 / 26 = 1923.08
        $this->assertEquals(1923.08, (float) $attendance->calculated_pay);
    }

    public function test_staff_leave_application_and_approval_flow(): void
    {
        $staff = User::create([
            'name' => 'Leave Applicant',
            'email' => 'applicant@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'monthly',
            'monthly_salary' => 50000.00,
        ]);

        $admin = User::create([
            'name' => 'Academy Admin',
            'email' => 'admin@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'role' => 'academy_admin',
        ]);

        $holiday = OrganizationHoliday::create([
            'academy_id' => $this->academy->id,
            'title' => 'Diwali',
            'holiday_date' => '2026-11-01',
            'type' => 'flexible_religious',
            'year' => 2026,
        ]);

        $leave = StaffLeave::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'leave_type' => 'flexible_religious',
            'organization_holiday_id' => $holiday->id,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-01',
            'total_days' => 1.0,
            'reason' => 'Diwali festival',
            'status' => 'pending',
            'is_paid' => true,
        ]);

        $this->assertEquals('pending', $leave->status);

        // Admin approves leave
        $leave->approve($admin);

        $this->assertEquals('approved', $leave->fresh()->status);
        $this->assertDatabaseHas('staff_attendances', [
            'user_id' => $staff->id,
            'attendance_date' => '2026-11-01 00:00:00',
            'status' => 'on_leave',
        ]);
    }
}
