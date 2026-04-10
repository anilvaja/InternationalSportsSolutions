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
        // Configure mail settings from database if available
        try {
            if (Schema::hasTable('settings')) {
                MailConfigService::configure();
            }
        } catch (\Exception $e) {
            // Silent fail during migrations or when database is not ready
            // This handles cases where database file doesn't exist yet
        }

        Notification::extend('sms', function ($app) {
            return new SmsChannel($app->make(SmsService::class));
        });
    }
}
