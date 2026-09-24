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
        'slot_name',
        'attendance_date',
        'check_in_at',
        'check_out_at',
        'break_duration_minutes',
        'scheduled_minutes',
        'actual_minutes',
        'extra_minutes',
        'approved_extra_minutes',
        'payable_minutes',
        'total_worked_minutes',
        'status',
        'overtime_status',
        'overtime_reason',
        'approval_authority_user_id',
        'approved_by_user_id',
        'approved_at',
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
            'scheduled_minutes' => 'integer',
            'actual_minutes' => 'integer',
            'extra_minutes' => 'integer',
            'approved_extra_minutes' => 'integer',
            'payable_minutes' => 'integer',
            'total_worked_minutes' => 'integer',
            'hourly_rate_snapshot' => 'decimal:2',
            'minutly_rate_snapshot' => 'decimal:4',
            'monthly_salary_snapshot' => 'decimal:2',
            'calculated_pay' => 'decimal:2',
            'approved_at' => 'datetime',
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

    public function approvalAuthorityUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approval_authority_user_id');
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }

    protected static function boot()
    {
        parent::boot();

        static::saving(function (StaffAttendance $attendance) {
            $attendance->syncWorkedMinutesAndPay();
        });
    }

    public static function getDailyWorkedMinutesForUser(int $userId, string $date, ?int $excludeAttendanceId = null): int
    {
        $query = static::where('user_id', $userId)
            ->whereDate('attendance_date', $date)
            ->whereNotIn('status', ['rejected', 'absent', 'on_leave']);

        if ($excludeAttendanceId) {
            $query->where('id', '!=', $excludeAttendanceId);
        }

        return (int) $query->sum('payable_minutes');
    }

    public function syncWorkedMinutesAndPay(): void
    {
        $this->break_duration_minutes = $this->break_duration_minutes ?? 0;

        $checkInRaw = $this->check_in_at;
        $checkOutRaw = $this->check_out_at;

        if ($checkInRaw && $checkOutRaw) {
            $checkIn = Carbon::parse($checkInRaw);
            $checkOut = Carbon::parse($checkOutRaw);

            $diffMinutes = (int) abs($checkOut->diffInMinutes($checkIn));
            $this->actual_minutes = max(0, $diffMinutes - (int) ($this->break_duration_minutes ?? 0));
        } elseif ($this->status === 'absent' || $this->status === 'on_leave') {
            $this->actual_minutes = 0;
        }

        $user = $this->user ?: ($this->user_id ? User::find($this->user_id) : null);

        if ($user) {
            // Fetch user attendance settings
            $setting = StaffAttendanceSetting::getOrCreateForUser($user);

            $this->salary_type_snapshot = $this->salary_type_snapshot ?: ($user->salary_type ?: 'monthly');
            $this->hourly_rate_snapshot = $this->hourly_rate_snapshot ?? $user->hourly_rate;
            $this->minutly_rate_snapshot = $this->minutly_rate_snapshot ?? $user->minutly_rate;
            $this->monthly_salary_snapshot = $this->monthly_salary_snapshot ?? $user->monthly_salary;

            $this->approval_authority_user_id = $this->approval_authority_user_id ?? $setting->approval_authority_user_id;

            // Resolve scheduled minutes from slot or settings
            if (empty($this->scheduled_minutes) || $this->scheduled_minutes <= 0) {
                $dayOfWeek = strtolower(Carbon::parse($this->attendance_date)->format('l'));
                $slot = StaffScheduleSlot::where('academy_id', $user->academy_id)
                    ->where('user_id', $user->id)
                    ->where('day_of_week', $dayOfWeek)
                    ->when($this->slot_name, fn($q) => $q->where('slot_name', $this->slot_name))
                    ->first();

                if ($slot && $slot->slot_duration_minutes > 0) {
                    $this->scheduled_minutes = $slot->slot_duration_minutes;
                } else {
                    $this->scheduled_minutes = (int) ($setting->expected_daily_minutes ?: 300);
                }
            }

            // Calculate Extra Hours
            $this->extra_minutes = max(0, $this->actual_minutes - $this->scheduled_minutes);
            $threshold = (int) ($setting->approval_threshold_minutes ?: 30);

            if ($this->extra_minutes <= $threshold) {
                $this->overtime_status = 'auto_approved';
                $this->approved_extra_minutes = $this->extra_minutes;
            } else {
                if ($this->overtime_status === 'approved') {
                    $this->approved_extra_minutes = $this->extra_minutes;
                } elseif ($this->overtime_status === 'rejected') {
                    $this->approved_extra_minutes = 0;
                } else {
                    $this->overtime_status = 'pending_approval';
                    $this->approved_extra_minutes = 0;
                }
            }

            $this->payable_minutes = min($this->actual_minutes, $this->scheduled_minutes) + $this->approved_extra_minutes;
            $this->total_worked_minutes = $this->payable_minutes;
        }

        $this->calculated_pay = $this->calculatePay();
    }

    public function calculatePay(): float
    {
        // Check if on_leave is a paid leave
        $isPaidLeave = false;
        if ($this->status === 'on_leave') {
            $leave = StaffLeave::where('academy_id', $this->academy_id)
                ->where('user_id', $this->user_id)
                ->where('status', 'approved')
                ->whereDate('start_date', '<=', $this->attendance_date)
                ->whereDate('end_date', '>=', $this->attendance_date)
                ->first();
            if ($leave && $leave->is_paid) {
                $isPaidLeave = true;
            }
        }

        if (in_array($this->status, ['absent', 'rejected']) || ($this->status === 'on_leave' && !$isPaidLeave)) {
            return 0.00;
        }

        $type = $this->salary_type_snapshot ?: 'hourly';
        $payableMins = $this->payable_minutes > 0 ? $this->payable_minutes : $this->actual_minutes;

        if ($type === 'hourly') {
            $rate = (float) ($this->hourly_rate_snapshot ?? 0);
            $hours = $payableMins / 60.0;
            return round($hours * $rate, 2);
        }

        if ($type === 'minutly') {
            $rate = (float) ($this->minutly_rate_snapshot ?? 0);
            return round($payableMins * $rate, 2);
        }

        if ($type === 'monthly') {
            $monthlySalary = (float) ($this->monthly_salary_snapshot ?? 0);
            $userObj = $this->user ?: ($this->user_id ? User::find($this->user_id) : null);
            $setting = $userObj ? StaffAttendanceSetting::getOrCreateForUser($userObj) : null;
            $workingDays = max(1, $setting?->working_days_per_month ?: 26);

            $dailyPay = $monthlySalary / (float) $workingDays;

            if ($isPaidLeave) {
                return round($dailyPay, 2);
            }

            $standardDailyHours = (float) ($userObj?->standard_daily_hours ?: 5.0);
            $standardDailyMinutes = max(1, $standardDailyHours * 60);

            if ($payableMins >= $standardDailyMinutes) {
                return round($dailyPay, 2);
            }

            if ($payableMins > 0) {
                $proRataRatio = $payableMins / $standardDailyMinutes;
                return round($dailyPay * $proRataRatio, 2);
            }
        }

        return 0.00;
    }

    public function approveOvertime(User $approver): void
    {
        $this->overtime_status = 'approved';
        $this->approved_by_user_id = $approver->id;
        $this->approved_at = now();
        $this->syncWorkedMinutesAndPay();
        $this->save();
    }

    public function rejectOvertime(User $approver): void
    {
        $this->overtime_status = 'rejected';
        $this->approved_by_user_id = $approver->id;
        $this->approved_at = now();
        $this->syncWorkedMinutesAndPay();
        $this->save();
    }
}
