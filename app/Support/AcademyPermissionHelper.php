<?php
namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

class AcademyPermissionHelper
{
    /**
     * Get all permissions for the current user in the current academy context.
     * Combines role permissions and any additional permissions from user_academy_roles.
     */
    public static function getUserPermissions(): array
    {
        $user = Auth::user();
        if (!$user || !$user->academy_id) {
            return [];
        }
        // Ensure we have the correct User model instance
        if (!($user instanceof User)) {
            $user = User::find($user->id);
        }
        if (!$user) {
            return [];
        }
        $permissions = [];
        if (method_exists($user, 'getAcademyRole')) {
            $role = $user->getAcademyRole($user->academy_id);
            $rolePermissions = $role?->permissions ?? [];
            
            // Convert role permission names to IDs if they are stored as names
            foreach ($rolePermissions as $permission) {
                if (is_numeric($permission)) {
                    // Already an ID
                    $permissions[] = $permission;
                } else {
                    // Convert name to ID
                    $permissionId = static::getPermissionId($permission);
                    if ($permissionId) {
                        $permissions[] = $permissionId;
                    }
                }
            }
        }
        if (method_exists($user, 'userAcademyRoles')) {
            $pivot = $user->userAcademyRoles()->where('academy_id', $user->academy_id)->first();
            if ($pivot && is_array($pivot->additional_permissions)) {
                // Convert additional permission names to IDs
                $additionalPermissionIds = [];
                foreach ($pivot->additional_permissions as $permissionName) {
                    $permissionId = static::getPermissionId($permissionName);
                    if ($permissionId) {
                        $additionalPermissionIds[] = $permissionId;
                    }
                }
                $permissions = array_unique(array_merge($permissions, $additionalPermissionIds));
            }
        }
        // Debug log for troubleshooting
    Log::info('[AcademyPermissionHelper] User: ' . $user->id . ' (' . $user->name . ') Academy: ' . $user->academy_id . ' Permissions: ' . json_encode($permissions));
        return $permissions;
    }

    /**
     * Check if the current user has a given permission in the academy context.
     */
    public static function can(string $permission): bool
    {
        $user = Auth::user();
        if ($user && $user->is_super_admin) {
            return true;
        }
        
        // Get permission ID from name
        $permissionId = static::getPermissionId($permission);
        if (!$permissionId) {
            return false;
        }
        
        $userPermissions = static::getUserPermissions();
        return in_array($permissionId, $userPermissions);
    }
    
    /**
     * Get permission ID from permission name
     */
    public static function getPermissionId(string $permissionName): ?int
    {
        static $permissionCache = [];
        
        if (!isset($permissionCache[$permissionName])) {
            $permission = \App\Models\AcademyPermission::where('name', $permissionName)->first();
            $permissionCache[$permissionName] = $permission?->id;
        }
        
        return $permissionCache[$permissionName];
    }
    /**
     * Check if the given user has a given permission in the academy context.
     */
    public static function canForUser($user, string $permission): bool
    {
        if ($user && $user->is_super_admin) {
            return true;
        }
        if (!$user || !$user->academy_id) {
            return false;
        }
        
        // Get permission ID from name
        $permissionId = static::getPermissionId($permission);
        if (!$permissionId) {
            return false;
        }
        
        // Use the same logic as getUserPermissions but for the given user
        $permissions = [];
        if (method_exists($user, 'getAcademyRole')) {
            $role = $user->getAcademyRole($user->academy_id);
            $rolePermissions = $role?->permissions ?? [];
            
            // Convert role permission names to IDs if they are stored as names
            foreach ($rolePermissions as $permission) {
                if (is_numeric($permission)) {
                    // Already an ID
                    $permissions[] = $permission;
                } else {
                    // Convert name to ID
                    $permissionId = static::getPermissionId($permission);
                    if ($permissionId) {
                        $permissions[] = $permissionId;
                    }
                }
            }
        }
        if (method_exists($user, 'userAcademyRoles')) {
            $pivot = $user->userAcademyRoles()->where('academy_id', $user->academy_id)->first();
            if ($pivot && is_array($pivot->additional_permissions)) {
                // Convert additional permission names to IDs
                $additionalPermissionIds = [];
                foreach ($pivot->additional_permissions as $permissionName) {
                    $permissionId = static::getPermissionId($permissionName);
                    if ($permissionId) {
                        $additionalPermissionIds[] = $permissionId;
                    }
                }
                $permissions = array_unique(array_merge($permissions, $additionalPermissionIds));
            }
        }
        return in_array($permissionId, $permissions);
    }
}
