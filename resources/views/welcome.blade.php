@php
    $systemName = \App\Models\Setting::get('system_name', 'International Sports Solutions');
    $systemLogo = \App\Models\Setting::get('system_logo');
    $primaryColor = \App\Models\Setting::get('primary_color', '#0284c7');
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $systemName }}</title>
    <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />
    <style>
        body { font-family: 'Instrument Sans', sans-serif; background: #f8fafc; color: #222; }
        .center { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .panel-links { display: flex; gap: 2rem; margin-top: 2rem; }
        .panel-link {
            display: flex; flex-direction: column; align-items: center; text-decoration: none;
            background: #fff; border-radius: 1rem; box-shadow: 0 2px 8px #0001; padding: 2rem 2.5rem;
            transition: box-shadow 0.2s, transform 0.2s;
        }
        .panel-link:hover { box-shadow: 0 4px 16px #0002; transform: translateY(-4px) scale(1.03);}
        .panel-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: {{ $primaryColor }};}
        .panel-desc { font-size: 1rem; color: #555; margin-bottom: 1rem; }
        .panel-btn {
            background: {{ $primaryColor }}; color: #fff; border: none; border-radius: 0.5rem;
            padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 500; cursor: pointer;
            transition: opacity 0.2s;
        }
        .panel-btn:hover { opacity: 0.9; }
        @media (max-width: 700px) {
            .panel-links { flex-direction: column; gap: 1.5rem; }
            .panel-link { padding: 1.5rem 1rem; }
        }
    </style>
</head>
<body>
    <div class="center">
        @if($systemLogo)
            <img src="{{ \Illuminate\Support\Facades\Storage::url($systemLogo) }}" alt="{{ $systemName }} Logo" style="height:64px; margin-bottom:1rem; border-radius:8px;">
        @endif
        <h1 style="font-size:2rem; font-weight:700; color:{{ $primaryColor }}; margin-bottom:0.5rem;">
            {{ $systemName }}
        </h1>
        <p style="color:#555; margin-bottom:2rem; font-size:1.1rem;">
            Welcome! Please choose your panel to continue.
        </p>
        <div class="panel-links">
            <a href="{{ url('/admin') }}" class="panel-link" target="_blank">
                <span class="panel-title">Admin Panel</span>
                <span class="panel-desc">Super admin access for global management.</span>
                <button class="panel-btn">Open Admin Panel</button>
            </a>
            <a href="{{ url('/academy') }}" class="panel-link" target="_blank">
                <span class="panel-title">Academy Panel</span>
                <span class="panel-desc">Academy admin and staff management.</span>
                <button class="panel-btn">Open Academy Panel</button>
            </a>
            <a href="{{ url('/student') }}" class="panel-link" target="_blank">
                <span class="panel-title">Student Panel</span>
                <span class="panel-desc">Student dashboard and participation.</span>
                <button class="panel-btn">Open Student Panel</button>
            </a>
        </div>
    </div>
</body>
</html>