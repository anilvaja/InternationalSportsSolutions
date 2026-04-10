<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserBelongsToAcademy
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();
        
        // Allow super admins to access any academy panel
        if ($user && $user->is_super_admin) {
            return $next($request);
        }
        
        // Ensure user belongs to an academy
        if (!$user || !$user->academy_id) {
            abort(403, 'You do not have access to any academy.');
        }
        
        // For now, allow any user with academy_id to access academy panel
        // Later we can add role-based restrictions
        
        // Ensure academy is active
        if (!$user->academy->isActive()) {
            abort(403, 'Academy is currently inactive.');
        }
        
        return $next($request);
    }
}
