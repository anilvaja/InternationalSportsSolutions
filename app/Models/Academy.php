<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\Auditable;

class Academy extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'domain',
        'logo',
        'icon',
        'contact_email',
        'contact_phone',
        'address',
        'city',
        'state',
        'country',
        'postal_code',
        'status',
        'settings',
        'max_users',
        'max_students',
        'max_branches',
        'max_coaches',
        'subscription_starts_at',
        'subscription_ends_at',
    ];

    protected $casts = [
        'settings' => 'array',
        'subscription_starts_at' => 'date',
        'subscription_ends_at' => 'date',
        'status' => 'string',
    ];

    // Relationships for central panel (super admin)
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(AcademyRole::class);
    }

    public function owner(): HasMany
    {
        return $this->hasMany(User::class)->whereHas('roles', function($query) {
            $query->where('name', 'academy_owner');
        });
    }

    public function admins(): HasMany
    {
        return $this->hasMany(User::class)->whereHas('roles', function($query) {
            $query->whereIn('name', ['academy_owner', 'academy_admin']);
        });
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isSubscriptionActive(): bool
    {
        return $this->subscription_ends_at && $this->subscription_ends_at->isFuture();
    }

    /**
     * Boot method to handle automatic role creation
     */
    protected static function boot()
    {
        parent::boot();
        
        static::created(function ($academy) {
            $academy->createDefaultRoles();
        });
    }

    /**
     * Create default roles for this academy
     */
    public function createDefaultRoles(): void
    {
        $defaultRoles = [
            [
                'name' => 'admin',
                'display_name' => 'Admin',
                'description' => 'Full access to academy management',
                'permissions' => \App\Models\AcademyPermission::pluck('name')->toArray(),
                'is_default' => true,
                'is_removable' => false,
            ],
            [
                'name' => 'manager',
                'display_name' => 'Manager',
                'description' => 'Academy operations management',
                'permissions' => [
                    'view_dashboard', 'manage_students', 'manage_coaches', 'view_reports',
                    'manage_batches', 'manage_attendance', 'view_payments'
                ],
                'is_default' => true,
                'is_removable' => false,
            ],
            [
                'name' => 'coach',
                'display_name' => 'Coach',
                'description' => 'Student training and development',
                'permissions' => [
                    'view_dashboard', 'view_students', 'manage_attendance', 'view_batches',
                    'manage_syllabus', 'view_student_progress'
                ],
                'is_default' => true,
                'is_removable' => false,
            ],
            [
                'name' => 'staff',
                'display_name' => 'Staff',
                'description' => 'Basic academy operations',
                'permissions' => [
                    'view_dashboard', 'view_students', 'view_attendance'
                ],
                'is_default' => true,
                'is_removable' => false,
            ],
        ];

        foreach ($defaultRoles as $roleData) {
            \App\Models\AcademyRole::firstOrCreate(
                [
                    'academy_id' => $this->id,
                    'name' => $roleData['name'],
                ],
                [
                    'display_name' => $roleData['display_name'],
                    'description' => $roleData['description'],
                    'permissions' => $roleData['permissions'],
                    'is_active' => true,
                    'is_default' => $roleData['is_default'],
                    'is_removable' => $roleData['is_removable'],
                ]
            );
        }
    }

    /**
     * Get the URL for the academy icon
     */
    public function getIconUrl(): ?string
    {
        return $this->icon ? \Illuminate\Support\Facades\Storage::url($this->icon) : null;
    }

    /**
     * Ensure this academy has all default roles
     * Useful for existing academies that may not have the new role structure
     */
    public function ensureDefaultRoles(): void
    {
        $this->createDefaultRoles();
    }

    /**
     * Check if academy has all required default roles
     */
    public function hasAllDefaultRoles(): bool
    {
        $requiredRoles = ['admin', 'manager', 'coach', 'staff'];
        $existingRoles = $this->roles()->where('is_default', true)->pluck('name')->toArray();
        
        return empty(array_diff($requiredRoles, $existingRoles));
    }
}
