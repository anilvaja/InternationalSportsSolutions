import express from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { getCentralDb, closeCentralDb, resetCentralDbInstance } from '../db/centralDb.js';
import { getTenantDbById, closeAllTenantDbs, provisionAcademyDb } from '../db/connectionManager.js';
import { extractSubdomain, extractHost } from '../middleware/tenantResolver.js';
import { ALL_ACADEMY_PERMISSIONS, DEFAULT_ACADEMY_ROLES } from '../config/permissions.js';
import { InquiryService } from '../services/inquiryService.js';
import { requireSetupIpForApi } from '../middleware/setupIpGuard.js';
import QRCode from 'qrcode';

export const publicRouter = express.Router();

/**
 * GET /api/public/system-mode
 * Reports active database directory and test isolation mode
 */
publicRouter.get('/system-mode', (req, res) => {
  res.json({
    success: true,
    isTest: config.isTest,
    dataDirName: path.basename(config.dataDir),
    dataDir: config.dataDir,
    centralDbPath: config.centralDbPath,
    academiesDir: config.academiesDir
  });
});

/**
 * GET /api/public/tenant-info
 * Detects whether the current request is coming from a tenant subdomain or custom domain
 * e.g., mahaviracademy.internationalsportssolutions.test or mahavirsports.com
 */
publicRouter.get('/tenant-info', (req, res) => {
  try {
    const host = extractHost(req);
    const querySlug = req.query.slug;
    const queryDomain = req.query.domain;
    const centralDb = getCentralDb();

    let academy = null;
    let matchedDomain = null;

    // 1. Check exact custom domain or host in domains table
    const isPlatformRoot = (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'internationalsportssolutions.com' ||
      host === 'www.internationalsportssolutions.com' ||
      host === 'internationalsportssolutions.test' ||
      host === 'www.internationalsportssolutions.test' ||
      (config.baseDomain && (host === config.baseDomain || host === `www.${config.baseDomain}`))
    );

    const targetDomain = queryDomain || (
      host && !isPlatformRoot ? host : null
    );

    if (targetDomain) {
      const match = centralDb.prepare(`
        SELECT a.*, d.domain as matched_domain, d.is_primary, d.is_custom
        FROM domains d
        JOIN academies a ON d.academy_id = a.id
        WHERE d.domain = ? COLLATE NOCASE AND d.status = 'active'
      `).get(targetDomain.trim().toLowerCase());

      if (match) {
        academy = match;
        matchedDomain = match.matched_domain;
      }
    }

    // 2. Fallback to slug or subdomain
    if (!academy) {
      const slug = querySlug || extractSubdomain(req);
      if (slug) {
        academy = centralDb.prepare(`
          SELECT * FROM academies WHERE slug = ? COLLATE NOCASE
        `).get(slug.trim());
      }
    }

    // 3. Fallback only for preview subdomains / ephemeral preview deployments with explicit query
    if (!academy && (querySlug || queryDomain)) {
      const isCloudPreview = (
        host && (
          host.includes('airoapp.ai') ||
          host.includes('preview') ||
          host.includes('vercel.app') ||
          host.includes('onrender.com') ||
          host.includes('railway.app')
        )
      );
      if (isCloudPreview) {
        academy = centralDb.prepare("SELECT * FROM academies WHERE status = 'active' ORDER BY id ASC LIMIT 1").get();
      }
    }

    if (!academy) {
      return res.json({ success: true, isTenantSubdomain: false, academy: null });
    }

    // Attach domains registered for this academy
    const domains = centralDb.prepare(`
      SELECT id, domain, is_primary, is_custom, status FROM domains WHERE academy_id = ?
    `).all(academy.id);

    res.json({
      success: true,
      isTenantSubdomain: true,
      found: true,
      academy: {
        id: academy.id,
        name: academy.name,
        slug: academy.slug,
        contact_email: academy.contact_email,
        contact_phone: academy.contact_phone,
        address: academy.address,
        city: academy.city,
        logo_url: academy.logo_url,
        plan: academy.plan,
        status: academy.status,
        matched_domain: matchedDomain,
        domains,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/public/academies
 */
publicRouter.get('/academies', (req, res) => {
  try {
    const centralDb = getCentralDb();
    const academies = centralDb.prepare(`
      SELECT id, name, slug, contact_email, contact_phone, city, logo_url
      FROM academies
      WHERE status = 'active'
      ORDER BY name ASC
    `).all();

    res.json({ success: true, academies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/public/invoice-lookup
 */
publicRouter.get('/invoice-lookup', (req, res) => {
  try {
    const { academy_id, invoice_number, student_code } = req.query;

    if (!academy_id || (!invoice_number && !student_code)) {
      return res.status(400).json({
        success: false,
        error: 'academy_id and either invoice_number or student_code are required',
      });
    }

    const centralDb = getCentralDb();
    const academy = centralDb.prepare('SELECT id, name, slug, logo_url, city, address, contact_email, contact_phone, gst_number FROM academies WHERE id = ?').get(Number(academy_id));
    if (!academy) {
      return res.status(404).json({ success: false, error: 'Academy not found' });
    }

    const tenantDb = getTenantDbById(Number(academy_id));
    let query = `
      SELECT sf.*, s.student_code, s.admission_number, s.first_name, s.last_name, s.phone,
             b.name as branch_name
      FROM student_fees sf
      JOIN students s ON s.id = sf.student_id
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE 1=1
    `;
    const params = [];

    if (invoice_number) {
      query += ` AND sf.invoice_number = ?`;
      params.push(invoice_number.trim());
    }
    if (student_code) {
      query += ` AND s.student_code = ?`;
      params.push(student_code.trim());
    }

    const rawInvoices = tenantDb.prepare(query).all(...params);
    const invoices = rawInvoices.map(inv => ({
      ...inv,
      academy_name: academy.name,
      academy_logo: academy.logo_url,
      academy_city: academy.city,
      academy_address: academy.address,
      academy_gst: academy.gst_number,
    }));

    if (!invoices.length) {
      return res.status(404).json({ success: false, error: 'No matching fee invoices found' });
    }

    res.json({ success: true, invoices, academy });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/public/pay
 */
publicRouter.post('/pay', (req, res) => {
  try {
    const { academy_id, invoice_id, amount, payment_mode = 'upi', transaction_reference } = req.body;

    if (!academy_id || !invoice_id || !amount) {
      return res.status(400).json({ success: false, error: 'academy_id, invoice_id, and amount are required' });
    }

    const centralDb = getCentralDb();
    const academy = centralDb.prepare('SELECT id, name, slug, logo_url, city, address, contact_email, contact_phone, gst_number FROM academies WHERE id = ?').get(Number(academy_id));

    const tenantDb = getTenantDbById(Number(academy_id));
    const invoice = tenantDb.prepare(`
      SELECT sf.*, s.student_code, s.admission_number, s.first_name, s.last_name, s.phone
      FROM student_fees sf
      JOIN students s ON s.id = sf.student_id
      WHERE sf.id = ?
    `).get(Number(invoice_id));

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const payAmt = Math.min(Number(amount), invoice.balance_amount);
    const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;

    const tx = tenantDb.transaction(() => {
      tenantDb.prepare(`
        INSERT INTO fee_payments (student_fee_id, receipt_number, payment_date, amount, payment_mode, transaction_reference, notes)
        VALUES (?, ?, DATE('now'), ?, ?, ?, 'Quick Pay Portal')
      `).run(invoice.id, receiptNumber, payAmt, payment_mode, transaction_reference || null);

      const newPaid = invoice.paid_amount + payAmt;
      const newBalance = Math.max(0, invoice.net_amount - newPaid);
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';

      tenantDb.prepare(`
        UPDATE student_fees
        SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaid, newBalance, newStatus, invoice.id);
    });

    tx();

    res.json({
      success: true,
      message: 'Payment completed successfully',
      receiptNumber,
      amount: payAmt,
      date: new Date().toISOString().split('T')[0],
      invoice: {
        ...invoice,
        paid_amount: invoice.paid_amount + payAmt,
        balance_amount: Math.max(0, invoice.net_amount - (invoice.paid_amount + payAmt)),
      },
      academy,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Helper to resolve academy for public prospective student endpoints
 */
function resolvePublicAcademy(req, centralDb) {
  const querySlug = req.query.academy || req.query.slug || req.query.academy_slug || req.body?.academy_slug || req.body?.slug;
  const queryId = req.query.academy_id || req.query.id || req.body?.academy_id;
  const host = extractHost(req);
  const sub = extractSubdomain(req);

  let academy = null;

  if (queryId) {
    academy = centralDb.prepare("SELECT * FROM academies WHERE id = ? AND status = 'active'").get(Number(queryId));
  } else if (querySlug) {
    academy = centralDb.prepare("SELECT * FROM academies WHERE slug = ? COLLATE NOCASE AND status = 'active'").get(querySlug.trim());
  } else if (sub) {
    academy = centralDb.prepare("SELECT * FROM academies WHERE slug = ? COLLATE NOCASE AND status = 'active'").get(sub);
  } else if (host) {
    try {
      const match = centralDb.prepare(`
        SELECT a.* FROM domains d
        JOIN academies a ON d.academy_id = a.id
        WHERE d.domain = ? COLLATE NOCASE AND d.status = 'active'
      `).get(host);
      if (match) academy = match;
    } catch (_) {}
  }

  if (!academy) {
    const activeAcademies = centralDb.prepare("SELECT id, name, slug, logo_url, city, contact_phone, contact_email FROM academies WHERE status = 'active' ORDER BY name ASC").all();
    if (activeAcademies.length === 1) {
      academy = activeAcademies[0];
    }
  }

  return academy;
}

/**
 * GET /api/public/inquiry-form-meta
 * Returns academy details, active branches, sports, and available batches
 * for self-service student/parent admission registration
 */
publicRouter.get('/inquiry-form-meta', (req, res) => {
  try {
    const centralDb = getCentralDb();
    const academy = resolvePublicAcademy(req, centralDb);

    if (!academy) {
      const activeAcademies = centralDb.prepare("SELECT id, name, slug, logo_url, city, contact_phone FROM academies WHERE status = 'active' ORDER BY name ASC").all();
      return res.json({
        success: true,
        needsAcademySelection: true,
        academies: activeAcademies
      });
    }

    const tenantDb = getTenantDbById(academy.id);

    // Fetch tenant-specific logo if configured
    try {
      const tLogo = tenantDb.prepare("SELECT value FROM tenant_settings WHERE key = 'logo_url'").get();
      if (tLogo && tLogo.value) academy.logo_url = tLogo.value;
    } catch (_) {}

    const branches = tenantDb.prepare("SELECT id, name, city, address, phone FROM branches WHERE is_active = 1 ORDER BY name ASC").all();
    const sports = tenantDb.prepare("SELECT id, name, description FROM sports WHERE is_active = 1 ORDER BY name ASC").all();
    const batches = tenantDb.prepare(`
      SELECT b.id, b.name, b.branch_id, b.sport_id, b.days_of_week, b.start_time, b.end_time, b.max_capacity,
             br.name as branch_name, sp.name as sport_name
      FROM batches b
      LEFT JOIN branches br ON br.id = b.branch_id
      LEFT JOIN sports sp ON sp.id = b.sport_id
      WHERE b.is_active = 1
      ORDER BY b.name ASC
    `).all();

    res.json({
      success: true,
      needsAcademySelection: false,
      academy: {
        id: academy.id,
        name: academy.name,
        slug: academy.slug,
        logo_url: academy.logo_url,
        city: academy.city,
        address: academy.address,
        contact_phone: academy.contact_phone,
        contact_email: academy.contact_email
      },
      branches,
      sports,
      batches
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/public/inquiries
 * Self-service student/parent admission inquiry submission
 */
publicRouter.post('/inquiries', (req, res) => {
  try {
    const centralDb = getCentralDb();
    const academy = resolvePublicAcademy(req, centralDb);

    if (!academy) {
      return res.status(400).json({ success: false, error: 'Target sports academy could not be identified' });
    }

    const { student_name, phone } = req.body;
    if (!student_name || !phone) {
      return res.status(400).json({ success: false, error: 'Student name and contact phone number are required' });
    }

    const tenantDb = getTenantDbById(academy.id);
    const inquiryData = {
      ...req.body,
      source: req.body.source || (req.body.is_qr ? 'qr_code' : 'online'),
      status: 'new'
    };

    const inquiry = InquiryService.createInquiry(tenantDb, academy.id, inquiryData, null);

    // Record central audit entry
    try {
      centralDb.prepare(`
        INSERT INTO central_audit_logs (user_id, user_email, action, entity, details, ip_address)
        VALUES (NULL, 'PUBLIC_INQUIRY', 'CREATE_INQUIRY', 'inquiries', ?, ?)
      `).run(`Online student inquiry for '${student_name}' submitted to ${academy.name} (Ref #${inquiry.id})`, req.ip);
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: 'Inquiry registered successfully! The academy will contact you shortly.',
      inquiry: {
        id: inquiry.id,
        reference_no: `INQ-${String(inquiry.id).padStart(4, '0')}`,
        student_name: inquiry.student_name,
        created_at: inquiry.created_at
      },
      academy: {
        name: academy.name,
        contact_phone: academy.contact_phone
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/public/inquiry-qr
 * Public QR code generator endpoint
 */
publicRouter.get('/inquiry-qr', async (req, res) => {
  try {
    const centralDb = getCentralDb();
    const academy = resolvePublicAcademy(req, centralDb);

    if (!academy) {
      return res.status(404).json({ success: false, error: 'Academy not found' });
    }

    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3005';
    const targetUrl = `${protocol}://${host}/inquiry.html?academy=${academy.slug}`;

    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H'
    });

    res.json({
      success: true,
      targetUrl,
      qrDataUrl,
      academy: {
        id: academy.id,
        name: academy.name,
        slug: academy.slug
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rate limiting map for public sales inquiries: ip -> [timestamps]
const salesInquiryRateLimit = new Map();
function checkSalesInquiryRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 5;
  const timestamps = salesInquiryRateLimit.get(ip) || [];
  const validTimestamps = timestamps.filter(t => now - t < windowMs);
  if (validTimestamps.length >= maxRequests) {
    return false;
  }
  validTimestamps.push(now);
  salesInquiryRateLimit.set(ip, validTimestamps);
  return true;
}

/**
 * GET /api/public/platform-plans
 * Publicly returns active platform subscription plans with their quota limits
 */
publicRouter.get('/platform-plans', (req, res) => {
  try {
    const centralDb = getCentralDb();
    const plans = centralDb.prepare(`
      SELECT id, name, slug, description, price, billing_interval, trial_days, is_default
      FROM subscription_plans
      WHERE status = 'active'
      ORDER BY price ASC
    `).all();

    const planLimits = centralDb.prepare(`
      SELECT plan_id, quota_key, limit_value, counting_policy
      FROM subscription_plan_limits
    `).all();

    const plansWithLimits = plans.map(p => ({
      ...p,
      limits: planLimits.filter(l => l.plan_id === p.id)
    }));

    res.json({ success: true, plans: plansWithLimits });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/public/sales-inquiries
 * Public lead capture for prospective sports academy owners & clubs
 */
publicRouter.post('/sales-inquiries', (req, res) => {
  try {
    const centralDb = getCentralDb();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    // 1. Honeypot check (bot protection: hp_website field must remain empty)
    if (req.body.hp_website || req.body.hp_company) {
      // Silently return success to fool bots
      return res.status(201).json({
        success: true,
        message: 'Thank you for requesting a demo! Our team will contact you shortly.'
      });
    }

    // 2. In-memory Rate Limiting
    if (!checkSalesInquiryRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a few minutes before submitting again.'
      });
    }

    // 3. Server-side validation of required fields
    const {
      academy_name,
      contact_name,
      email,
      phone,
      city,
      approx_students,
      approx_branches,
      interested_plan,
      message
    } = req.body;

    if (!academy_name || !String(academy_name).trim()) {
      return res.status(400).json({ success: false, error: 'Academy / Business name is required' });
    }
    if (!contact_name || !String(contact_name).trim()) {
      return res.status(400).json({ success: false, error: 'Contact person name is required' });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address' });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, error: 'Contact phone / WhatsApp number is required' });
    }
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      return res.status(400).json({ success: false, error: 'Please provide a valid phone number (at least 8 digits)' });
    }

    // 4. Insert into central platform_sales_inquiries
    const insertStmt = centralDb.prepare(`
      INSERT INTO platform_sales_inquiries (
        academy_name, contact_name, email, phone, city,
        approx_students, approx_branches, interested_plan, message,
        status, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
    `);

    const result = insertStmt.run(
      String(academy_name).trim(),
      String(contact_name).trim(),
      String(email).trim().toLowerCase(),
      String(phone).trim(),
      city ? String(city).trim() : null,
      approx_students ? String(approx_students).trim() : null,
      approx_branches ? String(approx_branches).trim() : null,
      interested_plan ? String(interested_plan).trim() : null,
      message ? String(message).trim() : null,
      ip
    );

    // 5. Audit log in central
    try {
      centralDb.prepare(`
        INSERT INTO central_audit_logs (user_id, user_email, action, entity, details, ip_address)
        VALUES (NULL, 'SALES_LEAD', 'CREATE_SALES_INQUIRY', 'platform_sales_inquiries', ?, ?)
      `).run(
        `Sales inquiry from '${contact_name}' for academy '${academy_name}' (${email}, ${phone})`,
        ip
      );
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: 'Thank you for requesting a demo! Our platform team will contact you shortly.',
      inquiryId: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/public/setup
 * Returns setup status (whether platform has any super admin)
 *
 * POST /api/public/setup
 * Factory Reset & Platform Initialization:
 * 1. Closes connections and completely drops/wipes central.db and all academy_*.db files.
 * 2. Re-runs migrations to recreate pristine central.db.
 * 3. Creates ONLY the requested Super Admin user (custom name, email, password from form input).
 * 4. Seeds configuration, system settings, subscription plans, central permissions, and academy role templates.
 * 5. Provisions ONLY 1 default academy: "Pratik Karate Academy" (bare academy, no branches, batches, students, coaches, or demo data).
 */
publicRouter.get('/setup', requireSetupIpForApi, (req, res) => {
  try {
    const centralDb = getCentralDb();
    const existingSuperAdmin = centralDb.prepare('SELECT email FROM super_admins LIMIT 1').get();
    const academiesCount = centralDb.prepare('SELECT COUNT(*) as c FROM academies').get()?.c || 0;
    const plansCount = centralDb.prepare('SELECT COUNT(*) as c FROM subscription_plans').get()?.c || 0;
    let rolesCount = 0;
    let permsCount = 0;
    try {
      rolesCount = centralDb.prepare('SELECT COUNT(*) as c FROM central_role_templates').get()?.c || 0;
      permsCount = centralDb.prepare('SELECT COUNT(*) as c FROM central_permissions').get()?.c || 0;
    } catch (_) { }

    return res.json({
      success: true,
      initialized: !!existingSuperAdmin,
      superAdminEmail: existingSuperAdmin?.email || null,
      plansCount,
      rolesCount,
      permissionsCount: permsCount,
      academiesCount,
      loginUrl: '/',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

publicRouter.post('/setup', requireSetupIpForApi, (req, res) => {
  const steps = [];
  try {
    const { confirm, admin_name, admin_email, admin_password } = req.body || {};

    if (confirm !== 'RESET') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation failed. Please type "RESET" to confirm complete database wipe.'
      });
    }

    if (!admin_name || !admin_email || !admin_password) {
      return res.status(400).json({
        success: false,
        error: 'Super Admin name, email, and password are required.'
      });
    }

    if (admin_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters.'
      });
    }

    // Step 1: Close all tenant databases and central database
    closeAllTenantDbs();
    closeCentralDb();
    resetCentralDbInstance();
    steps.push('Closed all active database connections');

    // Step 2: Wipe all tenant database files
    let academyDbsDeleted = 0;
    if (fs.existsSync(config.academiesDir)) {
      const files = fs.readdirSync(config.academiesDir);
      for (const file of files) {
        if (file.endsWith('.db') || file.endsWith('.db-wal') || file.endsWith('.db-shm')) {
          try {
            fs.unlinkSync(path.join(config.academiesDir, file));
            academyDbsDeleted++;
          } catch (e) {
            console.warn(`Could not delete ${file}:`, e.message);
          }
        }
      }
    }
    steps.push(`Deleted ${academyDbsDeleted} academy database file(s)`);

    // Step 3: Wipe central database files
    const centralFiles = [
      config.centralDbPath,
      `${config.centralDbPath}-wal`,
      `${config.centralDbPath}-shm`
    ];
    for (const f of centralFiles) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch (e) {
          console.warn(`Could not delete ${f}:`, e.message);
        }
      }
    }
    steps.push('Completely dropped and removed central.db');

    // Step 4: Re-initialize fresh central database & execute central migrations
    resetCentralDbInstance();
    const centralDb = getCentralDb();
    steps.push('Recreated pristine central database with latest schema migrations');

    // Step 5: Setup Super Admin from user input (NOT auto-configured)
    const saltRounds = 10;
    const passwordHash = bcrypt.hashSync(admin_password, saltRounds);
    centralDb.prepare(`
      INSERT INTO super_admins (name, email, password_hash, status)
      VALUES (?, ?, ?, 'active')
    `).run(admin_name.trim(), admin_email.trim().toLowerCase(), passwordHash);
    steps.push(`Created Super Admin user: ${admin_email.trim().toLowerCase()}`);

    // Step 6: Platform Configuration / Settings
    const insertSetting = centralDb.prepare('INSERT OR REPLACE INTO central_settings (key, value) VALUES (?, ?)');
    insertSetting.run('platform_name', 'International Sports Solutions');
    insertSetting.run('currency_symbol', '₹');
    insertSetting.run('currency_code', 'INR');
    insertSetting.run('support_email', admin_email.trim().toLowerCase());
    insertSetting.run('enable_registrations', 'true');
    steps.push('Configured central platform settings');

    // Step 7: Seed Subscription Plans & Limits
    const plansToSeed = [
      {
        name: 'Starter',
        slug: 'starter',
        description: 'Starter tier for single-branch sports clubs and individual dojos',
        price: 999,
        billing_interval: 'monthly',
        trial_days: 14,
        status: 'active',
        is_default: 1,
        limits: { branches: 1, coaches: 3, batches: 5, students: 75, students_per_batch: 25, users: 5 },
        features: { syllabus: 1, facilities: 1, events: 0, payroll: 0, smart_attendance: 0, face_attendance: 0 },
      },
      {
        name: 'Standard',
        slug: 'standard',
        description: 'Best for growing sports academies with multiple batches, schedules, and staff',
        price: 2499,
        billing_interval: 'monthly',
        trial_days: 14,
        status: 'active',
        is_default: 0,
        limits: { branches: 3, coaches: 10, batches: 15, students: 250, students_per_batch: 30, users: 15 },
        features: { syllabus: 1, facilities: 1, events: 1, payroll: 1, smart_attendance: 1, face_attendance: 1 },
      },
      {
        name: 'Professional',
        slug: 'professional',
        description: 'High-capacity multi-campus academies with extensive payroll and event operations',
        price: 4999,
        billing_interval: 'monthly',
        trial_days: 30,
        status: 'active',
        is_default: 0,
        limits: { branches: 8, coaches: 25, batches: 40, students: 800, students_per_batch: 40, users: 35 },
        features: { syllabus: 1, facilities: 1, events: 1, payroll: 1, smart_attendance: 1, face_attendance: 1 },
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Nationwide sports organizations and federations with priority SLA and scale',
        price: 9999,
        billing_interval: 'monthly',
        trial_days: 30,
        status: 'active',
        is_default: 0,
        limits: { branches: 25, coaches: 100, batches: 150, students: 3000, students_per_batch: 60, users: 100 },
        features: { syllabus: 1, facilities: 1, events: 1, payroll: 1, smart_attendance: 1, face_attendance: 1 },
      },
    ];

    for (const p of plansToSeed) {
      const ins = centralDb.prepare(`
        INSERT INTO subscription_plans (name, slug, description, price, billing_interval, trial_days, status, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(p.name, p.slug, p.description, p.price, p.billing_interval, p.trial_days, p.status, p.is_default);
      const planId = Number(ins.lastInsertRowid);

      for (const [qKey, qVal] of Object.entries(p.limits)) {
        centralDb.prepare(`
          INSERT INTO subscription_plan_limits (plan_id, quota_key, limit_value, counting_policy)
          VALUES (?, ?, ?, 'active_only')
        `).run(planId, qKey, qVal);
      }

      for (const [feat, isEn] of Object.entries(p.features)) {
        centralDb.prepare(`
          INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled)
          VALUES (?, ?, ?)
        `).run(planId, feat, isEn);
      }
    }
    steps.push('Seeded 4 subscription tiers (Starter, Standard, Professional, Enterprise)');

    // Step 8: Seed Permissions Catalog & Central Role Templates
    const insertCentralPerm = centralDb.prepare(`
      INSERT OR REPLACE INTO central_permissions (permission_key, category, description)
      VALUES (?, ?, ?)
    `);
    for (const perm of ALL_ACADEMY_PERMISSIONS) {
      const category = perm.split('_')[1] || 'general';
      const description = `Permission to ${perm.replace(/_/g, ' ')}`;
      insertCentralPerm.run(perm, category, description);
    }

    const insertCentralRole = centralDb.prepare(`
      INSERT OR REPLACE INTO central_role_templates (name, display_name, description, permissions, is_system, theme_color)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const role of DEFAULT_ACADEMY_ROLES) {
      insertCentralRole.run(
        role.name,
        role.display_name,
        role.description,
        JSON.stringify(role.permissions),
        role.is_system,
        role.theme_color
      );
    }
    steps.push(`Seeded ${ALL_ACADEMY_PERMISSIONS.length} permissions & ${DEFAULT_ACADEMY_ROLES.length} role templates`);

    // Step 9: Seed ONLY 1 academy: "Pratik Karate Academy"
    // Clean academy only: NO branches, NO batches, NO students, NO coaches, NO attendance, NO dummy data
    const pratikAcademyData = {
      id: 1,
      name: 'Pratik Karate Academy',
      slug: 'pratik-karate-academy',
      contact_email: 'admin@pratikkarate.com',
      contact_phone: '+91 98250 12345',
      address: 'Dojo Complex, Navrangpura',
      city: 'Ahmedabad',
      plan: 'enterprise',
      max_branches: 10,
      max_students: 1500,
      max_coaches: 80,
    };

    // Use provisionAcademyDb without admin_email to avoid creating unnecessary dummy admin, or pass base admin
    const provisioned = provisionAcademyDb(pratikAcademyData);
    const tenantDb = getTenantDbById(provisioned.id);

    // Ensure tenant has NO demo records (branches, batches, students, coaches, attendance, fees, etc.)
    tenantDb.exec(`
      DELETE FROM branches;
      DELETE FROM batches;
      DELETE FROM students;
      DELETE FROM student_batch_enrollments;
      DELETE FROM student_attendance;
      DELETE FROM coaches;
      DELETE FROM users;
      DELETE FROM sports;
      DELETE FROM syllabus_categories;
      DELETE FROM syllabus_techniques;
      DELETE FROM student_fees;
      DELETE FROM fee_payments;
      DELETE FROM employment_records;
      DELETE FROM staff_salary_profiles;
      DELETE FROM staff_punches;
      DELETE FROM academy_holidays;
      DELETE FROM branch_work_schedules;
    `);

    // Ensure active subscription for Pratik Karate Academy
    const entPlan = centralDb.prepare("SELECT id FROM subscription_plans WHERE slug = 'enterprise'").get();
    if (entPlan) {
      centralDb.prepare(`
        INSERT OR REPLACE INTO academy_subscriptions (academy_id, plan_id, status, starts_at)
        VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
      `).run(provisioned.id, entPlan.id);
    }

    steps.push('Provisioned empty "Pratik Karate Academy" (ID: 1) — clean slate without any branches, batches, or demo records');

    return res.json({
      success: true,
      message: 'Platform factory reset and initialization completed successfully.',
      superAdminEmail: admin_email.trim().toLowerCase(),
      plansCount: plansToSeed.length,
      rolesCount: DEFAULT_ACADEMY_ROLES.length,
      permissionsCount: ALL_ACADEMY_PERMISSIONS.length,
      academyName: 'Pratik Karate Academy',
      academyDbsDeleted,
      steps,
    });
  } catch (err) {
    console.error('[Public Setup Error]', err);
    return res.status(500).json({ success: false, error: err.message, steps });
  }
});

