@php
    $preset = \App\Models\Setting::get('admin_theme_preset', 'ocean');
    $primaryColor = \App\Models\Setting::get('primary_color', '#0284c7');
    $sidebarBg = \App\Models\Setting::get('sidebar_bg_color');
    $contentBg = \App\Models\Setting::get('content_bg_color');

    $presets = [
        'ocean' => [
            'start' => '#0284c7',
            'end' => '#06b6d4',
            'sidebar_bg' => '#0f172a',
            'content_bg' => '#0b1329',
        ],
        'sunset' => [
            'start' => '#e11d48',
            'end' => '#f43f5e',
            'sidebar_bg' => '#18080f',
            'content_bg' => '#12050b',
        ],
        'midnight' => [
            'start' => '#4f46e5',
            'end' => '#818cf8',
            'sidebar_bg' => '#0f172a',
            'content_bg' => '#090d16',
        ],
        'emerald' => [
            'start' => '#059669',
            'end' => '#10b981',
            'sidebar_bg' => '#062c22',
            'content_bg' => '#041f18',
        ],
        'cyber' => [
            'start' => '#9333ea',
            'end' => '#d946ef',
            'sidebar_bg' => '#1e0836',
            'content_bg' => '#140526',
        ],
        'amber' => [
            'start' => '#d97706',
            'end' => '#f59e0b',
            'sidebar_bg' => '#261807',
            'content_bg' => '#190f04',
        ],
    ];

    $active = $presets[$preset] ?? [
        'start' => $primaryColor,
        'end' => $primaryColor,
        'sidebar_bg' => $sidebarBg ?: '#0f172a',
        'content_bg' => $contentBg ?: '#0b1329',
    ];

    $finalSidebarBg = $sidebarBg ?: $active['sidebar_bg'];
    $finalContentBg = $contentBg ?: $active['content_bg'];
@endphp

<style>
    /* Super Admin Panel Side Menu (Sidebar) Background */
    aside.fi-sidebar,
    .fi-sidebar,
    .fi-sidebar-header,
    .fi-sidebar-nav {
        background-color: {{ $finalSidebarBg }} !important;
    }

    /* Super Admin Main Content Area Background */
    body,
    .fi-main,
    main.fi-main,
    .fi-layout {
        background-color: {{ $finalContentBg }} !important;
    }

    /* Topbar Header Background & Border */
    .fi-topbar {
        background: linear-gradient(135deg, {{ $finalSidebarBg }}, {{ $active['start'] }}15) !important;
        border-bottom: 1px solid {{ $active['start'] }}25 !important;
    }

    .fi-sidebar-header {
        background: linear-gradient(135deg, {{ $active['start'] }}20, {{ $finalSidebarBg }}) !important;
        border-bottom: 1px solid {{ $active['start'] }}20 !important;
    }

    /* Primary Action Buttons */
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

    /* Active Nav Item */
    .fi-sidebar-item-active a {
        background: linear-gradient(135deg, {{ $active['start'] }}30, {{ $active['end'] }}15) !important;
        border-left: 3px solid {{ $active['start'] }} !important;
        color: #ffffff !important;
    }
</style>
