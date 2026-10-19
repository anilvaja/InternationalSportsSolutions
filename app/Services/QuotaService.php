<?php

namespace App\Services;

use App\Models\Academy;
use App\Models\AcademyLimitOverride;
use App\Models\AcademySubscription;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\Coach;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuotaService
{
    /**
     * Resolves the effective limit for a given quota key using precedence:
     * 1. Valid academy-specific override (effective now)
     * 2. Active assigned subscription plan limit
     * 3. Legacy academy column fallback
     * 4. Platform default (or 0 / reject)
     */
    public function effectiveLimit(Academy $academy, string $quotaKey): int
    {
        $now = now();

        // 1. Check for valid academy-specific override
        $override = AcademyLimitOverride::where('academy_id', $academy->id)
            ->where('quota_key', $quotaKey)
            ->where(function ($query) use ($now) {
                $query->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($query) use ($now) {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->orderBy('id', 'desc')
            ->first();

        if ($override) {
            return (int) $override->override_value;
        }

        // 2. Check for active assigned subscription plan
        $subscription = AcademySubscription::with(['plan.limits'])
            ->where('academy_id', $academy->id)
            ->whereIn('status', ['active', 'trial'])
            ->where(function ($query) use ($now) {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->latest()
            ->first();

        if ($subscription && $subscription->plan) {
            $planLimit = $subscription->plan->limits
                ->where('quota_key', $quotaKey)
                ->first();

            if ($planLimit) {
                return (int) $planLimit->limit_value;
            }
        }

        // 3. Fallback to legacy academy columns if available
        $legacyMap = [
            'users' => 'max_users',
            'branches' => 'max_branches',
            'batches' => 'max_batches',
            'students' => 'max_students',
            'coaches' => 'max_coaches',
        ];

        if (isset($legacyMap[$quotaKey]) && isset($academy->{$legacyMap[$quotaKey]})) {
            return (int) $academy->{$legacyMap[$quotaKey]};
        }

        if ($quotaKey === 'students_per_batch') {
            return 30; // Standard default batch capacity
        }

        // Default strict fallback
        return 0;
    }

    /**
     * Calculates the current active usage for an academy and quota key.
     * Respects documented active/inactive counting policy without double counting.
     */
    public function usage(Academy $academy, string $quotaKey, ?int $batchId = null): int
    {
        return match ($quotaKey) {
            'users' => User::where('academy_id', $academy->id)
                ->where(function ($q) {
                    $q->whereNull('status')->orWhere('status', 'active');
                })
                ->count(),

            'branches' => Branch::where('academy_id', $academy->id)
                ->where('is_active', true)
                ->count(),

            'batches' => Batch::where('academy_id', $academy->id)
                ->where('is_active', true)
                ->count(),

            'students' => Student::where('academy_id', $academy->id)
                ->where('status', 'active')
                ->count(),

            'students_per_batch' => $batchId
                ? DB::table('batch_students')
                    ->where('batch_id', $batchId)
                    ->where('status', 'active')
                    ->count()
                : 0,

            'coaches' => Coach::where('academy_id', $academy->id)
                ->where('is_active', true)
                ->count(),

            default => 0,
        };
    }

    /**
     * Computes the remaining capacity for a quota.
     */
    public function remaining(Academy $academy, string $quotaKey, ?int $batchId = null): int
    {
        $limit = $this->effectiveLimit($academy, $quotaKey);
        $current = $this->usage($academy, $quotaKey, $batchId);
        return max(0, $limit - $current);
    }

    /**
     * Asserts that the academy can create the requested quantity of resources.
     * Throws a ValidationException if limit would be exceeded or subscription is inactive.
     *
     * @throws ValidationException
     */
    public function assertCanCreate(
        Academy $academy,
        string $quotaKey,
        int $quantity = 1,
        ?int $batchId = null,
        array $context = []
    ): void {
        if ($quantity <= 0) {
            throw ValidationException::withMessages([
                'quantity' => 'Quantity to allocate must be a positive integer.',
            ]);
        }

        // Verify subscription status policy: expired or suspended subscriptions cannot create resources
        $subscription = AcademySubscription::where('academy_id', $academy->id)
            ->latest()
            ->first();

        if ($subscription && in_array($subscription->status, ['expired', 'suspended', 'cancelled'])) {
            throw ValidationException::withMessages([
                'subscription' => "Your academy subscription is currently {$subscription->status}. New resource creation is locked. Please renew or contact support.",
            ]);
        }

        $limit = $this->effectiveLimit($academy, $quotaKey);
        $current = $this->usage($academy, $quotaKey, $batchId);

        if ($current + $quantity > $limit) {
            $resourceLabel = ucwords(str_replace('_', ' ', $quotaKey));
            throw ValidationException::withMessages([
                $quotaKey => "Your academy has reached its maximum quota of {$limit} {$resourceLabel} (current usage: {$current}). Contact the platform administrator to increase your limit.",
            ]);
        }
    }

    /**
     * Aggregates usage and limit summary for all standard quotas.
     */
    public function summary(Academy $academy): array
    {
        $keys = ['users', 'branches', 'batches', 'students', 'students_per_batch', 'coaches'];
        $result = [];

        foreach ($keys as $key) {
            $limit = $this->effectiveLimit($academy, $key);
            $usage = $this->usage($academy, $key);
            $remaining = max(0, $limit - $usage);
            $isOverLimit = $usage > $limit;

            $result[$key] = [
                'quota_key' => $key,
                'limit' => $limit,
                'usage' => $usage,
                'remaining' => $remaining,
                'is_over_limit' => $isOverLimit,
                'percentage' => $limit > 0 ? min(100, round(($usage / $limit) * 100, 1)) : 100,
            ];
        }

        return $result;
    }
}
