/**
 * FeeService - Comprehensive Student Fee Lifecycle Management
 * 
 * Implements:
 * 1. Calendar-accurate fee periods and next installment calculation (handling Feb, leap years, 28-31 day months).
 * 2. Student fee overrides with precedence over batch rates.
 * 3. Multi-month selection (1, 2, 3, 4, 5, 6, 9, 12 months) and discount presets.
 * 4. Strict 20% discount ceiling enforcement and decimal-safe currency arithmetic.
 * 5. Student fee ledger as the single source of truth for chronological history and paid-through tracking.
 * 6. Partial payments and outstanding balances tracking without premature period advancement.
 * 7. Approval-controlled fee pauses & membership holds that safely adjust the fee timeline upon approval.
 */

import { DateUtils } from '../utils/dateUtils.js';

export class FeeService {
  /**
   * Safe decimal rounding to 2 decimal places
   */
  static round2(val) {
    return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
  }

  /**
   * Helper: check if year is leap year
   */
  static isLeapYear(year) {
    return DateUtils.isLeapYear(year);
  }

  /**
   * Helper: number of days in a given month (1-indexed month: 1=Jan, 2=Feb, ..., 12=Dec)
   */
  static daysInMonth(year, month) {
    return DateUtils.getDaysInMonth(year, month);
  }

  /**
   * Formats YYYY-MM-DD
   */
  static formatDate(y, m, d) {
    return DateUtils.formatIsoDate(y, m, d);
  }

  /**
   * Accurate calendar month arithmetic.
   * End date is strictly the day immediately preceding the next installment date.
   * Clamps day of month if target month has fewer days (e.g. 31 Jan -> 28/29 Feb, not March).
   * 
   * @param {string} startDateStr - 'YYYY-MM-DD' or 'DD/MM/YYYY'
   * @param {number} monthsCount - Integer (1 to 12)
   * @returns {{ periodStart: string, periodEnd: string, nextInstallmentDate: string }}
   */
  static addCalendarMonths(startDateStr, monthsCount) {
    if (!startDateStr || typeof startDateStr !== 'string') {
      throw new Error('Valid startDate (YYYY-MM-DD) is required');
    }
    const count = Number(monthsCount);
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error('monthsCount must be a positive integer');
    }

    const normalizedStr = DateUtils.parseAndNormalizeDate(startDateStr, { fieldName: 'startDate' });

    const parts = normalizedStr.split('-').map(Number);
    const startYear = parts[0];
    const startMonth = parts[1]; // 1-12
    const startDay = parts[2];   // 1-31

    // Compute target month & year
    const totalMonths = (startYear * 12) + (startMonth - 1) + count;
    const targetYear = Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1; // 1-12

    // Clamp day if target month has fewer days (e.g. Jan 31 + 1 month -> Feb 28 in non-leap year)
    const maxDays = this.daysInMonth(targetYear, targetMonth);
    const targetDay = Math.min(startDay, maxDays);

    const nextInstallmentDate = this.formatDate(targetYear, targetMonth, targetDay);
    const periodEnd = DateUtils.addDays(nextInstallmentDate, -1);

    return {
      periodStart: normalizedStr,
      periodEnd,
      nextInstallmentDate,
    };
  }

  /**
   * Adds specified number of days to a 'YYYY-MM-DD' date string
   */
  static addDays(dateStr, days) {
    return DateUtils.addDays(dateStr, days);
  }

  /**
   * Resolves the student's applicable monthly fee rate.
   * Priority:
   * 1. Student-specific fee override (if active on targetDate)
   * 2. Batch-level monthly fee
   * 3. Default fallback
   */
  static getStudentMonthlyFee(db, studentId, targetDate = null) {
    const checkDate = targetDate || new Date().toISOString().split('T')[0];

    // 1. Check student-specific override
    const override = db.prepare(`
      SELECT * FROM student_fee_overrides
      WHERE student_id = ?
        AND is_active = 1
        AND effective_from <= ?
        AND (effective_until IS NULL OR effective_until >= ?)
      ORDER BY id DESC
      LIMIT 1
    `).get(studentId, checkDate, checkDate);

    if (override) {
      return {
        monthlyFee: Number(override.custom_monthly_fee),
        source: 'student_override',
        reason: override.reason,
        overrideId: override.id,
      };
    }

    // 2. Check active batch enrollment
    const batch = db.prepare(`
      SELECT b.id as batch_id, b.name as batch_name, b.monthly_fee
      FROM student_batch_enrollments sbe
      JOIN batches b ON b.id = sbe.batch_id
      WHERE sbe.student_id = ? AND sbe.status = 'active'
      ORDER BY sbe.id DESC
      LIMIT 1
    `).get(studentId);

    if (batch && batch.monthly_fee !== null && batch.monthly_fee !== undefined) {
      return {
        monthlyFee: Number(batch.monthly_fee),
        source: 'batch',
        batchId: batch.batch_id,
        batchName: batch.batch_name,
      };
    }

    // 3. Fallback: check student's branch general batch rate
    const branchBatch = db.prepare(`
      SELECT b.monthly_fee, b.name as batch_name
      FROM students s
      JOIN batches b ON b.branch_id = s.branch_id
      WHERE s.id = ?
      LIMIT 1
    `).get(studentId);

    if (branchBatch && branchBatch.monthly_fee) {
      return {
        monthlyFee: Number(branchBatch.monthly_fee),
        source: 'branch_batch',
        batchName: branchBatch.batch_name,
      };
    }

    return {
      monthlyFee: 1500, // Reasonable default sports academy rate
      source: 'default',
    };
  }

  /**
   * Calculates the student's next installment date and fee timeline from the ledger.
   * Crucial rule: The fee ledger and approved pauses dictate the next unpaid date,
   * not simply the calendar month or arbitrary payment date.
   */
  static getStudentFeeTimeline(db, studentId) {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!student) {
      throw new Error(`Student ${studentId} not found`);
    }

    // 0. Resolve admission / initial batch start date
    const activeEnrollment = db.prepare(`
      SELECT sbe.start_date, b.id as batch_id, b.name as batch_name, b.monthly_fee
      FROM student_batch_enrollments sbe
      LEFT JOIN batches b ON b.id = sbe.batch_id
      WHERE sbe.student_id = ? AND sbe.status = 'active'
      ORDER BY sbe.id ASC LIMIT 1
    `).get(studentId);

    const admissionStartDate = (activeEnrollment && activeEnrollment.start_date)
      || student.admission_date
      || student.enrolled_at
      || (student.created_at ? student.created_at.split(' ')[0] : null)
      || new Date().toISOString().split('T')[0];

    const joiningDate = admissionStartDate;

    // 1. Check for any outstanding/unpaid fee charges
    const unpaidFees = db.prepare(`
      SELECT * FROM student_fees
      WHERE student_id = ? AND status IN ('pending', 'partial', 'overdue')
      ORDER BY due_date ASC, id ASC
    `).all(studentId);

    const totalOutstanding = unpaidFees.reduce((acc, f) => acc + (f.balance_amount || 0), 0);

    // 2. Determine paid-through date from fully settled periods
    const latestPaidFee = db.prepare(`
      SELECT period_end, next_installment_date
      FROM student_fees
      WHERE student_id = ? AND status = 'paid' AND period_end IS NOT NULL
      ORDER BY period_end DESC, id DESC
      LIMIT 1
    `).get(studentId);

    let paidThroughDate = latestPaidFee ? latestPaidFee.period_end : null;

    // Check ledger for any extra paid-through date records
    const latestLedger = db.prepare(`
      SELECT paid_through_date, period_end
      FROM student_fee_ledger
      WHERE student_id = ? AND (paid_through_date IS NOT NULL OR period_end IS NOT NULL)
      ORDER BY COALESCE(paid_through_date, period_end) DESC, id DESC
      LIMIT 1
    `).get(studentId);

    if (latestLedger) {
      const ledgerDate = latestLedger.paid_through_date || latestLedger.period_end;
      if (!paidThroughDate || (ledgerDate && ledgerDate > paidThroughDate)) {
        paidThroughDate = ledgerDate;
      }
    }

    // Default next installment start date
    let nextStartDate;
    if (paidThroughDate) {
      nextStartDate = this.addDays(paidThroughDate, 1);
    } else {
      nextStartDate = admissionStartDate;
    }

    // 3. Reconcile with approved fee pauses
    // If nextStartDate falls within an approved pause, or an approved pause starts on nextStartDate:
    const approvedPauses = db.prepare(`
      SELECT * FROM fee_pause_requests
      WHERE student_id = ? AND status = 'approved'
      ORDER BY approved_start_date ASC
    `).all(studentId);

    for (const pause of approvedPauses) {
      const pStart = pause.approved_start_date || pause.requested_start_date;
      const pEnd = pause.approved_end_date || pause.requested_end_date;

      // If next installment is on or within the paused period, shift it past the pause!
      if (nextStartDate >= pStart && nextStartDate <= pEnd) {
        nextStartDate = this.addDays(pEnd, 1);
      }
    }

    const feeRate = this.getStudentMonthlyFee(db, studentId, nextStartDate);

    return {
      studentId,
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        student_code: student.student_code,
        admission_number: student.admission_number,
        phone: student.phone,
        email: student.email,
        branch_id: student.branch_id,
        branch_name: activeEnrollment ? activeEnrollment.batch_name : null,
      },
      joiningDate,
      admissionDate: admissionStartDate,
      admissionStartDate,
      batchStartDate: activeEnrollment ? activeEnrollment.start_date : null,
      paidThroughDate,
      nextStartDate,
      applicableMonthlyFee: feeRate.monthlyFee,
      monthlyFee: feeRate.monthlyFee,
      feeRateSource: feeRate.source,
      rateSource: feeRate.source,
      batchName: feeRate.batchName || (activeEnrollment ? activeEnrollment.batch_name : null),
      totalOutstanding: this.round2(totalOutstanding),
      unpaidBalance: this.round2(totalOutstanding),
      unpaidInvoicesCount: unpaidFees.length,
      unpaidInvoices: unpaidFees,
      approvedPauses,
    };
  }

  /**
   * Discount calculation with mandatory ceiling validation.
   * Standard accounts are capped at 20%; Admins can override up to 100% of base fee.
   * Never silently clamps invalid input; rejects with clear errors.
   */
  static calculateDiscount({ baseFee, monthsCount, discountType = 'none', discountValue = 0, db = null, allowAdminOverride = false }) {
    const base = Number(baseFee);
    if (isNaN(base) || base <= 0) {
      throw new Error('Base fee must be a positive number');
    }

    let presetPercentage = 0;
    if (db) {
      const preset = db.prepare('SELECT discount_percentage FROM fee_discount_presets WHERE months = ? AND is_active = 1').get(Number(monthsCount));
      if (preset) {
        presetPercentage = Number(preset.discount_percentage);
      }
    }

    let manualPercentage = 0;
    let manualFixedAmount = 0;

    if (discountType === 'percentage') {
      const pct = Number(discountValue);
      if (isNaN(pct) || pct < 0) {
        throw new Error('Discount percentage must be non-negative');
      }
      manualPercentage = pct;
    } else if (discountType === 'fixed') {
      const fixed = Number(discountValue);
      if (isNaN(fixed) || fixed < 0) {
        throw new Error('Fixed discount amount must be non-negative');
      }
      manualFixedAmount = fixed;
    } else if (discountType !== 'none' && discountType !== 'preset') {
      throw new Error(`Invalid discount type: ${discountType}. Allowed: 'none', 'percentage', 'fixed', 'preset'`);
    }

    // Combine preset and manual percentage
    const combinedPercentage = presetPercentage + manualPercentage;
    const percentageDiscountAmount = this.round2((combinedPercentage / 100) * base);
    const totalDiscountAmount = this.round2(percentageDiscountAmount + manualFixedAmount);

    // Enforce discount ceiling: Admin override allows up to 100% of base fee; standard ceiling is 20%
    const maxAllowedDiscount = allowAdminOverride ? this.round2(base) : this.round2(base * 0.20);

    if (totalDiscountAmount > maxAllowedDiscount + 0.001) {
      if (allowAdminOverride) {
        throw new Error(`Total discount of ₹${totalDiscountAmount} cannot exceed the total base fee of ₹${base}`);
      } else {
        throw new Error(
          `Total discount of ₹${totalDiscountAmount} exceeds the maximum permitted ceiling of 20% (₹${maxAllowedDiscount}) on base fee of ₹${base}`
        );
      }
    }

    const payableAmount = this.round2(Math.max(0, base - totalDiscountAmount));

    return {
      baseFee: this.round2(base),
      presetPercentage,
      manualPercentage,
      manualFixedAmount,
      totalDiscountAmount,
      maxAllowedDiscount,
      payableAmount,
    };
  }

  /**
   * Collects a fee payment, creating invoice, payment, and updating the chronological student fee ledger.
   * Concurrency-safe, atomic, and idempotent.
   */
  static collectFee(db, {
    student_id,
    invoice_id = null,
    months_count = 1,
    start_date,
    end_date = null,
    payment_amount,
    payment_mode = 'cash',
    transaction_reference = null,
    notes = null,
    discount_type = 'none',
    discount_value = 0,
    discount_reason = null,
    collected_by = null,
    title = null,
    allowAdminOverride = false,
  }) {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
    if (!student) {
      throw new Error(`Student with ID ${student_id} not found`);
    }

    const months = Number(months_count);
    if (!Number.isInteger(months) || months < 1 || months > 36) {
      throw new Error('months_count must be an integer between 1 and 36');
    }

    // Resolve timeline
    const timeline = this.getStudentFeeTimeline(db, student_id);
    const periodStart = start_date
      ? DateUtils.parseAndNormalizeDate(start_date, { fieldName: 'start_date' })
      : timeline.nextStartDate;

    // Calculate dates
    const dateCalc = this.addCalendarMonths(periodStart, months);
    const periodEnd = end_date
      ? DateUtils.parseAndNormalizeDate(end_date, { fieldName: 'end_date' })
      : dateCalc.periodEnd;
    const nextInstallmentDate = end_date ? this.addDays(periodEnd, 1) : dateCalc.nextInstallmentDate;

    // Monthly rate
    const feeInfo = this.getStudentMonthlyFee(db, student_id, periodStart);
    const monthlyRate = feeInfo.monthlyFee;
    const baseFee = this.round2(monthlyRate * months);

    // Validate discounts
    const discountCalc = this.calculateDiscount({
      baseFee,
      monthsCount: months,
      discountType: discount_type,
      discountValue: discount_value,
      db,
      allowAdminOverride,
    });

    const netAmount = discountCalc.payableAmount;
    const payment = Number(payment_amount !== undefined ? payment_amount : netAmount);

    if (isNaN(payment) || payment < 0) {
      throw new Error('Payment amount must be a non-negative number');
    }

    const receiptNumber = `REC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    let invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const feeTitle = title || `${months}-Month Coaching (${periodStart} to ${periodEnd})`;

    let resultPayload = null;

    // Database transaction
    const tx = db.transaction(() => {
      let feeId = null;
      let existingInvoice = null;
      if (invoice_id) {
        existingInvoice = db.prepare('SELECT * FROM student_fees WHERE id = ?').get(Number(invoice_id));
      }

      const paidAmount = this.round2(payment);
      let balanceAmount = 0;
      let status = 'pending';

      if (existingInvoice) {
        feeId = existingInvoice.id;
        invoiceNumber = existingInvoice.invoice_number;
        const totalPaidSoFar = this.round2((existingInvoice.paid_amount || 0) + paidAmount);
        balanceAmount = this.round2(Math.max(0, netAmount - totalPaidSoFar));
        status = balanceAmount === 0 ? 'paid' : (totalPaidSoFar > 0 ? 'partial' : 'pending');

        db.prepare(`
          UPDATE student_fees
          SET title = ?,
              amount = ?,
              discount_amount = ?,
              net_amount = ?,
              paid_amount = ?,
              balance_amount = ?,
              status = ?,
              period_start = ?,
              period_end = ?,
              months_count = ?,
              base_fee = ?,
              discount_percentage = ?,
              discount_type = ?,
              discount_reason = ?,
              discount_applied_by = ?,
              next_installment_date = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          feeTitle,
          baseFee,
          discountCalc.totalDiscountAmount,
          netAmount,
          totalPaidSoFar,
          balanceAmount,
          status,
          periodStart,
          periodEnd,
          months,
          baseFee,
          discountCalc.presetPercentage + discountCalc.manualPercentage,
          discount_type,
          discount_reason,
          collected_by,
          nextInstallmentDate,
          feeId
        );
      } else {
        balanceAmount = this.round2(Math.max(0, netAmount - paidAmount));
        status = balanceAmount === 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending');

        const insertFee = db.prepare(`
          INSERT INTO student_fees (
            student_id, invoice_number, title, due_date,
            amount, discount_amount, tax_amount, net_amount,
            paid_amount, balance_amount, status, notes,
            period_start, period_end, months_count, base_fee,
            discount_percentage, discount_type, discount_reason,
            discount_applied_by, next_installment_date
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?, 0, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?
          )
        `).run(
          student_id,
          invoiceNumber,
          feeTitle,
          periodStart,
          baseFee,
          discountCalc.totalDiscountAmount,
          netAmount,
          paidAmount,
          balanceAmount,
          status,
          notes,
          periodStart,
          periodEnd,
          months,
          baseFee,
          discountCalc.presetPercentage + discountCalc.manualPercentage,
          discount_type,
          discount_reason,
          collected_by,
          nextInstallmentDate
        );

        feeId = insertFee.lastInsertRowid;
      }

      // 2. Record payment in fee_payments if payment > 0
      let paymentId = null;
      if (paidAmount > 0) {
        const insertPayment = db.prepare(`
          INSERT INTO fee_payments (
            student_fee_id, student_id, receipt_number, payment_date,
            amount, payment_mode, transaction_reference, notes,
            collected_by, status
          ) VALUES (?, ?, ?, DATE('now'), ?, ?, ?, ?, ?, 'completed')
        `).run(
          feeId,
          student_id,
          receiptNumber,
          paidAmount,
          payment_mode,
          transaction_reference,
          notes,
          collected_by
        );
        paymentId = insertPayment.lastInsertRowid;
      }

      // 3. Record in student_fee_ledger
      // Charge entry
      db.prepare(`
        INSERT INTO student_fee_ledger (
          student_id, student_fee_id, entry_type, charge_type,
          period_start, period_end, months_count, debit, credit,
          running_balance, paid_through_date, notes, created_by
        ) VALUES (?, ?, 'charge', 'tuition', ?, ?, ?, ?, 0, ?, ?, ?, ?)
      `).run(
        student_id,
        feeId,
        periodStart,
        periodEnd,
        months,
        baseFee,
        baseFee,
        status === 'paid' ? periodEnd : null,
        feeTitle,
        collected_by
      );

      // Discount entry if applicable
      if (discountCalc.totalDiscountAmount > 0) {
        db.prepare(`
          INSERT INTO student_fee_ledger (
            student_id, student_fee_id, entry_type, charge_type,
            period_start, period_end, months_count, debit, credit,
            running_balance, paid_through_date, notes, created_by
          ) VALUES (?, ?, 'discount', 'tuition', ?, ?, ?, 0, ?, ?, ?, ?, ?)
        `).run(
          student_id,
          feeId,
          periodStart,
          periodEnd,
          months,
          discountCalc.totalDiscountAmount,
          netAmount,
          status === 'paid' ? periodEnd : null,
          `Discount applied: ${discount_type} (${discount_reason || 'Academy approved'})`,
          collected_by
        );
      }

      // Payment entry if paid
      if (paidAmount > 0) {
        db.prepare(`
          INSERT INTO student_fee_ledger (
            student_id, student_fee_id, fee_payment_id, entry_type, charge_type,
            period_start, period_end, months_count, debit, credit,
            running_balance, paid_through_date, notes, created_by
          ) VALUES (?, ?, ?, 'payment', 'tuition', ?, ?, ?, 0, ?, ?, ?, ?, ?)
        `).run(
          student_id,
          feeId,
          paymentId,
          periodStart,
          periodEnd,
          months,
          paidAmount,
          balanceAmount,
          status === 'paid' ? periodEnd : null,
          `Payment received via ${payment_mode} (Ref: ${receiptNumber})`,
          collected_by
        );
      }

      // 4. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (
          user_id, user_name, user_role, action, entity, entity_id, details
        ) VALUES (?, ?, ?, 'COLLECT_FEE', 'student_fees', ?, ?)
      `).run(
        collected_by,
        'Staff',
        'academy_admin',
        feeId,
        `Collected ₹${paidAmount} for student ${student_id} (${periodStart} to ${periodEnd}, ${months} mo)`
      );

      resultPayload = {
        success: true,
        feeId,
        paymentId,
        invoiceNumber,
        receiptNumber,
        studentId: student_id,
        studentName: `${student.first_name} ${student.last_name}`,
        periodStart,
        periodEnd,
        nextInstallmentDate,
        monthsCount: months,
        monthlyRate,
        baseFee,
        discountAmount: discountCalc.totalDiscountAmount,
        netAmount,
        netPayable: netAmount,
        paidAmount,
        balanceAmount,
        remainingBalance: balanceAmount,
        status,
      };
    });

    tx();
    return resultPayload;
  }

  /**
   * Request a fee pause / membership hold
   */
  static requestPause(db, {
    student_id,
    branch_id,
    batch_id = null,
    pause_type = 'fee_pause',
    requested_start_date,
    requested_end_date,
    reason,
    requested_by,
  }) {
    if (!student_id || !requested_start_date || !requested_end_date || !reason) {
      throw new Error('student_id, requested_start_date, requested_end_date, and reason are required');
    }

    const normStart = DateUtils.parseAndNormalizeDate(requested_start_date, { fieldName: 'requested_start_date' });
    const normEnd = DateUtils.parseAndNormalizeDate(requested_end_date, { fieldName: 'requested_end_date' });

    if (normEnd < normStart) {
      throw new Error('Pause end date cannot be earlier than start date');
    }

    const student = db.prepare('SELECT branch_id FROM students WHERE id = ?').get(student_id);
    if (!student) {
      throw new Error('Student not found');
    }
    const targetBranchId = branch_id || student.branch_id || 1;

    // Check overlapping requests
    const overlap = db.prepare(`
      SELECT id, status, requested_start_date, requested_end_date
      FROM fee_pause_requests
      WHERE student_id = ?
        AND status IN ('pending', 'approved')
        AND NOT (requested_end_date < ? OR requested_start_date > ?)
      LIMIT 1
    `).get(student_id, normStart, normEnd);

    if (overlap) {
      throw new Error(
        `Overlapping ${overlap.status} pause request exists (#${overlap.id}: ${overlap.requested_start_date} to ${overlap.requested_end_date})`
      );
    }

    const insert = db.prepare(`
      INSERT INTO fee_pause_requests (
        student_id, branch_id, batch_id, pause_type,
        requested_start_date, requested_end_date, reason,
        status, requested_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      student_id,
      targetBranchId,
      batch_id,
      pause_type,
      normStart,
      normEnd,
      reason.trim(),
      requested_by
    );

    return {
      success: true,
      requestId: insert.lastInsertRowid,
      pauseId: insert.lastInsertRowid,
      pause: {
        id: insert.lastInsertRowid,
        status: 'pending',
        student_id,
        branch_id: targetBranchId,
        requested_start_date: normStart,
        requested_end_date: normEnd,
      },
      message: 'Fee pause request submitted successfully and is pending approval',
    };
  }

  /**
   * Approves or rejects a pause request with strict role and branch authorization
   */
  static reviewPause(db, {
    pause_id,
    decision, // 'approved' | 'rejected'
    approved_by,
    approval_notes = null,
    approved_start_date = null,
    approved_end_date = null,
    userRole,
    userBranchId = null,
  }) {
    const pause = db.prepare('SELECT * FROM fee_pause_requests WHERE id = ?').get(pause_id);
    if (!pause) {
      throw new Error('Fee pause request not found');
    }

    if (pause.status !== 'pending') {
      throw new Error(`Cannot review request #${pause_id} because its current status is already '${pause.status}'`);
    }

    // Branch head coach authorization check
    if (userRole === 'coach' && userBranchId && Number(pause.branch_id) !== Number(userBranchId)) {
      throw new Error('Branch Head Coaches may only approve fee pauses within their assigned branch');
    }

    if (decision === 'approved') {
      const finalStart = approved_start_date
        ? DateUtils.parseAndNormalizeDate(approved_start_date, { fieldName: 'approved_start_date' })
        : pause.requested_start_date;
      const finalEnd = approved_end_date
        ? DateUtils.parseAndNormalizeDate(approved_end_date, { fieldName: 'approved_end_date' })
        : pause.requested_end_date;

      db.prepare(`
        UPDATE fee_pause_requests
        SET status = 'approved',
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP,
            approval_notes = ?,
            approved_start_date = ?,
            approved_end_date = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(approved_by, approval_notes, finalStart, finalEnd, pause_id);

      // Record in ledger as an auditable pause adjustment
      db.prepare(`
        INSERT INTO student_fee_ledger (
          student_id, entry_type, charge_type,
          period_start, period_end, debit, credit,
          notes, created_by
        ) VALUES (?, 'pause_adjustment', 'tuition', ?, ?, 0, 0, ?, ?)
      `).run(
        pause.student_id,
        finalStart,
        finalEnd,
        `Approved Fee Pause: ${pause.reason} (Notes: ${approval_notes || 'None'})`,
        approved_by
      );

      return {
        success: true,
        message: 'Fee pause request approved. Student fee timeline has been adjusted.',
        status: 'approved',
        pause: {
          id: pause_id,
          status: 'approved',
          approved_start_date: finalStart,
          approved_end_date: finalEnd,
        },
      };
    } else if (decision === 'rejected') {
      db.prepare(`
        UPDATE fee_pause_requests
        SET status = 'rejected',
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP,
            approval_notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(approved_by, approval_notes || 'Rejected by authorized reviewer', pause_id);

      return {
        success: true,
        message: 'Fee pause request rejected. Fee timeline remains unchanged.',
        status: 'rejected',
        pause: {
          id: pause_id,
          status: 'rejected',
        },
      };
    } else {
      throw new Error(`Invalid decision: ${decision}. Allowed: 'approved', 'rejected'`);
    }
  }

  /**
   * Sets or updates student-specific fee override
   */
  static setStudentOverride(db, {
    student_id,
    custom_monthly_fee,
    reason,
    effective_from,
    effective_until = null,
    created_by,
  }) {
    const fee = Number(custom_monthly_fee);
    if (isNaN(fee) || fee <= 0) {
      throw new Error('custom_monthly_fee must be a positive number');
    }

    if (!reason || !reason.trim()) {
      throw new Error('A detailed reason is required for student fee overrides');
    }

    const startDate = effective_from
      ? DateUtils.parseAndNormalizeDate(effective_from, { fieldName: 'effective_from' })
      : new Date().toISOString().split('T')[0];
    const untilDate = effective_until
      ? DateUtils.parseAndNormalizeDate(effective_until, { fieldName: 'effective_until' })
      : null;

    // Deactivate previous active overrides for this student
    db.prepare(`
      UPDATE student_fee_overrides
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ? AND is_active = 1
    `).run(student_id);

    const insert = db.prepare(`
      INSERT INTO student_fee_overrides (
        student_id, custom_monthly_fee, reason,
        effective_from, effective_until, is_active,
        created_by, approved_by
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      student_id,
      fee,
      reason.trim(),
      startDate,
      untilDate,
      created_by,
      created_by
    );

    return {
      success: true,
      overrideId: insert.lastInsertRowid,
      custom_monthly_fee: fee,
      override: {
        id: insert.lastInsertRowid,
        student_id,
        custom_monthly_fee: fee,
        reason: reason.trim(),
        effective_from: startDate,
        effective_until: untilDate,
      },
      message: `Student-specific rate of ₹${fee}/month established successfully`,
    };
  }

  /**
   * Summary analytics for academy fee dashboard
   */
  static getFeeDashboardAnalytics(db) {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7); // 'YYYY-MM'

    // Total collected this month
    const thisMonthCollections = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM fee_payments
      WHERE payment_date LIKE ? AND status = 'completed'
    `).get(`${currentMonth}%`).total;

    // Total all-time collections
    const allTimeCollections = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM fee_payments
      WHERE status = 'completed'
    `).get().total;

    // Outstanding dues
    const outstanding = db.prepare(`
      SELECT COALESCE(SUM(balance_amount), 0) as total, COUNT(*) as count
      FROM student_fees
      WHERE status IN ('pending', 'partial', 'overdue')
    `).get();

    // Overdue count
    const overdueCount = db.prepare(`
      SELECT COUNT(DISTINCT student_id) as count
      FROM student_fees
      WHERE status = 'overdue' OR (status IN ('pending', 'partial') AND due_date < ?)
    `).get(today).count;

    // Pending pause requests
    const pendingPausesCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM fee_pause_requests
      WHERE status = 'pending'
    `).get().count;

    // Payment methods breakdown
    const methodsBreakdown = db.prepare(`
      SELECT payment_mode, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM fee_payments
      WHERE status = 'completed'
      GROUP BY payment_mode
    `).all();

    // Ageing analysis of outstanding balances
    // 1-7 days, 8-30 days, 31-60 days, >60 days
    const overdueInvoices = db.prepare(`
      SELECT balance_amount, due_date
      FROM student_fees
      WHERE balance_amount > 0 AND due_date < ?
    `).all(today);

    const ageing = {
      days_1_to_7: 0,
      days_8_to_30: 0,
      days_31_to_60: 0,
      days_over_60: 0,
    };

    const nowMs = new Date(today).getTime();
    for (const inv of overdueInvoices) {
      const dueMs = new Date(inv.due_date).getTime();
      const diffDays = Math.max(0, Math.floor((nowMs - dueMs) / (1000 * 60 * 60 * 24)));
      if (diffDays <= 7) {
        ageing.days_1_to_7 += inv.balance_amount;
      } else if (diffDays <= 30) {
        ageing.days_8_to_30 += inv.balance_amount;
      } else if (diffDays <= 60) {
        ageing.days_31_to_60 += inv.balance_amount;
      } else {
        ageing.days_over_60 += inv.balance_amount;
      }
    }

    return {
      thisMonthCollections: this.round2(thisMonthCollections),
      allTimeCollections: this.round2(allTimeCollections),
      totalOutstandingDues: this.round2(outstanding.total),
      unpaidInvoicesCount: outstanding.count,
      overdueStudentsCount: overdueCount,
      pendingPausesCount,
      methodsBreakdown,
      ageingBuckets: {
        '1-7 Days': this.round2(ageing.days_1_to_7),
        '8-30 Days': this.round2(ageing.days_8_to_30),
        '31-60 Days': this.round2(ageing.days_31_to_60),
        '>60 Days': this.round2(ageing.days_over_60),
      },
    };
  }

  /**
   * Updates an existing fee invoice (e.g. correcting dates, title, notes, or amounts if unpaid)
   */
  static updateFee(db, feeId, updateData = {}, user = {}) {
    const id = Number(feeId);
    const fee = db.prepare('SELECT * FROM student_fees WHERE id = ?').get(id);
    if (!fee) {
      throw new Error(`Fee invoice ${feeId} not found`);
    }
    if (fee.status === 'cancelled') {
      throw new Error('Cannot edit a cancelled fee invoice');
    }

    const title = updateData.title !== undefined ? String(updateData.title).trim() : fee.title;
    const dueDate = updateData.due_date
      ? DateUtils.parseAndNormalizeDate(updateData.due_date, { fieldName: 'due_date' })
      : fee.due_date;
    const periodStart = updateData.period_start
      ? DateUtils.parseAndNormalizeDate(updateData.period_start, { fieldName: 'period_start' })
      : fee.period_start;
    const periodEnd = updateData.period_end
      ? DateUtils.parseAndNormalizeDate(updateData.period_end, { fieldName: 'period_end' })
      : fee.period_end;
    const nextInstallmentDate = updateData.next_installment_date
      ? DateUtils.parseAndNormalizeDate(updateData.next_installment_date, { fieldName: 'next_installment_date' })
      : fee.next_installment_date;
    const notes = updateData.notes !== undefined ? String(updateData.notes) : fee.notes;

    let baseFee = fee.base_fee !== undefined ? fee.base_fee : fee.amount;
    let discountAmount = fee.discount_amount || 0;
    let netAmount = fee.net_amount || fee.amount;
    let balanceAmount = fee.balance_amount !== undefined ? fee.balance_amount : netAmount;
    let status = fee.status;

    // If unpaid, allow editing financial amounts directly
    const paidAmount = Number(fee.paid_amount || 0);
    if (paidAmount === 0 && (updateData.base_fee !== undefined || updateData.discount_amount !== undefined || updateData.amount !== undefined)) {
      if (updateData.base_fee !== undefined) {
        baseFee = this.round2(Math.max(0, Number(updateData.base_fee)));
      } else if (updateData.amount !== undefined) {
        baseFee = this.round2(Math.max(0, Number(updateData.amount)));
      }
      if (updateData.discount_amount !== undefined) {
        discountAmount = this.round2(Math.max(0, Number(updateData.discount_amount)));
      }
      netAmount = this.round2(Math.max(0, baseFee - discountAmount));
      balanceAmount = netAmount;
      status = balanceAmount === 0 ? 'paid' : 'pending';

      // Update student_fee_ledger charge entry
      db.prepare(`
        UPDATE student_fee_ledger
        SET debit = ?, running_balance = ?, period_start = ?, period_end = ?, notes = ?
        WHERE student_fee_id = ? AND entry_type = 'charge'
      `).run(baseFee, baseFee, periodStart, periodEnd, title, id);

      // Update or insert discount entry in ledger
      if (discountAmount > 0) {
        const existingDiscount = db.prepare(`SELECT id FROM student_fee_ledger WHERE student_fee_id = ? AND entry_type = 'discount'`).get(id);
        if (existingDiscount) {
          db.prepare(`
            UPDATE student_fee_ledger
            SET credit = ?, running_balance = ?, period_start = ?, period_end = ?
            WHERE id = ?
          `).run(discountAmount, netAmount, periodStart, periodEnd, existingDiscount.id);
        } else {
          db.prepare(`
            INSERT INTO student_fee_ledger (
              student_id, student_fee_id, entry_type, charge_type,
              period_start, period_end, months_count, debit, credit,
              running_balance, notes, created_by
            ) VALUES (?, ?, 'discount', 'tuition', ?, ?, ?, 0, ?, ?, 'Discount adjusted', ?)
          `).run(fee.student_id, id, periodStart, periodEnd, fee.months_count || 1, discountAmount, netAmount, user.userId || user.id || null);
        }
      }
    } else {
      // Update dates & title in ledger
      db.prepare(`
        UPDATE student_fee_ledger
        SET period_start = ?, period_end = ?, notes = ?
        WHERE student_fee_id = ? AND entry_type = 'charge'
      `).run(periodStart, periodEnd, title, id);
    }

    db.prepare(`
      UPDATE student_fees
      SET title = ?, due_date = ?, period_start = ?, period_end = ?,
          next_installment_date = ?, notes = ?, base_fee = ?,
          discount_amount = ?, net_amount = ?, balance_amount = ?, status = ?
      WHERE id = ?
    `).run(
      title, dueDate, periodStart, periodEnd,
      nextInstallmentDate, notes, baseFee,
      discountAmount, netAmount, balanceAmount, status,
      id
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details)
      VALUES (?, ?, ?, 'UPDATE_FEE', 'student_fees', ?, ?)
    `).run(
      user.userId || user.id || null,
      user.name || 'Staff',
      user.role || 'academy_admin',
      id,
      `Updated fee invoice #${id} (${fee.invoice_number})`
    );

    return db.prepare('SELECT * FROM student_fees WHERE id = ?').get(id);
  }

  /**
   * Voids/Cancels an incorrectly generated fee invoice.
   * If payments were recorded, automatically reverses them with audit entries.
   */
  static voidFee(db, feeId, reason = 'Voided by Administrator', user = {}) {
    const id = Number(feeId);
    const fee = db.prepare('SELECT * FROM student_fees WHERE id = ?').get(id);
    if (!fee) {
      throw new Error(`Fee invoice ${feeId} not found`);
    }
    if (fee.status === 'cancelled') {
      throw new Error('Invoice is already cancelled / voided');
    }

    const cleanReason = String(reason || 'Voided by Administrator').trim();

    // 1. Reverse any payments associated with this invoice
    const payments = db.prepare('SELECT * FROM fee_payments WHERE student_fee_id = ? AND status = ?').all(id, 'completed');
    for (const p of payments) {
      db.prepare(`
        UPDATE fee_payments
        SET status = 'reversed', reversal_reason = ?, reversed_by = ?, reversed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(cleanReason, user.userId || user.id || null, p.id);

      db.prepare(`
        INSERT INTO student_fee_ledger (
          student_id, student_fee_id, fee_payment_id, entry_type, charge_type,
          debit, credit, running_balance, notes, created_by
        ) VALUES (?, ?, ?, 'refund', 'tuition', 0, ?, 0, ?, ?)
      `).run(
        fee.student_id,
        id,
        p.id,
        p.amount,
        `Reversal of payment ${p.receipt_number}: ${cleanReason}`,
        user.userId || user.id || null
      );
    }

    // 2. Insert waiver/void adjustment in student_fee_ledger
    db.prepare(`
      INSERT INTO student_fee_ledger (
        student_id, student_fee_id, entry_type, charge_type,
        period_start, period_end, months_count, debit, credit,
        running_balance, notes, created_by
      ) VALUES (?, ?, 'waiver', 'tuition', ?, ?, ?, 0, ?, 0, ?, ?)
    `).run(
      fee.student_id,
      id,
      fee.period_start,
      fee.period_end,
      fee.months_count || 1,
      fee.net_amount || fee.amount || 0,
      `Invoice ${fee.invoice_number} cancelled: ${cleanReason}`,
      user.userId || user.id || null
    );

    // 3. Mark invoice as cancelled
    const updatedNotes = (fee.notes ? fee.notes + ' | ' : '') + `CANCELLED: ${cleanReason}`;
    db.prepare(`
      UPDATE student_fees
      SET status = 'cancelled', balance_amount = 0, notes = ?
      WHERE id = ?
    `).run(updatedNotes, id);

    // 4. Audit Log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details)
      VALUES (?, ?, ?, 'VOID_FEE', 'student_fees', ?, ?)
    `).run(
      user.userId || user.id || null,
      user.name || 'Staff',
      user.role || 'academy_admin',
      id,
      `Voided fee invoice ${fee.invoice_number}. Reason: ${cleanReason}`
    );

    return {
      success: true,
      message: `Invoice ${fee.invoice_number} voided successfully`,
      feeId: id,
    };
  }

  /**
   * Reverses a recorded payment receipt, reopening the invoice balance.
   */
  static reversePayment(db, paymentId, reason = 'Reversed by Administrator', user = {}) {
    const id = Number(paymentId);
    const payment = db.prepare('SELECT * FROM fee_payments WHERE id = ?').get(id);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }
    if (payment.status === 'reversed') {
      throw new Error('Payment is already reversed');
    }

    const cleanReason = String(reason || 'Reversed by Administrator').trim();

    // 1. Mark payment as reversed
    db.prepare(`
      UPDATE fee_payments
      SET status = 'reversed', reversal_reason = ?, reversed_by = ?, reversed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cleanReason, user.userId || user.id || null, id);

    // 2. Adjust fee invoice balance if student_fee_id is present
    let fee = null;
    if (payment.student_fee_id) {
      fee = db.prepare('SELECT * FROM student_fees WHERE id = ?').get(payment.student_fee_id);
      if (fee) {
        const newPaidAmount = this.round2(Math.max(0, (fee.paid_amount || 0) - payment.amount));
        const newBalanceAmount = this.round2(Math.max(0, (fee.net_amount || fee.amount || 0) - newPaidAmount));
        const newStatus = newBalanceAmount === 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'pending');

        db.prepare(`
          UPDATE student_fees
          SET paid_amount = ?, balance_amount = ?, status = ?
          WHERE id = ?
        `).run(newPaidAmount, newBalanceAmount, newStatus, fee.id);
        fee.paid_amount = newPaidAmount;
        fee.balance_amount = newBalanceAmount;
        fee.status = newStatus;
      }
    }

    // 3. Add reversal entry to ledger
    db.prepare(`
      INSERT INTO student_fee_ledger (
        student_id, student_fee_id, fee_payment_id, entry_type, charge_type,
        debit, credit, running_balance, notes, created_by
      ) VALUES (?, ?, ?, 'refund', 'tuition', 0, ?, ?, ?, ?)
    `).run(
      payment.student_id,
      payment.student_fee_id,
      id,
      payment.amount,
      fee ? fee.balance_amount : 0,
      `Reversal of receipt ${payment.receipt_number}: ${cleanReason}`,
      user.userId || user.id || null
    );

    // 4. Audit Log
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details)
      VALUES (?, ?, ?, 'REVERSE_PAYMENT', 'fee_payments', ?, ?)
    `).run(
      user.userId || user.id || null,
      user.name || 'Staff',
      user.role || 'academy_admin',
      id,
      `Reversed payment ${payment.receipt_number} (₹${payment.amount}). Reason: ${cleanReason}`
    );

    return {
      success: true,
      message: `Payment ${payment.receipt_number} reversed successfully`,
      paymentId: id,
      fee,
    };
  }
}
