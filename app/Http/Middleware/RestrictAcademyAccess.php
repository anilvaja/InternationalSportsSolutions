<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RestrictAcademyAccess
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Allow access if user is not authenticated (for login page)
        if (!Auth::check()) {
            return $next($request);
        }

        $user = Auth::user();

        // Allow super admins to access the academy panel
        if ($user->is_super_admin) {
            return $next($request);
        }

        // Additional check: ensure user has an academy assigned
        if ($user->academy_id === null) {
            Auth::logout();
            return redirect()->route('filament.academy.auth.login')
                ->withErrors(['email' => 'You are not assigned to any academy. Please contact support.']);
        }

        // Additional check: ensure user status is active
        if ($user->is_active === false || ($user->status && $user->status !== 'active')) {
            Auth::logout();
            return redirect()->route('filament.academy.auth.login')
                ->withErrors(['email' => 'Your user account is inactive or suspended. Please contact support.']);
        }

        // Additional check: ensure user's academy is active
        if ($user->academy && $user->academy->status !== 'active') {
            Auth::logout();
            return redirect()->route('filament.academy.auth.login')
                ->withErrors(['email' => 'Your academy account is not active. Please contact support.']);
        }

        return $next($request);
    }
}
