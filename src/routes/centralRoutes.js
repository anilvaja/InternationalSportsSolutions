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

      return {
        ...ac,
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

    // Central audit log
    const centralDb = getCentralDb();
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
