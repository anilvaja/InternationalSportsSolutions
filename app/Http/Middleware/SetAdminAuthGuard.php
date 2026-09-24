<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class SetAdminAuthGuard
{
    /**
     * Switch the default auth guard to 'web' so that Auth::user(), Auth::id(),
     * etc. resolve to the admin-panel session instead of other guard sessions.
     * This allows admin, academy, and student sessions to coexist in the same browser.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        Auth::shouldUse('web');

        return $next($request);
    }
}
