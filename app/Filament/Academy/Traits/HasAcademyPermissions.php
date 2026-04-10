<?php

namespace App\Filament\Academy\Traits;

use Illuminate\Support\Str;

trait HasAcademyPermissions
{
    /**
     * Get the permission name for a given action and resource.
     *
     * @param string $action (view, create, edit, delete, export, print, etc.)
     * @return string
     */
    public static function getAcademyPermissionName(string $action): string
    {
        // Guess resource name from class (e.g., StudentResource => students)
        $resource = Str::snake(class_basename(static::class));
        $resource = str_replace('_resource', '', $resource);
        // Pluralize if needed (optional, adjust if your naming is different)
        $resource = Str::plural($resource);
        return $action . '_' . $resource;
    }

    /**
     * Check if the current user has the given permission for this resource.
     *
     * @param string $action
     * @return bool
     */
    public static function canAcademy(string $action): bool
    {
        $permission = static::getAcademyPermissionName($action);
        return \App\Support\AcademyPermissionHelper::can($permission);
    }
}
