<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Traits\Auditable;

class Event extends Model
{
    use SoftDeletes, Auditable;

    protected $fillable = [
        'title',
        'slug',
        'description',
        'content',
        'type',
        'status',
        'event_date',
        'event_end_date',
        'location',
        'venue',
        'fee',
        'max_participants',
        'eligibility_criteria',
        'manual_participants',
        'requires_rsvp',
        'rsvp_deadline',
        'email_notifications',
        'sms_notifications',
        'dashboard_notifications',
        'image',
        'attachments',
        'academy_id',
        'created_by',
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($event) {
            if (!$event->slug) {
                $event->slug = static::generateUniqueSlug($event->title);
            }
        });
        
        static::updating(function ($event) {
            if ($event->isDirty('title') && !$event->isDirty('slug')) {
                $event->slug = static::generateUniqueSlug($event->title, $event->id);
            }
        });
    }

    protected static function generateUniqueSlug($title, $ignoreId = null)
    {
        $slug = Str::slug($title);
        $originalSlug = $slug;
        $counter = 1;

        while (static::where('slug', $slug)->when($ignoreId, function ($query, $ignoreId) {
            return $query->where('id', '!=', $ignoreId);
        })->exists()) {
            $slug = $originalSlug . '-' . $counter;
            $counter++;
        }

        return $slug;
    }

    protected $casts = [
        'event_date' => 'datetime',
        'event_end_date' => 'datetime',
        'rsvp_deadline' => 'datetime',
        'eligibility_criteria' => 'array',
        'manual_participants' => 'array',
        'attachments' => 'array',
        'requires_rsvp' => 'boolean',
        'email_notifications' => 'boolean',
        'sms_notifications' => 'boolean',
        'dashboard_notifications' => 'boolean',
        'fee' => 'decimal:2',
    ];

    // Relationships
    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(EventParticipant::class);
    }

    public function interestedParticipants(): HasMany
    {
        return $this->hasMany(EventParticipant::class)->where('status', 'interested');
    }

    public function notInterestedParticipants(): HasMany
    {
        return $this->hasMany(EventParticipant::class)->where('status', 'not_interested');
    }

    public function attendedParticipants(): HasMany
    {
        return $this->hasMany(EventParticipant::class)->where('status', 'attended');
    }

    public function fees(): HasMany
    {
        return $this->hasMany(EventFee::class);
    }

    public function paidFees(): HasMany
    {
        return $this->hasMany(EventFee::class)->where('payment_status', 'paid');
    }

    public function pendingFees(): HasMany
    {
        return $this->hasMany(EventFee::class)->where('payment_status', 'pending');
    }

    public function overdueFees(): HasMany
    {
        return $this->hasMany(EventFee::class)->where('payment_status', 'overdue');
    }

    // Accessors
    public function getImageUrlAttribute(): ?string
    {
        return $this->image ? Storage::url($this->image) : null;
    }

    public function getStatusBadgeAttribute(): string
    {
        return match($this->status) {
            'draft' => 'gray',
            'published' => 'success',
            'cancelled' => 'danger',
            default => 'gray'
        };
    }

    public function getTypeBadgeAttribute(): string
    {
        return match($this->type) {
            'training' => 'info',
            'competition' => 'warning',
            'workshop' => 'success',
            'general' => 'primary',
            default => 'gray'
        };
    }

    // Scopes
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('event_date', '>', now());
    }

    public function scopeForAcademy(Builder $query, int $academyId): Builder
    {
        return $query->where('academy_id', $academyId);
    }

    public function scopeRequiringRsvp(Builder $query): Builder
    {
        return $query->where('requires_rsvp', true);
    }

    // Methods
    public function canRsvp(): bool
    {
        if (!$this->requires_rsvp) {
            return false;
        }
        
        if ($this->rsvp_deadline && now()->isAfter($this->rsvp_deadline)) {
            return false;
        }
        
        return $this->status === 'published';
    }

    public function isFull(): bool
    {
        if (!$this->max_participants) {
            return false;
        }
        
        return $this->interestedParticipants()->count() >= $this->max_participants;
    }

    public function getManualParticipantsCount(): int
    {
        if (!$this->manual_participants || !is_array($this->manual_participants)) {
            return 0;
        }
        
        return count($this->manual_participants);
    }

    public function getTotalEligibleCount(): int
    {
        $eligibleCount = $this->getEligibleStudents()->count();
        $manualCount = $this->getManualParticipantsCount();
        
        // Remove duplicates by counting unique student IDs
        $manualStudentIds = $this->manual_participants ?? [];
        $eligibleStudentIds = $this->getEligibleStudents()->pluck('id')->toArray();
        $uniqueStudentIds = array_unique(array_merge($eligibleStudentIds, $manualStudentIds));
        
        return count($uniqueStudentIds);
    }

    public function getEligibleStudents()
    {
        $query = Student::where('academy_id', $this->academy_id);
        
        if ($this->eligibility_criteria) {
            foreach ($this->eligibility_criteria as $criteria => $value) {
                switch ($criteria) {
                    case 'belt_levels':
                        if (!empty($value)) {
                            $query->whereIn('belt_level', $value);
                        }
                        break;
                    case 'age_min':
                        if ($value) {
                            $query->whereRaw('DATEDIFF(CURDATE(), date_of_birth) / 365.25 >= ?', [$value]);
                        }
                        break;
                    case 'age_max':
                        if ($value) {
                            $query->whereRaw('DATEDIFF(CURDATE(), date_of_birth) / 365.25 <= ?', [$value]);
                        }
                        break;
                    case 'gender':
                        if (!empty($value)) {
                            $query->whereIn('gender', $value);
                        }
                        break;
                    case 'status':
                        if (!empty($value)) {
                            $query->whereIn('status', $value);
                        }
                        break;
                    case 'branches':
                        if (!empty($value)) {
                            $query->whereIn('branch_id', $value);
                        }
                        break;
                }
            }
        }
        
        return $query->get();
    }

    public function sendInvitations(): int
    {

        EventParticipant::where('event_id', $this->id)->delete();
        
        $eligibleStudents = $this->getEligibleStudents();
        $invitedCount = 0;
        
        // Get all students to invite (eligible + manual)
        $studentsToInvite = collect($eligibleStudents);
        
        // Add manually selected participants
        if ($this->manual_participants && is_array($this->manual_participants)) {
            $manualStudents = Student::whereIn('id', $this->manual_participants)->get();
            $studentsToInvite = $studentsToInvite->merge($manualStudents)->unique('id');
        }
        
        foreach ($studentsToInvite as $student) {
            // Create participant record if not exists
            $participant = EventParticipant::firstOrCreate([
                'event_id' => $this->id,
                'student_id' => $student->id,
            ], [
                'status' => 'invited',
                'payment_required' => $this->fee > 0,
            ]);
            
            if ($participant->wasRecentlyCreated) {
                $invitedCount++;
                
                // Send notifications
                if ($this->dashboard_notifications) {
                    try {
                        $student->notifications()->create([
                            'type' => 'event_invitation',
                            'data' => [
                                'event_id' => $this->id,
                                'event_title' => $this->title,
                                'event_date' => $this->event_date->format('d M Y, H:i'),
                                'message' => "You've been invited to {$this->title}",
                            ],
                        ]);
                    } catch (\Exception $e) {
                        // Log the error but continue with invitation process
                        Log::warning('Failed to create notification for student ' . $student->id . ': ' . $e->getMessage());
                    }
                }
                
                // TODO: Send email notification
                // TODO: Send SMS notification
            }
        }
        
        return $invitedCount;
    }

    // Fee Management Methods
    public function createFeeForParticipant(Student $student, float $amount = null): EventFee
    {
        $feeAmount = $amount ?? $this->fee ?? 0;
        
        return EventFee::updateOrCreate([
            'event_id' => $this->id,
            'student_id' => $student->id,
        ], [
            'amount' => $feeAmount,
            'final_amount' => $feeAmount,
            'due_date' => $this->event_date?->subDays(7), // Due 7 days before event
        ]);
    }

    public function createFeesForAllParticipants(): int
    {
        $createdCount = 0;
        
        if ($this->fee > 0) {
            foreach ($this->participants as $participant) {
                if ($participant->student) {
                    $this->createFeeForParticipant($participant->student);
                    $createdCount++;
                }
            }
        }
        
        return $createdCount;
    }

    public function getTotalRevenue(): float
    {
        return $this->fees()->where('payment_status', 'paid')->sum('final_amount');
    }

    public function getPendingRevenue(): float
    {
        return $this->fees()->whereIn('payment_status', ['pending', 'partial'])->sum('final_amount');
    }

    public function getOverdueRevenue(): float
    {
        return $this->fees()->where('payment_status', 'overdue')->sum('final_amount');
    }

    public function updateOverdueFees(): int
    {
        $updatedCount = 0;
        
        $overdueFees = $this->fees()
            ->where('payment_status', 'pending')
            ->where('due_date', '<', now())
            ->get();
            
        foreach ($overdueFees as $fee) {
            $fee->update([
                'payment_status' => 'overdue',
                'late_fee' => $fee->calculateLateFee(),
            ]);
            $updatedCount++;
        }
        
        return $updatedCount;
    }
}
