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
        
        Audit::create([
            'user_type' => $user ? get_class($user) : null,
            'user_id' => $user ? $user->id : null,
            'event' => $event,
            'auditable_type' => get_class($this),
            'auditable_id' => $this->id,
            'old_values' => $event === 'updated' ? $this->normalizeAuditValues($this->getOriginal()) : ($event === 'deleted' ? $this->normalizeAuditValues($this->getAttributes()) : null),
            'new_values' => $event === 'created' || $event === 'updated' || $event === 'restored' ? $this->normalizeAuditValues($this->getAttributes()) : null,
            'url' => Request::fullUrl(),
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
            'tags' => $this->getAuditTags(),
        ]);
    }

    protected function getAuditUser()
    {
        // Try to get authenticated user from different guards
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

    /**
     * Normalize audit values to ensure consistent datetime formatting
     */
    protected function normalizeAuditValues(?array $values): ?array
    {
        if (!$values) {
            return $values;
        }

        $normalized = [];
        foreach ($values as $key => $value) {
            // Handle datetime fields consistently
            if ($this->isAuditDateField($key) && $value !== null) {
                try {
                    // Convert to Carbon and format consistently
                    $carbonDate = \Carbon\Carbon::parse($value);
                    $normalized[$key] = $carbonDate->format('Y-m-d H:i:s');
                } catch (\Exception $e) {
                    // If parsing fails, keep the original value
                    $normalized[$key] = $value;
                }
            } else {
                $normalized[$key] = $value;
            }
        }

        return $normalized;
    }

    /**
     * Check if an attribute is a date attribute for audit purposes
     */
    protected function isAuditDateField(string $key): bool
    {
        // Check if it's a default timestamp field
        if (in_array($key, ['created_at', 'updated_at', 'deleted_at'])) {
            return true;
        }

        // Check if it's in the model's dates array
        if (property_exists($this, 'dates') && in_array($key, $this->dates)) {
            return true;
        }

        // Check if it's a date cast
        if (isset($this->casts[$key]) && in_array($this->casts[$key], ['date', 'datetime', 'timestamp'])) {
            return true;
        }

        // Check if it ends with common date field suffixes
        if (preg_match('/_(at|date|time)$/', $key)) {
            return true;
        }

        return false;
    }

    public function audits()
    {
        return $this->morphMany(Audit::class, 'auditable')->latest();
    }
}
