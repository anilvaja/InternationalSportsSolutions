<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Fee Receipt - {{ $fee->receipt_number }}</title>
    <style>
        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .academy-logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 5px;
        }
        
        .academy-name {
            font-size: 20px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 10px;
        }
        
        .receipt-title {
            font-size: 18px;
            font-weight: bold;
            color: #dc2626;
            margin: 10px 0;
        }
        
        .receipt-number {
            font-size: 14px;
            color: #6b7280;
        }
        
        .content {
            margin: 20px 0;
        }
        
        .info-section {
            margin-bottom: 25px;
        }
        
        .info-title {
            font-size: 14px;
            font-weight: bold;
            color: #374151;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 5px 0;
        }
        
        .info-label {
            font-weight: bold;
            color: #4b5563;
            width: 40%;
        }
        
        .info-value {
            color: #111827;
            width: 55%;
        }
        
        .amount-section {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }
        
        .amount-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
        }
        
        .total-amount {
            font-size: 16px;
            font-weight: bold;
            color: #059669;
            border-top: 1px solid #d1d5db;
            padding-top: 10px;
        }
        
        .payment-info {
            background-color: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin: 20px 0;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
        }
        
        .signature-section {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
        }
        
        .signature-box {
            text-align: center;
            width: 200px;
        }
        
        .signature-line {
            border-bottom: 1px solid #333;
            margin-bottom: 5px;
            height: 40px;
        }
        
        .status-paid {
            color: #059669;
            font-weight: bold;
        }
        
        .status-pending {
            color: #d97706;
            font-weight: bold;
        }
        
        .status-overdue {
            color: #dc2626;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="academy-logo">🏆</div>
        <div class="academy-name">{{ $academy->name }}</div>
        @if($academy->address)
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">{{ $academy->address }}</div>
        @endif
        @if($academy->phone || $academy->email)
            <div style="font-size: 12px; color: #6b7280;">
                @if($academy->phone) Phone: {{ $academy->phone }} @endif
                @if($academy->phone && $academy->email) | @endif
                @if($academy->email) Email: {{ $academy->email }} @endif
            </div>
        @endif
        <div class="receipt-title">FEE RECEIPT</div>
        <div class="receipt-number">Receipt No: {{ $fee->receipt_number }}</div>
    </div>

    <div class="content">
        <!-- Student Information -->
        <div class="info-section">
            <div class="info-title">Student Information</div>
            <div class="info-row">
                <span class="info-label">Student Name:</span>
                <span class="info-value">{{ $student->getSafeFullName() }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Student ID:</span>
                <span class="info-value">{{ $student->student_id }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Batch:</span>
                <span class="info-value">{{ $batch->name }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Branch:</span>
                <span class="info-value">{{ $branch->name }}</span>
            </div>
        </div>

        <!-- Fee Details -->
        <div class="info-section">
            <div class="info-title">Fee Details</div>
            <div class="info-row">
                <span class="info-label">Fee Period:</span>
                <span class="info-value">{{ \Carbon\Carbon::parse($fee->fees_from_date)->format('M d, Y') }} - {{ \Carbon\Carbon::parse($fee->fees_to_date)->format('M d, Y') }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Months Paid:</span>
                <span class="info-value">{{ $fee->months_paid }} month{{ $fee->months_paid > 1 ? 's' : '' }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Payment Date:</span>
                <span class="info-value">{{ \Carbon\Carbon::parse($fee->payment_date)->format('M d, Y') }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value status-{{ $fee->status }}">{{ ucfirst($fee->status) }}</span>
            </div>
        </div>

        <!-- Amount Details -->
        <div class="amount-section">
            @if($fee->is_discount_applied && $fee->discount_amount > 0)
                @php
                    // Calculate original amount from batch monthly fee and months paid
                    $originalAmount = $fee->batch->monthly_fee * $fee->months_paid;
                @endphp
                <div class="amount-row">
                    <span>Original Fee Amount ({{ $fee->batch->monthly_fee }} × {{ $fee->months_paid }} months):</span>
                    <span>₹{{ number_format($originalAmount, 2) }}</span>
                </div>
                <div class="amount-row">
                    <span>Discount Applied ({{ $fee->discount_reason }}):</span>
                    <span>-₹{{ number_format($fee->discount_amount, 2) }}</span>
                </div>
                <div class="amount-row total-amount">
                    <span>Net Amount Paid:</span>
                    <span>₹{{ number_format($fee->fees_amount, 2) }}</span>
                </div>
            @else
                <div class="amount-row">
                    <span>Fee Amount ({{ $fee->batch->monthly_fee }} × {{ $fee->months_paid }} months):</span>
                    <span>₹{{ number_format($fee->fees_amount, 2) }}</span>
                </div>
                <div class="amount-row total-amount">
                    <span>Total Amount Paid:</span>
                    <span>₹{{ number_format($fee->fees_amount, 2) }}</span>
                </div>
            @endif
        </div>

        <!-- Payment Information -->
        <div class="payment-info">
            <div class="info-row">
                <span class="info-label">Payment Mode:</span>
                <span class="info-value">{{ ucfirst(str_replace('_', ' ', $fee->payment_mode)) }}</span>
            </div>
            @if($fee->transaction_reference)
                <div class="info-row">
                    <span class="info-label">Transaction Reference:</span>
                    <span class="info-value">{{ $fee->transaction_reference }}</span>
                </div>
            @endif
            @if($fee->payment_note)
                <div class="info-row">
                    <span class="info-label">Payment Note:</span>
                    <span class="info-value">{{ $fee->payment_note }}</span>
                </div>
            @endif
        </div>

        <!-- Summary Information -->
        <div class="info-section">
            <div class="info-title">Fee Summary</div>
            <div class="info-row">
                <span class="info-label">Monthly Fee Rate:</span>
                <span class="info-value">₹{{ number_format($fee->batch->monthly_fee, 2) }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">This Payment Period:</span>
                <span class="info-value">{{ $fee->months_paid }} month{{ $fee->months_paid > 1 ? 's' : '' }} ({{ \Carbon\Carbon::parse($fee->fees_from_date)->format('M d, Y') }} - {{ \Carbon\Carbon::parse($fee->fees_to_date)->format('M d, Y') }})</span>
            </div>
            @if($fee->is_discount_applied && $fee->discount_amount > 0)
                <div class="info-row">
                    <span class="info-label">Discount Given:</span>
                    <span class="info-value">₹{{ number_format($fee->discount_amount, 2) }} ({{ $fee->discount_reason }})</span>
                </div>
            @endif
            <div class="info-row">
                <span class="info-label">Amount Received:</span>
                <span class="info-value">₹{{ number_format($fee->fees_amount, 2) }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Total Fees Paid Till Date:</span>
                <span class="info-value">₹{{ number_format($totalPaidFees, 2) }}</span>
            </div>
            @if($fee->next_installment_date)
                <div class="info-row">
                    <span class="info-label">Next Due Date:</span>
                    <span class="info-value">{{ \Carbon\Carbon::parse($fee->next_installment_date)->format('M d, Y') }}</span>
                </div>
            @endif
        </div>

        @if($fee->fees_note)
            <div class="info-section">
                <div class="info-title">Notes</div>
                <div style="padding: 10px; background-color: #fef3c7; border-radius: 5px;">
                    {{ $fee->fees_note }}
                </div>
            </div>
        @endif

        <!-- Signature Section -->
        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-line"></div>
                <div>Student/Parent Signature</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div>Authorized Signature</div>
                @if($fee->collectedBy)
                    <div style="font-size: 10px; margin-top: 5px;">{{ $fee->collectedBy->name }}</div>
                @endif
            </div>
        </div>
    </div>

    <div class="footer">
        <p>This is a computer-generated receipt.</p>
        <p>Generated by: {{ $generatedBy }} | Generated at: {{ $generatedAt }}</p>
        <p>For any queries, please contact the academy office.</p>
    </div>
</body>
</html>
