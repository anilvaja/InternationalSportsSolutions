<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Auditable;

class OrganizationHoliday extends Model
{
    use HasFactory, SoftDeletes, Auditable;

    protected $fillable = [
        'academy_id',
        'title',
        'holiday_date',
        'type',
        'year',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'holiday_date' => 'date',
            'year' => 'integer',
        ];
    }

    public function scopeForAcademy($query, $academyId)
    {
        return $query->where(function ($q) use ($academyId) {
            $q->whereNull('academy_id')->orWhere('academy_id', $academyId);
        });
    }

    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }
}
