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
use App\Http\Middleware\EnsureUserBelongsToAcademy;

class AcademyPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->id('academy')
            ->path('academy')
            ->login()
            ->colors([
                'primary' => Color::Blue,
            ])
            ->brandName('Academy Dashboard')
            ->brandLogo(fn (): \Illuminate\View\View => view('filament.academy.components.brand'))
            ->favicon(public_path('favicon.ico'))
            ->discoverResources(in: app_path('Filament/Academy/Resources'), for: 'App\\Filament\\Academy\\Resources')
            ->discoverPages(in: app_path('Filament/Academy/Pages'), for: 'App\\Filament\\Academy\\Pages')
            ->discoverWidgets(in: app_path('Filament/Academy/Widgets'), for: 'App\\Filament\\Academy\\Widgets')
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
                'restrict.academy',
                EnsureUserBelongsToAcademy::class,
            ])
            ->authGuard('web');
    }
}
