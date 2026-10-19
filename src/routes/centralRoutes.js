import express from 'express';
import fs from 'fs';
import { getCentralDb } from '../db/centralDb.js';
import { provisionAcademyDb, getTenantDbById, closeTenantDb } from '../db/connectionManager.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { streamAcademyBackup, streamCentralPlatformBackup } from '../services/backupService.js';
import { QuotaService, STANDARD_QUOTA_KEYS, DEFAULT_PLAN_VALUES } from '../services/quotaService.js';

export const centralRouter = express.Router();

// Enforce Super Admin on all central routes
centralRouter.use(requireAuth, requireSuperAdmin);

/**
 * GET /api/central/stats
 */
centralRouter.get('/stats', (req, res) => {
  try {
    const centralDb = getCentralDb();
    const academies = centralDb.prepare('SELECT id, name, slug, status FROM academies').all();

    let totalStudents = 0;
    let totalCoaches = 0;
    let totalBatches = 0;

    // Aggregate metrics across isolated databases
    for (const ac of academies) {
      if (ac.status !== 'suspended') {
        try {
          const tenantDb = getTenantDbById(ac.id);
          const sCount = tenantDb.prepare('SELECT COUNT(*) as c FROM students').get().c;
          const cCount = tenantDb.prepare('SELECT COUNT(*) as c FROM coaches').get().c;
          const bCount = tenantDb.prepare('SELECT COUNT(*) as c FROM batches').get().c;
          totalStudents += sCount;
          totalCoaches += cCount;
          totalBatches += bCount;
        } catch (e) {
          console.warn(`Could not fetch stats for academy ${ac.id}:`, e.message);
        }
      }
    }

    res.json({
      success: true,
      stats: {
        totalAcademies: academies.length,
        activeAcademies: academies.filter(a => a.status === 'active').length,
        totalStudents,
        totalCoaches,
        totalBatches,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/central/academies
 */
centralRouter.get('/academies', (req, res) => {
  try {
    const centralDb = getCentralDb();
    const academies = centralDb.prepare(`
      SELECT id, name, slug, contact_email, contact_phone, city, plan,
             max_branches, max_students, max_coaches, status, created_at
      FROM academies
      ORDER BY created_at DESC
    `).all();

    // Enrich with live metrics from each tenant DB
    const enriched = academies.map(ac => {
      let studentCount = 0;
      let coachCount = 0;
      let branchCount = 0;

      if (ac.status !== 'suspended') {
        try {
          const tenantDb = getTenantDbById(ac.id);
          studentCount = tenantDb.prepare('SELECT COUNT(*) as c FROM students').get().c;
          coachCount = tenantDb.prepare('SELECT COUNT(*) as c FROM coaches').get().c;
          branchCount = tenantDb.prepare('SELECT COUNT(*) as c FROM branches').get().c;
        } catch (e) {
          // ignore error
        }
      }

      // Fetch registered domains and subdomains
      let domains = [];
      try {
        domains = centralDb.prepare(`
          SELECT id, domain, is_primary, is_custom, status, created_at
          FROM domains
          WHERE academy_id = ?
          ORDER BY is_primary DESC, created_at ASC
        `).all(ac.id);
      } catch (e) {}

      return {
        ...ac,
        domains,
        metrics: {
          students: studentCount,
          coaches: coachCount,
          branches: branchCount,
        },
      };
    });

    res.json({ success: true, academies: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/central/academies
 * Provisions a new isolated academy database
 */
centralRouter.post('/academies', (req, res) => {
  try {
    const {
      name,
      slug,
      contact_email,
      contact_phone,
      address,
      city,
      plan,
      max_branches,
      max_students,
      max_coaches,
      admin_name,
      admin_email,
      admin_password,
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, error: 'Academy name and slug are required' });
    }

    const academy = provisionAcademyDb({
      name,
      slug,
      contact_email,
      contact_phone,
      address,
      city,
      plan: plan || 'professional',
      max_branches: max_branches ? Number(max_branches) : 5,
      max_students: max_students ? Number(max_students) : 500,
      max_coaches: max_coaches ? Number(max_coaches) : 50,
      admin_name,
      admin_email,
      admin_password,
    });

    // If custom domain provided, register it
    const centralDb = getCentralDb();
    if (req.body.custom_domain && req.body.custom_domain.trim()) {
      const cd = req.body.custom_domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      try {
        centralDb.prepare(`
          INSERT OR IGNORE INTO domains (academy_id, domain, is_primary, is_custom, status)
          VALUES (?, ?, 0, 1, 'active')
        `).run(academy.id, cd);
      } catch (e) {}
    }

    // Central audit log
    centralDb.prepare(`
      INSERT INTO central_audit_logs (user_id, user_email, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, 'PROVISION_ACADEMY', 'academies', ?, ?, ?)
    `).run(req.user.userId, req.user.email, String(academy.id), `Provisioned new database for ${name}`, req.ip);

    res.status(201).json({
      success: true,
      message: `Academy '${name}' database created successfully`,
      academy: {
        id: academy.id,
        name: academy.name,
        slug: academy.slug,
        db_path: academy.db_path,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/central/academies/:id
 */
centralRouter.put('/academies/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, plan, status, max_branches, max_students, max_coaches, contact_email, contact_phone } = req.body;

    const centralDb = getCentralDb();
    const existing = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Academy not found' });
    }

    centralDb.prepare(`
      UPDATE academies
      SET name = COALESCE(?, name),
          plan = COALESCE(?, plan),
          status = COALESCE(?, status),
          max_branches = COALESCE(?, max_branches),
          max_students = COALESCE(?, max_students),
          max_coaches = COALESCE(?, max_coaches),
          contact_email = COALESCE(?, contact_email),
          contact_phone = COALESCE(?, contact_phone),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || null,
      plan || null,
      status || null,
      max_branches ? Number(max_branches) : null,
      max_students ? Number(max_students) : null,
      max_coaches ? Number(max_coaches) : null,
      contact_email || null,
      contact_phone || null,
      id
    );

    res.json({ success: true, message: 'Academy updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/central/academies/:id
 */
centralRouter.delete('/academies/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const centralDb = getCentralDb();
    const academy = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(id);
    if (!academy) {
      return res.status(404).json({ success: false, error: 'Academy not found' });
    }

    // Close open connection
    closeTenantDb(id);

    // Delete db file if exists
    if (academy.db_path && fs.existsSync(academy.db_path)) {
      try {
        fs.unlinkSync(academy.db_path);
      } catch (e) {
        console.warn(`Could not delete db file ${academy.db_path}:`, e.message);
      }
    }

    centralDb.prepare('DELETE FROM academies WHERE id = ?').run(id);

    res.json({ success: true, message: `Academy '${academy.name}' and its database removed` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/central/academies/:id/backup
 */
centralRouter.get('/academies/:id/backup', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await streamAcademyBackup(id, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

/**
 * GET /api/central/backup
 */
centralRouter.get('/backup', async (req, res) => {
  try {
    await streamCentralPlatformBackup(res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

/**
 * GET /api/central/audit-logs
 */
centralRouter.get('/audit-logs', (req, res) => {
  try {
    const centralDb = getCentralDb();
    const logs = centralDb.prepare('SELECT * FROM central_audit_logs ORDER BY created_at DESC LIMIT 100').all();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// DOMAIN & SUBDOMAIN MANAGEMENT ENDPOINTS
// ==========================================

/**
 * GET /api/central/academies/:id/domains
 * Lists all registered subdomains and custom domains for an academy
 */
centralRouter.get('/academies/:id/domains', (req, res) => {
  try {
    const id = Number(req.params.id);
    const centralDb = getCentralDb();
    const academy = centralDb.prepare('SELECT id, name, slug FROM academies WHERE id = ?').get(id);
    if (!academy) {
      return res.status(404).json({ success: false, error: 'Academy not found' });
    }

    const domains = centralDb.prepare(`
      SELECT id, domain, is_primary, is_custom, status, created_at, updated_at
      FROM domains
      WHERE academy_id = ?
      ORDER BY is_primary DESC, created_at ASC
    `).all(id);

    res.json({
      success: true,
      academy,
      defaultSubdomain: `${academy.slug}.internationalsportssolutions.test`,
      domains,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/central/academies/:id/domains
 * Registers a new domain or subdomain for an academy
 */
centralRouter.post('/academies/:id/domains', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { domain, is_primary, is_custom } = req.body;

    if (!domain || typeof domain !== 'string' || !domain.trim()) {
      return res.status(400).json({ success: false, error: 'Valid domain name is required' });
    }

    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    // Domain validation (must contain a dot or localhost)
    if (!cleanDomain.includes('.') && cleanDomain !== 'localhost') {
      return res.status(400).json({
        success: false,
        error: 'Domain must be a valid FQDN (e.g. sports.example.com or mysports.test)',
      });
    }

    const centralDb = getCentralDb();
    const academy = centralDb.prepare('SELECT id, name FROM academies WHERE id = ?').get(id);
    if (!academy) {
      return res.status(404).json({ success: false, error: 'Academy not found' });
    }

    // Check uniqueness across ALL academies
    const existing = centralDb.prepare(`
      SELECT d.*, a.name as academy_name
      FROM domains d
      JOIN academies a ON d.academy_id = a.id
      WHERE d.domain = ? COLLATE NOCASE
    `).get(cleanDomain);

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Domain '${cleanDomain}' is already registered to ${existing.academy_name} (ID: ${existing.academy_id})`,
      });
    }

    const primaryFlag = is_primary ? 1 : 0;
    const customFlag = is_custom !== undefined
      ? (is_custom ? 1 : 0)
      : (!cleanDomain.endsWith('.internationalsportssolutions.test') && !cleanDomain.endsWith('.localhost') ? 1 : 0);

    let newDomainId;
    const tx = centralDb.transaction(() => {
      if (primaryFlag === 1) {
        centralDb.prepare('UPDATE domains SET is_primary = 0 WHERE academy_id = ?').run(id);
      }
      const insert = centralDb.prepare(`
        INSERT INTO domains (academy_id, domain, is_primary, is_custom, status)
        VALUES (?, ?, ?, ?, 'active')
      `).run(id, cleanDomain, primaryFlag, customFlag);
      newDomainId = Number(insert.lastInsertRowid);
    });

    tx();

    // Central audit log
    centralDb.prepare(`
      INSERT INTO central_audit_logs (user_id, user_email, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, 'ADD_DOMAIN', 'domains', ?, ?, ?)
    `).run(req.user.userId, req.user.email, String(newDomainId), `Registered domain ${cleanDomain} for ${academy.name}`, req.ip);

    res.status(201).json({
      success: true,
      message: `Domain '${cleanDomain}' registered successfully`,
      domain: {
        id: newDomainId,
        academy_id: id,
        domain: cleanDomain,
        is_primary: primaryFlag,
        is_custom: customFlag,
        status: 'active',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/central/academies/:id/domains/:domainId
 * Updates primary status or activation status of a domain
 */
centralRouter.put('/academies/:id/domains/:domainId', (req, res) => {
  try {
    const id = Number(req.params.id);
    const domainId = Number(req.params.domainId);
    const { is_primary, status } = req.body;

    const centralDb = getCentralDb();
    const existing = centralDb.prepare('SELECT * FROM domains WHERE id = ? AND academy_id = ?').get(domainId, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Domain not found for this academy' });
    }

    const tx = centralDb.transaction(() => {
      if (is_primary) {
        centralDb.prepare('UPDATE domains SET is_primary = 0 WHERE academy_id = ?').run(id);
        centralDb.prepare('UPDATE domains SET is_primary = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(domainId);
      }
      if (status) {
        centralDb.prepare('UPDATE domains SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, domainId);
      }
    });

    tx();

    res.json({ success: true, message: 'Domain updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/central/academies/:id/domains/:domainId
 * Removes a domain (protects the last remaining domain)
 */
centralRouter.delete('/academies/:id/domains/:domainId', (req, res) => {
  try {
    const id = Number(req.params.id);
    const domainId = Number(req.params.domainId);

    const centralDb = getCentralDb();
    const existing = centralDb.prepare('SELECT * FROM domains WHERE id = ? AND academy_id = ?').get(domainId, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Domain not found for this academy' });
    }

    const count = centralDb.prepare('SELECT COUNT(*) as c FROM domains WHERE academy_id = ?').get(id).c;
    if (count <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the only registered domain. Every academy must have at least one reachable domain or subdomain.',
      });
    }

    const tx = centralDb.transaction(() => {
      centralDb.prepare('DELETE FROM domains WHERE id = ?').run(domainId);
      if (existing.is_primary === 1) {
        // Fallback primary to the first available domain
        const firstRemaining = centralDb.prepare('SELECT id FROM domains WHERE academy_id = ? ORDER BY id ASC LIMIT 1').get(id);
        if (firstRemaining) {
          centralDb.prepare('UPDATE domains SET is_primary = 1 WHERE id = ?').run(firstRemaining.id);
        }
      }
    });

    tx();

    // Central audit log
    centralDb.prepare(`
      INSERT INTO central_audit_logs (user_id, user_email, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, 'DELETE_DOMAIN', 'domains', ?, ?, ?)
    `).run(req.user.userId, req.user.email, String(domainId), `Removed domain ${existing.domain} from academy ${id}`, req.ip);

    res.json({ success: true, message: `Domain '${existing.domain}' removed successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// SUBSCRIPTION PLANS & QUOTA MANAGEMENT ENDPOINTS (SUPER ADMIN)
// ==========================================

/**
 * GET /api/central/plans
 * Lists all subscription plans with limits, feature entitlements, and assigned academy count
 */
centralRouter.get('/plans', (req, res) => {
  try {
    const centralDb = getCentralDb();
    const plans = centralDb.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM academy_subscriptions s WHERE s.plan_id = p.id AND s.status IN ('active', 'trial')) as active_subscriptions_count
      FROM subscription_plans p
      ORDER BY p.price ASC, p.id ASC
    `).all();

    const enriched = plans.map(p => {
      const limitsRows = centralDb.prepare('SELECT quota_key, limit_value, counting_policy FROM subscription_plan_limits WHERE plan_id = ?').all(p.id);
      const limits = {};
      for (const row of limitsRows) {
        limits[row.quota_key] = row.limit_value;
      }

      const featuresRows = centralDb.prepare('SELECT feature_key, is_enabled FROM subscription_plan_features WHERE plan_id = ?').all(p.id);
      const features = {};
      for (const row of featuresRows) {
        features[row.feature_key] = Boolean(row.is_enabled);
      }

      return {
        ...p,
        limits,
        features,
      };
    });

    res.json({ success: true, plans: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/central/plans
 * Creates a new subscription plan with configurable quota limits and feature toggles
 */
centralRouter.post('/plans', (req, res) => {
  try {
    const { name, slug, description, price, billing_interval, trial_days, status, limits, features } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Plan name is required' });
    }

    const planSlug = (slug || name).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    const centralDb = getCentralDb();

    // Check duplicate name or slug
    const existing = centralDb.prepare('SELECT id FROM subscription_plans WHERE name = ? OR slug = ? COLLATE NOCASE').get(name.trim(), planSlug);
    if (existing) {
      return res.status(400).json({ success: false, error: `Plan with name '${name}' or slug '${planSlug}' already exists` });
    }

    let newPlanId;
    const tx = centralDb.transaction(() => {
      const ins = centralDb.prepare(`
        INSERT INTO subscription_plans (name, slug, description, price, billing_interval, trial_days, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        planSlug,
        description || null,
        price !== undefined ? Number(price) : 0,
        billing_interval || 'monthly',
        trial_days !== undefined ? Number(trial_days) : 14,
        status || 'active'
      );
      newPlanId = Number(ins.lastInsertRowid);

      // Save limits (merge provided limits with DEFAULT_PLAN_VALUES)
      const limitsToSave = { ...DEFAULT_PLAN_VALUES, ...(limits || {}) };
      for (const [key, val] of Object.entries(limitsToSave)) {
        if (val !== undefined && val !== null) {
          const numVal = Number(val);
          if (isNaN(numVal) || numVal < 0) {
            throw new Error(`Limit for ${key} must be a non-negative integer`);
          }
          centralDb.prepare(`
            INSERT INTO subscription_plan_limits (plan_id, quota_key, limit_value, counting_policy)
            VALUES (?, ?, ?, 'active_only')
          `).run(newPlanId, key, numVal);
        }
      }

      // Save features
      if (features && typeof features === 'object') {
        for (const [fKey, isEnabled] of Object.entries(features)) {
          centralDb.prepare(`
            INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled)
            VALUES (?, ?, ?)
          `).run(newPlanId, fKey, isEnabled ? 1 : 0);
        }
      }
    });

    tx();

    QuotaService.logAudit(
      req.user.userId,
      req.user.email,
      'CREATE_PLAN',
      'subscription_plans',
      newPlanId,
      `Created subscription plan '${name}' (${planSlug})`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Subscription plan '${name}' created successfully`,
      planId: newPlanId,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/central/plans/:id
 */
centralRouter.get('/plans/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const centralDb = getCentralDb();
    const plan = centralDb.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(id);

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Subscription plan not found' });
    }

    const limitsRows = centralDb.prepare('SELECT quota_key, limit_value, counting_policy FROM subscription_plan_limits WHERE plan_id = ?').all(id);
    const limits = {};
    for (const row of limitsRows) {
      limits[row.quota_key] = row.limit_value;
    }

    const featuresRows = centralDb.prepare('SELECT feature_key, is_enabled FROM subscription_plan_features WHERE plan_id = ?').all(id);
    const features = {};
    for (const row of featuresRows) {
      features[row.feature_key] = Boolean(row.is_enabled);
    }

    res.json({ success: true, plan: { ...plan, limits, features } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/central/plans/:id
 * Updates plan details, quotas, and feature entitlements
 */
centralRouter.put('/plans/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description, price, billing_interval, trial_days, status, limits, features } = req.body;

    const centralDb = getCentralDb();
    const existing = centralDb.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Subscription plan not found' });
    }

    const tx = centralDb.transaction(() => {
      centralDb.prepare(`
        UPDATE subscription_plans
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            price = COALESCE(?, price),
            billing_interval = COALESCE(?, billing_interval),
            trial_days = COALESCE(?, trial_days),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name ? name.trim() : null,
        description !== undefined ? description : null,
        price !== undefined ? Number(price) : null,
        billing_interval || null,
        trial_days !== undefined ? Number(trial_days) : null,
        status || null,
        id
      );

      // Update limits
      if (limits && typeof limits === 'object') {
        for (const [key, val] of Object.entries(limits)) {
          if (val !== undefined && val !== null) {
            const numVal = Number(val);
            if (isNaN(numVal) || numVal < 0) {
              throw new Error(`Limit for ${key} must be a non-negative integer`);
            }
            centralDb.prepare(`
              INSERT INTO subscription_plan_limits (plan_id, quota_key, limit_value, counting_policy, updated_at)
              VALUES (?, ?, ?, 'active_only', CURRENT_TIMESTAMP)
              ON CONFLICT(plan_id, quota_key) DO UPDATE SET
                limit_value = excluded.limit_value,
                updated_at = CURRENT_TIMESTAMP
            `).run(id, key, numVal);
          }
        }
      }

      // Update features
      if (features && typeof features === 'object') {
        for (const [fKey, isEnabled] of Object.entries(features)) {
          centralDb.prepare(`
            INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(plan_id, feature_key) DO UPDATE SET
              is_enabled = excluded.is_enabled,
              updated_at = CURRENT_TIMESTAMP
          `).run(id, fKey, isEnabled ? 1 : 0);
        }
      }
    });

    tx();

    QuotaService.logAudit(
      req.user.userId,
      req.user.email,
      'UPDATE_PLAN',
      'subscription_plans',
      id,
      `Updated plan '${existing.name}' configuration`,
      req.ip
    );

    res.json({ success: true, message: 'Subscription plan updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/central/plans/:id
 */
centralRouter.delete('/plans/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const centralDb = getCentralDb();
    const plan = centralDb.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    // Check if academies are currently assigned
    const assignedCount = centralDb.prepare(`
      SELECT COUNT(*) as c FROM academy_subscriptions WHERE plan_id = ? AND status IN ('active', 'trial')
    `).get(id).c;

    if (assignedCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete plan '${plan.name}' because ${assignedCount} academy(ies) are currently subscribed to it. Please reassign them first.`,
      });
    }

    centralDb.prepare('DELETE FROM subscription_plans WHERE id = ?').run(id);

    QuotaService.logAudit(
      req.user.userId,
      req.user.email,
      'DELETE_PLAN',
      'subscription_plans',
      id,
      `Deleted subscription plan '${plan.name}'`,
      req.ip
    );

    res.json({ success: true, message: `Subscription plan '${plan.name}' deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/central/academies/:id/subscription
 * Retrieves current subscription, plan, overrides, and live quota usage for an academy
 */
centralRouter.get('/academies/:id/subscription', (req, res) => {
  try {
    const id = Number(req.params.id);
    const centralDb = getCentralDb();
    const academy = centralDb.prepare('SELECT id, name, slug, plan, status FROM academies WHERE id = ?').get(id);

    if (!academy) {
      return res.status(404).json({ success: false, error: 'Academy not found' });
    }

    const subscription = centralDb.prepare(`
      SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.description as plan_description
      FROM academy_subscriptions s
      JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.academy_id = ?
      ORDER BY s.id DESC
      LIMIT 1
    `).get(id);

    const overrides = centralDb.prepare(`
      SELECT *
      FROM academy_limit_overrides
      WHERE academy_id = ?
      ORDER BY id DESC
    `).all(id);

    const featureOverrides = centralDb.prepare(`
      SELECT *
      FROM academy_feature_overrides
      WHERE academy_id = ?
      ORDER BY id DESC
    `).all(id);

    // Live quota metrics & over-limit warnings
    const quotaSummary = QuotaService.getAcademyQuotaSummary(id);

    res.json({
      success: true,
      academy,
      subscription: subscription || null,
      overrides,
      featureOverrides,
      quotaSummary,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/central/academies/:id/subscription
 * Assigns or updates the subscription plan for an academy with over-limit protection
 */
centralRouter.post('/academies/:id/subscription', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { plan_id, status, starts_at, ends_at, auto_renew } = req.body;

    if (!plan_id) {
      return res.status(400).json({ success: false, error: 'Plan ID is required' });
    }

    const centralDb = getCentralDb();
    const academy = centralDb.prepare('SELECT id, name FROM academies WHERE id = ?').get(id);
    if (!academy) {
      return res.status(404).json({ success: false, error: 'Academy not found' });
    }

    const plan = centralDb.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(Number(plan_id));
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Subscription plan not found' });
    }

    // Inspect usage vs new plan limits to flag over-limit warnings
    const planLimits = centralDb.prepare('SELECT quota_key, limit_value FROM subscription_plan_limits WHERE plan_id = ?').all(plan.id);
    const overLimitWarnings = [];

    for (const pl of planLimits) {
      const currentUsage = QuotaService.usage(id, pl.quota_key);
      if (currentUsage > pl.limit_value) {
        overLimitWarnings.push({
          quota_key: pl.quota_key,
          current_usage: currentUsage,
          new_limit: pl.limit_value,
          message: `Current usage of ${currentUsage} exceeds new plan limit of ${pl.limit_value}. Existing records are preserved, but new additions will be blocked.`,
        });
      }
    }

    let subId;
    const tx = centralDb.transaction(() => {
      // Deactivate previous active subscriptions
      centralDb.prepare("UPDATE academy_subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE academy_id = ? AND status = 'active'").run(id);

      const ins = centralDb.prepare(`
        INSERT INTO academy_subscriptions (academy_id, plan_id, status, starts_at, ends_at, auto_renew)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        plan.id,
        status || 'active',
        starts_at || new Date().toISOString(),
        ends_at || null,
        auto_renew !== undefined ? (auto_renew ? 1 : 0) : 1
      );
      subId = Number(ins.lastInsertRowid);

      // Update academy's plan slug
      centralDb.prepare('UPDATE academies SET plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(plan.slug, id);
    });

    tx();

    QuotaService.logAudit(
      req.user.userId,
      req.user.email,
      'ASSIGN_SUBSCRIPTION',
      'academies',
      id,
      `Assigned subscription plan '${plan.name}' to academy '${academy.name}'. Over-limit warnings: ${overLimitWarnings.length}`,
      req.ip
    );

    res.json({
      success: true,
      message: `Subscription plan '${plan.name}' assigned to '${academy.name}' successfully`,
      subscriptionId: subId,
      overLimitWarnings,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/central/academies/:id/overrides
 * Sets an academy-specific quota limit override or feature override with mandatory reason
 */
centralRouter.post('/academies/:id/overrides', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { quota_key, override_value, reason, starts_at, ends_at, feature_key, is_enabled } = req.body;

    const centralDb = getCentralDb();
    const academy = centralDb.prepare('SELECT id, name FROM academies WHERE id = ?').get(id);
    if (!academy) {
      return res.status(404).json({ success: false, error: 'Academy not found' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Reason for override is required for audit compliance' });
    }

    if (quota_key) {
      if (!STANDARD_QUOTA_KEYS.includes(quota_key)) {
        return res.status(400).json({
          success: false,
          error: `Invalid quota_key. Must be one of: ${STANDARD_QUOTA_KEYS.join(', ')}`,
        });
      }

      const numVal = Number(override_value);
      if (isNaN(numVal) || numVal < 0) {
        return res.status(400).json({ success: false, error: 'Override value must be a non-negative integer' });
      }

      // Check current usage if lowering limit
      const currentUsage = QuotaService.usage(id, quota_key);
      const isOverLimit = currentUsage > numVal;

      const ins = centralDb.prepare(`
        INSERT INTO academy_limit_overrides (academy_id, quota_key, override_value, reason, starts_at, ends_at, changed_by_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        quota_key,
        numVal,
        reason.trim(),
        starts_at || new Date().toISOString(),
        ends_at || null,
        req.user.userId
      );

      QuotaService.logAudit(
        req.user.userId,
        req.user.email,
        'SET_QUOTA_OVERRIDE',
        'academy_limit_overrides',
        ins.lastInsertRowid,
        `Set ${quota_key} override to ${numVal} for ${academy.name}. Reason: ${reason}. Over-limit: ${isOverLimit}`,
        req.ip
      );

      return res.status(201).json({
        success: true,
        message: `Quota override for '${quota_key}' set to ${numVal}`,
        overrideId: ins.lastInsertRowid,
        isOverLimit,
        warning: isOverLimit ? `Current usage (${currentUsage}) exceeds new override (${numVal}). Further creation is blocked.` : null,
      });
    }

    if (feature_key) {
      const ins = centralDb.prepare(`
        INSERT INTO academy_feature_overrides (academy_id, feature_key, is_enabled, reason, starts_at, ends_at, changed_by_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        feature_key.trim(),
        is_enabled ? 1 : 0,
        reason.trim(),
        starts_at || new Date().toISOString(),
        ends_at || null,
        req.user.userId
      );

      QuotaService.logAudit(
        req.user.userId,
        req.user.email,
        'SET_FEATURE_OVERRIDE',
        'academy_feature_overrides',
        ins.lastInsertRowid,
        `Set feature '${feature_key}' to ${is_enabled ? 'enabled' : 'disabled'} for ${academy.name}. Reason: ${reason}`,
        req.ip
      );

      return res.status(201).json({
        success: true,
        message: `Feature override for '${feature_key}' saved`,
        overrideId: ins.lastInsertRowid,
      });
    }

    res.status(400).json({ success: false, error: 'Either quota_key or feature_key must be specified' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/central/academies/:id/overrides/:overrideId
 * Removes an override so academy limit reverts to the active subscription plan value
 */
centralRouter.delete('/academies/:id/overrides/:overrideId', (req, res) => {
  try {
    const id = Number(req.params.id);
    const overrideId = Number(req.params.overrideId);

    const centralDb = getCentralDb();
    const existing = centralDb.prepare('SELECT * FROM academy_limit_overrides WHERE id = ? AND academy_id = ?').get(overrideId, id);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Override not found' });
    }

    centralDb.prepare('DELETE FROM academy_limit_overrides WHERE id = ?').run(overrideId);

    QuotaService.logAudit(
      req.user.userId,
      req.user.email,
      'REMOVE_QUOTA_OVERRIDE',
      'academy_limit_overrides',
      overrideId,
      `Removed ${existing.quota_key} override from academy ${id}`,
      req.ip
    );

    res.json({ success: true, message: `Override removed. Limit reverted to plan value.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/central/academies/:id/quota-summary
 */
centralRouter.get('/academies/:id/quota-summary', (req, res) => {
  try {
    const id = Number(req.params.id);
    const summary = QuotaService.getAcademyQuotaSummary(id);
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
