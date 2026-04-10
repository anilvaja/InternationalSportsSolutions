<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\Auditable;

class EventParticipant extends Model
{
    use Auditable;
    protected $fillable = [
        'event_id',
        'student_id',
        'status',
        'responded_at',
        'response_notes',
        'payment_required',
        'payment_status',
        'payment_date',
        'amount_paid',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
        'payment_date' => 'datetime',
        'payment_required' => 'boolean',
        'amount_paid' => 'decimal:2',
    ];

    // Relationships
    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function eventFee(): BelongsTo
    {
        return $this->belongsTo(EventFee::class, 'event_id', 'event_id')
                    ->where('student_id', $this->student_id ?? 0);
    }

    // Accessors
    public function getStatusBadgeAttribute(): string
    {
        return match($this->status) {
            'invited' => 'warning',
            'interested' => 'success',
            'not_interested' => 'danger',
            'attended' => 'info',
            'no_show' => 'dark',
            default => 'gray'
        };
    }

    public function getStatusLabelAttribute(): string
    {
        return match($this->status) {
            'invited' => 'Invited',
            'interested' => 'Interested',
            'not_interested' => 'Not Interested',
            'attended' => 'Attended',
            'no_show' => 'No Show',
            default => ucfirst($this->status)
        };
    }

    // Methods
    public function markAsInterested(string $notes = null): void
    {
        $this->update([
            'status' => 'interested',
            'responded_at' => now(),
            'response_notes' => $notes,
        ]);
    }

    public function markAsNotInterested(string $notes = null): void
    {
        $this->update([
            'status' => 'not_interested',
            'responded_at' => now(),
            'response_notes' => $notes,
        ]);
    }

    public function markAsAttended(): void
    {
        $this->update([
            'status' => 'attended',
        ]);
    }

    public function markAsNoShow(): void
    {
        $this->update([
            'status' => 'no_show',
        ]);
    }
}
