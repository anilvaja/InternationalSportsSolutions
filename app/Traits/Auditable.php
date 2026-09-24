<?php

namespace App\Traits;

use App\Models\Audit;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

trait Auditable
{
    public static function bootAuditable()
    {
        static::created(function ($model) {
            $model->auditActivity('created');
        });

        static::updated(function ($model) {
            $model->auditActivity('updated');
        });

        static::deleted(function ($model) {
            $model->auditActivity('deleted');
        });

        if (method_exists(static::class, 'restored')) {
            static::restored(function ($model) {
                $model->auditActivity('restored');
            });
        }
    }

    public function auditActivity(string $event)
    {
        $user = $this->getAuditUser();
        
        $activity = activity()
            ->performedOn($this)
            ->event($event);

        if ($user) {
            $activity->causedBy($user);
        }

        $properties = [
            'url' => Request::fullUrl(),
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
        ];

        if ($event === 'updated') {
            $properties['old'] = $this->normalizeAuditValues($this->getOriginal());
            $properties['attributes'] = $this->normalizeAuditValues($this->getAttributes());
        } elseif ($event === 'created' || $event === 'restored') {
            $properties['attributes'] = $this->normalizeAuditValues($this->getAttributes());
        } elseif ($event === 'deleted') {
            $properties['old'] = $this->normalizeAuditValues($this->getAttributes());
        }

        $activity->withProperties($properties)
            ->log($event);
    }

    protected function getAuditUser()
    {
        if (Auth::guard('web')->check()) {
            return Auth::guard('web')->user();
        }
        
        if (Auth::guard('academy')->check()) {
            return Auth::guard('academy')->user();
        }

        if (Auth::guard('student')->check()) {
            return Auth::guard('student')->user();
        }

        return null;
    }

    protected function getAuditTags(): array
    {
        return [];
    }

    protected function normalizeAuditValues(?array $values): ?array
    {
        if (!$values) {
            return $values;
        }

        $normalized = [];
        foreach ($values as $key => $value) {
            if ($this->isAuditDateField($key) && $value !== null) {
                try {
                    $carbonDate = \Carbon\Carbon::parse($value);
                    $normalized[$key] = $carbonDate->format('Y-m-d H:i:s');
                } catch (\Exception $e) {
                    $normalized[$key] = $value;
                }
            } else {
                $normalized[$key] = $value;
            }
        }

        return $normalized;
    }

    protected function isAuditDateField(string $key): bool
    {
        if (in_array($key, ['created_at', 'updated_at', 'deleted_at'])) {
            return true;
        }

        if (property_exists($this, 'dates') && in_array($key, $this->dates)) {
            return true;
        }

        if (isset($this->casts[$key]) && in_array($this->casts[$key], ['date', 'datetime', 'timestamp'])) {
            return true;
        }

        if (preg_match('/_(at|date|time)$/', $key)) {
            return true;
        }

        return false;
    }

    public function audits()
    {
        return $this->morphMany(Audit::class, 'subject')->latest();
    }
}
