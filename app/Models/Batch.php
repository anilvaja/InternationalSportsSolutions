<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Auditable;

class Batch extends Model
{
    use HasFactory, SoftDeletes, Auditable;

    protected $fillable = [
        'academy_id',
        'branch_id',
        'coach_id',
        'name',
        'batch_code',
        'description',
        'level',
        'skill_level',
        'age_group',
        'max_students',
        'start_time',
        'end_time',
        'days_of_week',
        'start_date',
        'end_date',
        'fees_amount',
        'monthly_fee',
        'registration_fee',
        'duration_minutes',
        'room_location',
        'is_active',
        'notes',
        'schedule', // Add the missing schedule field
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($batch) {
            // Auto-generate schedule field if not provided
            if (empty($batch->schedule)) {
                $batch->schedule = $batch->generateScheduleText();
            }
            
            // Set default values for required fields that might be missing
            if (empty($batch->skill_level)) {
                $batch->skill_level = $batch->level ?? 'beginner';
            }
            
            if (empty($batch->monthly_fee)) {
                $batch->monthly_fee = $batch->fees_amount ?? 0;
            }
            
            if (empty($batch->registration_fee)) {
                $batch->registration_fee = 0;
            }
            
            if (empty($batch->duration_minutes)) {
                $batch->duration_minutes = 90; // Default 90 minutes
            }
        });
        
        static::updating(function ($batch) {
            // Update schedule when time/days change
            if ($batch->isDirty(['start_time', 'end_time', 'days_of_week'])) {
                $batch->schedule = $batch->generateScheduleText();
            }
        });
    }

    protected $casts = [
        'days_of_week' => 'array',
        'start_time' => 'datetime:H:i',
        'end_time' => 'datetime:H:i',
        'start_date' => 'date',
        'end_date' => 'date',
        'fees_amount' => 'decimal:2',
        'monthly_fee' => 'decimal:2',
        'registration_fee' => 'decimal:2',
        'is_active' => 'boolean',
        'max_students' => 'integer',
        'duration_minutes' => 'integer',
    ];

    // Relationships
    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function coach(): BelongsTo
    {
        return $this->belongsTo(User::class, 'coach_id');
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'batch_students')
            ->withPivot(['joined_at', 'left_at', 'is_active'])
            ->withTimestamps();
    }

    public function activeStudents(): BelongsToMany
    {
        return $this->students()->wherePivot('is_active', true);
    }

    public function syllabusCategories(): BelongsToMany
    {
        return $this->belongsToMany(SyllabusCategory::class, 'batch_syllabus_categories')
            ->withPivot(['sort_order', 'is_primary', 'notes'])
            ->withTimestamps()
            ->orderBy('batch_syllabus_categories.sort_order');
    }

    public function primarySyllabusCategory(): BelongsToMany
    {
        return $this->syllabusCategories()->wherePivot('is_primary', true);
    }

    public function batchAttendances(): HasMany
    {
        return $this->hasMany(BatchAttendance::class);
    }

    // Helper methods
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForAcademy($query, $academyId)
    {
        return $query->where('academy_id', $academyId);
    }

    public function scopeForBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeForCoach($query, $coachId)
    {
        return $query->where('coach_id', $coachId);
    }

    public function getCurrentStudentCount(): int
    {
        return $this->activeStudents()->count();
    }

    public function hasCapacity(): bool
    {
        return $this->getCurrentStudentCount() < $this->max_students;
    }

    public function getAvailableSlots(): int
    {
        return max(0, $this->max_students - $this->getCurrentStudentCount());
    }

    public function getDaysOfWeekText(): string
    {
        if (empty($this->days_of_week)) {
            return 'No days set';
        }

        $daysOfWeek = $this->days_of_week;
        
        // If it's a JSON string, decode it
        if (is_string($daysOfWeek)) {
            $daysOfWeek = json_decode($daysOfWeek, true) ?? [];
        }
        
        if (empty($daysOfWeek)) {
            return 'No days set';
        }

        $days = [
            'monday' => 'Mon',
            'tuesday' => 'Tue',
            'wednesday' => 'Wed',
            'thursday' => 'Thu',
            'friday' => 'Fri',
            'saturday' => 'Sat',
            'sunday' => 'Sun',
        ];

        return collect($daysOfWeek)
            ->map(fn($day) => $days[strtolower($day)] ?? $day)
            ->join(', ');
    }

    public function getTimeSlot(): string
    {
        if (!$this->start_time || !$this->end_time) {
            return 'Time not set';
        }

        return $this->start_time->format('H:i') . ' - ' . $this->end_time->format('H:i');
    }

    public function isOngoing(): bool
    {
        $today = now()->toDateString();
        
        if ($this->start_date && $this->start_date->toDateString() > $today) {
            return false; // Not started yet
        }
        
        if ($this->end_date && $this->end_date->toDateString() < $today) {
            return false; // Already ended
        }
        
        return true; // Ongoing
    }

    public function getStatusText(): string
    {
        if (!$this->is_active) {
            return 'Inactive';
        }

        $today = now()->toDateString();
        
        if ($this->start_date && $this->start_date->toDateString() > $today) {
            return 'Upcoming';
        }
        
        if ($this->end_date && $this->end_date->toDateString() < $today) {
            return 'Completed';
        }
        
        return 'Active';
    }

    public function getCategoriesList(): string
    {
        return $this->syllabusCategories->pluck('name')->join(', ') ?: 'No categories assigned';
    }

    public function getPrimaryCategoryName(): ?string
    {
        $primaryCategory = $this->primarySyllabusCategory()->first();
        return $primaryCategory?->name;
    }

    public function hasPrimaryCategory(): bool
    {
        return $this->primarySyllabusCategory()->exists();
    }

    public function generateScheduleText(): string
    {
        $timeSlot = $this->getTimeSlot();
        $daysText = $this->getDaysOfWeekText();
        
        if ($timeSlot === 'Time not set' && $daysText === 'No days set') {
            return 'Schedule TBD';
        }
        
        if ($timeSlot === 'Time not set') {
            return "Days: {$daysText}";
        }
        
        if ($daysText === 'No days set') {
            return "Time: {$timeSlot}";
        }
        
        return "{$timeSlot} on {$daysText}";
    }
}
