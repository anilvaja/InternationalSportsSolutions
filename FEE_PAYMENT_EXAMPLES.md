# Fee Payment Examples

## How `months_paid` Works in Installment Payments

### Example 1: Regular Monthly Payment
```php
StudentFee::create([
    'student_id' => 123,
    'installment_paid' => 1000.00,        // ₹1000 for 1 month
    'months_paid' => 1,                   // This payment covers 1 month
    'per_month_fee' => 1000.00,           // ₹1000 per month
    'payment_date' => '2025-01-15',       // Payment made on Jan 15
    'payment_for_month' => '2025-01-01',  // Covers January 2025
    'next_due_date' => '2025-02-01',      // Next payment due Feb 1
]);
```
**Result**: Student paid ₹1000 for January 2025 fees (1 month × ₹1000).

### Example 2: 3-Month Payment
```php
StudentFee::create([
    'student_id' => 123,
    'installment_paid' => 3000.00,        // ₹3000 for 3 months
    'months_paid' => 3,                   // This payment covers 3 months
    'per_month_fee' => 1000.00,           // ₹1000 per month
    'payment_date' => '2025-01-15',       // Payment made on Jan 15
    'payment_for_month' => '2025-02-01',  // Covers Feb, Mar, Apr 2025
    'next_due_date' => '2025-05-01',      // Next payment due May 1
    'discount_amount' => 0.00,            // No discount in this example
    'notes' => '3 months paid: Feb, Mar, Apr 2025'
]);
```
**Result**: Student paid ₹3000 for February, March, and April 2025 fees (3 months × ₹1000).

### Example 3: 6-Month Payment with Discount
```php
StudentFee::create([
    'student_id' => 123,
    'installment_paid' => 5400.00,        // ₹5400 for 6 months (after 10% discount)
    'months_paid' => 6,                   // This payment covers 6 months
    'per_month_fee' => 1000.00,           // ₹1000 per month base rate
    'payment_date' => '2025-01-15',       // Payment made on Jan 15
    'payment_for_month' => '2025-01-01',  // Covers Jan to June 2025
    'next_due_date' => '2025-07-01',      // Next payment due July 1
    'discount_amount' => 600.00,          // ₹600 discount (10% off ₹6000)
    'is_advance_payment' => true,
    'advance_months' => 5,                // 5 months are advance (Feb-June)
    'notes' => '6 months paid with 10% discount: ₹6000 - ₹600 = ₹5400'
]);
```
**Result**: Student paid ₹5400 for January to June 2025 fees (6 months × ₹1000 - 10% discount).

## UI Implementation

### Fee Collection Form
```html
<form>
    <!-- Student Selection -->
    <select name="student_id">
        <option value="123">John Doe - Current Due: Jan 2025</option>
    </select>

    <!-- Months Selection -->
    <label>Pay for how many months?</label>
    <select name="months_paid" onchange="calculateTotal()">
        <option value="1">1 Month - ₹2000</option>
        <option value="3">3 Months - ₹5700 (5% off)</option>
        <option value="6">6 Months - ₹10800 (10% off)</option>
        <option value="12">12 Months - ₹20400 (15% off)</option>
    </select>

    <!-- Payment Amount (auto-calculated) -->
    <input type="number" name="installment_paid" readonly>

    <!-- Starting Month (auto-filled based on student's due date) -->
    <input type="month" name="payment_for_month" value="2025-01">

    <!-- Payment Method -->
    <select name="payment_type">
        <option value="cash">Cash</option>
        <option value="gpay">Google Pay</option>
        <option value="online">Online Transfer</option>
    </select>

    <!-- Notes -->
    <textarea name="notes" placeholder="Additional notes..."></textarea>
</form>
```

### JavaScript Calculation
```javascript
function calculateTotal() {
    const monthsPaid = parseInt(document.querySelector('[name="months_paid"]').value);
    const perMonthFee = 1000; // ₹1000 per month
    const discounts = {
        1: 0,    // No discount for 1 month
        3: 5,    // 5% discount for 3 months
        6: 10,   // 10% discount for 6 months
        12: 15   // 15% discount for 12 months
    };
    
    // Calculate base amount
    const baseAmount = perMonthFee * monthsPaid;
    
    // Apply discount
    const discountPercent = discounts[monthsPaid] || 0;
    const discountAmount = baseAmount * (discountPercent / 100);
    const finalAmount = baseAmount - discountAmount;
    
    // Update form fields
    document.querySelector('[name="installment_paid"]').value = finalAmount;
    document.querySelector('[name="per_month_fee"]').value = perMonthFee;
    document.querySelector('[name="discount_amount"]').value = discountAmount;
    
    // Show calculation breakdown
    document.getElementById('calculation-breakdown').innerHTML = `
        <p>Base Amount: ${monthsPaid} months × ₹${perMonthFee} = ₹${baseAmount}</p>
        <p>Discount (${discountPercent}%): -₹${discountAmount}</p>
        <p><strong>Total Amount: ₹${finalAmount}</strong></p>
    `;
    
    // Update next due date
    const startMonth = document.querySelector('[name="payment_for_month"]').value;
    const nextDueDate = addMonths(startMonth, monthsPaid);
    document.querySelector('[name="next_due_date"]').value = nextDueDate;
}

function addMonths(dateString, months) {
    const date = new Date(dateString + '-01');
    date.setMonth(date.getMonth() + months);
    return date.toISOString().substr(0, 7); // Return YYYY-MM format
}
```

## Database Queries

### Get Student's Payment History
```sql
SELECT 
    payment_date,
    months_paid,
    installment_paid,
    payment_for_month,
    next_due_date,
    CONCAT(payment_for_month, ' to ', 
           DATE_ADD(payment_for_month, INTERVAL months_paid-1 MONTH)) as months_covered
FROM student_fees 
WHERE student_id = 123 
ORDER BY payment_date DESC;
```

### Check What Months Are Covered
```sql
-- For a specific payment record
SELECT 
    payment_for_month as start_month,
    DATE_ADD(payment_for_month, INTERVAL months_paid-1 MONTH) as end_month,
    months_paid as total_months_covered
FROM student_fees 
WHERE id = 456;
```

### Calculate Outstanding Fees
```sql
-- Find the last payment and determine what's due
SELECT 
    s.id,
    s.first_name,
    s.last_name,
    COALESCE(MAX(sf.next_due_date), s.enrollment_date) as last_paid_until,
    CASE 
        WHEN MAX(sf.next_due_date) < CURDATE() THEN 'OVERDUE'
        WHEN MAX(sf.next_due_date) = CURDATE() THEN 'DUE_TODAY'
        ELSE 'CURRENT'
    END as fee_status
FROM students s
LEFT JOIN student_fees sf ON s.id = sf.student_id AND sf.status = 'paid'
GROUP BY s.id;
```

## Summary

- **`months_paid`**: Number of months this single payment covers
- **`installment_paid`**: Total amount paid in this transaction
- **`payment_for_month`**: Starting month of the payment period
- **`next_due_date`**: Calculated as `payment_for_month + months_paid`

This structure allows for flexible payment schedules where students can pay for multiple months at once and receive discounts for advance payments.
