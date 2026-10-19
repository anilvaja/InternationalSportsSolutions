<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\Auditable;

class EventParticipant extends Model implements \OwenIt\Auditing\Contracts\Auditable
{
    use Auditable;
    protected $fillable = [
        'event_id',
        'student_id',
        'status',
        'registration_status',
        'snapshot_version',
        'responded_at',
        'response_notes',
        'approved_by',
        'approved_at',
        'payment_required',
        'payment_status',
        'payment_date',
        'amount_paid',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
        'approved_at' => 'datetime',
        'payment_date' => 'datetime',
        'payment_required' => 'boolean',
        'snapshot_version' => 'integer',
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

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
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

    public function getRegistrationBadgeAttribute(): string
    {
        return match($this->registration_status) {
            'confirmed' => 'success',
            'pending' => 'warning',
            'waitlisted' => 'info',
            'rejected' => 'danger',
            default => 'gray'
        };
    }

    // Methods
    public function markAsInterested(?string $notes = null, string $changedByType = 'student', ?int $changedById = null): void
    {
        $event = $this->event;
        if (!$event->canRsvp()) {
            throw new \InvalidArgumentException('The RSVP deadline for this event has passed.');
        }

        $oldStatus = $this->status;
        $oldRegStatus = $this->registration_status ?? 'not_applicable';

        $newRegStatus = 'not_applicable';
        if ($event->registration_approval_required) {
            $newRegStatus = 'pending';
        } else {
            if ($event->max_participants && $event->interestedParticipants()->count() >= $event->max_participants) {
                $newRegStatus = $event->waitlist_enabled ? 'waitlisted' : 'rejected';
            } else {
                $newRegStatus = 'confirmed';
            }
        }

        $this->update([
            'status' => 'interested',
            'registration_status' => $newRegStatus,
            'responded_at' => now(),
            'response_notes' => $notes,
        ]);

        EventResponseHistory::create([
            'event_id' => $this->event_id,
            'student_id' => $this->student_id,
            'previous_status' => $oldStatus,
            'new_status' => 'interested',
            'previous_registration_status' => $oldRegStatus,
            'new_registration_status' => $newRegStatus,
            'notes' => $notes,
            'changed_by_type' => $changedByType,
            'changed_by_id' => $changedById,
        ]);
    }

    public function markAsNotInterested(?string $notes = null, string $changedByType = 'student', ?int $changedById = null): void
    {
        $event = $this->event;
        if (!$event->canRsvp()) {
            throw new \InvalidArgumentException('The RSVP deadline for this event has passed.');
        }

        $oldStatus = $this->status;
        $oldRegStatus = $this->registration_status ?? 'not_applicable';

        $this->update([
            'status' => 'not_interested',
            'registration_status' => 'not_applicable',
            'responded_at' => now(),
            'response_notes' => $notes,
        ]);

        EventResponseHistory::create([
            'event_id' => $this->event_id,
            'student_id' => $this->student_id,
            'previous_status' => $oldStatus,
            'new_status' => 'not_interested',
            'previous_registration_status' => $oldRegStatus,
            'new_registration_status' => 'not_applicable',
            'notes' => $notes,
            'changed_by_type' => $changedByType,
            'changed_by_id' => $changedById,
        ]);
    }

    public function approveRegistration(int $approvedById): void
    {
        $oldReg = $this->registration_status;
        $this->update([
            'registration_status' => 'confirmed',
            'approved_by' => $approvedById,
            'approved_at' => now(),
        ]);

        EventResponseHistory::create([
            'event_id' => $this->event_id,
            'student_id' => $this->student_id,
            'previous_status' => $this->status,
            'new_status' => $this->status,
            'previous_registration_status' => $oldReg,
            'new_registration_status' => 'confirmed',
            'notes' => 'Registration approved by organizer',
            'changed_by_type' => 'staff',
            'changed_by_id' => $approvedById,
        ]);
    }

    public function rejectRegistration(int $rejectedById, ?string $reason = null): void
    {
        $oldReg = $this->registration_status;
        $this->update([
            'registration_status' => 'rejected',
            'approved_by' => $rejectedById,
            'approved_at' => now(),
        ]);

        EventResponseHistory::create([
            'event_id' => $this->event_id,
            'student_id' => $this->student_id,
            'previous_status' => $this->status,
            'new_status' => $this->status,
            'previous_registration_status' => $oldReg,
            'new_registration_status' => 'rejected',
            'notes' => $reason ?? 'Registration rejected by organizer',
            'changed_by_type' => 'staff',
            'changed_by_id' => $rejectedById,
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
