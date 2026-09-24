<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Auditable;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class StaffLeave extends Model
{
    use HasFactory, SoftDeletes, Auditable;

    protected $fillable = [
        'academy_id',
        'user_id',
        'leave_type',
        'organization_holiday_id',
        'start_date',
        'end_date',
        'total_days',
        'reason',
        'status',
        'is_paid',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'total_days' => 'decimal:1',
            'is_paid' => 'boolean',
            'reviewed_at' => 'datetime',
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

    public function organizationHoliday(): BelongsTo
    {
        return $this->belongsTo(OrganizationHoliday::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function approve(User $reviewer): void
    {
        $this->update([
            'status' => 'approved',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        // Create or update StaffAttendance records for the date range
        $period = CarbonPeriod::create($this->start_date, $this->end_date);

        foreach ($period as $date) {
            $dateStr = $date->toDateString();

            StaffAttendance::updateOrCreate(
                [
                    'academy_id' => $this->academy_id,
                    'user_id' => $this->user_id,
                    'attendance_date' => $dateStr,
                ],
                [
                    'check_in_at' => $date->copy()->setTime(9, 0, 0),
                    'check_out_at' => $date->copy()->setTime(17, 0, 0),
                    'status' => 'on_leave',
                    'notes' => "Approved Leave ({$this->leave_type}): " . ($this->reason ?? 'Leave'),
                    'marked_by' => $reviewer->id,
                ]
            );
        }
    }

    public function reject(User $reviewer, ?string $reason = null): void
    {
        $this->update([
            'status' => 'rejected',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'rejection_reason' => $reason,
        ]);
    }
}
