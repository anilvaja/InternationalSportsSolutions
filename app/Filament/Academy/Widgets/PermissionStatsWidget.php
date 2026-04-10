<?php

namespace App\Filament\Academy\Widgets;

use App\Models\AcademyPermission;
use App\Models\AcademyRole;
use App\Models\User;
use App\Models\UserAcademyRole;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\Auth;

class PermissionStatsWidget extends BaseWidget
{
    protected function getStats(): array
    {
        $user = Auth::user();
        $academyId = $user->academy_id;

        // Get counts
        $totalPermissions = AcademyPermission::count();
        $totalRoles = AcademyRole::where('academy_id', $academyId)->count();
        $activeRoles = AcademyRole::where('academy_id', $academyId)->where('is_active', true)->count();
        $totalUsers = User::where('academy_id', $academyId)->where('is_super_admin', false)->count();
        $usersWithRoles = UserAcademyRole::whereHas('academyRole', function($query) use ($academyId) {
            $query->where('academy_id', $academyId);
        })->where('is_active', true)->distinct('user_id')->count();

        // Calculate permission coverage
        $allRoles = AcademyRole::where('academy_id', $academyId)->where('is_active', true)->get();
        $totalAssignedPermissions = 0;
        foreach($allRoles as $role) {
            $totalAssignedPermissions += count($role->permissions ?? []);
        }

        return [
            Stat::make('Total Permissions', $totalPermissions)
                ->description('System-wide permissions')
                ->descriptionIcon('heroicon-m-shield-check')
                ->color('success'),
            
            Stat::make('Active Roles', $activeRoles)
                ->description('Out of ' . $totalRoles . ' total roles')
                ->descriptionIcon('heroicon-m-key')
                ->color('info'),
            
            Stat::make('Users with Roles', $usersWithRoles)
                ->description('Out of ' . $totalUsers . ' total users')
                ->descriptionIcon('heroicon-m-users')
                ->color('warning'),
            
            Stat::make('Permission Assignments', $totalAssignedPermissions)
                ->description('Total role-permission assignments')
                ->descriptionIcon('heroicon-m-link')
                ->color('primary'),
        ];
    }

    public static function canView(): bool
    {
        $user = Auth::user();
        
        if ($user->is_super_admin) {
            return true;
        }
        
        return $user->hasPermission('view_permissions') || $user->hasPermission('view_roles');
    }
}
