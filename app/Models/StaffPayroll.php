<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Auditable;

class StaffPayroll extends Model
{
    use HasFactory, SoftDeletes, Auditable;

    protected $fillable = [
        'academy_id',
        'user_id',
        'period_start_date',
        'period_end_date',
        'salary_type',
        'total_days_worked',
        'total_worked_minutes',
        'base_salary_amount',
        'overtime_amount',
        'allowances',
        'deductions',
        'net_salary',
        'status',
        'paid_at',
        'payment_method',
        'notes',
        'generated_by',
    ];

    protected function casts(): array
    {
        return [
            'period_start_date' => 'date',
            'period_end_date' => 'date',
            'total_days_worked' => 'integer',
            'total_worked_minutes' => 'integer',
            'base_salary_amount' => 'decimal:2',
            'overtime_amount' => 'decimal:2',
            'allowances' => 'decimal:2',
            'deductions' => 'decimal:2',
            'net_salary' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function scopeForAcademy($query, $academyId)
    {
        return $query->where('academy_id', $academyId);
    }

    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    protected static function boot()
    {
        parent::boot();

        static::saving(function (StaffPayroll $payroll) {
            $payroll->calculateNetSalary();
        });
    }

    public function calculateNetSalary(): void
    {
        $base = (float) ($this->base_salary_amount ?? 0);
        $overtime = (float) ($this->overtime_amount ?? 0);
        $allowances = (float) ($this->allowances ?? 0);
        $deductions = (float) ($this->deductions ?? 0);

        $this->net_salary = round(($base + $overtime + $allowances) - $deductions, 2);
    }

    public static function generateForUser(User $user, string $startDate, string $endDate, ?int $generatedById = null): self
    {
        $attendances = StaffAttendance::where('academy_id', $user->academy_id)
            ->where('user_id', $user->id)
            ->whereBetween('attendance_date', [$startDate, $endDate])
            ->get();

        $totalDaysWorked = $attendances->where('total_worked_minutes', '>', 0)->count();
        $totalWorkedMinutes = (int) $attendances->sum('total_worked_minutes');
        $baseSalaryAmount = (float) $attendances->sum('calculated_pay');

        $payroll = new self([
            'academy_id' => $user->academy_id,
            'user_id' => $user->id,
            'period_start_date' => $startDate,
            'period_end_date' => $endDate,
            'salary_type' => $user->salary_type ?: 'monthly',
            'total_days_worked' => $totalDaysWorked,
            'total_worked_minutes' => $totalWorkedMinutes,
            'base_salary_amount' => $baseSalaryAmount,
            'overtime_amount' => 0.00,
            'allowances' => 0.00,
            'deductions' => 0.00,
            'net_salary' => $baseSalaryAmount,
            'status' => 'draft',
            'generated_by' => $generatedById,
        ]);

        $payroll->save();

        return $payroll;
    }
}
