# Fee Management System

## Overview
Comprehensive fee management system for multi-tenant sports academies with flexible payment structures, automatic calculations, and detailed tracking.

## Database Structure

### Tables
1. **fee_structures** - Define fee plans for different categories
2. **student_fees** - Track individual payment transactions
3. **students** - Updated with fee-related fields

## Fee Structure Features

### Multi-Level Fee Plans
- Branch-specific or academy-wide fee structures
- Age group and belt level based pricing
- Multi-month discount schemes
- Family and sibling discounts
- Early bird payment incentives

### Example Fee Structure
```php
FeeStructure::create([
    'name' => 'Kids Monthly Plan',
    'monthly_fee' => 2000.00,
    'registration_fee' => 500.00,
    'age_groups' => ['kids', 'teens'],
    'multi_month_discounts' => [
        3 => 5,   // 5% off for 3 months
        6 => 10,  // 10% off for 6 months
        12 => 20  // 20% off for yearly
    ],
    'sibling_discount_percent' => 10,
    'early_bird_discount_percent' => 5,
    'early_bird_days' => 7,
    'late_fee_amount' => 100.00,
    'grace_period_days' => 7
]);
```

## Payment Processing

### UI Flow for Fee Collection

#### 1. Select Student & Payment Details
```php
// Get student with current fee status
$student = Student::with(['feeStructure', 'fees'])
    ->where('id', $studentId)
    ->first();

// Calculate current dues
$currentDue = $student->calculateCurrentDue();
$overdueAmount = $student->getOverdueAmount();
```

#### 2. Payment Calculation
```javascript
// UI JavaScript for real-time calculation
function calculatePayment() {
    const monthsPaid = document.getElementById('months_paid').value;
    const feeStructure = student.fee_structure;
    
    let baseAmount = feeStructure.monthly_fee * monthsPaid;
    let discount = 0;
    
    // Apply multi-month discount
    if (feeStructure.multi_month_discounts[monthsPaid]) {
        discount = baseAmount * (feeStructure.multi_month_discounts[monthsPaid] / 100);
    }
    
    // Apply early bird discount if applicable
    if (isEarlyBird()) {
        discount += baseAmount * (feeStructure.early_bird_discount_percent / 100);
    }
    
    const finalAmount = baseAmount - discount;
    updatePaymentDisplay(baseAmount, discount, finalAmount);
}
```

#### 3. Payment Recording
```php
// Process payment
$payment = StudentFee::create([
    'student_id' => $request->student_id,
    'installment_paid' => $request->amount_paid,
    'months_paid' => $request->months_paid,
    'payment_date' => now(),
    'payment_for_month' => $request->payment_for_month,
    'next_due_date' => Carbon::parse($request->payment_for_month)
                            ->addMonths($request->months_paid),
    'payment_type' => $request->payment_type,
    'payment_reference' => $request->payment_reference,
    'fees_taken_by' => auth()->id(),
    'monthly_fee_rate' => $feeStructure->monthly_fee,
    'discount_amount' => $request->discount_amount,
    'notes' => $request->notes,
    'branch_id' => $student->branch_id,
    'batch_id' => $request->batch_id,
]);

// Update student's fee status
$student->updateFeeStatus();
```

## Key Features

### 1. Automatic Receipt Generation
- Format: `BR001-2025-01-00001`
- Branch-wise numbering
- Monthly sequence reset

### 2. Payment Types Support
- Cash payments
- Online payments (UPI, Cards)
- Bank transfers
- Cheque payments

### 3. Multi-Month Payments
- Pay for multiple months in advance
- Automatic discount calculation
- Proper month allocation

### 4. Fee Status Tracking
```php
// Student fee status methods
$student->getCurrentFeeStatus(); // current, due, overdue
$student->getNextDueDate();
$student->getOutstandingBalance();
$student->getPaymentHistory();
```

### 5. Academy-Level Tracking
- Custom fee codes for each academy
- Academy-specific metadata
- Financial year tracking
- Branch-wise collection reports

## Payment Scenarios

### Scenario 1: Regular Monthly Payment
```php
StudentFee::create([
    'student_id' => 123,
    'installment_paid' => 2000.00,
    'months_paid' => 1,
    'payment_for_month' => '2025-01-01',
    'next_due_date' => '2025-02-01',
    'payment_type' => 'cash',
    'notes' => 'Regular monthly fee'
]);
```

### Scenario 2: 3-Month Advance Payment with Discount
```php
StudentFee::create([
    'student_id' => 123,
    'installment_paid' => 5700.00, // 6000 - 300 discount
    'months_paid' => 3,
    'payment_for_month' => '2025-01-01',
    'next_due_date' => '2025-04-01',
    'discount_amount' => 300.00, // 5% discount for 3 months
    'payment_type' => 'online',
    'is_advance_payment' => true,
    'advance_months' => 2,
    'notes' => '3 months paid - 5% discount applied'
]);
```

### Scenario 3: Late Payment with Penalty
```php
StudentFee::create([
    'student_id' => 123,
    'installment_paid' => 2000.00,
    'late_fee' => 100.00,
    'months_paid' => 1,
    'payment_for_month' => '2025-01-01', // Paying for January in February
    'next_due_date' => '2025-02-01',
    'payment_type' => 'gpay',
    'notes' => 'Late payment - 7 days overdue'
]);
```

## Reports & Analytics

### 1. Fee Collection Reports
```sql
-- Monthly collection by branch
SELECT 
    b.name as branch_name,
    DATE_FORMAT(sf.payment_date, '%Y-%m') as month,
    SUM(sf.installment_paid) as total_collected,
    COUNT(sf.id) as payment_count
FROM student_fees sf
JOIN branches b ON sf.branch_id = b.id
WHERE sf.status = 'paid'
GROUP BY b.id, DATE_FORMAT(sf.payment_date, '%Y-%m');
```

### 2. Outstanding Dues Report
```sql
-- Students with pending fees
SELECT 
    s.first_name, s.last_name,
    s.next_fee_due_date,
    s.outstanding_balance,
    DATEDIFF(NOW(), s.next_fee_due_date) as days_overdue
FROM students s
WHERE s.fee_status IN ('due', 'overdue')
ORDER BY s.next_fee_due_date;
```

### 3. Payment Method Analysis
```sql
-- Payment method breakdown
SELECT 
    payment_type,
    COUNT(*) as transaction_count,
    SUM(installment_paid) as total_amount
FROM student_fees
WHERE payment_date >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
GROUP BY payment_type;
```

## UI Components

### 1. Fee Collection Interface
- Student selector with current status
- Payment calculator with real-time updates
- Multiple payment method options
- Receipt generation and printing

### 2. Fee Structure Management
- Create/edit fee plans
- Preview calculations
- Assign to student categories
- Effective date management

### 3. Reports Dashboard
- Collection summaries
- Outstanding dues
- Payment trends
- Branch-wise analytics

### 4. Student Fee History
- Complete payment timeline
- Receipt downloads
- Outstanding balance tracking
- Next due date alerts

## Integration Points

### 1. Student Management
- Fee status affects student status
- Automatic suspension for overdue fees
- Re-activation upon payment

### 2. Attendance System
- Fee status checks before marking attendance
- Warnings for due payments
- Grace period management

### 3. Parent Communication
- SMS/Email for due payments
- Payment confirmations
- Receipt delivery

### 4. Academy Analytics
- Revenue tracking
- Collection efficiency
- Student retention vs fee status
