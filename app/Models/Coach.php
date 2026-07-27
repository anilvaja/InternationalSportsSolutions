<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Auditable;

class Coach extends Model
{
    use HasFactory, SoftDeletes, Auditable;

    protected $fillable = [
        'coach_id',
        'user_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'date_of_birth',
        'gender',
        'address',
        'city',
        'state',
        'postal_code',
        'country',
        'specializations',
        'certifications',
        'years_of_experience',
        'belt_level',
        'bio',
        'hire_date',
        'employment_type',
        'hourly_rate',
        'monthly_salary',
        'status',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_relationship',
        'availability',
        'max_students_per_batch',
        'photo',
        'documents',
        'rating',
        'total_students_trained',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'hire_date' => 'date',
            'specializations' => 'array',
            'certifications' => 'array',
            'availability' => 'array',
            'documents' => 'array',
            'hourly_rate' => 'decimal:2',
            'monthly_salary' => 'decimal:2',
            'rating' => 'decimal:2',
            'years_of_experience' => 'integer',
            'max_students_per_batch' => 'integer',
            'total_students_trained' => 'integer',
        ];
    }

    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function primaryBatches(): HasMany
    {
        return $this->hasMany(Batch::class, 'primary_coach_id');
    }
}

