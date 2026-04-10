<?php

namespace App\Filament\Student\Pages;

use Filament\Pages\Page;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use App\Models\Student;
use App\Models\StudentFee;
use Barryvdh\DomPDF\Facade\Pdf;

class Fees extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-banknotes';
    
    protected static string $view = 'filament.student.pages.fees';
    
    protected static ?string $navigationLabel = 'My Fees';
    
    protected static ?string $navigationGroup = 'My Records';
    
    protected static ?int $navigationSort = 2;

    public $feesData = [];
    public $viewType = 'all'; // all, pending, paid
    public $selectedYear;

    public function mount(): void
    {
        // Start with "All Years" to show all data
        $this->selectedYear = ''; // Empty string for "All Years"
        $this->loadFeesData();
    }

    public function updatedViewType(): void
    {
        $this->loadFeesData();
    }

    public function updatedSelectedYear(): void
    {
        $this->loadFeesData();
    }

    protected function loadFeesData(): void
    {
        /** @var Student $student */
        $student = Auth::user();
        
        // Check if we should use Fee table or StudentFee table
        $totalStudentFees = $student->studentFees()->count();
        $totalFees = $student->fees()->count();
        
        // If no StudentFees but we have Fees, use those instead
        if ($totalStudentFees == 0 && $totalFees > 0) {
            $this->loadFeesFromFeeTable($student);
            return;
        }
        
        // Load student fees from database based on view type and year
        $query = $student->studentFees()
            ->with(['batch', 'branch', 'feesCollectedBy']);
        
        // Only apply year filter if we have a valid year and payment_date exists
        if (!empty($this->selectedYear)) {
            $query->whereYear('payment_date', $this->selectedYear);
        }

        // Apply filters based on view type
        switch ($this->viewType) {
            case 'pending':
                $query->where('status', 'pending');
                break;
            case 'paid':
                $query->where('status', 'paid');
                break;
            case 'overdue':
                $query->overdue();
                break;
            // 'all' case - no additional filtering
        }

        $allFees = $query->orderBy('payment_date', 'desc')->get();
        
        // Get all pending/overdue fees (not filtered by year since these should be current)
        $pendingFees = $student->studentFees()
            ->with(['batch', 'branch'])
            ->where(function($q) {
                $q->where('status', 'pending')
                  ->orWhere(function($sq) {
                      $sq->where('status', 'overdue');
                  });
            })
            ->orderBy('next_due_date', 'asc')
            ->get();

        // Get paid fees for the selected year
        $paidFees = $student->studentFees()
            ->with(['batch', 'branch', 'feesCollectedBy'])
            ->where('status', 'paid');
            
        if (!empty($this->selectedYear)) {
            $paidFees->whereYear('payment_date', $this->selectedYear);
        }
        
        $paidFees = $paidFees->orderBy('payment_date', 'desc')->get();
        
        // Calculate statistics
        $totalOutstanding = $pendingFees->sum('installment_paid');
        $overdueCount = $pendingFees->where('status', 'overdue')->count() + 
                       $pendingFees->filter(function($fee) {
                           return $fee->status === 'pending' && $fee->next_due_date && $fee->next_due_date->isPast();
                       })->count();

        // Find next due date and amount
        $nextDueFee = $pendingFees->sortBy('next_due_date')->first();
        $nextDueDate = $nextDueFee ? $nextDueFee->next_due_date : null;
        $nextDueAmount = $nextDueFee ? $nextDueFee->installment_paid : 0;

        // Prepare fees list for display
        $feesList = [];
        foreach ($pendingFees as $fee) {
            $isOverdue = $fee->status === 'overdue' || 
                        ($fee->status === 'pending' && $fee->next_due_date && $fee->next_due_date->isPast());
            
            $feesList[] = [
                'id' => $fee->id,
                'amount' => $fee->installment_paid,
                'due_date' => $fee->next_due_date ? $fee->next_due_date->format('Y-m-d') : null,
                'status' => $isOverdue ? 'overdue' : 'pending',
                'description' => $this->formatFeeDescription($fee),
                'batch' => $fee->batch ? $fee->batch->name : 'General Fee',
                'months_paid' => $fee->months_paid,
                'payment_for_month' => $fee->payment_for_month ? $fee->payment_for_month->format('M Y') : null,
                'late_fee' => $fee->late_fee ?? 0,
                'additional_charges' => $fee->additional_charges ?? 0,
                'notes' => $fee->notes,
            ];
        }

        // Prepare payment history
        $paymentHistory = [];
        foreach ($paidFees as $payment) {
            $paymentHistory[] = [
                'id' => $payment->id,
                'amount' => $payment->installment_paid,
                'paid_date' => $payment->payment_date->format('Y-m-d'),
                'description' => $this->formatFeeDescription($payment),
                'payment_method' => $payment->payment_type ?? 'Not specified',
                'receipt_number' => $payment->receipt_number,
                'months_covered' => $payment->months_paid,
                'payment_for_month' => $payment->payment_for_month ? $payment->payment_for_month->format('M Y') : null,
                'collected_by' => $payment->feesCollectedBy ? $payment->feesCollectedBy->name : 'System',
                'discount_applied' => $payment->discount_amount > 0,
                'discount_amount' => $payment->discount_amount ?? 0,
                'total_amount' => $payment->getTotalAmount(),
            ];
        }

        $this->feesData = [
            'total_outstanding' => $totalOutstanding,
            'overdue_count' => $overdueCount,
            'next_due_date' => $nextDueDate ? $nextDueDate->format('Y-m-d') : null,
            'next_due_amount' => $nextDueAmount,
            'fees_list' => $feesList,
            'payment_history' => $paymentHistory,
            'total_paid_this_year' => $paidFees->sum('installment_paid'),
            'total_fees_count' => $allFees->count(),
            'pending_count' => $pendingFees->count(),
            'paid_count' => $paidFees->count(),
        ];
    }

    private function formatFeeDescription($fee): string
    {
        $description = '';
        
        if ($fee->payment_for_month) {
            if ($fee->months_paid > 1) {
                $endMonth = $fee->payment_for_month->copy()->addMonths($fee->months_paid - 1);
                $description = "Training Fee - {$fee->payment_for_month->format('M Y')} to {$endMonth->format('M Y')}";
            } else {
                $description = "Training Fee - {$fee->payment_for_month->format('M Y')}";
            }
        } else {
            $description = "Training Fee Payment";
        }

        if ($fee->batch) {
            $description .= " ({$fee->batch->name})";
        }

        return $description;
    }

    protected function loadFeesFromFeeTable($student): void
    {
        // Load from Fee table instead
        $query = $student->fees()->with(['batch', 'branch', 'academy']);
        
        if (!empty($this->selectedYear)) {
            $query->whereYear('payment_date', $this->selectedYear);
        }

        // Apply filters based on view type
        switch ($this->viewType) {
            case 'pending':
                $query->where('status', 'pending');
                break;
            case 'paid':
                $query->where('status', 'paid');
                break;
            case 'overdue':
                $query->where('status', 'overdue');
                break;
        }

        $allFees = $query->orderBy('payment_date', 'desc')->get();
        
        // Separate pending fees from paid fees
        $pendingFees = $student->fees()
            ->where(function($q) {
                $q->where('status', 'pending')->orWhere('status', 'overdue');
            })
            ->orderBy('next_installment_date', 'asc')
            ->get();

        $paidFees = $student->fees()
            ->where('status', 'paid');
            
        if (!empty($this->selectedYear)) {
            $paidFees->whereYear('payment_date', $this->selectedYear);
        }
        
        $paidFees = $paidFees->orderBy('payment_date', 'desc')->get();

        // Calculate statistics
        $totalOutstanding = $pendingFees->sum('fees_amount');
        $overdueCount = $pendingFees->where('status', 'overdue')->count();

        // Find next due date and amount
        $nextDueFee = $pendingFees->sortBy('next_installment_date')->first();
        $nextDueDate = $nextDueFee ? $nextDueFee->next_installment_date : null;
        $nextDueAmount = $nextDueFee ? $nextDueFee->fees_amount : 0;

        // Prepare fees list for display
        $feesList = [];
        foreach ($pendingFees as $fee) {
            $isOverdue = $fee->status === 'overdue' || 
                        ($fee->status === 'pending' && $fee->next_installment_date && $fee->next_installment_date->isPast());
            
            $feesList[] = [
                'id' => $fee->id,
                'amount' => $fee->fees_amount,
                'due_date' => $fee->next_installment_date ? $fee->next_installment_date->format('Y-m-d') : null,
                'status' => $isOverdue ? 'overdue' : 'pending',
                'description' => $this->formatFeeDescriptionFromFee($fee),
                'batch' => $fee->batch ? $fee->batch->name : 'General Fee',
                'months_paid' => $fee->months_paid,
                'payment_for_month' => $fee->fees_from_date ? $fee->fees_from_date->format('M Y') : null,
                'late_fee' => 0,
                'additional_charges' => 0,
                'notes' => $fee->fees_note,
            ];
        }

        // Prepare payment history
        $paymentHistory = [];
        foreach ($paidFees as $payment) {
            $paymentHistory[] = [
                'id' => $payment->id,
                'amount' => $payment->fees_amount,
                'paid_date' => $payment->payment_date->format('Y-m-d'),
                'description' => $this->formatFeeDescriptionFromFee($payment),
                'payment_method' => $payment->payment_mode ?? 'Not specified',
                'receipt_number' => $payment->receipt_number,
                'months_covered' => $payment->months_paid,
                'payment_for_month' => $payment->fees_from_date ? $payment->fees_from_date->format('M Y') : null,
                'collected_by' => $payment->collectedBy ? $payment->collectedBy->name : 'System',
                'discount_applied' => $payment->discount_amount > 0,
                'discount_amount' => $payment->discount_amount ?? 0,
                'total_amount' => $payment->fees_amount - ($payment->discount_amount ?? 0),
            ];
        }

        $this->feesData = [
            'total_outstanding' => $totalOutstanding,
            'overdue_count' => $overdueCount,
            'next_due_date' => $nextDueDate ? $nextDueDate->format('Y-m-d') : null,
            'next_due_amount' => $nextDueAmount,
            'fees_list' => $feesList,
            'payment_history' => $paymentHistory,
            'total_paid_this_year' => $paidFees->sum('fees_amount'),
            'total_fees_count' => $allFees->count(),
            'pending_count' => $pendingFees->count(),
            'paid_count' => $paidFees->count(),
        ];
    }

    private function formatFeeDescriptionFromFee($fee): string
    {
        $description = '';
        
        if ($fee->fees_from_date && $fee->fees_to_date) {
            if ($fee->months_paid > 1) {
                $description = "Training Fee - {$fee->fees_from_date->format('M Y')} to {$fee->fees_to_date->format('M Y')}";
            } else {
                $description = "Training Fee - {$fee->fees_from_date->format('M Y')}";
            }
        } else {
            $description = "Training Fee Payment";
        }

        if ($fee->batch) {
            $description .= " ({$fee->batch->name})";
        }

        return $description;
    }

    public function getViewData(): array
    {
        return [
            'feesData' => $this->feesData,
            'viewType' => $this->viewType,
            'selectedYear' => $this->selectedYear,
        ];
    }

    public function downloadReceipt($paymentId)
    {
        try {
            /** @var Student $student */
            $student = Auth::user();
            
            // Try to find the payment in StudentFee first
            $payment = $student->studentFees()->find($paymentId);
            
            // If not found, try Fee table
            if (!$payment) {
                $payment = $student->fees()->find($paymentId);
            }
            
            if (!$payment) {
                $this->addError('download', 'Payment record not found.');
                return;
            }
            
            // Prepare data for the blade template
            $receiptNumber = $payment->receipt_number ?? 'RCP-' . str_pad($payment->id, 6, '0', STR_PAD_LEFT);
            
            // Get proper student name using the getName() method or full name attribute
            $studentName = $student->getName() ?? $student->getFullNameAttribute() ?? 'N/A';
            if (empty($studentName) || $studentName === 'N/A') {
                // Fallback to manual construction
                $firstName = $student->first_name ?? '';
                $lastName = $student->last_name ?? '';
                $studentName = trim($firstName . ' ' . $lastName) ?: 'Student';
            }
            
            Log::info('PDF Generation Debug', [
                'student_id' => $student->id,
                'student_first_name' => $student->first_name,
                'student_last_name' => $student->last_name,
                'student_name_used' => $studentName,
                'payment_id' => $payment->id
            ]);
            
            $data = [
                'receiptNumber' => $receiptNumber,
                'generatedDate' => now()->format('d M Y'),
                'studentName' => $studentName,
                'studentId' => $student->id,
                'studentEmail' => $student->email ?? 'N/A',
                'paymentDate' => $payment->payment_date ? 
                    $payment->payment_date->format('d M Y') : 'N/A',
                'paymentMethod' => $payment->payment_type ?? $payment->payment_method ?? 'Cash',
                'collectedBy' => $payment->collected_by ?? null,
                'formattedAmount' => number_format(
                    $payment->installment_paid ?? $payment->fees_amount ?? 0, 2
                ),
                'description' => $this->getSafePaymentDescription($payment),
                'period' => $this->getSafePaymentPeriod($payment),
                'timestamp' => now()->format('d M Y H:i:s')
            ];
            
            // Generate PDF using blade template
            $pdf = Pdf::loadView('receipts.payment-receipt', $data);
            $pdf->setPaper('A4', 'portrait');
            
            return response()->streamDownload(function () use ($pdf) {
                echo $pdf->output();
            }, 'receipt_' . $receiptNumber . '.pdf');
            
        } catch (\Exception $e) {
            Log::error('PDF generation error: ' . $e->getMessage());
            $this->addError('download', 'Error generating receipt: ' . $e->getMessage());
            return;
        }
    }
    
    private function getSafePaymentDescription($payment): string
    {
        $description = "Training Fee Payment";
        if ($payment->batch && $payment->batch->name) {
            $description = $payment->batch->name . " - Training Fee";
        }
        return $description;
    }
    
    private function getSafePaymentPeriod($payment): string
    {
        if (isset($payment->payment_for_month) && $payment->payment_for_month) {
            return $payment->payment_for_month->format('F Y');
        } elseif (isset($payment->fees_from_date) && $payment->fees_from_date) {
            if ($payment->fees_to_date && $payment->fees_to_date != $payment->fees_from_date) {
                return $payment->fees_from_date->format('M Y') . ' - ' . $payment->fees_to_date->format('M Y');
            }
            return $payment->fees_from_date->format('F Y');
        }
        return 'N/A';
    }
}
