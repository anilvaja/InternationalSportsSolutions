<?php

namespace App\Models;

use Spatie\Activitylog\Models\Activity as SpatieActivity;

class Audit extends SpatieActivity
{
    protected $table = 'activity_log';

    public function getUserNameAttribute(): string
    {
        $causer = $this->causer;
        if (!$causer) {
            return 'System';
        }

        if (isset($causer->name)) {
            return $causer->name;
        }

        if (isset($causer->first_name)) {
            return trim("{$causer->first_name} {$causer->last_name}");
        }

        return 'Unknown';
    }

    public function getModelNameAttribute(): string
    {
        $subjectType = $this->subject_type ?? 'N/A';
        $className = class_basename($subjectType);
        return str_replace('_', ' ', \Illuminate\Support\Str::snake($className));
    }

    public function getEventBadgeAttribute(): string
    {
        $event = $this->event ?? $this->description ?? 'info';
        return match($event) {
            'created' => 'success',
            'updated' => 'warning',
            'deleted' => 'danger',
            'restored' => 'info',
            default => 'gray'
        };
    }

    public function getEventLabelAttribute(): string
    {
        return ucfirst($this->event ?? $this->description ?? 'Log');
    }
}
