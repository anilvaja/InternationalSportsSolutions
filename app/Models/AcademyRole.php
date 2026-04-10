<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademyRole extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'academy_id',
        'name',
        'display_name',
        'description',
        'permissions',
        'is_active',
    ];

    protected $casts = [
        'permissions' => 'array',
        'is_active' => 'boolean',
    ];

    // Relationships
    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_academy_roles')
            ->withPivot(['is_active', 'assigned_at', 'expires_at', 'additional_permissions'])
            ->withTimestamps();
    }

    public function userAcademyRoles(): HasMany
    {
        return $this->hasMany(UserAcademyRole::class);
    }

    // Helper methods
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForAcademy($query, $academyId)
    {
        return $query->where('academy_id', $academyId);
    }

    // Permission methods
    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissions ?? []);
    }

    public function givePermission(string $permission): void
    {
        $permissions = $this->permissions ?? [];
        if (!in_array($permission, $permissions)) {
            $permissions[] = $permission;
            $this->permissions = $permissions;
            $this->save();
        }
    }

    public function revokePermission(string $permission): void
    {
        $permissions = $this->permissions ?? [];
        $this->permissions = array_values(array_diff($permissions, [$permission]));
        $this->save();
    }

    public function syncPermissions(array $permissions): void
    {
        $this->permissions = array_values($permissions);
        $this->save();
    }

    public function getPermissionsByCategory(): array
    {
        $permissions = $this->permissions ?? [];
        $categorized = [];
        
        foreach (AcademyPermission::getPermissionsByCategory() as $category => $categoryPermissions) {
            $categorized[$category] = array_intersect($permissions, array_keys($categoryPermissions));
        }
        
        return $categorized;
    }
}
