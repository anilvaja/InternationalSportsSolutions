<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionPlanLimit extends Model
{
    use HasFactory;

    protected $fillable = [
        'plan_id',
        'quota_key',
        'limit_value',
        'counting_policy',
    ];

    protected $casts = [
        'limit_value' => 'integer',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }
}
