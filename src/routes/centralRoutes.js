import express from 'express';
import fs from 'fs';
import { getCentralDb } from '../db/centralDb.js';
import { provisionAcademyDb, getTenantDbById, closeTenantDb } from '../db/connectionManager.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { streamAcademyBackup, streamCentralPlatformBackup } from '../services/backupService.js';

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
