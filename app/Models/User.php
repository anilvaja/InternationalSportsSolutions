<?php
namespace App\Models;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use App\Traits\Auditable;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasRoles, Auditable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'academy_id',
        'role',
        'phone',
        'avatar',
        'is_super_admin',
        'status',
        'date_of_birth',
        'employee_id',
        'department',
        'coaching_experience',
        'specialization',
        'certifications',
        'is_active',
        'bio',
        'notes',
    ];

    /**
     * Boot method to handle automatic role assignments
     */
    protected static function boot()
    {
        parent::boot();
        
        // Handle role assignment after user is created or updated
        static::saved(function ($user) {
            $user->handleAcademyRoleAssignment();
        });
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_super_admin' => 'boolean',
            'is_active' => 'boolean',
            'date_of_birth' => 'date',
            'specialization' => 'array',
        ];
    }

    // Relationships
    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function academyRoles(): BelongsToMany
    {
        return $this->belongsToMany(AcademyRole::class, 'user_academy_roles')
            ->withPivot(['is_active', 'assigned_at', 'expires_at', 'additional_permissions'])
            ->withTimestamps();
    }

    public function userAcademyRoles(): HasMany
    {
        return $this->hasMany(UserAcademyRole::class);
    }

    public function activeAcademyRoles(): HasMany
    {
        return $this->hasMany(UserAcademyRole::class)->active();
    }

    // Helper methods
    public function isSuperAdmin(): bool
    {
        return $this->is_super_admin;
    }

    public function isAcademyOwner(): bool
    {
        return $this->hasRole('academy_owner');
    }

    public function isAcademyAdmin(): bool
    {
        return $this->role === 'academy_admin' || $this->is_super_admin;
    }

    public function canAccessAcademy(Academy $academy): bool
    {
        return $this->is_super_admin || $this->academy_id === $academy->id;
    }

    // Academy role methods (simplified)
    public function getAcademyRole($academyId = null): ?AcademyRole
    {
        $academyId = $academyId ?? $this->academy_id;
        
        if (!$academyId) {
            return null;
        }

        $userRole = $this->activeAcademyRoles()
            ->forAcademy($academyId)
            ->first();

        return $userRole?->academyRole;
    }

    public function assignAcademyRole(AcademyRole $role): UserAcademyRole
    {
        return UserAcademyRole::create([
            'user_id' => $this->id,
            'academy_id' => $role->academy_id,
            'academy_role_id' => $role->id,
            'is_active' => true,
            'assigned_at' => now(),
            'additional_permissions' => [],
        ]);
    }

    public function removeAcademyRole(AcademyRole $role): bool
    {
        return $this->userAcademyRoles()
            ->where('academy_role_id', $role->id)
            ->delete();
    }

    // Permission checking methods
    public function hasPermission(string $permission, $academyId = null): bool
    {
        // Super admin has all permissions
        if ($this->is_super_admin) {
            return true;
        }

        $academyId = $academyId ?? $this->academy_id;
        
        if (!$academyId) {
            return false;
        }

        // Check role permissions
        $role = $this->getAcademyRole($academyId);
        if ($role && $role->hasPermission($permission)) {
            return true;
        }

        // Check additional permissions
        $userRole = $this->activeAcademyRoles()
            ->forAcademy($academyId)
            ->first();

        if ($userRole && is_array($userRole->additional_permissions)) {
            return in_array($permission, $userRole->additional_permissions);
        }

        return false;
    }

    public function hasAnyPermission(array $permissions, $academyId = null): bool
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermission($permission, $academyId)) {
                return true;
            }
        }
        return false;
    }

    public function hasAllPermissions(array $permissions, $academyId = null): bool
    {
        foreach ($permissions as $permission) {
            if (!$this->hasPermission($permission, $academyId)) {
                return false;
            }
        }
        return true;
    }

    public function givePermission(string $permission, $academyId = null): void
    {
        $academyId = $academyId ?? $this->academy_id;
        
        if (!$academyId) {
            return;
        }

        $userRole = $this->activeAcademyRoles()
            ->forAcademy($academyId)
            ->first();

        if ($userRole) {
            $additionalPermissions = $userRole->additional_permissions ?? [];
            if (!in_array($permission, $additionalPermissions)) {
                $additionalPermissions[] = $permission;
                $userRole->update(['additional_permissions' => $additionalPermissions]);
            }
        }
    }

    public function revokePermission(string $permission, $academyId = null): void
    {
        $academyId = $academyId ?? $this->academy_id;
        
        if (!$academyId) {
            return;
        }

        $userRole = $this->activeAcademyRoles()
            ->forAcademy($academyId)
            ->first();

        if ($userRole) {
            $additionalPermissions = $userRole->additional_permissions ?? [];
            $additionalPermissions = array_values(array_diff($additionalPermissions, [$permission]));
            $userRole->update(['additional_permissions' => $additionalPermissions]);
        }
    }

    public function getAllPermissions($academyId = null): array
    {
        if ($this->is_super_admin) {
            return array_keys(collect(AcademyPermission::getPermissionsByCategory())->flatten()->toArray());
        }

        $academyId = $academyId ?? $this->academy_id;
        
        if (!$academyId) {
            return [];
        }

        $permissions = [];

        // Get role permissions
        $role = $this->getAcademyRole($academyId);
        if ($role) {
            $permissions = array_merge($permissions, $role->permissions ?? []);
        }

        // Get additional permissions
        $userRole = $this->activeAcademyRoles()
            ->forAcademy($academyId)
            ->first();

        if ($userRole && is_array($userRole->additional_permissions)) {
            $permissions = array_merge($permissions, $userRole->additional_permissions);
        }

        return array_unique($permissions);
    }
    
    // Computed property for role names (for Filament table display)
    public function getRoleNamesAttribute()
    {
        if (!$this->relationLoaded('activeAcademyRoles')) {
            $this->load('activeAcademyRoles.academyRole');
        }
        $roles = $this->activeAcademyRoles
            ? $this->activeAcademyRoles->map(function ($userRole) {
                return optional($userRole->academyRole)->display_name;
            })->filter()->unique()->values()
            : collect();
        return $roles->isEmpty() ? 'No Role' : $roles->join(', ');
    }

    // FilamentUser interface implementation
    public function canAccessPanel(Panel $panel): bool
    {
        // Allow access to academy panel if user has academy_id
        if ($panel->getId() === 'academy') {
            return !is_null($this->academy_id) && !$this->is_super_admin;
        }
        
        // Allow access to admin panel for super admins
        if ($panel->getId() === 'admin') {
            return $this->is_super_admin;
        }
        
        // Allow access to central panel for super admins (legacy support)
        if ($panel->getId() === 'central') {
            return $this->is_super_admin;
        }
        
        return false;
    }
    
    public function getFilamentAvatarUrl(): ?string
    {
        return $this->avatar ? Storage::url($this->avatar) : null;
    }

    /**
     * Handle automatic academy role assignment for academy_admin users
     * Made public so it can be called from commands
     */
    public function handleAcademyRoleAssignment(): void
    {
        // Only process academy_admin role
        if (!$this->academy_id || $this->role !== 'academy_admin') {
            return;
        }

        $academy = $this->academy;
        if (!$academy) {
            return;
        }

        // Ensure academy has default roles first
        $academy->ensureDefaultRoles();

        // Find the admin role
        $adminRole = $academy->roles()
            ->where('name', 'admin')
            ->first();

        if (!$adminRole) {
            Log::warning("Admin role not found for academy {$academy->id}");
            return;
        }

        // Check if user already has admin role assigned
        $existingAssignment = $this->userAcademyRoles()
            ->where('academy_role_id', $adminRole->id)
            ->where('academy_id', $this->academy_id)
            ->first();

        if ($existingAssignment) {
            // Update existing assignment to be active
            $existingAssignment->update([
                'is_active' => true,
                'assigned_at' => now(),
            ]);
        } else {
            // Create new admin role assignment
            $this->userAcademyRoles()->create([
                'academy_role_id' => $adminRole->id,
                'academy_id' => $this->academy_id,
                'is_active' => true,
                'assigned_at' => now(),
            ]);
        }

        // Remove other academy role assignments for this academy
        $this->userAcademyRoles()
            ->where('academy_id', $this->academy_id)
            ->where('academy_role_id', '!=', $adminRole->id)
            ->update(['is_active' => false]);
    }
}
