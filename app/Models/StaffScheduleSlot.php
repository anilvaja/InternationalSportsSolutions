<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class StaffScheduleSlot extends Model
{
    use HasFactory;

    protected $fillable = [
        'academy_id',
        'user_id',
        'day_of_week',
        'slot_name',
        'start_time',
        'end_time',
        'slot_duration_minutes',
    ];

    protected function casts(): array
    {
        return [
            'slot_duration_minutes' => 'integer',
        ];
    }

    public function scopeForAcademy($query, $academyId)
    {
        return $query->where('academy_id', $academyId);
    }

    public function academy(): BelongsTo
    {
        return $this->belongsTo(Academy::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected static function boot()
    {
        parent::boot();

        static::saving(function (StaffScheduleSlot $slot) {
            if ($slot->start_time && $slot->end_time) {
                $start = Carbon::parse($slot->start_time);
                $end = Carbon::parse($slot->end_time);
                $slot->slot_duration_minutes = (int) abs($end->diffInMinutes($start));
            }
        });
    }
}
