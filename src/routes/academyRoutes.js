import express from 'express';
import { resolveTenant } from '../middleware/tenantResolver.js';
import { requireAuth, requireAcademyStaff } from '../middleware/auth.js';
import { streamAcademyBackup } from '../services/backupService.js';

export const academyRouter = express.Router();

// All routes here require valid auth, academy staff access, and tenant DB resolution
academyRouter.use(requireAuth, requireAcademyStaff, resolveTenant);

/**
 * GET /api/academy/dashboard
 * Aggregates summary analytics from the tenant's isolated database
 */
academyRouter.get('/dashboard', (req, res) => {
  try {
    const db = req.tenantDb;

    const totalStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'active'").get().c;
    const totalCoaches = db.prepare("SELECT COUNT(*) as c FROM coaches WHERE is_active = 1").get().c;
    const totalBatches = db.prepare("SELECT COUNT(*) as c FROM batches WHERE is_active = 1").get().c;

    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = db.prepare(`
      SELECT 
        COUNT(sa.id) as total_marked,
        SUM(CASE WHEN sa.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN sa.status = 'absent' THEN 1 ELSE 0 END) as absent_count
      FROM attendance a
      JOIN student_attendance sa ON sa.attendance_id = a.id
      WHERE a.date = ?
    `).get(today);

    const feeStats = db.prepare(`
      SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
        COALESCE(SUM(balance_amount), 0) as total_outstanding,
        COALESCE(SUM(paid_amount), 0) as total_collected
      FROM student_fees
    `).get();

    const pendingLeaves = db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status = 'pending'").get().c;

    // Recent activities from audit log
    const recentActivity = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5').all();

    res.json({
      success: true,
      academy: {
        id: req.academy.id,
        name: req.academy.name,
        slug: req.academy.slug,
        plan: req.academy.plan,
        limits: {
          max_branches: req.academy.max_branches,
          max_students: req.academy.max_students,
          max_coaches: req.academy.max_coaches,
        },
      },
      metrics: {
        totalStudents,
        totalCoaches,
        totalBatches,
        todayAttendance: {
          date: today,
          marked: todayAttendance.total_marked || 0,
          present: todayAttendance.present_count || 0,
          absent: todayAttendance.absent_count || 0,
        },
        fees: feeStats,
        pendingLeaves,
      },
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// STUDENTS
// ==========================================

/**
 * GET /api/academy/students
 */
academyRouter.get('/students', (req, res) => {
  try {
    const db = req.tenantDb;
    const { search, branch_id, status } = req.query;

    let query = `
      SELECT s.*, b.name as branch_name,
             (SELECT GROUP_CONCAT(bt.name, ', ') 
              FROM student_batches sb 
              JOIN batches bt ON bt.id = sb.batch_id 
              WHERE sb.student_id = s.id AND sb.is_active = 1) as enrolled_batches
      FROM students s
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_code LIKE ? OR s.email LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (branch_id) {
      query += ` AND s.branch_id = ?`;
      params.push(Number(branch_id));
    }
    if (status) {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY s.id DESC`;

    const students = db.prepare(query).all(...params);
    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/students
 */
academyRouter.post('/students', (req, res) => {
  try {
    const db = req.tenantDb;
    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      gender,
      guardian_name,
      guardian_phone,
      guardian_email,
      address,
      branch_id,
      blood_group,
      batch_id,
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'First name and last name are required' });
    }

    // Check student quota against plan limit
    const currentCount = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
    if (currentCount >= req.academy.max_students) {
      return res.status(403).json({
        success: false,
        error: `Student limit reached (${req.academy.max_students}). Upgrade your plan in Central Admin.`,
      });
    }

    // Generate unique student code: STU-XXXX
    const studentCode = `STU-${Math.floor(1000 + Math.random() * 9000)}`;

    const insert = db.prepare(`
      INSERT INTO students (
        student_code, first_name, last_name, email, phone, date_of_birth,
        gender, guardian_name, guardian_phone, guardian_email, address,
        branch_id, blood_group, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = insert.run(
      studentCode,
      first_name.trim(),
      last_name.trim(),
      email ? email.trim() : null,
      phone || null,
      date_of_birth || null,
      gender || null,
      guardian_name || null,
      guardian_phone || null,
      guardian_email || null,
      address || null,
      branch_id ? Number(branch_id) : null,
      blood_group || null
    );

    const newStudentId = result.lastInsertRowid;

    // Optional batch enrollment
    if (batch_id) {
      db.prepare('INSERT OR IGNORE INTO student_batches (student_id, batch_id) VALUES (?, ?)').run(newStudentId, Number(batch_id));
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, ?, 'CREATE', 'students', ?, ?, ?)
    `).run(req.user.userId, req.user.name, req.user.role, String(newStudentId), `Added student ${first_name} ${last_name} (${studentCode})`, req.ip);

    res.status(201).json({
      success: true,
      message: 'Student enrolled successfully',
      studentId: newStudentId,
      studentCode,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/students/:id
 */
academyRouter.put('/students/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const id = Number(req.params.id);
    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      gender,
      guardian_name,
      guardian_phone,
      guardian_email,
      address,
      branch_id,
      blood_group,
      status,
    } = req.body;

    db.prepare(`
      UPDATE students
      SET first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          date_of_birth = COALESCE(?, date_of_birth),
          gender = COALESCE(?, gender),
          guardian_name = COALESCE(?, guardian_name),
          guardian_phone = COALESCE(?, guardian_phone),
          guardian_email = COALESCE(?, guardian_email),
          address = COALESCE(?, address),
          branch_id = COALESCE(?, branch_id),
          blood_group = COALESCE(?, blood_group),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      first_name || null,
      last_name || null,
      email || null,
      phone || null,
      date_of_birth || null,
      gender || null,
      guardian_name || null,
      guardian_phone || null,
      guardian_email || null,
      address || null,
      branch_id ? Number(branch_id) : null,
      blood_group || null,
      status || null,
      id
    );

    res.json({ success: true, message: 'Student updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// COACHES & STAFF
// ==========================================

/**
 * GET /api/academy/coaches
 */
academyRouter.get('/coaches', (req, res) => {
  try {
    const db = req.tenantDb;
    const coaches = db.prepare(`
      SELECT c.*, s.name as sport_name, b.name as branch_name,
             (SELECT COUNT(*) FROM batches bt WHERE bt.coach_id = c.id AND bt.is_active = 1) as active_batches
      FROM coaches c
      LEFT JOIN sports s ON s.id = c.sport_id
      LEFT JOIN branches b ON b.id = c.branch_id
      ORDER BY c.id DESC
    `).all();

    res.json({ success: true, coaches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/coaches
 */
academyRouter.post('/coaches', (req, res) => {
  try {
    const db = req.tenantDb;
    const { name, email, phone, sport_id, branch_id, specializations, experience_years, salary_type, salary_amount } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Coach name is required' });
    }

    const currentCount = db.prepare('SELECT COUNT(*) as c FROM coaches').get().c;
    if (currentCount >= req.academy.max_coaches) {
      return res.status(403).json({
        success: false,
        error: `Coach limit reached (${req.academy.max_coaches}). Upgrade plan to add more coaches.`,
      });
    }

    const insert = db.prepare(`
      INSERT INTO coaches (
        name, email, phone, sport_id, branch_id, specializations,
        experience_years, salary_type, salary_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      name.trim(),
      email || null,
      phone || null,
      sport_id ? Number(sport_id) : null,
      branch_id ? Number(branch_id) : null,
      specializations || null,
      experience_years ? Number(experience_years) : 0,
      salary_type || 'monthly',
      salary_amount ? Number(salary_amount) : 0
    );

    res.status(201).json({ success: true, coachId: result.lastInsertRowid, message: 'Coach added successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// BATCHES & SCHEDULES
// ==========================================

/**
 * GET /api/academy/batches
 */
academyRouter.get('/batches', (req, res) => {
  try {
    const db = req.tenantDb;
    const batches = db.prepare(`
      SELECT bt.*, s.name as sport_name, b.name as branch_name, c.name as coach_name,
             (SELECT COUNT(*) FROM student_batches sb WHERE sb.batch_id = bt.id AND sb.is_active = 1) as enrolled_count
      FROM batches bt
      LEFT JOIN sports s ON s.id = bt.sport_id
      LEFT JOIN branches b ON b.id = bt.branch_id
      LEFT JOIN coaches c ON c.id = bt.coach_id
      ORDER BY bt.id DESC
    `).all();

    res.json({ success: true, batches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/batches
 */
academyRouter.post('/batches', (req, res) => {
  try {
    const db = req.tenantDb;
    const { name, sport_id, branch_id, coach_id, start_time, end_time, days_of_week, max_capacity, monthly_fee } = req.body;

    if (!name || !start_time || !end_time) {
      return res.status(400).json({ success: false, error: 'Batch name, start time, and end time are required' });
    }

    const insert = db.prepare(`
      INSERT INTO batches (
        name, sport_id, branch_id, coach_id, start_time, end_time,
        days_of_week, max_capacity, monthly_fee
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      name.trim(),
      sport_id ? Number(sport_id) : null,
      branch_id ? Number(branch_id) : null,
      coach_id ? Number(coach_id) : null,
      start_time,
      end_time,
      typeof days_of_week === 'object' ? JSON.stringify(days_of_week) : days_of_week || '["Mon","Wed","Fri"]',
      max_capacity ? Number(max_capacity) : 30,
      monthly_fee ? Number(monthly_fee) : 0
    );

    res.status(201).json({ success: true, batchId: result.lastInsertRowid, message: 'Batch created successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/batches/:id/students
 */
academyRouter.get('/batches/:id/students', (req, res) => {
  try {
    const db = req.tenantDb;
    const batchId = Number(req.params.id);

    const students = db.prepare(`
      SELECT s.id, s.student_code, s.first_name, s.last_name, s.phone, s.guardian_phone, sb.joined_at
      FROM students s
      JOIN student_batches sb ON sb.student_id = s.id
      WHERE sb.batch_id = ? AND sb.is_active = 1
      ORDER BY s.first_name ASC
    `).all(batchId);

    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ATTENDANCE
// ==========================================

/**
 * GET /api/academy/attendance
 */
academyRouter.get('/attendance', (req, res) => {
  try {
    const db = req.tenantDb;
    const { batch_id, date } = req.query;

    if (!batch_id || !date) {
      return res.status(400).json({ success: false, error: 'batch_id and date query parameters are required' });
    }

    const attendanceRecord = db.prepare('SELECT * FROM attendance WHERE batch_id = ? AND date = ?').get(Number(batch_id), date);

    // List all enrolled students in this batch, along with marked attendance if exists
    const roster = db.prepare(`
      SELECT 
        s.id as student_id,
        s.student_code,
        s.first_name,
        s.last_name,
        sa.status,
        sa.remarks
      FROM students s
      JOIN student_batches sb ON sb.student_id = s.id AND sb.batch_id = ? AND sb.is_active = 1
      LEFT JOIN student_attendance sa ON sa.student_id = s.id AND sa.attendance_id = ?
      ORDER BY s.first_name ASC
    `).all(Number(batch_id), attendanceRecord ? attendanceRecord.id : -1);

    res.json({
      success: true,
      attendanceRecord: attendanceRecord || null,
      roster,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/attendance
 * Marks or updates attendance for a batch on a given date
 */
academyRouter.post('/attendance', (req, res) => {
  try {
    const db = req.tenantDb;
    const { batch_id, date, entries, notes } = req.body;

    if (!batch_id || !date || !Array.isArray(entries)) {
      return res.status(400).json({ success: false, error: 'batch_id, date, and entries array are required' });
    }

    const tx = db.transaction(() => {
      // Find or create attendance header
      let att = db.prepare('SELECT id FROM attendance WHERE batch_id = ? AND date = ?').get(Number(batch_id), date);
      let attId;

      if (att) {
        attId = att.id;
        db.prepare('UPDATE attendance SET notes = COALESCE(?, notes) WHERE id = ?').run(notes || null, attId);
      } else {
        const ins = db.prepare('INSERT INTO attendance (batch_id, date, taken_by_user_id, notes) VALUES (?, ?, ?, ?)');
        const res = ins.run(Number(batch_id), date, req.user.userId, notes || null);
        attId = res.lastInsertRowid;
      }

      const upsertStudentAttendance = db.prepare(`
        INSERT INTO student_attendance (attendance_id, student_id, status, remarks)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(attendance_id, student_id) DO UPDATE SET
          status = excluded.status,
          remarks = excluded.remarks
      `);

      for (const entry of entries) {
        upsertStudentAttendance.run(attId, Number(entry.student_id), entry.status || 'present', entry.remarks || null);
      }
    });

    tx();

    res.json({ success: true, message: `Attendance marked successfully for ${entries.length} students` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// FEES & PAYMENTS
// ==========================================

/**
 * GET /api/academy/fees
 */
academyRouter.get('/fees', (req, res) => {
  try {
    const db = req.tenantDb;
    const { status, student_id } = req.query;

    let query = `
      SELECT sf.*, s.student_code, s.first_name, s.last_name, s.phone,
             fs.name as fee_structure_name
      FROM student_fees sf
      JOIN students s ON s.id = sf.student_id
      LEFT JOIN fee_structures fs ON fs.id = sf.fee_structure_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND sf.status = ?`;
      params.push(status);
    }
    if (student_id) {
      query += ` AND sf.student_id = ?`;
      params.push(Number(student_id));
    }

    query += ` ORDER BY sf.due_date ASC, sf.id DESC`;

    const fees = db.prepare(query).all(...params);
    res.json({ success: true, fees });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/fees
 * Generates a new student fee invoice
 */
academyRouter.post('/fees', (req, res) => {
  try {
    const db = req.tenantDb;
    const { student_id, fee_structure_id, title, due_date, amount, discount_amount = 0, tax_amount = 0, notes } = req.body;

    if (!student_id || !title || !due_date || amount === undefined) {
      return res.status(400).json({ success: false, error: 'student_id, title, due_date, and amount are required' });
    }

    const netAmount = Number(amount) - Number(discount_amount) + Number(tax_amount);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const insert = db.prepare(`
      INSERT INTO student_fees (
        student_id, fee_structure_id, invoice_number, title, due_date,
        amount, discount_amount, tax_amount, net_amount, paid_amount, balance_amount,
        status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?)
    `);

    const result = insert.run(
      Number(student_id),
      fee_structure_id ? Number(fee_structure_id) : null,
      invoiceNumber,
      title.trim(),
      due_date,
      Number(amount),
      Number(discount_amount),
      Number(tax_amount),
      netAmount,
      netAmount,
      notes || null
    );

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoiceId: result.lastInsertRowid,
      invoiceNumber,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/academy/fees/pay
 * Records a payment against an invoice and updates balance/status
 */
academyRouter.post('/fees/pay', (req, res) => {
  try {
    const db = req.tenantDb;
    const { student_fee_id, amount, payment_mode = 'cash', transaction_reference, notes } = req.body;

    if (!student_fee_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid student_fee_id and payment amount required' });
    }

    const invoice = db.prepare('SELECT * FROM student_fees WHERE id = ?').get(Number(student_fee_id));
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const paymentAmount = Number(amount);
    const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;

    const tx = db.transaction(() => {
      // 1. Insert payment record
      db.prepare(`
        INSERT INTO fee_payments (
          student_fee_id, receipt_number, payment_date, amount,
          payment_mode, transaction_reference, notes, collected_by
        ) VALUES (?, ?, DATE('now'), ?, ?, ?, ?, ?)
      `).run(
        invoice.id,
        receiptNumber,
        paymentAmount,
        payment_mode,
        transaction_reference || null,
        notes || null,
        req.user.userId
      );

      // 2. Update invoice balances
      const newPaid = invoice.paid_amount + paymentAmount;
      const newBalance = Math.max(0, invoice.net_amount - newPaid);
      let newStatus = 'partial';
      if (newBalance <= 0) {
        newStatus = 'paid';
      }

      db.prepare(`
        UPDATE student_fees
        SET paid_amount = ?,
            balance_amount = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaid, newBalance, newStatus, invoice.id);
    });

    tx();

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      receiptNumber,
      amount: paymentAmount,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// LEAVES, BRANCHES, SPORTS, AUDIT, BACKUP
// ==========================================

/**
 * GET /api/academy/leaves
 */
academyRouter.get('/leaves', (req, res) => {
  try {
    const db = req.tenantDb;
    const leaves = db.prepare('SELECT * FROM leave_requests ORDER BY id DESC').all();
    res.json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/academy/leaves/:id
 */
academyRouter.put('/leaves/:id', (req, res) => {
  try {
    const db = req.tenantDb;
    const { status, reviewer_comments } = req.body;
    const id = Number(req.params.id);

    db.prepare(`
      UPDATE leave_requests
      SET status = ?,
          reviewer_comments = ?,
          reviewed_by = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, reviewer_comments || null, req.user.userId, id);

    res.json({ success: true, message: `Leave request ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/branches
 */
academyRouter.get('/branches', (req, res) => {
  try {
    const db = req.tenantDb;
    const branches = db.prepare('SELECT * FROM branches ORDER BY name ASC').all();
    res.json({ success: true, branches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/sports
 */
academyRouter.get('/sports', (req, res) => {
  try {
    const db = req.tenantDb;
    const sports = db.prepare('SELECT * FROM sports ORDER BY name ASC').all();
    res.json({ success: true, sports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/facilities
 */
academyRouter.get('/facilities', (req, res) => {
  try {
    const db = req.tenantDb;
    const facilities = db.prepare(`
      SELECT f.*, b.name as branch_name 
      FROM facilities f 
      LEFT JOIN branches b ON b.id = f.branch_id 
      ORDER BY f.name ASC
    `).all();
    res.json({ success: true, facilities });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/inventory
 */
academyRouter.get('/inventory', (req, res) => {
  try {
    const db = req.tenantDb;
    const items = db.prepare(`
      SELECT eq.*, s.name as sport_name, b.name as branch_name 
      FROM equipment_inventory eq
      LEFT JOIN sports s ON s.id = eq.sport_id
      LEFT JOIN branches b ON b.id = eq.branch_id
      ORDER BY eq.name ASC
    `).all();
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/audit-logs
 */
academyRouter.get('/audit-logs', (req, res) => {
  try {
    const db = req.tenantDb;
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/academy/backup
 * Downloads this academy's isolated database backup
 */
academyRouter.get('/backup', async (req, res) => {
  try {
    await streamAcademyBackup(req.academy.id, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});
