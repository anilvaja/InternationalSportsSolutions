import { getCentralDb } from '../db/centralDb.js';
import { getTenantDbById, getTenantDbBySlug } from '../db/connectionManager.js';

/**
 * Extracts tenant subdomain from Host header, X-Forwarded-Host, or hostname
 * Examples:
 *   mahaviracademy.internationalsportssolutions.test -> 'mahaviracademy'
 *   mahaviracademy.localhost:3005                   -> 'mahaviracademy'
 */
export function extractSubdomain(req) {
  const rawHost = req.headers['x-forwarded-host'] || req.headers['host'] || req.hostname || '';
  const host = rawHost.split(':')[0].toLowerCase().trim();

  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub !== 'www' && sub !== 'admin' && sub !== 'api') {
      return sub;
    }
  } else if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0];
  }

  return null;
}

/**
 * Resolves the target academy database connection and attaches it to `req.tenantDb`
 */
export function resolveTenant(req, res, next) {
  try {
    let academyId = null;
    let academySlug = null;

    // 1. User token context
    if (req.user && req.user.academyId) {
      academyId = req.user.academyId;
    }

    // 2. Request headers override (allowed for SuperAdmin or explicitly declared by frontend)
    const headerAcademyId = req.headers['x-academy-id'];
    const headerAcademySlug = req.headers['x-academy-slug'];

    if (headerAcademyId) {
      academyId = Number(headerAcademyId);
    } else if (headerAcademySlug) {
      academySlug = headerAcademySlug.toString().trim();
    }

    // 3. Query params override
    if (req.query.academy_id) {
      academyId = Number(req.query.academy_id);
    } else if (req.query.academy_slug) {
      academySlug = req.query.academy_slug.toString().trim();
    }

    // 4. Subdomain check (e.g. mahaviracademy.internationalsportssolutions.test)
    if (!academyId && !academySlug) {
      const sub = extractSubdomain(req);
      if (sub) {
        academySlug = sub;
      }
    }

    const centralDb = getCentralDb();
    let academyRecord = null;

    if (academyId) {
      academyRecord = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(academyId);
    } else if (academySlug) {
      academyRecord = centralDb.prepare('SELECT * FROM academies WHERE slug = ? COLLATE NOCASE').get(academySlug);
      if (academyRecord) {
        academyId = academyRecord.id;
      }
    }

    if (!academyRecord) {
      return res.status(404).json({
        success: false,
        error: `Academy context '${academySlug || academyId || 'unknown'}' not found in central registry.`,
      });
    }

    // Security check: non-super admin cannot access another academy's database
    if (req.user && !req.user.isSuperAdmin && req.user.academyId && req.user.academyId !== academyRecord.id) {
      return res.status(403).json({
        success: false,
        error: 'Cross-tenant access forbidden. You do not have permissions for this academy.',
      });
    }

    // Attach DB connection and metadata
    req.academy = academyRecord;
    req.tenantDb = getTenantDbById(academyRecord.id);

    next();
  } catch (err) {
    console.error('[TenantResolver Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Tenant resolution failure' });
  }
}
