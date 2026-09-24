<?php

namespace App\Providers;

use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

if (! class_exists(\Laravel\Horizon\HorizonApplicationServiceProvider::class)) {
    class HorizonServiceProvider extends ServiceProvider
    {
        public function register(): void
        {
            //
        }

        public function boot(): void
        {
            //
        }
    }
} else {
    class HorizonServiceProvider extends \Laravel\Horizon\HorizonApplicationServiceProvider
    {
        /**
         * Bootstrap any application services.
         */
        public function boot(): void
        {
            parent::boot();

            \Laravel\Horizon\Horizon::auth(function ($request) {
                $user = $request->user();
                return $user && (bool) $user->is_super_admin;
            });
        }

        /**
         * Register the Horizon gate.
         *
         * This gate determines who can access Horizon in non-local environments.
         */
        protected function gate(): void
        {
            Gate::define('viewHorizon', function ($user = null) {
                return $user && (bool) $user->is_super_admin;
            });
        }
    }
}
