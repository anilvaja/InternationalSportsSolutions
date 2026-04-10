<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentAttendance extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'academy_id',
        'batch_attendance_id',
        'student_id',
        'status',
        'actual_arrival_time',
        'actual_departure_time',
        'participation_level',
        'progress_notes',
        'notes',
        'parent_notified',
        'parent_notification_sent_at',
    ];

    protected $casts = [
        'actual_arrival_time' => 'datetime:H:i:s',
        'actual_departure_time' => 'datetime:H:i:s',
        'parent_notified' => 'boolean',
        'parent_notification_sent_at' => 'datetime',
    ];

    // Relationships
    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function batchAttendance(): BelongsTo
    {
        return $this->belongsTo(BatchAttendance::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    // Scopes
    public function scopePresent($query)
    {
        return $query->where('status', 'present');
    }

    protected static function boot()
    {
        parent::boot();
        
        // Add validation before saving to prevent duplicate records
        static::saving(function ($model) {
            // Check for unique constraint violation before saving
            $query = static::where('batch_attendance_id', $model->batch_attendance_id)
                ->where('student_id', $model->student_id)
                ->where('academy_id', $model->academy_id);
                
            // Exclude current record when updating
            if ($model->exists) {
                $query->where('id', '!=', $model->id);
            }
            
            if ($query->exists()) {
                $existing = $query->first();
                throw new \Exception("Duplicate student attendance: Student {$model->student_id} already has attendance record for batch attendance {$model->batch_attendance_id} (Record ID: {$existing->id})");
            }
        });
    }

    public function scopeAbsent($query)
    {
        return $query->where('status', 'absent');
    }

    public function scopeLate($query)
    {
        return $query->where('status', 'late');
    }

    public function scopeExcused($query)
    {
        return $query->where('status', 'excused');
    }

    // Helper methods
    public function markPresent($arrivalTime = null): void
    {
        $this->update([
            'status' => 'present',
            'actual_arrival_time' => $arrivalTime ?? $this->batchAttendance->class_start_time,
        ]);
    }

    public function markLate($arrivalTime): void
    {
        $this->update([
            'status' => 'late',
            'actual_arrival_time' => $arrivalTime,
        ]);
    }

    public function markAbsent($notes = null): void
    {
        $this->update([
            'status' => 'absent',
            'notes' => $notes,
            'actual_arrival_time' => null,
            'actual_departure_time' => null,
        ]);
    }

    public function markExcused($notes = null): void
    {
        $this->update([
            'status' => 'excused',
            'notes' => $notes,
            'actual_arrival_time' => null,
            'actual_departure_time' => null,
        ]);
    }

    public function isPresent(): bool
    {
        return in_array($this->status, ['present', 'late']);
    }

    public function isAbsent(): bool
    {
        return $this->status === 'absent';
    }

    public function isLate(): bool
    {
        return $this->status === 'late';
    }

    public function isExcused(): bool
    {
        return $this->status === 'excused';
    }
}
