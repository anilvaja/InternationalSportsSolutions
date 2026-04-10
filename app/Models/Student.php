<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Filament\Models\Contracts\HasName;
use App\Traits\Auditable;

class Student extends Authenticatable implements HasName
{
    use HasFactory, SoftDeletes, Notifiable, Auditable;

    protected $fillable = [
        'student_id',
        'first_name',
        'last_name',
        'email',
        'password',
        'phone',
        'date_of_birth',
        'gender',
        'address',
        'city',
        'state',
        'postal_code',
        'country',
        'parent_name',
        'parent_phone',
        'parent_email',
        'parent_relationship',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_relationship',
        'medical_conditions',
        'allergies',
        'medications',
        'blood_group',
        'dietary_restrictions',
        'academy_id',
        'branch_id',
        'enrollment_date',
        'status',
        'belt_level',
        'notes',
        'photo',
        'documents',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'enrollment_date' => 'date',
        'documents' => 'array',
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'first_name' => 'string',
        'last_name' => 'string',
    ];

    // Relationships
    public function academy(): HasOneThrough
    {
        return $this->hasOneThrough(Academy::class, Branch::class, 'id', 'id', 'branch_id', 'academy_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    // Scopes
    public function scopeForAcademy($query, $academyId)
    {
        return $query->where('academy_id', $academyId);
    }

    public function batches(): BelongsToMany
    {
        return $this->belongsToMany(Batch::class, 'batch_students')
            ->withPivot([
                'joined_at',
                'left_at',
                'is_active',
                'notes'
            ])
            ->withTimestamps();
    }

    public function activeBatches(): BelongsToMany
    {
        return $this->batches()->wherePivot('is_active', true);
    }

    public function studentAttendances(): HasMany
    {
        return $this->hasMany(StudentAttendance::class);
    }

    public function techniqueProgress(): HasMany
    {
        return $this->hasMany(StudentTechniqueProgress::class);
    }

    public function fees(): HasMany
    {
        return $this->hasMany(Fee::class);
    }

    public function studentFees(): HasMany
    {
        return $this->hasMany(StudentFee::class);
    }

    public function paidFees(): HasMany
    {
        return $this->fees()->where('status', 'paid');
    }

    public function paidStudentFees(): HasMany
    {
        return $this->studentFees()->where('status', 'paid');
    }

    public function overdueStudentFees(): HasMany
    {
        return $this->studentFees()->overdue();
    }

    // Helper methods
    public function getFullNameAttribute(): string
    {
        $firstName = $this->first_name ?? '';
        $lastName = $this->last_name ?? '';
        
        // Ensure we're working with strings, not arrays
        if (is_array($firstName)) {
            $firstName = is_string($firstName[0] ?? '') ? $firstName[0] : '';
        }
        if (is_array($lastName)) {
            $lastName = is_string($lastName[0] ?? '') ? $lastName[0] : '';
        }
        
        // Additional safety: ensure we have strings
        $firstName = (string) $firstName;
        $lastName = (string) $lastName;
        
        $fullName = trim($firstName . ' ' . $lastName);
        return $fullName ?: 'Student';
    }

    public function getName(): string
    {
        return $this->getFullNameAttribute();
    }

    public function getFilamentName(): string
    {
        $name = $this->getName();
        
        // Ensure we always return a string, never an array
        if (is_array($name)) {
            return 'Student';
        }
        
        return $name ?: 'Student';
    }

    public function getSafeFullName(): string
    {
        $firstName = $this->getAttribute('first_name');
        $lastName = $this->getAttribute('last_name');
        
        // Handle any type conversion issues
        $firstName = is_string($firstName) ? $firstName : (is_array($firstName) ? ($firstName[0] ?? '') : '');
        $lastName = is_string($lastName) ? $lastName : (is_array($lastName) ? ($lastName[0] ?? '') : '');
        
        $fullName = trim($firstName . ' ' . $lastName);
        return $fullName ?: 'Student';
    }

    public function getAgeAttribute(): int
    {
        return $this->date_of_birth ? $this->date_of_birth->age : 0;
    }

    public function getCurrentBatches()
    {
        return $this->batches()->wherePivot('is_active', true);
    }

    public function getLastTechniqueLearnedInBatch($batchId)
    {
        $pivot = $this->batches()->wherePivot('batch_id', $batchId)->first()?->pivot;
        
        if ($pivot && $pivot->last_technique_learned_id) {
            return SyllabusTechnique::find($pivot->last_technique_learned_id);
        }
        
        return null;
    }

    public function hasActiveBatchEnrollment(): bool
    {
        return $this->activeBatches()->exists();
    }

    public function getActiveBatch()
    {
        return $this->activeBatches()->first();
    }

    public function getTechniqueProgressInBatch($batchId)
    {
        return $this->techniqueProgress()
            ->where('batch_id', $batchId)
            ->with('syllabustechnique')
            ->get();
    }

    public function notifications(): MorphMany
    {
        return $this->morphMany(Notification::class, 'notifiable');
    }

    public function eventParticipations(): HasMany
    {
        return $this->hasMany(EventParticipant::class);
    }

    public function events(): BelongsToMany
    {
        return $this->belongsToMany(Event::class, 'event_participants')
            ->withPivot(['status', 'responded_at', 'response_notes', 'payment_status', 'amount_paid'])
            ->withTimestamps();
    }

    public function eventFees(): HasMany
    {
        return $this->hasMany(EventFee::class);
    }

    public function getAttendanceRate($batchId = null): float
    {
        $query = $this->attendances();
        
        if ($batchId) {
            $query->where('batch_id', $batchId);
        }
        
        $totalClasses = $query->count();
        $presentClasses = $query->whereIn('status', ['present', 'late'])->count();
        
        return $totalClasses > 0 ? ($presentClasses / $totalClasses) * 100 : 0;
    }

    public function getUnreadNotificationsCount(): int
    {
        return $this->notifications()->whereNull('read_at')->count();
    }
}
