<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Receipt</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.4;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
        }
        .header h2 {
            margin: 5px 0;
            font-size: 16px;
        }
        .section {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #ddd;
            background: #f9f9f9;
        }
        .section h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            font-weight: bold;
        }
        .amount-section {
            background: #e8f5e8;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
            border: 2px solid #4CAF50;
        }
        .amount-section h3 {
            margin: 0;
            font-size: 22px;
            color: #2E7D32;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #f0f0f0;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }
        .status-badge {
            background: #4CAF50;
            color: white;
            padding: 5px 15px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>International Sports Solutions</h1>
        <h2>Payment Receipt</h2>
        <p>Receipt #: {{ $receiptNumber }}</p>
    </div>
    
    <div class="section">
        <h3>Receipt Information</h3>
        <p><strong>Generated:</strong> {{ $generatedDate }}</p>
        <p><strong>Receipt Number:</strong> {{ $receiptNumber }}</p>
        <span class="status-badge">PAID</span>
    </div>
    
    <div class="section">
        <h3>Student Information</h3>
        <p><strong>Name:</strong> {{ $studentName }}</p>
        <p><strong>Student ID:</strong> {{ $studentId }}</p>
        <p><strong>Email:</strong> {{ $studentEmail }}</p>
    </div>
    
    <div class="section">
        <h3>Payment Information</h3>
        <p><strong>Payment Date:</strong> {{ $paymentDate }}</p>
        <p><strong>Payment Method:</strong> {{ $paymentMethod }}</p>
        @if($collectedBy)
            <p><strong>Collected By:</strong> {{ $collectedBy }}</p>
        @endif
    </div>
    
    <div class="amount-section">
        <h3>Amount Paid: Rs. {{ $formattedAmount }}</h3>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Period</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ $description }}</td>
                <td>{{ $period }}</td>
                <td>Rs. {{ $formattedAmount }}</td>
            </tr>
        </tbody>
    </table>
    
    <div class="footer">
        <p><strong>Important Notes:</strong></p>
        <p>• This is a computer-generated receipt</p>
        <p>• Please keep this receipt for your records</p>
        <p>• For any queries, contact academy administration</p>
        <br>
        <p>Generated on {{ $timestamp }}</p>
    </div>
</body>
</html>
