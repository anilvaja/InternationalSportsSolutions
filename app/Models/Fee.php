<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class Fee extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'academy_id',
        'branch_id',
        'student_id',
        'batch_id',
        'receipt_number',
        'fees_amount',
        'months_paid',
        'payment_date',
        'fees_from_date',
        'fees_to_date',
        'next_installment_date',
        'payment_mode',
        'transaction_reference',
        'payment_note',
        'fees_note',
        'status',
        'is_discount_applied',
        'discount_amount',
        'discount_reason',
        'collected_by',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'fees_from_date' => 'date',
        'fees_to_date' => 'date',
        'next_installment_date' => 'date',
        'fees_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'is_discount_applied' => 'boolean',
        'months_paid' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($fee) {
            // Auto-generate receipt number if not provided
            if (empty($fee->receipt_number)) {
                $fee->receipt_number = static::generateReceiptNumber($fee->academy_id, $fee->branch_id);
            }
            
            // Auto-calculate next installment date
            if (empty($fee->next_installment_date)) {
                $fee->next_installment_date = $fee->calculateNextInstallmentDate();
            }
        });
    }

    // Relationships
    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function collectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collected_by');
    }

    // Helper Methods
    public static function generateReceiptNumber($academyId, $branchId): string
    {
        $prefix = 'FEE';
        $date = now()->format('Ymd');
        $count = static::whereDate('created_at', today())
                      ->where('academy_id', $academyId)
                      ->where('branch_id', $branchId)
                      ->count() + 1;
        
        return sprintf('%s-%s-%s-%04d', $prefix, $academyId, $date, $count);
    }

    public function calculateNextInstallmentDate(): Carbon
    {
        return $this->fees_to_date ? 
            Carbon::parse($this->fees_to_date)->addDay() : 
            Carbon::parse($this->payment_date)->addMonth($this->months_paid);
    }

    public function getTotalAmountAttribute(): float
    {
        return $this->fees_amount - $this->discount_amount;
    }

    public function getFormattedAmountAttribute(): string
    {
        return '₹' . number_format($this->total_amount, 2);
    }

    public function isOverdue(): bool
    {
        return $this->status === 'overdue' || 
               ($this->next_installment_date && $this->next_installment_date->isPast());
    }

    public function scopeForAcademy($query, $academyId)
    {
        return $query->where('academy_id', $academyId);
    }

    public function scopeForBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopePaid($query)
    {
        return $query->where('status', 'paid');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeOverdue($query)
    {
        return $query->where('status', 'overdue')
                    ->orWhere(function ($q) {
                        $q->whereNotNull('next_installment_date')
                          ->where('next_installment_date', '<', now());
                    });
    }

    public function scopeThisMonth($query)
    {
        return $query->whereMonth('payment_date', now()->month)
                    ->whereYear('payment_date', now()->year);
    }

    public function scopeToday($query)
    {
        return $query->whereDate('payment_date', today());
    }

    /**
     * Get overdue students with their pending amounts
     */
    public static function getOverdueStudents($academyId = null)
    {
        $query = static::where('status', 'overdue')
            ->with(['student', 'batch']);
            
        if ($academyId) {
            $query->where('academy_id', $academyId);
        }
        
        return $query->orderBy('fees_from_date', 'asc')->get();
    }

    /**
     * Get overdue statistics for dashboard
     */
    public static function getOverdueStats($academyId = null)
    {
        $query = static::where('status', 'overdue');
            
        if ($academyId) {
            $query->where('academy_id', $academyId);
        }
        
        $overdueRecords = $query->get();
        
        return [
            'total_overdue_students' => $overdueRecords->unique('student_id')->count(),
            'total_overdue_amount' => $overdueRecords->sum('fees_amount'),
            'high_priority_count' => $overdueRecords->filter(function($fee) {
                return $fee->fees_from_date->diffInDays(now()) > 60;
            })->unique('student_id')->count(),
            'medium_priority_count' => $overdueRecords->filter(function($fee) {
                $days = $fee->fees_from_date->diffInDays(now());
                return $days > 30 && $days <= 60;
            })->unique('student_id')->count(),
        ];
    }

    /**
     * Mark overdue fee as paid and update with payment details
     */
    public function markAsPaid($paymentDate, $paymentMode, $collectedBy, $discountAmount = 0)
    {
        $this->update([
            'status' => 'paid',
            'payment_date' => $paymentDate,
            'payment_mode' => $paymentMode,
            'collected_by' => $collectedBy,
            'discount_amount' => $discountAmount,
            'is_discount_applied' => $discountAmount > 0,
        ]);
        
        return $this;
    }
}
