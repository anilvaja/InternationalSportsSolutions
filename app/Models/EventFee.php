<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Auditable;

class EventFee extends Model
{
    use SoftDeletes, Auditable;

    protected $fillable = [
        'event_id',
        'student_id',
        'amount',
        'discount_amount',
        'final_amount',
        'payment_status',
        'payment_method',
        'payment_date',
        'payment_reference',
        'payment_notes',
        'discount_reason',
        'due_date',
        'late_fee',
        'refund_amount',
        'refund_date',
        'refund_reason',
        'processed_by',
    ];

    protected $casts = [
        'payment_date' => 'datetime',
        'due_date' => 'datetime',
        'refund_date' => 'datetime',
        'amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'final_amount' => 'decimal:2',
        'late_fee' => 'decimal:2',
        'refund_amount' => 'decimal:2',
    ];

    protected static function boot()
    {
        parent::boot();
        
        // Ensure event and student belong to the same academy
        static::creating(function ($eventFee) {
            if ($eventFee->event && $eventFee->student) {
                if ($eventFee->event->academy_id !== $eventFee->student->academy_id) {
                    throw new \Exception('Event and Student must belong to the same academy.');
                }
            }
        });
        
        static::updating(function ($eventFee) {
            if ($eventFee->event && $eventFee->student) {
                if ($eventFee->event->academy_id !== $eventFee->student->academy_id) {
                    throw new \Exception('Event and Student must belong to the same academy.');
                }
            }
        });
    }

    // Relationships
    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    // Accessors
    public function getStatusBadgeAttribute(): string
    {
        return match($this->payment_status) {
            'pending' => 'warning',
            'paid' => 'success',
            'partial' => 'info',
            'overdue' => 'danger',
            'refunded' => 'dark',
            'cancelled' => 'gray',
            default => 'gray'
        };
    }

    public function getStatusLabelAttribute(): string
    {
        return match($this->payment_status) {
            'pending' => 'Pending',
            'paid' => 'Paid',
            'partial' => 'Partial Payment',
            'overdue' => 'Overdue',
            'refunded' => 'Refunded',
            'cancelled' => 'Cancelled',
            default => ucfirst($this->payment_status)
        };
    }

    // Methods
    public function markAsPaid(float $amount, string $method, string $reference = null, string $notes = null): void
    {
        $this->update([
            'payment_status' => $amount >= $this->final_amount ? 'paid' : 'partial',
            'payment_method' => $method,
            'payment_date' => now(),
            'payment_reference' => $reference,
            'payment_notes' => $notes,
        ]);
    }

    public function applyDiscount(float $discountAmount, string $reason = null): void
    {
        $this->update([
            'discount_amount' => $discountAmount,
            'final_amount' => $this->amount - $discountAmount,
            'discount_reason' => $reason,
        ]);
    }

    public function processRefund(float $refundAmount, string $reason = null): void
    {
        $this->update([
            'payment_status' => 'refunded',
            'refund_amount' => $refundAmount,
            'refund_date' => now(),
            'refund_reason' => $reason,
        ]);
    }

    public function isOverdue(): bool
    {
        return $this->due_date && 
               now()->isAfter($this->due_date) && 
               in_array($this->payment_status, ['pending', 'partial']);
    }

    public function calculateLateFee(): float
    {
        if (!$this->isOverdue()) {
            return 0;
        }

        // Calculate late fee (e.g., 2% per week overdue, max 20%)
        $daysOverdue = now()->diffInDays($this->due_date);
        $weeksOverdue = ceil($daysOverdue / 7);
        $lateFeePercent = min($weeksOverdue * 2, 20); // Max 20%
        
        return round($this->final_amount * ($lateFeePercent / 100), 2);
    }
}
