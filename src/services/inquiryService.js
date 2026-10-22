import { QuotaService } from './quotaService.js';
import { FeeService } from './feeService.js';
import { DateUtils } from '../utils/dateUtils.js';

export class InquiryService {
  /**
   * Normalize phone number for duplicate detection
   */
  static normalizePhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '').slice(-10); // last 10 digits
  }

  /**
   * Normalize date string to ISO YYYY-MM-DD using strict calendar validation
   * Supports DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, and YYYY-MM-DD
   */
  static normalizeDate(val) {
    try {
      return DateUtils.parseAndNormalizeDate(val, { fieldName: 'Inquiry Date' });
    } catch (e) {
      return null;
    }
  }

  /**
   * Check for potential duplicate inquiries or existing students
   */
  static checkDuplicates(db, { phone, student_name, current_inquiry_id = null }) {
    const normalized = this.normalizePhone(phone);
    const trimmedName = (student_name || '').trim().toLowerCase();
    const warnings = [];

    if (normalized) {
      // Check existing inquiries
      const matchingInquiries = db.prepare(`
        SELECT id, student_name, phone, status, created_at
        FROM inquiries
        WHERE (phone LIKE ? OR phone LIKE ?)
        ${current_inquiry_id ? 'AND id != ?' : ''}
        ORDER BY id DESC LIMIT 5
      `).all(`%${normalized}%`, `%${normalized}`, ...(current_inquiry_id ? [current_inquiry_id] : []));

      if (matchingInquiries.length > 0) {
        warnings.push({
          type: 'duplicate_inquiry_phone',
          message: `Found ${matchingInquiries.length} existing inquiry/inquiries with similar phone number (${phone})`,
          matches: matchingInquiries,
        });
      }

      // Check existing students
      const matchingStudents = db.prepare(`
        SELECT id, student_code, first_name, last_name, phone, guardian_phone, status
        FROM students
        WHERE phone LIKE ? OR guardian_phone LIKE ?
        ORDER BY id DESC LIMIT 5
      `).all(`%${normalized}%`, `%${normalized}%`);

      if (matchingStudents.length > 0) {
        warnings.push({
          type: 'existing_student_phone',
          message: `Phone number matches ${matchingStudents.length} enrolled student(s)`,
          matches: matchingStudents,
        });
      }
    }

    if (trimmedName && trimmedName.length >= 3) {
      const nameParts = trimmedName.split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

      const matchingNameStudents = db.prepare(`
        SELECT id, student_code, first_name, last_name, phone, status
        FROM students
        WHERE LOWER(first_name) = ? ${lastName ? 'AND LOWER(last_name) = ?' : ''}
        ORDER BY id DESC LIMIT 5
      `).all(firstName, ...(lastName ? [lastName] : []));

      if (matchingNameStudents.length > 0) {
        warnings.push({
          type: 'existing_student_name',
          message: `Student name matches existing student records: ${matchingNameStudents.map(s => `${s.first_name} ${s.last_name} (${s.student_code})`).join(', ')}`,
          matches: matchingNameStudents,
        });
      }
    }

    return {
      hasDuplicates: warnings.length > 0,
      warnings,
    };
  }

  /**
   * List inquiries with filtering & pagination
   */
  static listInquiries(db, academyId, filters = {}) {
    const {
      search,
      status,
      branch_id,
      sport_id,
      source,
      page = 1,
      limit = 20,
    } = filters;

    let whereClause = 'WHERE i.academy_id = ?';
    const params = [Number(academyId)];

    if (status) {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }
    if (branch_id) {
      whereClause += ' AND i.branch_id = ?';
      params.push(Number(branch_id));
    }
    if (sport_id) {
      whereClause += ' AND i.sport_id = ?';
      params.push(Number(sport_id));
    }
    if (source) {
      whereClause += ' AND i.source = ?';
      params.push(source);
    }
    if (search) {
      whereClause += ' AND (i.student_name LIKE ? OR i.phone LIKE ? OR i.email LIKE ? OR i.guardian_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM inquiries i ${whereClause}`).get(...params);
    const total = countRow ? countRow.count : 0;

    const parsedLimit = Number(limit);
    const parsedPage = Number(page);
    const offset = (parsedPage - 1) * parsedLimit;

    const inquiries = db.prepare(`
      SELECT 
        i.*,
        b.name as branch_name,
        sp.name as sport_name,
        bt.name as preferred_batch_name,
        u.name as assigned_user_name,
        (SELECT COUNT(*) FROM inquiry_trials it WHERE it.inquiry_id = i.id) as trial_count,
        (SELECT trial_date FROM inquiry_trials it WHERE it.inquiry_id = i.id ORDER BY it.trial_date DESC LIMIT 1) as last_trial_date,
        (SELECT attendance_status FROM inquiry_trials it WHERE it.inquiry_id = i.id ORDER BY it.trial_date DESC LIMIT 1) as last_trial_status
      FROM inquiries i
      LEFT JOIN branches b ON b.id = i.branch_id
      LEFT JOIN sports sp ON sp.id = i.sport_id
      LEFT JOIN batches bt ON bt.id = i.preferred_batch_id
      LEFT JOIN users u ON u.id = i.assigned_to_user_id
      ${whereClause}
      ORDER BY i.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, parsedLimit, offset);

    return {
      inquiries,
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    };
  }

  /**
   * Create an inquiry
   */
  static createInquiry(db, academyId, data, currentUserId = null) {
    const {
      student_name,
      guardian_name,
      guardian_relation,
      phone,
      email,
      date_of_birth,
      gender,
      branch_id,
      sport_id,
      preferred_batch_id,
      source = 'walk_in',
      notes,
      assigned_to_user_id,
      next_followup_date,
    } = data;

    if (!student_name || !phone) {
      throw new Error('Student name and contact phone number are required');
    }

    const resolvedDob = this.normalizeDate(date_of_birth || data.dob || null);
    const resolvedFollowup = this.normalizeDate(next_followup_date) || null;

    const ins = db.prepare(`
      INSERT INTO inquiries (
        academy_id, student_name, guardian_name, guardian_relation, phone, email,
        date_of_birth, gender, branch_id, sport_id, preferred_batch_id,
        source, notes, assigned_to_user_id, next_followup_date, status, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
    `);

    const result = ins.run(
      Number(academyId),
      student_name.trim(),
      guardian_name ? guardian_name.trim() : null,
      guardian_relation || null,
      phone.trim(),
      email ? email.trim() : null,
      resolvedDob,
      gender || null,
      branch_id ? Number(branch_id) : null,
      sport_id ? Number(sport_id) : null,
      preferred_batch_id ? Number(preferred_batch_id) : null,
      source,
      notes || null,
      assigned_to_user_id ? Number(assigned_to_user_id) : null,
      resolvedFollowup,
      currentUserId
    );

    return db.prepare('SELECT * FROM inquiries WHERE id = ?').get(result.lastInsertRowid);
  }

  /**
   * Schedule or update a trial class (Does NOT create fee liability)
   */
  static scheduleTrial(db, inquiryId, trialData) {
    const {
      branch_id,
      sport_id,
      batch_id,
      coach_id,
      trial_date,
      start_time,
      end_time,
      attendance_status = 'scheduled',
      feedback,
      coach_notes,
    } = trialData;

    if (!trial_date) {
      throw new Error('Trial date is required');
    }

    const ins = db.prepare(`
      INSERT INTO inquiry_trials (
        inquiry_id, branch_id, sport_id, batch_id, coach_id,
        trial_date, start_time, end_time, attendance_status, feedback, coach_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = ins.run(
      Number(inquiryId),
      branch_id ? Number(branch_id) : null,
      sport_id ? Number(sport_id) : null,
      batch_id ? Number(batch_id) : null,
      coach_id ? Number(coach_id) : null,
      trial_date,
      start_time || null,
      end_time || null,
      attendance_status,
      feedback || null,
      coach_notes || null
    );

    // Update inquiry status
    const newStatus = attendance_status === 'attended' ? 'trial_completed' : 'trial_scheduled';
    db.prepare("UPDATE inquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status NOT IN ('converted')").run(newStatus, Number(inquiryId));

    return db.prepare('SELECT * FROM inquiry_trials WHERE id = ?').get(result.lastInsertRowid);
  }

  /**
   * Transactional Admission Wizard: Converts inquiry into student, sets active batch, and initializes fee ledger
   */
  static convertInquiryToAdmission(db, academyId, inquiryId, admissionData, currentUser) {
    const inquiry = db.prepare('SELECT * FROM inquiries WHERE id = ? AND academy_id = ?').get(Number(inquiryId), Number(academyId));
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    if (inquiry.status === 'converted' && inquiry.converted_student_id) {
      throw new Error(`Inquiry has already been converted to student (Student ID: ${inquiry.converted_student_id})`);
    }

    return this.createAdmission(db, academyId, {
      ...admissionData,
      inquiry_id: inquiry.id,
      first_name: admissionData.first_name || inquiry.student_name.split(' ')[0],
      last_name: admissionData.last_name || (inquiry.student_name.split(' ').slice(1).join(' ') || '.'),
      phone: admissionData.phone || inquiry.phone,
      email: admissionData.email || inquiry.email,
      date_of_birth: admissionData.date_of_birth || inquiry.date_of_birth,
      gender: admissionData.gender || inquiry.gender,
      guardian_name: admissionData.guardian_name || inquiry.guardian_name,
      branch_id: admissionData.branch_id || inquiry.branch_id,
    }, currentUser);
  }

  /**
   * Generates hierarchical unique student code: [Academy Code]-[Branch Code]-[Year]-[Sequence]
   * Example: GSA-BHL-26-0042
   */
  static generateStudentCode(db, targetBranchId = null) {
    let acadCode = 'ISS';
    try {
      const tenantSetting = db.prepare("SELECT value FROM tenant_settings WHERE key = 'academy_code'").get();
      if (tenantSetting && tenantSetting.value) {
        acadCode = tenantSetting.value.toUpperCase();
      } else {
        const row = db.prepare("SELECT value FROM tenant_settings WHERE key = 'academy_name'").get();
        if (row && row.value) {
          acadCode = row.value.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4);
        }
      }
    } catch (e) {}

    let branchCode = 'MAIN';
    if (targetBranchId) {
      try {
        const br = db.prepare('SELECT name, code FROM branches WHERE id = ?').get(targetBranchId);
        if (br) {
          branchCode = br.code || br.name.replace(/branch/i, '').trim().slice(0, 3).toUpperCase() || 'BR1';
        }
      } catch (e) {}
    }

    const count = db.prepare('SELECT COUNT(*) as c FROM students').get().c + 1;
    const yr = String(new Date().getFullYear()).slice(-2);
    return `${acadCode}-${branchCode}-${yr}-${String(count).padStart(4, '0')}`;
  }

  /**
   * Core Transactional Admission Method (Direct or via Inquiry)
   */
  static createAdmission(db, academyId, admissionData, currentUser) {
    const {
      inquiry_id = null,
      student_code = null,
      admission_number = null,
      first_name,
      last_name,
      email = null,
      phone,
      date_of_birth = null,
      dob = null,
      gender = null,
      blood_group = null,
      nationality = null,
      preferred_language = null,
      // Guardian info
      guardian_name = null,
      guardian_phone = null,
      guardian_email = null,
      primary_guardian_relation = null,
      primary_guardian = null,
      father_name = null,
      father_phone = null,
      mother_name = null,
      mother_phone = null,
      alternate_emergency_contact = null,
      authorized_pickup_persons = null,
      authorized_pickup = null,
      parent_portal_enabled = 0,
      // Address info
      address = null,
      current_address = null,
      permanent_address = null,
      city = null,
      state = null,
      postal_code = null,
      pincode = null,
      country = 'India',
      same_as_current_address = 1,
      // Emergency contact
      emergency_contact_name = null,
      emergency_contact_relationship = null,
      emergency_contact_phone = null,
      // Educational
      school_college_name = null,
      school_name = null,
      grade_standard = null,
      grade_level = null,
      education_board = null,
      academic_year = null,
      occupation = null,
      // Health
      allergies = null,
      emergency_medical_instructions = null,
      regular_medications = null,
      medical_conditions = null,
      injury_history = null,
      doctor_clinic_contact = null,
      medical_consent = 0,
      emergency_medical_consent = 0,
      // Sports & Admission
      branch_id,
      batch_id = null,
      joining_date = null,
      start_date = null,
      previous_sports_experience = null,
      sports_history = null,
      previous_academy = null,
      goals_notes = null,
      photo_video_permission = 1,
      photo_media_consent = 1,
      competition_consent = 1,
      // Fees & Override
      fee_plan_id = null,
      fee_override_amount = null,
      discount_percent = 0,
      discount_percentage = 0,
      discount_reason = null,
      joining_fee_amount = 0,
      admission_fee = 0,
      initial_payment_amount = 0,
      payment_method = 'cash',
      payment_mode = null,
      payment_notes = null,
    } = admissionData;

    const resolvedPhone = (phone || father_phone || mother_phone || guardian_phone || emergency_contact_phone || '').trim();
    if (!first_name || !resolvedPhone) {
      throw new Error('Student first name and contact phone are required');
    }

    if (!branch_id) {
      throw new Error('A valid branch must be selected for admission');
    }

    // Verify branch belongs to academy
    const branch = db.prepare('SELECT id, name FROM branches WHERE id = ?').get(Number(branch_id));
    if (!branch) {
      throw new Error('The selected branch does not exist in this academy');
    }

    // Check student quota limit
    QuotaService.assertCanCreate(academyId, 'students', 1);

    const resolvedDob = this.normalizeDate(date_of_birth || dob || null);
    const resolvedAddress = address || current_address || null;
    const resolvedPostalCode = postal_code || pincode || null;
    const resolvedSchool = school_college_name || school_name || null;
    const resolvedGrade = grade_standard || grade_level || null;
    const resolvedSportsExp = previous_sports_experience || sports_history || null;
    const resolvedMedInstructions = emergency_medical_instructions || regular_medications || medical_conditions || null;
    const resolvedMedicalConsent = (medical_consent || emergency_medical_consent) ? 1 : 0;
    const resolvedPhotoPermission = (photo_video_permission || photo_media_consent) ? 1 : 0;
    const effectiveJoiningDate = this.normalizeDate(joining_date || start_date) || new Date().toISOString().split('T')[0];
    const resolvedJoiningFee = Number(joining_fee_amount || admission_fee || 0);
    const resolvedDiscount = Number(discount_percent || discount_percentage || 0);
    const resolvedPaymentMethod = payment_method || payment_mode || 'cash';

    // Enforce discount ceiling policy (<= 20% max discount)
    if (resolvedDiscount > 20) {
      const isAdmin = currentUser && (currentUser.isSuperAdmin || currentUser.role === 'academy_admin');
      if (!isAdmin) {
        throw new Error('Discount ceiling exceeded: discounts above 20% require Academy Admin authorization');
      }
    }

    let createdStudent = null;
    let enrollmentRecord = null;
    let feeLiability = null;
    let paymentRecord = null;

    // Run everything in an isolated, idempotent transaction
    const tx = db.transaction(() => {
      // 1. Generate unique Admission / Student Code
      let finalStudentCode = student_code;
      if (!finalStudentCode) {
        finalStudentCode = InquiryService.generateStudentCode(db, Number(branch_id));
      }

      // Check if student with this code already exists
      const existing = db.prepare('SELECT id FROM students WHERE student_code = ?').get(finalStudentCode);
      if (existing) {
        finalStudentCode = `${finalStudentCode}-${Math.floor(100 + Math.random() * 900)}`;
      }

      const finalAdmissionNumber = admission_number ? String(admission_number).trim() : finalStudentCode;

      // 2. Insert Student Record
      const insStudent = db.prepare(`
        INSERT INTO students (
          student_code, admission_number, first_name, last_name, email, phone,
          date_of_birth, gender, blood_group, nationality, preferred_language,
          guardian_name, guardian_phone, guardian_email, primary_guardian_relation,
          father_name, father_phone, mother_name, mother_phone,
          alternate_emergency_contact, authorized_pickup_persons, parent_portal_enabled,
          address, permanent_address, city, state, postal_code, country, same_as_current_address,
          school_college_name, grade_standard, education_board, academic_year, occupation,
          allergies, emergency_medical_instructions, injury_history, doctor_clinic_contact, medical_consent,
          branch_id, previous_sports_experience, previous_academy, goals_notes,
          photo_video_permission, competition_consent,
          joining_fee_amount, discount_percent, discount_reason, discount_approved_by, discount_approved_at,
          status, enrolled_at, academy_id
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          'active', ?, ?
        )
      `);

      const resStudent = insStudent.run(
        finalStudentCode,
        finalAdmissionNumber,
        first_name.trim(),
        (last_name || '').trim(),
        email ? email.trim() : null,
        resolvedPhone,
        resolvedDob,
        gender || null,
        blood_group || null,
        nationality || 'Indian',
        preferred_language || 'English',
        guardian_name || father_name || mother_name || null,
        guardian_phone || father_phone || resolvedPhone,
        guardian_email || email || null,
        primary_guardian_relation || (primary_guardian === 'mother' ? 'Mother' : (father_name ? 'Father' : 'Guardian')),
        father_name || null,
        father_phone || null,
        mother_name || null,
        mother_phone || null,
        alternate_emergency_contact || (emergency_contact_phone ? `${emergency_contact_name || 'Emergency'} (${emergency_contact_phone})` : null),
        authorized_pickup_persons || authorized_pickup || null,
        parent_portal_enabled ? 1 : 0,
        resolvedAddress,
        same_as_current_address ? resolvedAddress : (permanent_address || resolvedAddress),
        city || null,
        state || null,
        resolvedPostalCode,
        country || 'India',
        same_as_current_address ? 1 : 0,
        resolvedSchool,
        resolvedGrade,
        education_board || null,
        academic_year || null,
        occupation || null,
        allergies || null,
        resolvedMedInstructions,
        injury_history || null,
        doctor_clinic_contact || null,
        resolvedMedicalConsent,
        Number(branch_id),
        resolvedSportsExp,
        previous_academy || null,
        goals_notes || null,
        resolvedPhotoPermission,
        competition_consent ? 1 : 0,
        resolvedJoiningFee,
        resolvedDiscount,
        discount_reason || null,
        resolvedDiscount > 0 ? (currentUser ? currentUser.userId : null) : null,
        resolvedDiscount > 0 ? new Date().toISOString() : null,
        effectiveJoiningDate,
        Number(academyId)
      );

      const studentId = resStudent.lastInsertRowid;
      createdStudent = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);

      // 3. Add to student_guardians table if provided
      if (father_name) {
        db.prepare(`
          INSERT INTO student_guardians (student_id, name, relationship, phone, is_primary)
          VALUES (?, ?, 'Father', ?, 1)
        `).run(studentId, father_name.trim(), father_phone || phone);
      }
      if (mother_name) {
        db.prepare(`
          INSERT INTO student_guardians (student_id, name, relationship, phone, is_primary)
          VALUES (?, ?, 'Mother', ?, ?)
        `).run(studentId, mother_name.trim(), mother_phone || phone, father_name ? 0 : 1);
      }

      // 4. Batch Assignment (Rule: Exactly one active batch at a time)
      if (batch_id) {
        const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND branch_id = ? AND is_active = 1').get(Number(batch_id), Number(branch_id));
        if (!batch) {
          throw new Error('Selected batch does not exist, is inactive, or belongs to another branch');
        }

        // Check batch capacity
        const enrolledCount = db.prepare("SELECT COUNT(*) as c FROM student_batch_enrollments WHERE batch_id = ? AND status = 'active'").get(batch.id).c;
        if (batch.max_capacity && enrolledCount >= batch.max_capacity) {
          throw new Error(`Batch '${batch.name}' has reached its maximum capacity of ${batch.max_capacity} students`);
        }

        // Close any prior active batch memberships for idempotency
        db.prepare("UPDATE student_batch_enrollments SET status = 'transferred', end_date = ? WHERE student_id = ? AND status = 'active'").run(effectiveJoiningDate, studentId);

        const insEnrollment = db.prepare(`
          INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status, assigned_by)
          VALUES (?, ?, ?, 'active', ?)
        `);
        const resEnrollment = insEnrollment.run(studentId, batch.id, effectiveJoiningDate, currentUser ? currentUser.userId : null);
        enrollmentRecord = db.prepare('SELECT * FROM student_batch_enrollments WHERE id = ?').get(resEnrollment.lastInsertRowid);
      }

      // 5. Accurate Fee Calculation & Liability Setup
      // Base fee resolution order: 1. Student fee override -> 2. Batch fee -> 3. 0
      let baseFee = 0;
      if (fee_override_amount !== null && fee_override_amount !== undefined && fee_override_amount !== '') {
        baseFee = Number(fee_override_amount);
      } else if (batch_id) {
        const b = db.prepare('SELECT monthly_fee FROM batches WHERE id = ?').get(Number(batch_id));
        baseFee = (b && b.monthly_fee) ? Number(b.monthly_fee) : 0;
      }

      const discountAmt = Math.round((baseFee * resolvedDiscount) / 100);
      const joiningFee = resolvedJoiningFee;
      const netTuitionFee = Math.max(0, baseFee - discountAmt);
      const totalAmountDue = netTuitionFee + joiningFee;

      // Determine initial fee period based on joining date (e.g. 10 Aug - 9 Sep)
      const jDate = new Date(effectiveJoiningDate);
      const periodEndDate = new Date(jDate);
      periodEndDate.setMonth(periodEndDate.getMonth() + 1);
      periodEndDate.setDate(periodEndDate.getDate() - 1);
      const endDateStr = `${periodEndDate.getFullYear()}-${String(periodEndDate.getMonth() + 1).padStart(2, '0')}-${String(periodEndDate.getDate()).padStart(2, '0')}`;

      if (totalAmountDue > 0) {
        const initialPaid = Math.min(Number(initial_payment_amount) || 0, totalAmountDue);
        const initialBalance = totalAmountDue - initialPaid;
        const initialStatus = initialPaid >= totalAmountDue ? 'paid' : (initialPaid > 0 ? 'partial' : 'pending');
        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

        const insFee = db.prepare(`
          INSERT INTO student_fees (
            student_id, invoice_number, title, due_date, amount, discount_amount,
            net_amount, paid_amount, balance_amount, status, period_start, period_end,
            months_count, base_fee, discount_percentage, discount_type, discount_reason, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        `);

        const resFee = insFee.run(
          studentId,
          invoiceNumber,
          'Admission & Initial Training Fee',
          effectiveJoiningDate,
          baseFee + joiningFee,
          discountAmt,
          totalAmountDue,
          initialPaid,
          initialBalance,
          initialStatus,
          effectiveJoiningDate,
          endDateStr,
          baseFee,
          resolvedDiscount,
          resolvedDiscount > 0 ? 'percentage' : 'none',
          discount_reason || null,
          payment_notes || 'Admission initial fee'
        );

        feeLiability = db.prepare('SELECT * FROM student_fees WHERE id = ?').get(resFee.lastInsertRowid);

        // Record payment only if actual cash/card payment received
        if (initialPaid > 0) {
          const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;
          const insPayment = db.prepare(`
            INSERT INTO fee_payments (
              student_fee_id, student_id, receipt_number, payment_date, amount,
              payment_mode, notes, collected_by, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
          `);
          const resPay = insPayment.run(
            feeLiability.id,
            studentId,
            receiptNumber,
            effectiveJoiningDate,
            initialPaid,
            resolvedPaymentMethod,
            payment_notes || 'Admission initial payment',
            currentUser ? currentUser.userId : null
          );
          paymentRecord = db.prepare('SELECT * FROM fee_payments WHERE id = ?').get(resPay.lastInsertRowid);

          // Add to student_fee_ledger
          db.prepare(`
            INSERT INTO student_fee_ledger (
              student_id, student_fee_id, fee_payment_id, entry_type, charge_type,
              period_start, period_end, months_count, debit, credit, running_balance, created_by
            ) VALUES (?, ?, ?, 'payment', 'tuition', ?, ?, 1, 0, ?, ?, ?)
          `).run(studentId, feeLiability.id, paymentRecord.id, effectiveJoiningDate, endDateStr, initialPaid, initialBalance, currentUser ? currentUser.userId : null);
        }
      }

      // 6. Initialize Standard Admission Checklist
      const defaultChecklist = [
        { key: 'doc_photo', name: 'Student Photo Uploaded', mandatory: 0, completed: admissionData.photo_url ? 1 : 0 },
        { key: 'guardian_consent', name: 'Parent / Guardian Consent Form', mandatory: 1, completed: admissionData.medical_consent ? 1 : 0 },
        { key: 'medical_clearance', name: 'Medical Clearance & Health Declaration', mandatory: 0, completed: admissionData.medical_consent ? 1 : 0 },
        { key: 'admission_fee_settled', name: 'Admission & Initial Fee Settlement', mandatory: 1, completed: (initial_payment_amount >= totalAmountDue && totalAmountDue > 0) ? 1 : 0 },
        { key: 'batch_assignment', name: 'Batch & Schedule Assignment', mandatory: 0, completed: batch_id ? 1 : 0 },
      ];

      for (const item of defaultChecklist) {
        db.prepare(`
          INSERT INTO admission_checklists (
            academy_id, student_id, item_key, item_name, is_mandatory, is_completed, verified_by_user_id, verified_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          Number(academyId),
          studentId,
          item.key,
          item.name,
          item.mandatory,
          item.completed,
          item.completed ? (currentUser ? currentUser.userId : null) : null,
          item.completed ? new Date().toISOString() : null
        );
      }

      // 7. If linked to an inquiry, mark inquiry as converted
      if (inquiry_id) {
        db.prepare(`
          UPDATE inquiries
          SET status = 'converted',
              converted_student_id = ?,
              converted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(studentId, Number(inquiry_id));
      }
    });

    tx();

    return {
      success: true,
      student: createdStudent,
      enrollment: enrollmentRecord,
      fee: feeLiability,
      payment: paymentRecord,
    };
  }

  /**
   * Rejoin workflow for returning former students
   */
  static rejoinStudent(db, academyId, studentId, rejoinData, currentUser) {
    const student = db.prepare('SELECT * FROM students WHERE id = ? AND academy_id = ?').get(Number(studentId), Number(academyId));
    if (!student) {
      throw new Error('Student not found');
    }

    const {
      branch_id,
      batch_id,
      rejoin_date,
      fee_override_amount,
      joining_fee_amount = 0,
      initial_payment_amount = 0,
      payment_method = 'cash',
      notes,
    } = rejoinData;

    const effectiveRejoinDate = rejoin_date || new Date().toISOString().split('T')[0];

    const tx = db.transaction(() => {
      // 1. Reactivate student status
      db.prepare("UPDATE students SET status = 'active', branch_id = COALESCE(?, branch_id), updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(branch_id ? Number(branch_id) : null, student.id);

      // 2. Close previous batch memberships
      db.prepare("UPDATE student_batch_enrollments SET status = 'completed', end_date = ? WHERE student_id = ? AND status = 'active'")
        .run(effectiveRejoinDate, student.id);

      // 3. Assign new batch
      if (batch_id) {
        const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND is_active = 1').get(Number(batch_id));
        if (!batch) throw new Error('Selected batch does not exist or is inactive');

        db.prepare(`
          INSERT INTO student_batch_enrollments (student_id, batch_id, start_date, status, assigned_by)
          VALUES (?, ?, ?, 'active', ?)
        `).run(student.id, batch.id, effectiveRejoinDate, currentUser ? currentUser.userId : null);

        // 4. Calculate fees from new effective rejoin date
        const baseFee = (fee_override_amount !== undefined && fee_override_amount !== null && fee_override_amount !== '')
          ? Number(fee_override_amount)
          : (batch.monthly_fee || 0);

        const totalDue = baseFee + Number(joining_fee_amount || 0);
        if (totalDue > 0) {
          const initialPaid = Math.min(Number(initial_payment_amount) || 0, totalDue);
          const initialBalance = totalDue - initialPaid;
          const status = initialPaid >= totalDue ? 'paid' : (initialPaid > 0 ? 'partial' : 'pending');

          const jDate = new Date(effectiveRejoinDate);
          const pEnd = new Date(jDate);
          pEnd.setMonth(pEnd.getMonth() + 1);
          pEnd.setDate(pEnd.getDate() - 1);
          const endDateStr = `${pEnd.getFullYear()}-${String(pEnd.getMonth() + 1).padStart(2, '0')}-${String(pEnd.getDate()).padStart(2, '0')}`;
          const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

          const resFee = db.prepare(`
            INSERT INTO student_fees (
              student_id, invoice_number, title, due_date, amount, discount_amount,
              net_amount, paid_amount, balance_amount, status, period_start, period_end,
              months_count, base_fee, discount_percentage, discount_type, notes
            ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 1, ?, 0, 'none', ?)
          `).run(
            student.id,
            invoiceNumber,
            'Rejoining Training Fee',
            effectiveRejoinDate,
            totalDue,
            totalDue,
            initialPaid,
            initialBalance,
            status,
            effectiveRejoinDate,
            endDateStr,
            baseFee,
            notes || 'Rejoining student fee activation'
          );

          if (initialPaid > 0) {
            const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;
            const resPay = db.prepare(`
              INSERT INTO fee_payments (
                student_fee_id, student_id, receipt_number, payment_date, amount,
                payment_mode, notes, collected_by, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
            `).run(
              resFee.lastInsertRowid,
              student.id,
              receiptNumber,
              effectiveRejoinDate,
              initialPaid,
              payment_method || 'cash',
              notes || 'Rejoining initial payment',
              currentUser ? currentUser.userId : null
            );

            db.prepare(`
              INSERT INTO student_fee_ledger (
                student_id, student_fee_id, fee_payment_id, entry_type, charge_type,
                period_start, period_end, months_count, debit, credit, running_balance, created_by
              ) VALUES (?, ?, ?, 'payment', 'tuition', ?, ?, 1, 0, ?, ?, ?)
            `).run(student.id, resFee.lastInsertRowid, resPay.lastInsertRowid, effectiveRejoinDate, endDateStr, initialPaid, initialBalance, currentUser ? currentUser.userId : null);
          }
        }
      }
    });

    tx();

    return db.prepare('SELECT * FROM students WHERE id = ?').get(student.id);
  }
}
