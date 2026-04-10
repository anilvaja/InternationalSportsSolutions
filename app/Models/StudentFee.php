<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;

class StudentFee extends Model
{
    use HasFactory, SoftDeletes, Auditable;

    protected $fillable = [
        'student_id',
        'receipt_number',
        'installment_paid',
        'months_paid',
        'payment_date',
        'payment_for_month',
        'next_due_date',
        'total_paid',
        'payment_type',
        'payment_reference',
        'fees_taken_by',
        'monthly_fee_rate',
        'discount_amount',
        'late_fee',
        'additional_charges',
        'additional_charges_detail',
        'status',
        'is_advance_payment',
        'advance_months',
        'notes',
        'payment_breakdown',
        'receipt_file',
        'academy_fee_code',
        'academy_metadata',
        'batch_id',
        'branch_id',
        'financial_year',
        'is_refund',
        'refund_of_payment_id',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'payment_for_month' => 'date',
        'next_due_date' => 'date',
        'installment_paid' => 'decimal:2',
        'total_paid' => 'decimal:2',
        'monthly_fee_rate' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'late_fee' => 'decimal:2',
        'additional_charges' => 'decimal:2',
        'additional_charges_detail' => 'array',
        'payment_breakdown' => 'array',
        'academy_metadata' => 'array',
        'is_advance_payment' => 'boolean',
        'is_refund' => 'boolean',
    ];

    // Relationships
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function feesCollectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'fees_taken_by');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function refundOfPayment(): BelongsTo
    {
        return $this->belongsTo(StudentFee::class, 'refund_of_payment_id');
    }

    // Helper Methods
    public function isPaid(): bool
    {
        return $this->status === 'paid';
    }

    public function isOverdue(): bool
    {
        return $this->status === 'overdue' || 
               ($this->status === 'pending' && $this->next_due_date->isPast());
    }

    public function getNetAmount(): float
    {
        return $this->installment_paid - $this->discount_amount;
    }

    public function getTotalAmount(): float
    {
        return $this->installment_paid + $this->late_fee + $this->additional_charges;
    }

    public function getMonthsCovered(): array
    {
        $months = [];
        $startDate = $this->payment_for_month;
        
        for ($i = 0; $i < $this->months_paid; $i++) {
            $months[] = $startDate->copy()->addMonths($i);
        }
        
        return $months;
    }

    public function generateReceiptNumber(): string
    {
        $branch = $this->branch;
        $year = $this->payment_date->format('Y');
        $month = $this->payment_date->format('m');
        
        // Format: BRxxx-YYYY-MM-xxxxx
        $prefix = 'BR' . str_pad($branch->id, 3, '0', STR_PAD_LEFT);
        $count = static::whereYear('payment_date', $year)
                      ->whereMonth('payment_date', $month)
                      ->where('branch_id', $branch->id)
                      ->count() + 1;
        
        return $prefix . '-' . $year . '-' . $month . '-' . str_pad($count, 5, '0', STR_PAD_LEFT);
    }

    // Scopes
    public function scopePaid($query)
    {
        return $query->where('status', 'paid');
    }

    public function scopeOverdue($query)
    {
        return $query->where(function($q) {
            $q->where('status', 'overdue')
              ->orWhere(function($sq) {
                  $sq->where('status', 'pending')
                     ->where('next_due_date', '<', now());
              });
        });
    }

    public function scopeForMonth($query, $year, $month)
    {
        return $query->whereYear('payment_for_month', $year)
                    ->whereMonth('payment_for_month', $month);
    }

    public function scopeByBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeByPaymentType($query, $type)
    {
        return $query->where('payment_type', $type);
    }

    // Boot method to auto-generate receipt number
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($fee) {
            if (empty($fee->receipt_number)) {
                $fee->receipt_number = $fee->generateReceiptNumber();
            }
            
            if (empty($fee->financial_year)) {
                $fee->financial_year = $fee->payment_date->format('Y') . '-' . 
                                      $fee->payment_date->addYear()->format('Y');
            }
        });
    }
}
