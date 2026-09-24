<?php

namespace App\Providers;

use App\Models\Setting;
use App\Services\MailConfigService;
use App\Notifications\Channels\SmsChannel;
use App\Services\SmsService;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(SmsService::class, function ($app) {
            return new SmsService();
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Detect current request protocol
        $isSecure = (isset($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['HTTPS'] == 1)) ||
                    (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

        if ($isSecure) {
            \Illuminate\Support\Facades\URL::forceScheme('https');
        } else {
            \Illuminate\Support\Facades\URL::forceScheme('http');
            // Dynamically rewrite app.url config to use http
            $appUrl = config('app.url');
            if ($appUrl && str_starts_with($appUrl, 'https://')) {
                config(['app.url' => str_replace('https://', 'http://', $appUrl)]);
            }
            // Dynamically force HTTP asset root in URL generator using reflection
            $assetUrl = config('app.asset_url') ?? env('ASSET_URL');
            if ($assetUrl && str_starts_with($assetUrl, 'https://')) {
                $httpAssetUrl = str_replace('https://', 'http://', $assetUrl);
                try {
                    $urlGenerator = app('url');
                    $reflection = new \ReflectionClass($urlGenerator);
                    $property = $reflection->getProperty('assetRoot');
                    $property->setAccessible(true);
                    $property->setValue($urlGenerator, $httpAssetUrl);
                } catch (\Exception $e) {
                    // Fallback if class structure differs
                }
            }
        }

        // Configure mail settings from database if available
        try {
            if (Schema::hasTable('settings')) {
                MailConfigService::configure();
                $tz = Setting::get('timezone', env('APP_TIMEZONE', 'Asia/Kolkata'));
                if ($tz) {
                    date_default_timezone_set($tz);
                    config(['app.timezone' => $tz]);
                }
            }
        } catch (\Exception $e) {
            // Silent fail during migrations or when database is not ready
            // This handles cases where database file doesn't exist yet
        }

        Notification::extend('sms', function ($app) {
            return new SmsChannel($app->make(SmsService::class));
        });

        // Global Calendar / DatePicker format configuration (Display: DD/MM/YYYY - Storage: YYYY-MM-DD)
        \Filament\Forms\Components\DatePicker::configureUsing(function (\Filament\Forms\Components\DatePicker $component) {
            $component->displayFormat('d/m/Y')->format('Y-m-d');
        });

        \Filament\Forms\Components\DateTimePicker::configureUsing(function (\Filament\Forms\Components\DateTimePicker $component) {
            $component->displayFormat('d/m/Y H:i')->format('Y-m-d H:i:s');
        });
    }
}
