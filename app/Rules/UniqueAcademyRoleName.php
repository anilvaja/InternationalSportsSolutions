<?php

namespace App\Rules;

use App\Models\AcademyRole;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class UniqueAcademyRoleName implements ValidationRule
{
    protected $academyId;
    protected $excludeId;

    public function __construct($academyId, $excludeId = null)
    {
        $this->academyId = $academyId;
        $this->excludeId = $excludeId;
    }

    /**
     * Run the validation rule.
     *
     * @param  \Closure(string): \Illuminate\Translation\PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $query = AcademyRole::where('academy_id', $this->academyId)
            ->where('name', $value);

        if ($this->excludeId) {
            $query->where('id', '!=', $this->excludeId);
        }

        if ($query->exists()) {
            $fail('The role name must be unique within this academy.');
        }
    }
}
