<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Staff Payslip - {{ $user->name }}</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 13px;
            color: #1f2937;
            margin: 0;
            padding: 20px;
            line-height: 1.5;
        }
        .header {
            border-bottom: 2px solid #0284c7;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .header table {
            width: 100%;
        }
        .academy-name {
            font-size: 22px;
            font-weight: bold;
            color: #0284c7;
            margin: 0;
        }
        .document-title {
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            text-align: right;
            color: #374151;
        }
        .info-grid {
            width: 100%;
            margin-bottom: 20px;
            border-collapse: collapse;
        }
        .info-grid td {
            padding: 6px 10px;
            vertical-align: top;
        }
        .info-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px;
        }
        .info-label {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: bold;
        }
        .info-value {
            font-size: 13px;
            font-weight: bold;
            color: #0f172a;
        }
        .table-data {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
        }
        .table-data th {
            background-color: #0284c7;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            padding: 10px;
            font-size: 12px;
            text-transform: uppercase;
        }
        .table-data td {
            padding: 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        .table-data tr:nth-child(even) td {
            background-color: #f8fafc;
        }
        .amount-row td {
            font-size: 14px;
        }
        .net-pay-box {
            background-color: #f0fdf4;
            border: 2px solid #22c55e;
            padding: 15px;
            border-radius: 6px;
            text-align: right;
            margin-bottom: 30px;
        }
        .net-pay-title {
            font-size: 12px;
            color: #15803d;
            text-transform: uppercase;
            font-weight: bold;
        }
        .net-pay-amount {
            font-size: 24px;
            font-weight: bold;
            color: #166534;
        }
        .footer-signatures {
            width: 100%;
            margin-top: 50px;
        }
        .footer-signatures td {
            width: 50%;
            text-align: center;
            vertical-align: bottom;
        }
        .signature-line {
            border-top: 1px solid #94a3b8;
            width: 70%;
            margin: 0 auto;
            padding-top: 5px;
            font-size: 11px;
            color: #64748b;
        }
    </style>
</head>
<body>

    {{-- Header --}}
    <div class="header">
        <table>
            <tr>
                <td>
                    <h1 class="academy-name">{{ $academy->name ?? 'Sports Academy' }}</h1>
                    <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                        {{ $academy->contact_email ?? 'support@academysports.com' }} | {{ $academy->contact_phone ?? '' }}
                    </div>
                </td>
                <td style="text-align: right;">
                    <div class="document-title">Official Payslip</div>
                    <div style="font-size: 11px; color: #64748b;">Generated: {{ now()->format('M d, Y') }}</div>
                </td>
            </tr>
        </table>
    </div>

    {{-- Staff & Period Info --}}
    <table class="info-grid">
        <tr>
            <td width="50%">
                <div class="info-box">
                    <div class="info-label">Employee Details</div>
                    <div class="info-value" style="font-size: 15px; margin-top: 2px;">{{ $user->name }}</div>
                    <div style="color: #475569; font-size: 12px;">Email: {{ $user->email }}</div>
                    <div style="color: #475569; font-size: 12px;">Role: {{ ucfirst(str_replace('_', ' ', $user->role ?? 'Staff')) }}</div>
                </div>
            </td>
            <td width="50%">
                <div class="info-box">
                    <div class="info-label">Pay Period & Status</div>
                    <div class="info-value" style="font-size: 14px; margin-top: 2px;">
                        {{ \Carbon\Carbon::parse($payroll->period_start_date)->format('M d, Y') }} - {{ \Carbon\Carbon::parse($payroll->period_end_date)->format('M d, Y') }}
                    </div>
                    <div style="color: #475569; font-size: 12px;">Salary Type: <strong>{{ ucfirst($payroll->salary_type) }}</strong></div>
                    <div style="color: #475569; font-size: 12px;">Payment Status: 
                        <span style="font-weight: bold; color: {{ $payroll->status === 'paid' ? '#16a34a' : '#d97706' }};">
                            {{ strtoupper($payroll->status) }}
                        </span>
                    </div>
                </div>
            </td>
        </tr>
    </table>

    {{-- Attendance Work Summary --}}
    <table class="table-data">
        <thead>
            <tr>
                <th>Summary Metric</th>
                <th style="text-align: right;">Value</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Days Worked</td>
                <td style="text-align: right; font-weight: bold;">{{ $payroll->total_days_worked }} days</td>
            </tr>
            <tr>
                <td>Total Worked Duration</td>
                <td style="text-align: right; font-weight: bold;">
                    @php
                        $hours = floor($payroll->total_worked_minutes / 60);
                        $mins = $payroll->total_worked_minutes % 60;
                    @endphp
                    {{ $hours }} hours {{ $mins }} mins ({{ $payroll->total_worked_minutes }} mins)
                </td>
            </tr>
        </tbody>
    </table>

    {{-- Financial Breakdown --}}
    <table class="table-data">
        <thead>
            <tr>
                <th>Earnings & Deductions Component</th>
                <th style="text-align: right;">Amount ($)</th>
            </tr>
        </thead>
        <tbody>
            <tr class="amount-row">
                <td>Base Calculated Salary</td>
                <td style="text-align: right;">${{ number_format($payroll->base_salary_amount, 2) }}</td>
            </tr>
            @if($payroll->overtime_amount > 0)
            <tr class="amount-row">
                <td>Overtime Bonus</td>
                <td style="text-align: right; color: #16a34a;">+${{ number_format($payroll->overtime_amount, 2) }}</td>
            </tr>
            @endif
            @if($payroll->allowances > 0)
            <tr class="amount-row">
                <td>Allowances</td>
                <td style="text-align: right; color: #16a34a;">+${{ number_format($payroll->allowances, 2) }}</td>
            </tr>
            @endif
            @if($payroll->deductions > 0)
            <tr class="amount-row">
                <td>Deductions</td>
                <td style="text-align: right; color: #dc2626;">-${{ number_format($payroll->deductions, 2) }}</td>
            </tr>
            @endif
        </tbody>
    </table>

    {{-- Net Payable Box --}}
    <div class="net-pay-box">
        <div class="net-pay-title">Net Payable Salary</div>
        <div class="net-pay-amount">${{ number_format($payroll->net_salary, 2) }}</div>
    </div>

    @if($payroll->notes)
    <div style="margin-bottom: 25px; font-size: 11px; color: #64748b;">
        <strong>Notes / Remarks:</strong> {{ $payroll->notes }}
    </div>
    @endif

    {{-- Signatures --}}
    <table class="footer-signatures">
        <tr>
            <td>
                <div class="signature-line">Employee Signature</div>
            </td>
            <td>
                <div class="signature-line">Authorized Signatory (Academy)</div>
            </td>
        </tr>
    </table>

</body>
</html>
