import express from 'express';
import bcrypt from 'bcryptjs';
import { getCentralDb } from '../db/centralDb.js';
import { getTenantDbById } from '../db/connectionManager.js';
import { signToken } from '../middleware/auth.js';
import { config } from '../config/index.js';

export const authRouter = express.Router();

/**
 * POST /api/auth/login
 * Unified login endpoint supporting Super Admin, Academy Staff/Admins, and Students
 */
authRouter.post('/login', (req, res) => {
  try {
    const { email, password, academy_slug } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const centralDb = getCentralDb();

    // 1. Check Super Admin in Central DB
    const superAdmin = centralDb.prepare('SELECT * FROM super_admins WHERE email = ? COLLATE NOCASE').get(trimmedEmail);
    if (superAdmin) {
      const match = bcrypt.compareSync(password, superAdmin.password_hash);
      if (match) {
        const payload = {
          userId: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email,
          role: 'super_admin',
          isSuperAdmin: true,
        };
        const token = signToken(payload);

        res.cookie('token', token, {
          httpOnly: true,
          secure: config.nodeEnv === 'production',
          maxAge: config.cookieMaxAge,
          sameSite: 'lax',
        });

        // Audit log in Central
        centralDb.prepare(`
          INSERT INTO central_audit_logs (user_id, user_email, action, entity, details, ip_address)
          VALUES (?, ?, 'LOGIN', 'super_admins', 'Super Admin logged in', ?)
        `).run(superAdmin.id, superAdmin.email, req.ip);

        return res.json({
          success: true,
          message: 'Logged in as Super Admin',
          token,
          user: payload,
        });
      }
    }

    // 2. Resolve Academy for non-super admins
    let targetAcademyId = null;

    if (academy_slug) {
      const academy = centralDb.prepare('SELECT id FROM academies WHERE slug = ? COLLATE NOCASE').get(academy_slug);
      if (academy) targetAcademyId = academy.id;
    }

    if (!targetAcademyId) {
      // Look up in central router table
      const lookup = centralDb.prepare('SELECT academy_id, role FROM academy_users_lookup WHERE email = ? COLLATE NOCASE').get(trimmedEmail);
      if (lookup) {
        targetAcademyId = lookup.academy_id;
      }
    }

    if (!targetAcademyId) {
      return res.status(401).json({ success: false, error: 'Invalid credentials or academy not found' });
    }

    const academy = centralDb.prepare('SELECT * FROM academies WHERE id = ?').get(targetAcademyId);
    if (!academy || academy.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Academy account is suspended or inaccessible' });
    }

    // Open target tenant DB
    const tenantDb = getTenantDbById(targetAcademyId);

    // Try finding in `users` (Staff, Coaches, Academy Admins)
    const staffUser = tenantDb.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(trimmedEmail);
    if (staffUser) {
      const match = bcrypt.compareSync(password, staffUser.password_hash);
      if (match) {
        const payload = {
          userId: staffUser.id,
          name: staffUser.name,
          email: staffUser.email,
          role: staffUser.role,
          academyId: academy.id,
          academySlug: academy.slug,
          academyName: academy.name,
          isSuperAdmin: false,
        };
        const token = signToken(payload);

        res.cookie('token', token, {
          httpOnly: true,
          secure: config.nodeEnv === 'production',
          maxAge: config.cookieMaxAge,
          sameSite: 'lax',
        });

        // Audit log in Tenant DB
        tenantDb.prepare(`
          INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details, ip_address)
          VALUES (?, ?, ?, 'LOGIN', 'users', 'Staff user logged in', ?)
        `).run(staffUser.id, staffUser.name, staffUser.role, req.ip);

        return res.json({
          success: true,
          message: 'Logged in successfully',
          token,
          user: payload,
        });
      }
    }

    // Try finding in `students` table
    const studentUser = tenantDb.prepare('SELECT * FROM students WHERE email = ? COLLATE NOCASE OR student_code = ?').get(trimmedEmail, trimmedEmail);
    if (studentUser && studentUser.password_hash) {
      const match = bcrypt.compareSync(password, studentUser.password_hash);
      if (match) {
        const payload = {
          userId: studentUser.id,
          name: `${studentUser.first_name} ${studentUser.last_name}`,
          email: studentUser.email,
          studentCode: studentUser.student_code,
          role: 'student',
          academyId: academy.id,
          academySlug: academy.slug,
          academyName: academy.name,
          isSuperAdmin: false,
        };
        const token = signToken(payload);

        res.cookie('token', token, {
          httpOnly: true,
          secure: config.nodeEnv === 'production',
          maxAge: config.cookieMaxAge,
          sameSite: 'lax',
        });

        return res.json({
          success: true,
          message: 'Logged in as Student',
          token,
          user: payload,
        });
      }
    }

    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ success: false, error: err.message || 'Internal login error' });
  }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', (req, res) => {
  if (!req.user) {
    return res.json({ success: true, authenticated: false, user: null });
  }

  const centralDb = getCentralDb();
  let academiesList = [];

  if (req.user.isSuperAdmin) {
    academiesList = centralDb.prepare('SELECT id, name, slug, plan, status FROM academies ORDER BY name ASC').all();
  } else if (req.user.academyId) {
    const ac = centralDb.prepare('SELECT id, name, slug, plan, status, logo_url FROM academies WHERE id = ?').get(req.user.academyId);
    if (ac) academiesList = [ac];
  }

  res.json({
    success: true,
    authenticated: true,
    user: req.user,
    accessibleAcademies: academiesList,
  });
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});
