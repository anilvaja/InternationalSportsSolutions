<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentTechniqueProgress extends Model
{
    use HasFactory, Auditable;

    protected $table = 'student_technique_progress';

    protected $fillable = [
        'student_id',
        'syllabus_technique_id',
        'batch_id',
        'taught_by_coach_id',
        'status',
        'started_date',
        'completed_date',
        'practice_count',
        'coach_notes',
        'assessment_scores',
    ];

    protected $casts = [
        'started_date' => 'date',
        'completed_date' => 'date',
        'assessment_scores' => 'array',
        'practice_count' => 'integer',
    ];

    // Relationships
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function syllabustechnique(): BelongsTo
    {
        return $this->belongsTo(SyllabusTechnique::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function taughtByCoach(): BelongsTo
    {
        return $this->belongsTo(Coach::class, 'taught_by_coach_id');
    }

    // Helper methods
    public function isCompleted(): bool
    {
        return $this->status === 'mastered';
    }

    public function markAsStarted(): void
    {
        $this->update([
            'status' => 'learning',
            'started_date' => now()->toDateString(),
        ]);
    }

    public function markAsCompleted(): void
    {
        $this->update([
            'status' => 'mastered',
            'completed_date' => now()->toDateString(),
        ]);
    }

    public function incrementPractice(): void
    {
        $this->increment('practice_count');
        
        if ($this->status === 'not_started') {
            $this->markAsStarted();
        } elseif ($this->status === 'learning') {
            $this->update(['status' => 'practiced']);
        }
    }
}
