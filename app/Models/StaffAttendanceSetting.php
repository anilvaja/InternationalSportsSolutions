<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Auditable;

class StaffAttendanceSetting extends Model
{
    use HasFactory, SoftDeletes, Auditable;

    protected static function boot()
    {
        parent::boot();

        static::saved(function (StaffAttendanceSetting $setting) {
            if ($setting->user_id) {
                $user = User::find($setting->user_id);
                if ($user) {
                    if (!empty($setting->salary_type)) {
                        $user->salary_type = $setting->salary_type;
                    }
                    if ($setting->salary_type === 'hourly' && $setting->salary_amount) {
                        $user->hourly_rate = $setting->salary_amount;
                    } elseif ($setting->salary_type === 'minutly' && $setting->salary_amount) {
                        $user->minutly_rate = $setting->salary_amount;
                    } elseif ($setting->salary_type === 'monthly' && $setting->salary_amount) {
                        $user->monthly_salary = $setting->salary_amount;
                    }
                    if ($setting->expected_daily_hours) {
                        $user->standard_daily_hours = $setting->expected_daily_hours;
                    }
                    if ($setting->overtime_hourly_rate) {
                        $user->overtime_hourly_rate = $setting->overtime_hourly_rate;
                    }
                    $user->saveQuietly();
                }
            }
        });
    }

    protected $fillable = [
        'academy_id',
        'user_id',
        'salary_type',
        'salary_amount',
        'effective_from',
        'working_days_per_month',
        'expected_daily_hours',
        'expected_daily_minutes',
        'overtime_applicable',
        'overtime_rate_multiplier',
        'overtime_hourly_rate',
        'approval_authority_type',
        'approval_authority_user_id',
        'approval_threshold_minutes',
        'max_backdate_days',
        'branch_id',
        'schedule_source',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'salary_amount' => 'decimal:2',
            'expected_daily_hours' => 'decimal:2',
            'expected_daily_minutes' => 'integer',
            'working_days_per_month' => 'integer',
            'overtime_applicable' => 'boolean',
            'overtime_rate_multiplier' => 'decimal:2',
            'overtime_hourly_rate' => 'decimal:2',
            'approval_threshold_minutes' => 'integer',
            'max_backdate_days' => 'integer',
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

    public function approvalAuthorityUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approval_authority_user_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function scheduleSlots(): HasMany
    {
        return $this->hasMany(StaffScheduleSlot::class, 'user_id', 'user_id');
    }

    public static function getOrCreateForUser(User $user): self
    {
        return static::firstOrCreate(
            [
                'academy_id' => $user->academy_id,
                'user_id' => $user->id,
            ],
            [
                'salary_type' => $user->salary_type ?: 'monthly',
                'salary_amount' => $user->monthly_salary ?? $user->hourly_rate ?? 0.00,
                'expected_daily_hours' => $user->standard_daily_hours ?: 5.00,
                'expected_daily_minutes' => (int)(($user->standard_daily_hours ?: 5.00) * 60),
                'overtime_applicable' => true,
                'overtime_hourly_rate' => $user->overtime_hourly_rate,
                'approval_authority_type' => 'academy_admin',
                'approval_threshold_minutes' => 30,
                'max_backdate_days' => 2,
            ]
        );
    }
}
