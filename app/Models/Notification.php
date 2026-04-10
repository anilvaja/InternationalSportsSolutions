<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Notification extends Model
{
    use Auditable;
    
    protected $fillable = [
        'type',
        'notifiable_type',
        'notifiable_id',
        'data',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    // Relationships
    public function notifiable(): MorphTo
    {
        return $this->morphTo();
    }

    // Accessors
    public function getIsReadAttribute(): bool
    {
        return !is_null($this->read_at);
    }

    // Methods
    public function markAsRead(): void
    {
        if (is_null($this->read_at)) {
            $this->update(['read_at' => now()]);
        }
    }

    public function markAsUnread(): void
    {
        $this->update(['read_at' => null]);
    }
}
