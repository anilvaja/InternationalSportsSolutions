<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademyFeatureOverride extends Model
{
    use HasFactory;

    protected $fillable = [
        'academy_id',
        'feature_key',
        'is_enabled',
        'reason',
        'starts_at',
        'ends_at',
        'changed_by_id',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class, 'academy_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_id');
    }

    public function isValidNow(): bool
    {
        $now = now();
        if ($this->starts_at && $this->starts_at->isFuture()) {
            return false;
        }
        if ($this->ends_at && $this->ends_at->isPast()) {
            return false;
        }
        return true;
    }
}
