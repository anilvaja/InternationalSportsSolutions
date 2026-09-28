<?php

namespace App\Models;

use OwenIt\Auditing\Models\Audit as OwenItAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class Audit extends OwenItAudit
{
    protected $table = 'audits';

    protected static function booted(): void
    {
        static::creating(function (Audit $audit) {
            if (!$audit->academy_id) {
                // 1. Check logged-in user academy_id
                if (Auth::check() && isset(Auth::user()->academy_id)) {
                    $audit->academy_id = Auth::user()->academy_id;
                } elseif ($audit->user && isset($audit->user->academy_id)) {
                    $audit->academy_id = $audit->user->academy_id;
                }

                // 2. Check auditable model academy_id or if auditable is Academy itself
                if (!$audit->academy_id && $audit->auditable) {
                    if ($audit->auditable instanceof Academy) {
                        $audit->academy_id = $audit->auditable->id;
                    } elseif (isset($audit->auditable->academy_id)) {
                        $audit->academy_id = $audit->auditable->academy_id;
                    }
                }
            }
        });
    }

    /**
     * Scope query based on user role and permissions:
     * 1> Super Admin: complete logs across system
     * 2> Academy Admin: logs for their academy only
     * 3> Rest users: own change logs only
     */
    public function scopeForUserAccess(Builder $query, ?User $user = null): Builder
    {
        $user = $user ?? Auth::user();

        if (!$user) {
            return $query->whereRaw('1 = 0'); // Block unauthenticated access
        }

        // Rule 1: Only Super Admin can see complete system logs
        if ($user->is_super_admin) {
            return $query;
        }

        $isAcademyAdmin = $user->role === 'academy_admin' || 
                          $user->userAcademyRoles()->whereHas('role', fn($r) => $r->where('name', 'admin'))->exists();

        // Rule 2: Only Academy Admin can see their academy-only logs (no other academy logs)
        if ($isAcademyAdmin && $user->academy_id) {
            return $query->where(function (Builder $q) use ($user) {
                $q->where('academy_id', $user->academy_id)
                  ->orWhereHas('user', fn ($uQuery) => $uQuery->where('academy_id', $user->academy_id));
            });
        }

        // Rule 3: Rest users can see own changes logs only
        return $query->where(function (Builder $q) use ($user) {
            $q->where(function ($sub) use ($user) {
                $sub->where('user_type', get_class($user))
                    ->where('user_id', $user->id);
            })
            ->orWhere(function ($sub) use ($user) {
                $sub->where('auditable_type', get_class($user))
                    ->where('auditable_id', $user->id);
            });
        });
    }

    public function getUserNameAttribute(): string
    {
        $user = $this->user;
        if (!$user) {
            return 'System';
        }

        if (isset($user->name)) {
            return $user->name;
        }

        if (isset($user->first_name)) {
            return trim("{$user->first_name} {$user->last_name}");
        }

        return 'Unknown';
    }

    public function getModelNameAttribute(): string
    {
        $auditableType = $this->auditable_type ?? 'N/A';
        $className = class_basename($auditableType);
        return str_replace('_', ' ', Str::snake($className));
    }

    public function getEventBadgeAttribute(): string
    {
        return match($this->event ?? 'info') {
            'created' => 'success',
            'updated' => 'warning',
            'deleted' => 'danger',
            'restored' => 'info',
            default => 'gray'
        };
    }
}
