import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenantResolver.js';
import { SyllabusService } from '../services/syllabusService.js';

export const studentRouter = express.Router();

studentRouter.use(requireAuth, resolveTenant);

/**
 * Middleware: ensure current user is student (or admin/staff viewing student profile)
 */
function ensureStudentAccess(req, res, next) {
  if (req.user.role === 'student' || req.user.isSuperAdmin || ['academy_admin', 'academy_staff'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Student portal access only' });
}

studentRouter.use(ensureStudentAccess);

/**
 * GET /api/student/dashboard
 */
studentRouter.get('/dashboard', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = req.user.role === 'student' ? req.user.userId : Number(req.query.student_id);

    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Student identifier required' });
    }

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student profile not found' });
    }

    // Active Batch (Student has at most ONE active batch at any time)
    const activeBatch = db.prepare(`
      SELECT b.*, s.name as sport_name, c.name as coach_name, br.name as branch_name,
             sbe.start_date as enrolled_date
      FROM student_batch_enrollments sbe
      JOIN batches b ON b.id = sbe.batch_id
      LEFT JOIN sports s ON s.id = b.sport_id
      LEFT JOIN coaches c ON c.id = b.coach_id
      LEFT JOIN branches br ON br.id = b.branch_id
      WHERE sbe.student_id = ? AND sbe.status = 'active'
    `).get(studentId);

    // Attendance stats
    const attendanceStats = db.prepare(`
      SELECT 
        COUNT(sa.id) as total_sessions,
        SUM(CASE WHEN sa.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN sa.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN sa.status = 'late' THEN 1 ELSE 0 END) as late_count
      FROM student_attendance sa
      WHERE sa.student_id = ?
    `).get(studentId);

    const totalSessions = attendanceStats.total_sessions || 0;
    const attendancePct = totalSessions > 0 ? Math.round(((attendanceStats.present_count || 0) / totalSessions) * 100) : 100;

    // Fees stats
    const feeSummary = db.prepare(`
      SELECT 
        COALESCE(SUM(balance_amount), 0) as outstanding_balance,
        COALESCE(SUM(paid_amount), 0) as total_paid
      FROM student_fees
      WHERE student_id = ?
    `).get(studentId);

    res.json({
      success: true,
      student: {
        id: student.id,
        code: student.student_code,
        name: `${student.first_name} ${student.last_name}`,
        email: student.email,
        phone: student.phone,
        status: student.status,
      },
      batches: activeBatch ? [activeBatch] : [],
      activeBatch: activeBatch || null,
      attendance: {
        totalSessions,
        present: attendanceStats.present_count || 0,
        absent: attendanceStats.absent_count || 0,
        percentage: attendancePct,
      },
      fees: feeSummary,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/student/attendance
 */
studentRouter.get('/attendance', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = req.user.role === 'student' ? req.user.userId : Number(req.query.student_id);

    const records = db.prepare(`
      SELECT sa.*, a.date, b.name as batch_name
      FROM student_attendance sa
      JOIN attendance a ON a.id = sa.attendance_id
      JOIN batches b ON b.id = a.batch_id
      WHERE sa.student_id = ?
      ORDER BY a.date DESC
      LIMIT 50
    `).all(studentId);

    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/student/fees
 */
studentRouter.get('/fees', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = req.user.role === 'student' ? req.user.userId : Number(req.query.student_id);

    const invoices = db.prepare(`
      SELECT sf.*, 
        (SELECT json_group_array(json_object(
          'id', fp.id,
          'receipt_number', fp.receipt_number,
          'amount', fp.amount,
          'payment_date', fp.payment_date,
          'payment_mode', fp.payment_mode
        )) FROM fee_payments fp WHERE fp.student_fee_id = sf.id) as payments_json
      FROM student_fees sf
      WHERE sf.student_id = ?
      ORDER BY sf.due_date DESC
    `).all(studentId);

    const formatted = invoices.map(inv => ({
      ...inv,
      payments: inv.payments_json ? JSON.parse(inv.payments_json) : [],
    }));

    res.json({ success: true, invoices: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/student/pay
 * Simulated payment from student self-service portal
 */
studentRouter.post('/pay', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = req.user.role === 'student' ? req.user.userId : Number(req.body.student_id);
    const { student_fee_id, amount, payment_mode = 'upi' } = req.body;

    const invoice = db.prepare('SELECT * FROM student_fees WHERE id = ? AND student_id = ?').get(Number(student_fee_id), studentId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found or does not belong to you' });
    }

    const payAmt = Math.min(Number(amount), invoice.balance_amount);
    const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO fee_payments (student_fee_id, receipt_number, payment_date, amount, payment_mode, notes)
        VALUES (?, ?, DATE('now'), ?, ?, 'Student Portal Online Payment')
      `).run(invoice.id, receiptNumber, payAmt, payment_mode);

      const newPaid = invoice.paid_amount + payAmt;
      const newBalance = Math.max(0, invoice.net_amount - newPaid);
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';

      db.prepare(`
        UPDATE student_fees
        SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaid, newBalance, newStatus, invoice.id);
    });

    tx();

    res.json({
      success: true,
      message: 'Payment processed successfully',
      receiptNumber,
      paidAmount: payAmt,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/student/leaves
 */
studentRouter.post('/leaves', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = req.user.role === 'student' ? req.user.userId : Number(req.body.student_id);
    const { start_date, end_date, reason } = req.body;

    if (!start_date || !end_date || !reason) {
      return res.status(400).json({ success: false, error: 'Start date, end date, and reason are required' });
    }

    const student = db.prepare('SELECT first_name, last_name FROM students WHERE id = ?').get(studentId);
    const studentName = student ? `${student.first_name} ${student.last_name}` : req.user.name;

    const insert = db.prepare(`
      INSERT INTO leave_requests (applicant_type, applicant_id, applicant_name, start_date, end_date, reason, status)
      VALUES ('student', ?, ?, ?, ?, ?, 'pending')
    `);

    insert.run(studentId, studentName, start_date, end_date, reason.trim());

    res.status(201).json({ success: true, message: 'Leave application submitted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/student/batch-history
 */
studentRouter.get('/batch-history', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = req.user.role === 'student' ? req.user.userId : Number(req.query.student_id);

    const history = db.prepare(`
      SELECT 
        sbe.*,
        b.name as batch_name,
        sp.name as sport_name,
        br.name as branch_name,
        tb.name as transferred_to_batch_name
      FROM student_batch_enrollments sbe
      JOIN batches b ON b.id = sbe.batch_id
      LEFT JOIN sports sp ON sp.id = b.sport_id
      LEFT JOIN branches br ON br.id = b.branch_id
      LEFT JOIN batches tb ON tb.id = sbe.transferred_to_batch_id
      WHERE sbe.student_id = ?
      ORDER BY sbe.id DESC
    `).all(studentId);

    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/student/technique-history
 * Allows student to view their current active technique, belt level, and learning progression
 */
studentRouter.get('/technique-history', (req, res) => {
  try {
    const db = req.tenantDb;
    const studentId = req.user.role === 'student' ? req.user.userId : Number(req.query.student_id);

    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Student identifier required' });
    }

    const progress = SyllabusService.getStudentTechniqueHistory(db, studentId);
    res.json({ success: true, studentId, ...progress });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

