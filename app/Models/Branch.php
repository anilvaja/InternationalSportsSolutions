<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Traits\Auditable;

class Branch extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'academy_id',
        'name',
        'code',
        'description',
        'address',
        'city',
        'state',
        'postal_code',
        'phone',
        'email',
        'manager_id',
        'status',
        'facilities',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'facilities' => 'array',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
    ];

    // Relationships
    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeForAcademy($query, $academyId)
    {
        return $query->where('academy_id', $academyId);
    }

    // Helper methods
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
