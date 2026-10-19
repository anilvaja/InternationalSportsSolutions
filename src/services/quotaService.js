import { getCentralDb } from '../db/centralDb.js';
import { getTenantDbById } from '../db/connectionManager.js';

export const STANDARD_QUOTA_KEYS = [
  'users',
  'branches',
  'batches',
  'students',
  'students_per_batch',
  'coaches',
];

export const DEFAULT_PLAN_VALUES = {
  users: 10,
  branches: 2,
  batches: 10,
  students: 200,
  students_per_batch: 30,
  coaches: 5,
};

export class QuotaService {
  /**
   * Resolves an academy's effective limit for a quota key using precedence:
   * 1. Valid academy-specific override (active now)
   * 2. Active assigned subscription plan's limit
   * 3. Legacy academy column fallback
   * 4. Platform default or deny (0)
   */
  static effectiveLimit(academyId, quotaKey) {
    const centralDb = getCentralDb();
    const now = new Date().toISOString();

    // 1. Academy-specific override (effective now)
    const override = centralDb.prepare(`
      SELECT override_value
      FROM academy_limit_overrides
      WHERE academy_id = ?
        AND quota_key = ?
        AND (starts_at IS NULL OR starts_at <= ?)
        AND (ends_at IS NULL OR ends_at >= ?)
      ORDER BY id DESC
      LIMIT 1
    `).get(academyId, quotaKey, now, now);

    if (override && override.override_value !== null && override.override_value !== undefined) {
      return Number(override.override_value);
    }

    // 2. Active subscription plan limit
    const subscription = centralDb.prepare(`
      SELECT plan_id
      FROM academy_subscriptions
      WHERE academy_id = ?
        AND status IN ('active', 'trial')
        AND (ends_at IS NULL OR ends_at >= ?)
      ORDER BY id DESC
      LIMIT 1
    `).get(academyId, now);

    if (subscription) {
      const planLimit = centralDb.prepare(`
        SELECT limit_value
        FROM subscription_plan_limits
        WHERE plan_id = ? AND quota_key = ?
      `).get(subscription.plan_id, quotaKey);

      if (planLimit && planLimit.limit_value !== null && planLimit.limit_value !== undefined) {
        return Number(planLimit.limit_value);
      }
    }

    // 3. Fallback to legacy academy columns
    const academy = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(academyId);
    if (academy) {
      const legacyMap = {
        users: academy.max_users,
        branches: academy.max_branches,
        batches: academy.max_batches,
        students: academy.max_students,
        coaches: academy.max_coaches,
      };

      if (legacyMap[quotaKey] !== undefined && legacyMap[quotaKey] !== null) {
        return Number(legacyMap[quotaKey]);
      }
    }

    // 4. Platform default values fallback
    if (DEFAULT_PLAN_VALUES[quotaKey] !== undefined) {
      if (academy && academy.plan === 'enterprise') {
        if (quotaKey === 'batches') return 50;
        if (quotaKey === 'users') return 25;
      }
      return DEFAULT_PLAN_VALUES[quotaKey];
    }

    // Strict deny: If unconfigured, do not silently allow infinite creation
    return 0;
  }

  /**
   * Calculates current usage from tenant database according to active/inactive counting policy.
   * Does NOT double-count users with multiple roles.
   */
  static usage(academyId, quotaKey, context = {}) {
    try {
      const tenantDb = getTenantDbById(academyId);

      switch (quotaKey) {
        case 'users': {
          // Count active distinct staff/users belonging to academy
          const row = tenantDb.prepare(`
            SELECT COUNT(DISTINCT email) as c
            FROM users
            WHERE (status IS NULL OR status = 'active')
          `).get();
          return row ? Number(row.c) : 0;
        }

        case 'branches': {
          const row = tenantDb.prepare(`
            SELECT COUNT(*) as c
            FROM branches
            WHERE is_active = 1
          `).get();
          return row ? Number(row.c) : 0;
        }

        case 'batches': {
          const row = tenantDb.prepare(`
            SELECT COUNT(*) as c
            FROM batches
            WHERE is_active = 1
          `).get();
          return row ? Number(row.c) : 0;
        }

        case 'students': {
          const row = tenantDb.prepare(`
            SELECT COUNT(*) as c
            FROM students
            WHERE status = 'active'
          `).get();
          return row ? Number(row.c) : 0;
        }

        case 'students_per_batch': {
          if (!context.batchId) return 0;
          const row = tenantDb.prepare(`
            SELECT COUNT(*) as c
            FROM student_batch_enrollments
            WHERE batch_id = ? AND status = 'active'
          `).get(Number(context.batchId));
          return row ? Number(row.c) : 0;
        }

        case 'coaches': {
          const row = tenantDb.prepare(`
            SELECT COUNT(*) as c
            FROM coaches
            WHERE is_active = 1
          `).get();
          return row ? Number(row.c) : 0;
        }

        default:
          return 0;
      }
    } catch (e) {
      console.warn(`[QuotaService.usage] Error computing usage for academy ${academyId}, quota ${quotaKey}:`, e.message);
      return 0;
    }
  }

  /**
   * Calculates remaining capacity for an academy
   */
  static remaining(academyId, quotaKey, context = {}) {
    const limit = this.effectiveLimit(academyId, quotaKey);
    const used = this.usage(academyId, quotaKey, context);
    return Math.max(0, limit - used);
  }

  /**
   * Asserts that an academy can create `quantity` units of a quota resource.
   * Throws Error if quota would be exceeded or subscription is inactive.
   */
  static assertCanCreate(academyId, quotaKey, quantity = 1, context = {}) {
    if (quantity <= 0) {
      throw new Error('Requested resource quantity must be a positive integer');
    }

    const centralDb = getCentralDb();
    const now = new Date().toISOString();

    // Check academy subscription status
    const subscription = centralDb.prepare(`
      SELECT status, ends_at
      FROM academy_subscriptions
      WHERE academy_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(academyId);

    if (subscription) {
      if (['expired', 'suspended', 'cancelled'].includes(subscription.status)) {
        throw new Error(
          `Your academy subscription is currently ${subscription.status}. New resource creation is disabled. Please contact the platform administrator.`
        );
      }
      if (subscription.ends_at && new Date(subscription.ends_at) < new Date(now)) {
        throw new Error(
          'Your academy subscription has expired. New resource creation is disabled. Please renew your plan.'
        );
      }
    }

    const limit = this.effectiveLimit(academyId, quotaKey);
    const current = this.usage(academyId, quotaKey, context);

    if (current + quantity > limit) {
      const resourceLabels = {
        users: 'users',
        branches: 'branches',
        batches: 'batches',
        students: 'students',
        students_per_batch: 'students in this batch',
        coaches: 'coaches',
      };
      const label = resourceLabels[quotaKey] || quotaKey;
      throw new Error(
        `Your academy has reached its maximum of ${limit} ${label} under the current subscription (current usage: ${current}). Contact the platform administrator to increase your limit.`
      );
    }
  }

  /**
   * Concurrency-safe atomic execution wrapper using database transaction lock.
   */
  static executeWithQuotaLock(academyId, quotaKey, quantity, context, actionFn) {
    const tenantDb = getTenantDbById(academyId);

    // Using tenantDb.transaction guarantees atomic check-and-insert
    const tx = tenantDb.transaction(() => {
      this.assertCanCreate(academyId, quotaKey, quantity, context);
      return actionFn(tenantDb);
    });

    return tx();
  }

  /**
   * Generates a complete usage and limit summary across all 6 standard quotas.
   */
  static getAcademyQuotaSummary(academyId) {
    const summary = {};

    for (const key of STANDARD_QUOTA_KEYS) {
      const limit = this.effectiveLimit(academyId, key);
      const usage = this.usage(academyId, key);
      const remaining = Math.max(0, limit - usage);
      const isOverLimit = usage > limit;

      summary[key] = {
        quota_key: key,
        limit,
        usage,
        remaining,
        is_over_limit: isOverLimit,
        percentage: limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 100,
      };
    }

    return summary;
  }

  /**
   * Checks whether an academy has a specific feature enabled (with override precedence).
   */
  static isFeatureEnabled(academyId, featureKey) {
    const centralDb = getCentralDb();
    const now = new Date().toISOString();

    // 1. Academy feature override
    const override = centralDb.prepare(`
      SELECT is_enabled
      FROM academy_feature_overrides
      WHERE academy_id = ?
        AND feature_key = ?
        AND (starts_at IS NULL OR starts_at <= ?)
        AND (ends_at IS NULL OR ends_at >= ?)
      ORDER BY id DESC
      LIMIT 1
    `).get(academyId, featureKey, now, now);

    if (override) {
      return Boolean(override.is_enabled);
    }

    // 2. Plan feature entitlement
    const sub = centralDb.prepare(`
      SELECT plan_id
      FROM academy_subscriptions
      WHERE academy_id = ?
        AND status IN ('active', 'trial')
        AND (ends_at IS NULL OR ends_at >= ?)
      ORDER BY id DESC
      LIMIT 1
    `).get(academyId, now);

    if (sub) {
      const feature = centralDb.prepare(`
        SELECT is_enabled
        FROM subscription_plan_features
        WHERE plan_id = ? AND feature_key = ?
      `).get(sub.plan_id, featureKey);

      if (feature) {
        return Boolean(feature.is_enabled);
      }
    }

    // Default enabled for core legacy features
    return true;
  }

  /**
   * Records administrative actions in central_audit_logs.
   */
  static logAudit(userId, userEmail, action, entity, entityId, details, ipAddress = null) {
    try {
      const centralDb = getCentralDb();
      centralDb.prepare(`
        INSERT INTO central_audit_logs (user_id, user_email, action, entity, entity_id, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId || null, userEmail || 'system', action, entity, String(entityId), details, ipAddress);
    } catch (e) {
      console.warn('[QuotaService.logAudit] Failed to log audit:', e.message);
    }
  }
}
