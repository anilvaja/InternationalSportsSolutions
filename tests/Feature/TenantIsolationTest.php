<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_only_access_own_academy_data(): void
    {
        $academyA = Academy::create([
            'name' => 'Academy Alpha',
            'code' => 'ALPHA',
            'slug' => 'academy-alpha',
            'contact_email' => 'alpha@academy.com',
            'contact_phone' => '1234567890',
            'status' => 'active',
        ]);

        $academyB = Academy::create([
            'name' => 'Academy Beta',
            'code' => 'BETA',
            'slug' => 'academy-beta',
            'contact_email' => 'beta@academy.com',
            'contact_phone' => '0987654321',
            'status' => 'active',
        ]);

        $userA = User::create([
            'name' => 'John Alpha',
            'email' => 'john@alpha.com',
            'password' => bcrypt('password'),
            'academy_id' => $academyA->id,
            'is_super_admin' => false,
        ]);

        $this->assertTrue($userA->canAccessAcademy($academyA));
        $this->assertFalse($userA->canAccessAcademy($academyB));
    }

    public function test_super_admin_can_access_any_academy(): void
    {
        $academy = Academy::create([
            'name' => 'Global Academy',
            'code' => 'GLOBAL',
            'slug' => 'global-academy',
            'contact_email' => 'global@academy.com',
            'contact_phone' => '1122334455',
            'status' => 'active',
        ]);

        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@global.com',
            'password' => bcrypt('password'),
            'is_super_admin' => true,
        ]);

        $this->assertTrue($superAdmin->canAccessAcademy($academy));
    }

    public function test_staff_attendance_and_payroll_scoped_by_academy(): void
    {
        $academyA = Academy::create([
            'name' => 'Academy 1',
            'code' => 'AC1',
            'slug' => 'academy-1',
            'contact_email' => 'ac1@academy.com',
            'contact_phone' => '111',
            'status' => 'active',
        ]);

        $academyB = Academy::create([
            'name' => 'Academy 2',
            'code' => 'AC2',
            'slug' => 'academy-2',
            'contact_email' => 'ac2@academy.com',
            'contact_phone' => '222',
            'status' => 'active',
        ]);

        $userA = User::create([
            'name' => 'Staff A',
            'email' => 'staffa@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $academyA->id,
        ]);

        $userB = User::create([
            'name' => 'Staff B',
            'email' => 'staffb@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $academyB->id,
        ]);

        $attendanceA = \App\Models\StaffAttendance::create([
            'academy_id' => $academyA->id,
            'user_id' => $userA->id,
            'attendance_date' => now()->toDateString(),
            'check_in_at' => now(),
            'check_out_at' => now()->addHours(8),
            'status' => 'present',
        ]);

        $attendanceB = \App\Models\StaffAttendance::create([
            'academy_id' => $academyB->id,
            'user_id' => $userB->id,
            'attendance_date' => now()->toDateString(),
            'check_in_at' => now(),
            'check_out_at' => now()->addHours(8),
            'status' => 'present',
        ]);

        $this->assertCount(1, \App\Models\StaffAttendance::forAcademy($academyA->id)->get());
        $this->assertEquals($attendanceA->id, \App\Models\StaffAttendance::forAcademy($academyA->id)->first()->id);

        $payrollA = \App\Models\StaffPayroll::create([
            'academy_id' => $academyA->id,
            'user_id' => $userA->id,
            'period_start_date' => now()->startOfMonth(),
            'period_end_date' => now()->endOfMonth(),
            'salary_type' => 'monthly',
            'net_salary' => 1000.00,
        ]);

        $this->assertCount(1, \App\Models\StaffPayroll::forAcademy($academyA->id)->get());
        $this->assertEquals($payrollA->id, \App\Models\StaffPayroll::forAcademy($academyA->id)->first()->id);
    }
}

