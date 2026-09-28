@php
    $preset = \App\Models\Setting::get('admin_theme_preset', 'ocean');

    $presets = [
        'ocean' => [
            'primary' => '#0284c7',
            'secondary' => '#06b6d4',
            'sidebar_light' => 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)',
            'sidebar_dark' => 'linear-gradient(180deg, #0c1e35 0%, #081427 100%)',
            'content_light' => '#f8fafc',
            'content_dark' => '#0c1626',
            'glow' => 'rgba(2, 132, 199, 0.14)',
            'border' => 'rgba(2, 132, 199, 0.25)',
        ],
        'sunset' => [
            'primary' => '#e11d48',
            'secondary' => '#f43f5e',
            'sidebar_light' => 'linear-gradient(180deg, #fff1f2 0%, #ffe4e6 100%)',
            'sidebar_dark' => 'linear-gradient(180deg, #2a0b12 0%, #1a050b 100%)',
            'content_light' => '#fcf8f9',
            'content_dark' => '#1b090e',
            'glow' => 'rgba(225, 29, 72, 0.14)',
            'border' => 'rgba(225, 29, 72, 0.25)',
        ],
        'midnight' => [
            'primary' => '#4f46e5',
            'secondary' => '#818cf8',
            'sidebar_light' => 'linear-gradient(180deg, #f5f3ff 0%, #e0e7ff 100%)',
            'sidebar_dark' => 'linear-gradient(180deg, #151638 0%, #0d0e25 100%)',
            'content_light' => '#f8fafc',
            'content_dark' => '#101126',
            'glow' => 'rgba(79, 70, 229, 0.14)',
            'border' => 'rgba(79, 70, 229, 0.25)',
        ],
        'emerald' => [
            'primary' => '#059669',
            'secondary' => '#10b981',
            'sidebar_light' => 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)',
            'sidebar_dark' => 'linear-gradient(180deg, #06231a 0%, #031610 100%)',
            'content_light' => '#f7fcf9',
            'content_dark' => '#091c16',
            'glow' => 'rgba(5, 150, 105, 0.14)',
            'border' => 'rgba(5, 150, 105, 0.25)',
        ],
        'cyber' => [
            'primary' => '#9333ea',
            'secondary' => '#d946ef',
            'sidebar_light' => 'linear-gradient(180deg, #faf5ff 0%, #f3e8ff 100%)',
            'sidebar_dark' => 'linear-gradient(180deg, #23093b 0%, #150424 100%)',
            'content_light' => '#fcf8fe',
            'content_dark' => '#19082b',
            'glow' => 'rgba(147, 51, 234, 0.14)',
            'border' => 'rgba(147, 51, 234, 0.25)',
        ],
        'amber' => [
            'primary' => '#d97706',
            'secondary' => '#f59e0b',
            'sidebar_light' => 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
            'sidebar_dark' => 'linear-gradient(180deg, #2b1803 0%, #1a0e01 100%)',
            'content_light' => '#fdfcf7',
            'content_dark' => '#1c1106',
            'glow' => 'rgba(217, 119, 6, 0.14)',
            'border' => 'rgba(217, 119, 6, 0.25)',
        ],
    ];

    $t = $presets[$preset] ?? $presets['ocean'];
@endphp

<style>
    /* Super Admin Sidebar Background (Light vs Dark) */
    html:not(.dark) aside.fi-sidebar,
    html:not(.dark) .fi-sidebar,
    html:not(.dark) .fi-sidebar-header,
    html:not(.dark) .fi-sidebar-nav {
        background: {{ $t['sidebar_light'] }} !important;
        border-right: 1px solid {{ $t['border'] }} !important;
    }

    html.dark aside.fi-sidebar,
    html.dark .fi-sidebar,
    html.dark .fi-sidebar-header,
    html.dark .fi-sidebar-nav {
        background: {{ $t['sidebar_dark'] }} !important;
        border-right: 1px solid {{ $t['border'] }} !important;
    }

    /* Main Content Area Background & Radial Ambient Glow */
    html:not(.dark) body,
    html:not(.dark) .fi-main,
    html:not(.dark) main.fi-main,
    html:not(.dark) .fi-layout {
        background-color: {{ $t['content_light'] }} !important;
        background-image: radial-gradient(at 0% 0%, {{ $t['glow'] }} 0px, transparent 50%) !important;
    }

    html.dark body,
    html.dark .fi-main,
    html.dark main.fi-main,
    html.dark .fi-layout {
        background-color: {{ $t['content_dark'] }} !important;
        background-image: radial-gradient(at 0% 0%, {{ $t['glow'] }} 0px, transparent 50%) !important;
    }

    /* Topbar Header */
    html:not(.dark) .fi-topbar {
        background: {{ $t['sidebar_light'] }} !important;
        border-bottom: 1px solid {{ $t['border'] }} !important;
    }

    html.dark .fi-topbar {
        background: {{ $t['sidebar_dark'] }} !important;
        border-bottom: 1px solid {{ $t['border'] }} !important;
    }

    /* Action Buttons */
    .fi-btn-primary, button[type="submit"].fi-btn {
        background: linear-gradient(135deg, {{ $t['primary'] }}, {{ $t['secondary'] }}) !important;
        border: none !important;
        box-shadow: 0 4px 14px 0 {{ $t['glow'] }} !important;
        transition: all 0.2s ease-in-out !important;
    }

    .fi-btn-primary:hover, button[type="submit"].fi-btn:hover {
        opacity: 0.95 !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 20px 0 {{ $t['glow'] }} !important;
    }

    /* Sidebar Active Navigation Item */
    .fi-sidebar-item-active a {
        background: linear-gradient(135deg, {{ $t['primary'] }}25, {{ $t['secondary'] }}15) !important;
        border-left: 3px solid {{ $t['primary'] }} !important;
    }
</style>
