<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubscriptionPlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'billing_interval',
        'trial_days',
        'status',
        'is_default',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'trial_days' => 'integer',
        'is_default' => 'boolean',
    ];

    public function limits(): HasMany
    {
        return $this->hasMany(SubscriptionPlanLimit::class, 'plan_id');
    }

    public function features(): HasMany
    {
        return $this->hasMany(SubscriptionPlanFeature::class, 'plan_id');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(AcademySubscription::class, 'plan_id');
    }

    public function getLimit(string $quotaKey, int $default = 0): int
    {
        $limit = $this->limits()->where('quota_key', $quotaKey)->first();
        return $limit ? (int) $limit->limit_value : $default;
    }
}
