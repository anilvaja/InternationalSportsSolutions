<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use Filament\Notifications\Notification;

class CheckAcademyPermission
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = Auth::user();

        // Super admin has all permissions
        if ($user && $user->is_super_admin) {
            return $next($request);
        }

        // Check if user has the required permission in their academy
        if ($user && $user->academy_id && $this->hasAcademyPermission($user, $permission)) {
            return $next($request);
        }

        // Deny access
        if ($request->expectsJson()) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        Notification::make()
            ->title('Access Denied')
            ->body('You do not have permission to access this resource.')
            ->danger()
            ->send();

        return redirect()->back();
    }

    /**
     * Check if user has academy permission
     */
    private function hasAcademyPermission($user, string $permission): bool
    {
        try {
            return $user->activeAcademyRoles()
                ->forAcademy($user->academy_id)
                ->get()
                ->some(function ($userRole) use ($permission) {
                    // Check role permissions
                    if ($userRole->academyRole && in_array($permission, $userRole->academyRole->permissions ?? [])) {
                        return true;
                    }
                    
                    // Check additional permissions
                    return in_array($permission, $userRole->additional_permissions ?? []);
                });
        } catch (\Exception $e) {
            // If there's an error checking permissions, deny access
            return false;
        }
    }
}
