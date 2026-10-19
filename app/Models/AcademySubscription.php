<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademySubscription extends Model
{
    use HasFactory;

    protected $fillable = [
        'academy_id',
        'plan_id',
        'status',
        'starts_at',
        'ends_at',
        'auto_renew',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'auto_renew' => 'boolean',
    ];

    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class, 'academy_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }

    public function isActive(): bool
    {
        if (!in_array($this->status, ['active', 'trial'])) {
            return false;
        }
        if ($this->ends_at && $this->ends_at->isPast()) {
            return false;
        }
        return true;
    }
}
