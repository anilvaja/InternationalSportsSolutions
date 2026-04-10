<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Notification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .content {
            padding: 20px 0;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 15px;
            text-align: center;
            border-radius: 5px;
            margin-top: 20px;
            font-size: 0.9em;
            color: #666;
        }
        .academy-name {
            color: #007bff;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2 class="academy-name">{{ $data['academy_name'] ?? config('app.name') }}</h2>
        <p>Academy Management System</p>
    </div>

    <div class="content">
        {!! nl2br(e($message)) !!}
    </div>

    @if(isset($data['additional_info']))
    <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <strong>Additional Information:</strong><br>
        {!! nl2br(e($data['additional_info'])) !!}
    </div>
    @endif

    <div class="footer">
        <p>This is an automated message from {{ $data['academy_name'] ?? config('app.name') }}.</p>
        <p>Please do not reply to this email.</p>
        @if(isset($data['contact_info']))
        <p>For inquiries, please contact: {{ $data['contact_info'] }}</p>
        @endif
    </div>
</body>
</html>
