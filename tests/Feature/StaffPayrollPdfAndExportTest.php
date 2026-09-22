<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\StaffAttendance;
use App\Models\StaffPayroll;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffPayrollPdfAndExportTest extends TestCase
{
    use RefreshDatabase;

    private Academy $academy;

    protected function setUp(): void
    {
        parent::setUp();

        $this->academy = Academy::create([
            'name' => 'Export Academy',
            'code' => 'EXP',
            'slug' => 'export-academy',
            'contact_email' => 'export@academy.com',
            'contact_phone' => '123123123',
            'status' => 'active',
        ]);
    }

    public function test_pdf_payslip_blade_view_renders_successfully(): void
    {
        $staff = User::create([
            'name' => 'PDF Staff',
            'email' => 'pdfstaff@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'monthly',
            'monthly_salary' => 3000.00,
        ]);

        $payroll = StaffPayroll::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'period_start_date' => '2026-09-01',
            'period_end_date' => '2026-09-30',
            'salary_type' => 'monthly',
            'total_days_worked' => 22,
            'total_worked_minutes' => 10560,
            'base_salary_amount' => 3000.00,
            'net_salary' => 3000.00,
            'status' => 'paid',
        ]);

        $view = $this->view('receipts.staff-payslip', [
            'payroll' => $payroll,
            'user' => $staff,
            'academy' => $this->academy,
        ]);

        $view->assertSee('Official Payslip');
        $view->assertSee('PDF Staff');
        $view->assertSee('3,000.00');
        $view->assertSee('PAID');
    }

    public function test_pdf_payslip_dompdf_stream(): void
    {
        $staff = User::create([
            'name' => 'Stream Staff',
            'email' => 'streamstaff@academy.com',
            'password' => bcrypt('password'),
            'academy_id' => $this->academy->id,
            'salary_type' => 'hourly',
            'hourly_rate' => 40.00,
        ]);

        $payroll = StaffPayroll::create([
            'academy_id' => $this->academy->id,
            'user_id' => $staff->id,
            'period_start_date' => '2026-09-01',
            'period_end_date' => '2026-09-30',
            'salary_type' => 'hourly',
            'total_days_worked' => 10,
            'total_worked_minutes' => 2400,
            'base_salary_amount' => 1600.00,
            'net_salary' => 1600.00,
            'status' => 'approved',
        ]);

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('receipts.staff-payslip', [
            'payroll' => $payroll,
            'user' => $staff,
            'academy' => $this->academy,
        ]);

        $this->assertNotEmpty($pdf->output());
    }
}
