<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Str;

class SyllabusCategory extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'academy_id',
        'name',
        'slug',
        'description',
        'parent_id',
        'sort_order',
        'belt_level',
        'age_group',
        'difficulty_level',
        'estimated_duration_minutes',
        'prerequisites',
        'icon',
        'color',
        'status',
    ];

    protected $casts = [
        'prerequisites' => 'array',
        'sort_order' => 'integer',
        'estimated_duration_minutes' => 'integer',
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

    public function parent(): BelongsTo
    {
        return $this->belongsTo(SyllabusCategory::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(SyllabusCategory::class, 'parent_id')->orderBy('sort_order');
    }

    public function techniques(): HasMany
    {
        return $this->hasMany(SyllabusTechnique::class, 'category_id')->orderBy('sort_order');
    }

    public function batches(): BelongsToMany
    {
        return $this->belongsToMany(Batch::class, 'batch_syllabus_categories')
            ->withPivot(['sort_order', 'is_primary', 'notes'])
            ->withTimestamps();
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

    public function scopeRootCategories($query)
    {
        return $query->whereNull('parent_id');
    }

    public function scopeByDifficulty($query, $level)
    {
        return $query->where('difficulty_level', $level);
    }

    // Helper methods
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function hasChildren(): bool
    {
        return $this->children()->count() > 0;
    }

    public function getTechniqueCount(): int
    {
        return $this->techniques()->count();
    }
}
