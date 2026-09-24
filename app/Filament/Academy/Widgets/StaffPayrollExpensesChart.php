<?php

namespace App\Filament\Academy\Widgets;

use App\Models\StaffPayroll;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class StaffPayrollExpensesChart extends ChartWidget
{
    protected static ?string $heading = 'Staff Payroll Expenditure Trend';

    protected static ?int $sort = 3;

    protected function getData(): array
    {
        $user = Auth::user();

        if (!$user || !$user->academy_id) {
            return [
                'datasets' => [],
                'labels' => [],
            ];
        }

        $labels = [];
        $payrollData = [];
        $hoursData = [];

        for ($i = 5; $i >= 0; $i--) {
            $month = now()->subMonths($i);
            $startOfMonth = $month->copy()->startOfMonth()->toDateString();
            $endOfMonth = $month->copy()->endOfMonth()->toDateString();

            $labels[] = $month->format('M Y');

            $payrolls = StaffPayroll::where('academy_id', $user->academy_id)
                ->whereBetween('period_start_date', [$startOfMonth, $endOfMonth])
                ->get();

            $totalPay = (float) $payrolls->sum('net_salary');
            $totalWorkedMinutes = (int) $payrolls->sum('total_worked_minutes');
            $totalHours = round($totalWorkedMinutes / 60.0, 1);

            $payrollData[] = $totalPay;
            $hoursData[] = $totalHours;
        }

        return [
            'datasets' => [
                [
                    'label' => 'Net Salary Payouts (₹)',
                    'data' => $payrollData,
                    'backgroundColor' => '#0284c7',
                    'borderColor' => '#0284c7',
                ],
                [
                    'label' => 'Worked Duration (Hours)',
                    'data' => $hoursData,
                    'backgroundColor' => '#10b981',
                    'borderColor' => '#10b981',
                ],
            ],
            'labels' => $labels,
        ];
    }

    protected function getType(): string
    {
        return 'bar';
    }
}
