<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Str;

class SyllabusTechnique extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'academy_id',
        'category_id',
        'name',
        'slug',
        'description',
        'instructions',
        'sort_order',
        'difficulty_level',
        'estimated_learning_time_minutes',
        'key_points',
        'common_mistakes',
        'prerequisites',
        'video_url',
        'images',
        'diagram',
        'evaluation_criteria',
        'requires_partner',
        'requires_equipment',
        'required_equipment',
        'teaching_tips',
        'variations',
        'progressions',
        'status',
    ];

    protected $casts = [
        'key_points' => 'array',
        'common_mistakes' => 'array',
        'prerequisites' => 'array',
        'images' => 'array',
        'evaluation_criteria' => 'array',
        'required_equipment' => 'array',
        'variations' => 'array',
        'progressions' => 'array',
        'requires_partner' => 'boolean',
        'requires_equipment' => 'boolean',
        'sort_order' => 'integer',
        'estimated_learning_time_minutes' => 'integer',
    ];

    // Auto-generate slug from name
    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->slug)) {
                $model->slug = Str::slug($model->name);
            }
        });
    }

    // Relationships
    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(SyllabusCategory::class);
    }

    public function studentProgress(): HasMany
    {
        return $this->hasMany(StudentTechniqueProgress::class, 'technique_id');
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

    public function scopeByDifficulty($query, $level)
    {
        return $query->where('difficulty_level', $level);
    }

    public function scopeRequiresPartner($query)
    {
        return $query->where('requires_partner', true);
    }

    public function scopeRequiresEquipment($query)
    {
        return $query->where('requires_equipment', true);
    }

    // Helper methods
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function hasVideo(): bool
    {
        return !empty($this->video_url);
    }

    public function hasImages(): bool
    {
        return !empty($this->images) && count($this->images) > 0;
    }

    public function getEstimatedLearningTimeFormatted(): string
    {
        if (!$this->estimated_learning_time_minutes) {
            return 'Not specified';
        }
        
        $hours = intval($this->estimated_learning_time_minutes / 60);
        $minutes = $this->estimated_learning_time_minutes % 60;
        
        if ($hours > 0) {
            return $hours . 'h ' . $minutes . 'm';
        }
        
        return $minutes . ' minutes';
    }
}
