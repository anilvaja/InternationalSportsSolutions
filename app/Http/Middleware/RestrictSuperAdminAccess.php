<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RestrictSuperAdminAccess
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

        // Only allow super admins (users with is_super_admin = true) to access admin panel
        if (!$user->is_super_admin) {
            // Redirect non-super-admin users to academy panel
            Auth::logout();
            return redirect()->route('filament.academy.auth.login')
                ->withErrors(['email' => 'You do not have permission to access the super admin panel. Please use the academy login.']);
        }

        return $next($request);
    }
}
