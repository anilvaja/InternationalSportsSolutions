<?php
// This base resource can be used for all Academy Filament Resources to centralize permission logic
namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Traits\HasAcademyPermissions;
use Filament\Resources\Resource;

abstract class BaseAcademyResource extends Resource
{
    use HasAcademyPermissions;

    // Override in child if needed
    public static function canViewAny(): bool
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        
        // Allow super admin
        if ($user && $user->is_super_admin) {
            return true;
        }
        
        // Check if user has academy and proper permissions
        if (!$user || is_null($user->academy_id)) {
            return false;
        }
        
        // Use proper permission check
        return static::canAcademy('view');
    }

    /**
     * Determine if the resource should be hidden from navigation.
     * This method controls navigation menu visibility based on permissions.
     */
    public static function shouldRegisterNavigation(): bool
    {
        // Hide from navigation if user can't view the resource
        return static::canViewAny();
    }

    /**
     * Override this method in child resources if you want custom navigation visibility logic
     */
    public static function canAccess(): bool
    {
        return static::canViewAny();
    }

    public static function canCreate(): bool
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        
        // Allow super admin
        if ($user && $user->is_super_admin) {
            return true;
        }
        
        // Check if user has academy and proper permissions
        if (!$user || is_null($user->academy_id)) {
            return false;
        }
        
        // Use proper permission check
        return static::canAcademy('create');
    }

    public static function canEdit($record): bool
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        
        // Allow super admin
        if ($user && $user->is_super_admin) {
            return true;
        }
        
        // Check if user has academy and proper permissions
        if (!$user || is_null($user->academy_id)) {
            return false;
        }

        // Belt-and-braces tenant check: even if a resource's getEloquentQuery()
        // scoping is ever missed/removed, never allow editing a record that
        // belongs to a different academy.
        if (!static::recordBelongsToCurrentAcademy($record, $user)) {
            return false;
        }
        
        // Use proper permission check
        return static::canAcademy('edit');
    }

    public static function canDelete($record): bool
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        
        // Allow super admin
        if ($user && $user->is_super_admin) {
            return true;
        }
        
        // Check if user has academy and proper permissions
        if (!$user || is_null($user->academy_id)) {
            return false;
        }

        // Belt-and-braces tenant check: even if a resource's getEloquentQuery()
        // scoping is ever missed/removed, never allow deleting a record that
        // belongs to a different academy.
        if (!static::recordBelongsToCurrentAcademy($record, $user)) {
            return false;
        }
        
        // Use proper permission check
        return static::canAcademy('delete');
    }

    /**
     * Defense-in-depth guard: confirms $record actually belongs to the
     * current user's academy before allowing a mutating action. Records
     * without an academy_id attribute (e.g. globally-shared lookup data)
     * are treated as not tenant-scoped and pass through unaffected.
     */
    protected static function recordBelongsToCurrentAcademy($record, $user): bool
    {
        if (!is_object($record) || !array_key_exists('academy_id', $record->getAttributes())) {
            return true;
        }

        return (int) $record->academy_id === (int) $user->academy_id;
    }
}
