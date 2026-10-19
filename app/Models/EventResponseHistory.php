<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EventResponseHistory extends Model
{
    public $timestamps = false;
    protected $table = 'event_response_history';

    protected $fillable = [
        'event_id',
        'student_id',
        'previous_status',
        'new_status',
        'previous_registration_status',
        'new_registration_status',
        'notes',
        'changed_by_type',
        'changed_by_id',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
