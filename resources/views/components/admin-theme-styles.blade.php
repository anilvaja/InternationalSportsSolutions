@php
    $preset = \App\Models\Setting::get('admin_theme_preset', 'ocean');
    $primaryColor = \App\Models\Setting::get('primary_color', '#0284c7');

    $presets = [
        'ocean' => [
            'start' => '#0284c7',
            'end' => '#06b6d4',
            'primary' => '#0284c7',
        ],
        'sunset' => [
            'start' => '#e11d48',
            'end' => '#f43f5e',
            'primary' => '#e11d48',
        ],
        'midnight' => [
            'start' => '#4f46e5',
            'end' => '#818cf8',
            'primary' => '#4f46e5',
        ],
        'emerald' => [
            'start' => '#059669',
            'end' => '#10b981',
            'primary' => '#059669',
        ],
        'cyber' => [
            'start' => '#9333ea',
            'end' => '#d946ef',
            'primary' => '#9333ea',
        ],
        'amber' => [
            'start' => '#d97706',
            'end' => '#f59e0b',
            'primary' => '#d97706',
        ],
    ];

    $active = $presets[$preset] ?? [
        'start' => $primaryColor,
        'end' => $primaryColor,
        'primary' => $primaryColor,
    ];
@endphp

<style>
    /* Super Admin Panel Dynamic Gradient Accents */
    .fi-topbar {
        background: linear-gradient(135deg, {{ $active['start'] }}12, {{ $active['end'] }}05) !important;
        border-bottom: 1px solid {{ $active['start'] }}25 !important;
    }
    
    .fi-sidebar-header {
        background: linear-gradient(135deg, {{ $active['start'] }}18, transparent) !important;
    }

    .fi-btn-primary, button[type="submit"].fi-btn {
        background: linear-gradient(135deg, {{ $active['start'] }}, {{ $active['end'] }}) !important;
        border: none !important;
        box-shadow: 0 4px 14px 0 {{ $active['start'] }}35 !important;
        transition: all 0.2s ease-in-out !important;
    }

    .fi-btn-primary:hover, button[type="submit"].fi-btn:hover {
        opacity: 0.95 !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 20px 0 {{ $active['start'] }}55 !important;
    }

    .fi-sidebar-item-active a {
        background: linear-gradient(135deg, {{ $active['start'] }}20, {{ $active['end'] }}10) !important;
        border-left: 3px solid {{ $active['start'] }} !important;
    }
</style>
