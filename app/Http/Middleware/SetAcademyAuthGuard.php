<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class SetAcademyAuthGuard
{
    /**
     * Switch the default auth guard to 'academy' so that Auth::user(), Auth::id(),
     * etc. resolve to the academy-panel session instead of the shared 'web' guard.
     * This allows admin and academy sessions to coexist in the same browser.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        Auth::shouldUse('academy');

        return $next($request);
    }
}
