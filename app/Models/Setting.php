<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

class Setting extends Model
{
    use Auditable;
    
    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
        'label',
        'description',
        'is_encrypted'
    ];

    protected $casts = [
        'is_encrypted' => 'boolean',
    ];

    /**
     * Get a setting value by key
     */
    public static function get(string $key, $default = null)
    {
        $cacheKey = "setting.{$key}";
        
        return Cache::rememberForever($cacheKey, function () use ($key, $default) {
            try {
                $setting = static::where('key', $key)->first();
            } catch (\Throwable $e) {
                return $default;
            }
            
            if (!$setting) {
                return $default;
            }
            
            $value = $setting->is_encrypted ? Crypt::decrypt($setting->value) : $setting->value;
            
            return match($setting->type) {
                'boolean' => (bool) $value,
                'integer' => (int) $value,
                'json' => json_decode($value, true),
                default => $value,
            };
        });
    }

    /**
     * Set a setting value
     */
    public static function set(string $key, $value, string $type = 'string', string $group = 'general', bool $encrypt = false): void
    {
        $processedValue = match($type) {
            'boolean' => $value ? '1' : '0',
            'json' => json_encode($value),
            default => (string) $value,
        };

        if ($encrypt) {
            $processedValue = Crypt::encrypt($processedValue);
        }

        static::updateOrCreate(
            ['key' => $key],
            [
                'value' => $processedValue,
                'type' => $type,
                'group' => $group,
                'is_encrypted' => $encrypt,
            ]
        );

        Cache::forget("setting.{$key}");
    }

    /**
     * Get all settings for a group
     */
    public static function getGroup(string $group): array
    {
        $settings = static::where('group', $group)->get();
        $result = [];

        foreach ($settings as $setting) {
            $value = $setting->is_encrypted ? Crypt::decrypt($setting->value) : $setting->value;
            
            $result[$setting->key] = match($setting->type) {
                'boolean' => (bool) $value,
                'integer' => (int) $value,
                'json' => json_decode($value, true),
                default => $value,
            };
        }

        return $result;
    }

    /**
     * Clear settings cache
     */
    public static function clearCache(): void
    {
        Cache::flush();
    }
}
