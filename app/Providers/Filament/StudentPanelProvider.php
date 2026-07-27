<?php

namespace App\Providers\Filament;

use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Widgets;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

class StudentPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        $primaryColorHex = \App\Models\Setting::get('primary_color', '#4f46e5');

        return $panel
            ->id('student')
            ->path('student')
            ->login()
            ->brandName(fn () => \App\Models\Setting::get('system_name', 'Student Portal'))
            ->brandLogo(fn () => view('components.dynamic-brand-logo'))
            ->favicon(public_path('favicon.ico'))
            ->colors([
                'primary' => Color::hex($primaryColorHex),
                'secondary' => Color::Purple,
                'danger' => Color::Rose,
                'success' => Color::Emerald,
                'warning' => Color::Orange,
                'info' => Color::Blue,
                'gray' => Color::Gray,            ])
            ->discoverResources(in: app_path('Filament/Student/Resources'), for: 'App\\Filament\\Student\\Resources')
            ->discoverPages(in: app_path('Filament/Student/Pages'), for: 'App\\Filament\\Student\\Pages')
            ->pages([
                Pages\Dashboard::class,
            ])
            ->discoverWidgets(in: app_path('Filament/Student/Widgets'), for: 'App\\Filament\\Student\\Widgets')
            ->widgets([
                Widgets\AccountWidget::class,
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ])
            ->authGuard('student')
            ->userMenuItems([
                'profile' => \Filament\Navigation\MenuItem::make()
                    ->label('My Profile')
                    ->url('/student/profile')
                    ->icon('heroicon-m-user-circle'),
            ])
            ->navigationGroups([
                'My Dashboard' => \Filament\Navigation\NavigationGroup::make()
                    ->label('My Dashboard'),
                'My Learning' => \Filament\Navigation\NavigationGroup::make()
                    ->label('My Learning'),
                'My Records' => \Filament\Navigation\NavigationGroup::make()
                    ->label('My Records'),
            ]);
    }
}
