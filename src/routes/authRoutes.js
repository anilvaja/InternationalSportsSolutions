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
          academyLogo: academy.logo_url || null,
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
          academyLogo: academy.logo_url || null,
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
  let userTheme = null;
  let roleTheme = null;
  let academyDefaultTheme = 'blue';
  let permissionsList = [];

  if (req.user.isSuperAdmin) {
    academiesList = centralDb.prepare('SELECT id, name, slug, plan, status, logo_url, city, address, contact_phone, contact_email, gst_number FROM academies ORDER BY name ASC').all();
    permissionsList = ['all'];
  } else if (req.user.academyId) {
    const ac = centralDb.prepare('SELECT id, name, slug, plan, status, logo_url, city, address, contact_phone, contact_email, gst_number FROM academies WHERE id = ?').get(req.user.academyId);
    if (ac) {
      academiesList = [ac];
      req.user.academyName = ac.name;
      req.user.academyLogo = ac.logo_url || null;
      req.user.academySlug = ac.slug;
    }

    try {
      const tenantDb = getTenantDbById(req.user.academyId);
      
      // Sync fresh logo from tenant_settings if configured
      try {
        const tenantLogo = tenantDb.prepare("SELECT value FROM tenant_settings WHERE key = 'logo_url'").get();
        if (tenantLogo && tenantLogo.value) {
          req.user.academyLogo = tenantLogo.value;
          if (ac) ac.logo_url = tenantLogo.value;
        }
      } catch (e) {}
      
      // Fetch academy policy default theme
      const policy = tenantDb.prepare('SELECT default_color_theme FROM academy_policy_settings WHERE academy_id = ?').get(req.user.academyId);
      if (policy && policy.default_color_theme) {
        academyDefaultTheme = policy.default_color_theme;
      }

      if (req.user.role === 'student') {
        const student = tenantDb.prepare('SELECT theme_color FROM students WHERE id = ?').get(req.user.userId);
        if (student) userTheme = student.theme_color;
        roleTheme = 'indigo';
      } else {
        const staff = tenantDb.prepare('SELECT theme_color, custom_permissions FROM users WHERE id = ?').get(req.user.userId);
        if (staff) {
          userTheme = staff.theme_color;
          try {
            permissionsList = JSON.parse(staff.custom_permissions || '[]');
          } catch (e) {
            permissionsList = [];
          }
        }

        const roleRec = tenantDb.prepare('SELECT theme_color, permissions FROM academy_roles WHERE name = ?').get(req.user.role);
        if (roleRec) {
          roleTheme = roleRec.theme_color;
          try {
            const rolePerms = JSON.parse(roleRec.permissions || '[]');
            permissionsList = Array.from(new Set([...permissionsList, ...rolePerms]));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('[auth/me] Error loading tenant theme settings:', err.message);
    }
  }

  const effectiveTheme = userTheme || roleTheme || academyDefaultTheme || 'blue';
  const canCustomizeTheme = req.user.isSuperAdmin || req.user.role === 'academy_admin' || permissionsList.includes('customize_theme') || permissionsList.includes('all');
  const canManageBranding = req.user.isSuperAdmin || req.user.role === 'academy_admin' || permissionsList.includes('manage_branding') || permissionsList.includes('all');

  const enrichedUser = {
    ...req.user,
    themeColor: userTheme,
    roleThemeColor: roleTheme,
    academyDefaultTheme,
    effectiveTheme,
    canCustomizeTheme,
    canManageBranding,
    permissions: permissionsList,
  };

  res.json({
    success: true,
    authenticated: true,
    user: enrichedUser,
    accessibleAcademies: academiesList,
  });
});

/**
 * PUT /api/auth/theme
 * Updates authenticated user's color theme preference
 */
authRouter.put('/theme', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { theme_color } = req.body;
  const validThemes = ['blue', 'emerald', 'purple', 'amber', 'crimson', 'teal', 'indigo', 'slate', 'default'];

  if (theme_color && !validThemes.includes(theme_color)) {
    return res.status(400).json({ success: false, error: 'Invalid color theme' });
  }

  if (req.user.isSuperAdmin) {
    return res.json({ success: true, theme_color, message: 'Super admin theme preference updated' });
  }

  if (!req.user.academyId) {
    return res.status(400).json({ success: false, error: 'Academy context required' });
  }

  const tenantDb = getTenantDbById(req.user.academyId);
  const saveColor = (!theme_color || theme_color === 'default') ? null : theme_color;

  if (req.user.role === 'student') {
    tenantDb.prepare('UPDATE students SET theme_color = ? WHERE id = ?').run(saveColor, req.user.userId);
  } else {
    tenantDb.prepare('UPDATE users SET theme_color = ? WHERE id = ?').run(saveColor, req.user.userId);
  }

  res.json({
    success: true,
    theme_color: saveColor,
    message: saveColor ? `Personal theme set to ${saveColor}` : 'Reverted to academy/role default theme',
  });
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (req, res) => {
  let sessionDiffText = null;
  let sessionMinutes = 0;
  if (req.user && req.user.academyId) {
    try {
      const tenantDb = getTenantDbById(req.user.academyId);
      const lastLogin = tenantDb.prepare(`
        SELECT created_at FROM audit_logs 
        WHERE user_id = ? AND action = 'LOGIN' 
        ORDER BY id DESC LIMIT 1
      `).get(req.user.userId);

      if (lastLogin && lastLogin.created_at) {
        const loginStr = String(lastLogin.created_at).trim();
        const loginTime = new Date(loginStr.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(loginStr) ? loginStr : loginStr.replace(' ', 'T') + 'Z').getTime();
        const diffMs = Math.max(0, Date.now() - loginTime);
        sessionMinutes = Math.max(1, Math.round(diffMs / 60000));
        const hrs = Math.floor(sessionMinutes / 60);
        const mins = sessionMinutes % 60;
        sessionDiffText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

        tenantDb.prepare(`
          INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details, ip_address)
          VALUES (?, ?, ?, 'LOGOUT', 'users', ?, ?)
        `).run(req.user.userId, req.user.name, req.user.role, `Logged out. Session duration: ${sessionDiffText}`, req.ip);
      }
    } catch (e) {
      console.warn('Logout session duration tracking warning:', e.message);
    }
  }

  res.clearCookie('token');
  res.json({ 
    success: true, 
    message: sessionDiffText ? `Logged out successfully. Session duration: ${sessionDiffText}` : 'Logged out successfully',
    sessionDuration: sessionDiffText,
    sessionMinutes,
  });
});

/**
 * POST /api/auth/change-password
 * Allows any authenticated user (Super Admin, Academy Admin, Staff, Coach, Student) to change their password
 */
authRouter.post('/change-password', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    }

    const { current_password, new_password } = req.body;

    if (!new_password || String(new_password).trim().length < 4) {
      return res.status(400).json({ success: false, error: 'New password must be at least 4 characters long' });
    }

    const centralDb = getCentralDb();

    // 1. If Super Admin
    if (req.user.isSuperAdmin) {
      const superAdmin = centralDb.prepare('SELECT * FROM super_admins WHERE id = ?').get(req.user.userId);
      if (!superAdmin) {
        return res.status(404).json({ success: false, error: 'Super Admin account not found' });
      }

      if (current_password) {
        const match = bcrypt.compareSync(current_password, superAdmin.password_hash);
        if (!match) {
          return res.status(400).json({ success: false, error: 'Current password is incorrect' });
        }
      }

      const hash = bcrypt.hashSync(String(new_password).trim(), 10);
      centralDb.prepare('UPDATE super_admins SET password_hash = ? WHERE id = ?').run(hash, superAdmin.id);

      centralDb.prepare(`
        INSERT INTO central_audit_logs (user_id, user_email, action, entity, details, ip_address)
        VALUES (?, ?, 'CHANGE_PASSWORD', 'super_admins', 'Super Admin changed personal password', ?)
      `).run(superAdmin.id, superAdmin.email, req.ip);

      return res.json({ success: true, message: 'Your Super Admin password has been updated successfully' });
    }

    // 2. Academy User (Admin, Staff, Coach, Student)
    if (!req.user.academyId) {
      return res.status(400).json({ success: false, error: 'Academy context required' });
    }

    const tenantDb = getTenantDbById(req.user.academyId);

    if (req.user.role === 'student') {
      const student = tenantDb.prepare('SELECT * FROM students WHERE id = ?').get(req.user.userId);
      if (!student) {
        return res.status(404).json({ success: false, error: 'Student account not found' });
      }

      if (student.password_hash && current_password) {
        const match = bcrypt.compareSync(current_password, student.password_hash);
        if (!match) {
          return res.status(400).json({ success: false, error: 'Current password is incorrect' });
        }
      }

      const hash = bcrypt.hashSync(String(new_password).trim(), 10);
      tenantDb.prepare('UPDATE students SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, student.id);

      return res.json({ success: true, message: 'Student portal password updated successfully' });
    }

    // Staff / Admin / Coach
    const user = tenantDb.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    if (user.password_hash && current_password) {
      const match = bcrypt.compareSync(current_password, user.password_hash);
      if (!match) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect' });
      }
    }

    const hash = bcrypt.hashSync(String(new_password).trim(), 10);
    tenantDb.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, user.id);

    tenantDb.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, details, ip_address)
      VALUES (?, ?, ?, 'CHANGE_PASSWORD', 'users', 'User changed personal password', ?)
    `).run(user.id, user.name, user.role, req.ip);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('[Change Password Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

