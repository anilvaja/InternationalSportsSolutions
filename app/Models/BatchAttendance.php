<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class BatchAttendance extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'academy_id',
        'batch_id',
        'class_date',
        'class_start_time',
        'class_end_time',
        'status',
        'cancel_reason',
        'notes',
        'attendance_taken',
        'attendance_marked_by',
        'attendance_marked_at',
        'is_makeup_class',
        'original_batch_attendance_id',
    ];

    protected $casts = [
        'class_date' => 'date',
        'class_start_time' => 'datetime:H:i:s',
        'class_end_time' => 'datetime:H:i:s',
        'attendance_taken' => 'boolean',
        'attendance_marked_at' => 'datetime',
        'is_makeup_class' => 'boolean',
    ];

    // Relationships
    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function attendanceMarkedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'attendance_marked_by');
    }

    public function originalBatchAttendance(): BelongsTo
    {
        return $this->belongsTo(BatchAttendance::class, 'original_batch_attendance_id');
    }

    public function studentAttendances(): HasMany
    {
        return $this->hasMany(StudentAttendance::class);
    }

    public function makeupClasses(): HasMany
    {
        return $this->hasMany(BatchAttendance::class, 'original_batch_attendance_id');
    }

    // Scopes
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeCancelled($query)
    {
        return $query->where('status', 'cancelled');
    }

    public function scopeScheduled($query)
    {
        return $query->where('status', 'scheduled');
    }

    public function scopeAttendanceTaken($query)
    {
        return $query->where('attendance_taken', true);
    }

    public function scopeAttendancePending($query)
    {
        return $query->where('attendance_taken', false)
                    ->where('status', '!=', 'cancelled');
    }

    protected static function boot()
    {
        parent::boot();
        
        // Note: Duplicate validation is now handled at the Filament form level
        // to provide better user experience with notifications instead of exceptions
    }

    // Helper methods
    public function markAttendanceTaken($userId = null): void
    {
        $this->update([
            'attendance_taken' => true,
            'attendance_marked_by' => $userId ?? Auth::id(),
            'attendance_marked_at' => now(),
            'status' => 'completed',
        ]);
    }

    public function cancelClass($reason, $notes = null): void
    {
        $this->update([
            'status' => 'cancelled',
            'cancel_reason' => $reason,
            'notes' => $notes,
        ]);
    }

    public function getTotalStudentsAttribute(): int
    {
        return $this->batch->activeStudents()->count();
    }

    public function getPresentStudentsAttribute(): int
    {
        return $this->studentAttendances()
                    ->where('status', 'present')
                    ->count();
    }

    public function getAbsentStudentsAttribute(): int
    {
        return $this->studentAttendances()
                    ->where('status', 'absent')
                    ->count();
    }

    public function getAttendanceRateAttribute(): float
    {
        $total = $this->total_students;
        $present = $this->present_students;
        
        return $total > 0 ? ($present / $total) * 100 : 0;
    }
}
