<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'student_id',
        'batch_id',
        'class_date',
        'class_start_time',
        'class_end_time',
        'status',
        'actual_arrival_time',
        'actual_departure_time',
        'marked_by',
        'notes',
        'is_makeup_class',
        'original_missed_attendance_id',
        'participation_level',
        'techniques_practiced',
        'primary_technique_focused_id',
        'progress_notes',
        'parent_notified',
        'parent_notification_sent_at',
    ];

    protected $casts = [
        'class_date' => 'date',
        'class_start_time' => 'datetime:H:i',
        'class_end_time' => 'datetime:H:i',
        'actual_arrival_time' => 'datetime:H:i',
        'actual_departure_time' => 'datetime:H:i',
        'techniques_practiced' => 'array',
        'parent_notified' => 'boolean',
        'is_makeup_class' => 'boolean',
        'parent_notification_sent_at' => 'datetime',
        'participation_level' => 'integer',
    ];

    // Relationships
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function markedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'marked_by');
    }

    public function originalMissedAttendance(): BelongsTo
    {
        return $this->belongsTo(Attendance::class, 'original_missed_attendance_id');
    }

    public function primaryTechniqueFocused(): BelongsTo
    {
        return $this->belongsTo(SyllabusTechnique::class, 'primary_technique_focused_id');
    }

    // Helper methods
    public function isPresent(): bool
    {
        return in_array($this->status, ['present', 'late']);
    }

    public function isAbsent(): bool
    {
        return in_array($this->status, ['absent', 'excused']);
    }

    public function wasLate(): bool
    {
        return $this->status === 'late';
    }

    public function updateTechniqueProgress(): void
    {
        if ($this->isPresent() && $this->primary_technique_focused_id) {
            // Update or create student technique progress
            $progress = StudentTechniqueProgress::firstOrCreate([
                'student_id' => $this->student_id,
                'syllabus_technique_id' => $this->primary_technique_focused_id,
                'batch_id' => $this->batch_id,
            ]);

            $progress->incrementPractice();

            // Update the last technique learned in batch_student pivot
            $this->student->batches()
                ->wherePivot('batch_id', $this->batch_id)
                ->updateExistingPivot($this->batch_id, [
                    'last_technique_learned_id' => $this->primary_technique_focused_id,
                    'last_attendance_date' => $this->class_date,
                ]);
        }
    }
}
