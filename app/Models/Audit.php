<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Audit extends Model
{
    protected $fillable = [
        'user_type',
        'user_id',
        'event',
        'auditable_type',
        'auditable_id',
        'old_values',
        'new_values',
        'url',
        'ip_address',
        'user_agent',
        'tags',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'tags' => 'array',
    ];

    // Relationships
    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): MorphTo
    {
        return $this->morphTo('user');
    }

    // Accessors
    public function getEventBadgeAttribute(): string
    {
        return match($this->event) {
            'created' => 'success',
            'updated' => 'warning',
            'deleted' => 'danger',
            'restored' => 'info',
            default => 'gray'
        };
    }

    public function getEventLabelAttribute(): string
    {
        return ucfirst($this->event);
    }

    public function getUserNameAttribute(): string
    {
        if (!$this->user) {
            return 'System';
        }

        if ($this->user_type === 'App\\Models\\User') {
            return $this->user->name ?? 'Unknown User';
        } elseif ($this->user_type === 'App\\Models\\Student') {
            return "{$this->user->first_name} {$this->user->last_name} (Student)";
        }

        return 'Unknown';
    }

    public function getModelNameAttribute(): string
    {
        $className = class_basename($this->auditable_type);
        return str_replace('_', ' ', \Illuminate\Support\Str::snake($className));
    }

    public function getChangedFieldsAttribute(): array
    {
        if (!$this->new_values || !$this->old_values) {
            return [];
        }

        $changed = [];
        foreach ($this->new_values as $field => $newValue) {
            $oldValue = $this->old_values[$field] ?? null;
            if ($oldValue !== $newValue) {
                $changed[$field] = [
                    'old' => $oldValue,
                    'new' => $newValue
                ];
            }
        }

        return $changed;
    }
}
