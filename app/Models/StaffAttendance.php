<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Auditable;
use Carbon\Carbon;

class StaffAttendance extends Model
{
    use HasFactory, SoftDeletes, Auditable;

    protected $fillable = [
        'academy_id',
        'user_id',
        'attendance_date',
        'check_in_at',
        'check_out_at',
        'break_duration_minutes',
        'total_worked_minutes',
        'status',
        'salary_type_snapshot',
        'hourly_rate_snapshot',
        'minutly_rate_snapshot',
        'monthly_salary_snapshot',
        'calculated_pay',
        'notes',
        'marked_by',
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date',
            'check_in_at' => 'datetime',
            'check_out_at' => 'datetime',
            'break_duration_minutes' => 'integer',
            'total_worked_minutes' => 'integer',
            'hourly_rate_snapshot' => 'decimal:2',
            'minutly_rate_snapshot' => 'decimal:4',
            'monthly_salary_snapshot' => 'decimal:2',
            'calculated_pay' => 'decimal:2',
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

    public function markedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'marked_by');
    }

    protected static function boot()
    {
        parent::boot();

        static::saving(function (StaffAttendance $attendance) {
            $attendance->syncWorkedMinutesAndPay();
        });
    }

    public function syncWorkedMinutesAndPay(): void
    {
        $checkInRaw = $this->check_in_at;
        $checkOutRaw = $this->check_out_at;

        if ($checkInRaw && $checkOutRaw) {
            $checkIn = Carbon::parse($checkInRaw);
            $checkOut = Carbon::parse($checkOutRaw);

            $diffMinutes = (int) abs($checkOut->diffInMinutes($checkIn));
            $actualWorked = max(0, $diffMinutes - (int) ($this->break_duration_minutes ?? 0));
            $this->total_worked_minutes = $actualWorked;
        } elseif ($this->status === 'absent' || $this->status === 'on_leave') {
            $this->total_worked_minutes = 0;
        }

        $user = $this->user ?: ($this->user_id ? User::find($this->user_id) : null);

        if ($user) {
            $this->salary_type_snapshot = $this->salary_type_snapshot ?: ($user->salary_type ?: 'monthly');
            $this->hourly_rate_snapshot = $this->hourly_rate_snapshot ?? $user->hourly_rate;
            $this->minutly_rate_snapshot = $this->minutly_rate_snapshot ?? $user->minutly_rate;
            $this->monthly_salary_snapshot = $this->monthly_salary_snapshot ?? $user->monthly_salary;
        }

        $this->calculated_pay = $this->calculatePay();
    }

    public function calculatePay(): float
    {
        if ($this->status === 'absent' || $this->status === 'on_leave') {
            return 0.00;
        }

        $type = $this->salary_type_snapshot ?: 'hourly';

        if ($type === 'hourly') {
            $rate = (float) ($this->hourly_rate_snapshot ?? 0);
            $hours = $this->total_worked_minutes / 60.0;
            return round($hours * $rate, 2);
        }

        if ($type === 'minutly') {
            $rate = (float) ($this->minutly_rate_snapshot ?? 0);
            return round($this->total_worked_minutes * $rate, 2);
        }

        if ($type === 'monthly') {
            $monthlySalary = (float) ($this->monthly_salary_snapshot ?? 0);
            $standardDailyHours = (float) ($this->user?->standard_daily_hours ?: 8.0);
            $standardDailyMinutes = max(1, $standardDailyHours * 60);
            $dailyPay = $monthlySalary / 26.0; // Standard 26 work days per month

            if ($this->total_worked_minutes >= $standardDailyMinutes) {
                return round($dailyPay, 2);
            }

            if ($this->total_worked_minutes > 0) {
                $proRataRatio = $this->total_worked_minutes / $standardDailyMinutes;
                return round($dailyPay * $proRataRatio, 2);
            }
        }

        return 0.00;
    }
}
