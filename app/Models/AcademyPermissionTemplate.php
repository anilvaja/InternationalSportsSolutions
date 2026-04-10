<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyPermissionTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'academy_id',
        'name',
        'description',
        'permissions',
        'is_system_template',
    ];

    protected $casts = [
        'permissions' => 'array',
        'is_system_template' => 'boolean',
    ];

    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    /**
     * Get templates for a specific academy
     */
    public static function forAcademy(int $academyId)
    {
        return static::where('academy_id', $academyId)
            ->orWhere('is_system_template', true);
    }

    /**
     * Get permission count for the template
     */
    public function getPermissionCountAttribute(): int
    {
        return count($this->permissions ?? []);
    }

    /**
     * Check if template has a specific permission
     */
    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissions ?? []);
    }

    /**
     * Get formatted permission list
     */
    public function getFormattedPermissionsAttribute(): array
    {
        $permissions = AcademyPermission::getGroupedPermissions();
        $formatted = [];
        
        foreach ($this->permissions ?? [] as $permission) {
            foreach ($permissions as $category => $categoryPermissions) {
                foreach ($categoryPermissions as $perm) {
                    if ($perm->name === $permission) {
                        $formatted[] = [
                            'category' => ucwords(str_replace('_', ' ', $category)),
                            'name' => $perm->display_name,
                            'description' => $perm->description,
                        ];
                        break 2;
                    }
                }
            }
        }
        
        return $formatted;
    }
}