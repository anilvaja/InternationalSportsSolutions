import express from 'express';
import { getCentralDb } from '../db/centralDb.js';
import { getTenantDbById } from '../db/connectionManager.js';
import { extractSubdomain, extractHost } from '../middleware/tenantResolver.js';

export const publicRouter = express.Router();

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
    const targetDomain = queryDomain || (
      host && host !== 'localhost' && host !== '127.0.0.1' && host !== 'internationalsportssolutions.test' ? host : null
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
