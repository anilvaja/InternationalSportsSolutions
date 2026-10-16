import { getCentralDb } from '../db/centralDb.js';
import { getTenantDbById, getTenantDbBySlug } from '../db/connectionManager.js';

/**
 * Extracts normalized host (without port) from request
 */
export function extractHost(req) {
  const rawHost = req.headers['x-forwarded-host'] || req.headers['host'] || req.hostname || '';
  return rawHost.split(':')[0].toLowerCase().trim();
}

/**
 * Extracts tenant subdomain from Host header, X-Forwarded-Host, or hostname
 * Examples:
 *   mahaviracademy.internationalsportssolutions.test -> 'mahaviracademy'
 *   mahaviracademy.localhost:3005                   -> 'mahaviracademy'
 */
export function extractSubdomain(req) {
  const host = extractHost(req);

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
    const centralDb = getCentralDb();
    let academyId = null;
    let academySlug = null;
    let academyRecord = null;

    // 1. Direct Domain Match from Host, X-Academy-Domain, or query.domain
    const host = extractHost(req);
    const customDomainQuery = req.query.domain || req.headers['x-academy-domain'];
    const domainCandidate = customDomainQuery || (
      host && host !== 'localhost' && host !== '127.0.0.1' && host !== 'internationalsportssolutions.test' ? host : null
    );

    if (domainCandidate) {
      try {
        const domainMatch = centralDb.prepare(`
          SELECT a.*, d.domain as matched_domain, d.is_primary, d.is_custom
          FROM domains d
          JOIN academies a ON d.academy_id = a.id
          WHERE d.domain = ? COLLATE NOCASE AND d.status = 'active'
        `).get(domainCandidate.trim().toLowerCase());

        if (domainMatch) {
          academyRecord = domainMatch;
          academyId = domainMatch.id;
        }
      } catch (e) {
        // Ignore if domains table not yet present
      }
    }

    // 2. User token context (if not already resolved by domain)
    if (!academyRecord && req.user && req.user.academyId) {
      academyId = req.user.academyId;
    }

    // 3. Request headers override (allowed for SuperAdmin or explicitly declared by frontend)
    if (!academyRecord) {
      const headerAcademyId = req.headers['x-academy-id'];
      const headerAcademySlug = req.headers['x-academy-slug'];

      if (headerAcademyId) {
        academyId = Number(headerAcademyId);
      } else if (headerAcademySlug) {
        academySlug = headerAcademySlug.toString().trim();
      }
    }

    // 4. Query params override
    if (!academyRecord) {
      if (req.query.academy_id) {
        academyId = Number(req.query.academy_id);
      } else if (req.query.academy_slug) {
        academySlug = req.query.academy_slug.toString().trim();
      }
    }

    // 5. Subdomain check (e.g. mahaviracademy.internationalsportssolutions.test)
    if (!academyRecord && !academyId && !academySlug) {
      const sub = extractSubdomain(req);
      if (sub) {
        academySlug = sub;
      }
    }

    if (!academyRecord) {
      if (academyId) {
        academyRecord = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(academyId);
      } else if (academySlug) {
        academyRecord = centralDb.prepare('SELECT * FROM academies WHERE slug = ? COLLATE NOCASE').get(academySlug);
        if (!academyRecord) {
          // Check if slug matches prefix in domains table
          const domainSubMatch = centralDb.prepare(`
            SELECT a.* FROM domains d
            JOIN academies a ON d.academy_id = a.id
            WHERE (d.domain LIKE ? OR d.domain LIKE ?) AND d.status = 'active'
          `).get(`${academySlug}.%`, `${academySlug}`);
          if (domainSubMatch) {
            academyRecord = domainSubMatch;
          }
        }
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
