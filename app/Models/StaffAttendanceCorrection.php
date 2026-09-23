<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\Auditable;

class StaffAttendanceCorrection extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'academy_id',
        'user_id',
        'staff_attendance_id',
        'request_date',
        'slot_name',
        'original_check_in',
        'original_check_out',
        'requested_check_in',
        'requested_check_out',
        'break_duration_minutes',
        'reason',
        'status',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'request_date' => 'date',
            'original_check_in' => 'datetime',
            'original_check_out' => 'datetime',
            'requested_check_in' => 'datetime',
            'requested_check_out' => 'datetime',
            'break_duration_minutes' => 'integer',
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

    public function staffAttendance(): BelongsTo
    {
        return $this->belongsTo(StaffAttendance::class);
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

        if ($this->staffAttendance) {
            $attendance = $this->staffAttendance;
            $attendance->check_in_at = $this->requested_check_in;
            $attendance->check_out_at = $this->requested_check_out;
            $attendance->break_duration_minutes = $this->break_duration_minutes;
            $attendance->syncWorkedMinutesAndPay();
            $attendance->save();
        } else {
            StaffAttendance::create([
                'academy_id' => $this->academy_id,
                'user_id' => $this->user_id,
                'attendance_date' => $this->request_date,
                'slot_name' => $this->slot_name ?: 'Slot 1',
                'check_in_at' => $this->requested_check_in,
                'check_out_at' => $this->requested_check_out,
                'break_duration_minutes' => $this->break_duration_minutes,
                'status' => 'present',
                'notes' => 'Created via Correction Request: ' . $this->reason,
                'marked_by' => $reviewer->id,
            ]);
        }
    }

    public function reject(User $reviewer): void
    {
        $this->update([
            'status' => 'rejected',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);
    }
}
