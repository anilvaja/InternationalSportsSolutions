import bcrypt from 'bcryptjs';
import path from 'path';
import { config } from '../config/index.js';
import { provisionAcademyDb, getTenantDbById, getAcademyDbPath } from '../db/connectionManager.js';
import { SmartAttendanceEngine } from './smartAttendanceEngine.js';
import { UserService } from './userService.js';
import { ALL_ACADEMY_PERMISSIONS, DEFAULT_ACADEMY_ROLES } from '../config/permissions.js';

export class AcademySetupWizardService {
  /**
   * Retrieves reference data and standard defaults for the 10-step wizard.
   * 
   * @param {import('better-sqlite3').Database} centralDb 
   */
  static getSetupDefaults(centralDb) {
    const plans = centralDb.prepare(`
      SELECT sp.*, 
        (SELECT json_group_object(quota_key, limit_value) FROM subscription_plan_limits WHERE plan_id = sp.id) as limits_json,
        (SELECT json_group_object(feature_key, is_enabled) FROM subscription_plan_features WHERE plan_id = sp.id) as features_json
      FROM subscription_plans sp
      WHERE sp.status = 'active'
      ORDER BY sp.price ASC
    `).all().map(p => ({
      ...p,
      limits: p.limits_json ? JSON.parse(p.limits_json) : {},
      features: p.features_json ? JSON.parse(p.features_json) : {},
    }));

    const standardSports = [
      { name: 'Karate', code: 'KAR', description: 'Traditional Martial Arts (Kata, Kumite, Kihon)', defaultCategories: ['Kihon (Basics)', 'Kata (Forms)', 'Kumite (Sparring)'] },
      { name: 'Taekwondo', code: 'TKD', description: 'Korean Martial Art (Poomsae, Kyorugi)', defaultCategories: ['Poomsae (Forms)', 'Kyorugi (Sparring)', 'Kyukpa (Breaking)'] },
      { name: 'Boxing', code: 'BOX', description: 'Sweet Science Combat Sport', defaultCategories: ['Footwork & Stance', 'Punch Combos', 'Defense & Slipping'] },
      { name: 'Kickboxing', code: 'KCK', description: 'Hybrid Stand-Up Combat Sport', defaultCategories: ['Striking Combos', 'Kicking Techniques', 'Clinch & Defense'] },
      { name: 'Football', code: 'FTB', description: 'Soccer & Ball Mastery', defaultCategories: ['Ball Control', 'Passing & Receiving', 'Tactical Positioning'] },
      { name: 'Cricket', code: 'CRK', description: 'Batting, Bowling & Fielding', defaultCategories: ['Batting Mechanics', 'Pace & Spin Bowling', 'Fielding & Catching'] },
      { name: 'Badminton', code: 'BAD', description: 'Racket Sport & Agility', defaultCategories: ['Footwork & Clears', 'Smash & Drop Shots', 'Net Play'] },
      { name: 'Swimming', code: 'SWM', description: 'Aquatics & Stroke Mastery', defaultCategories: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly'] },
      { name: 'Gymnastics', code: 'GYM', description: 'Acrobatics, Balance & Flexibility', defaultCategories: ['Floor Exercise', 'Vault & Balance', 'Flexibility Conditioning'] },
      { name: 'Yoga', code: 'YOG', description: 'Asanas, Breathwork & Mindfulness', defaultCategories: ['Basic Asanas', 'Pranayama', 'Advanced Balancing'] },
    ];

    const timezones = [
      { value: 'Asia/Kolkata', label: 'India Standard Time (IST, UTC+5:30)' },
      { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST, UTC+4:00)' },
      { value: 'UTC', label: 'Coordinated Universal Time (UTC+0:00)' },
      { value: 'America/New_York', label: 'Eastern Time (US & Canada, UTC-5:00)' },
      { value: 'Europe/London', label: 'Greenwich Mean Time (GMT, UTC+0:00)' },
      { value: 'Asia/Singapore', label: 'Singapore Time (SGT, UTC+8:00)' },
      { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET, UTC+10:00)' },
    ];

    const currencies = [
      { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
      { code: 'USD', symbol: '$', name: 'US Dollar' },
      { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
      { code: 'GBP', symbol: '£', name: 'British Pound' },
      { code: 'EUR', symbol: '€', name: 'Euro' },
      { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    ];

    return {
      plans,
      standardSports,
      timezones,
      currencies,
      dateFormats: [
        { format: 'DD/MM/YYYY', label: 'DD/MM/YYYY (Standard Indian / British format — Recommended)' },
        { format: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO standard format)' },
        { format: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US format)' },
      ],
      attendanceModes: [
        { id: 'qr', name: 'QR Code Pass Scanning', description: 'Instant scanning with mobile/tablet cameras or 2D barcode scanners' },
        { id: 'coach_manual', name: 'Coach-Assisted Manual Roster', description: 'Coaches mark attendance per batch in the field' },
        { id: 'face', name: 'Face Biometrics (Opt-In)', description: 'Anti-spoofing facial recognition with mandatory parent consent' },
        { id: 'nfc', name: 'NFC / RFID Cards & Wristbands', description: 'Tap-and-go silicone bands and contactless badges' },
        { id: 'gps', name: 'GPS Geofenced Check-In', description: 'Mobile location verification within branch radius' },
      ],
      salaryModes: [
        { mode: 'monthly', label: 'Monthly Fixed Salary', description: 'Fixed base salary prorated by working days and approved leaves' },
        { mode: 'daily', label: 'Daily Rate', description: 'Paid per verified attended working day' },
        { mode: 'hourly', label: 'Hourly Rate', description: 'Paid strictly based on clocked shift minutes divided by 60' },
        { mode: 'per_minute', label: 'Per-Minute Rate', description: 'High-precision compensation by actual minutes on duty' },
        { mode: 'per_session', label: 'Per-Batch / Session Rate', description: 'Paid per batch session coached and verified' },
      ],
      roles: DEFAULT_ACADEMY_ROLES,
    };
  }

  /**
   * Executes transactional provisioning of an entire fully-configured academy
   * from the 10-step guided setup wizard.
   * 
   * @param {import('better-sqlite3').Database} centralDb 
   * @param {object} wizardData 
   * @param {number} superAdminUserId 
   */
  static createAcademyThroughWizard(centralDb, wizardData, superAdminUserId = 1) {
    const {
      // Step 1: Academy Info
      name,
      code,
      slug: userSlug,
      contact_email,
      contact_phone,
      address,
      city,
      state,
      country = 'India',
      timezone = 'Asia/Kolkata',
      currency = 'INR',
      currency_symbol = '₹',
      date_format = 'DD/MM/YYYY',
      plan = 'professional',
      logo_url = null,
      custom_domain = null,

      // GST & Compliance
      is_gst_registered = false,
      gst_number = null,
      gst_rate = 18.0,
      legal_business_name = null,
      hsn_sac_code = '999293',

      // Step 2: Administrator Account
      admin_name,
      admin_email,
      admin_phone,
      admin_password,

      // Step 3: Branches
      branches = [],

      // Step 4: Sports & Disciplines
      sports = [],

      // Step 5: Batches & Timetables
      batches = [],

      // Step 6: Employees & Roles
      employees = [],

      // Step 7: Attendance Configuration
      attendance_settings = {},

      // Step 8: Salary Configuration
      salary_settings = {},

      // Step 9: Fee Settings
      fee_settings = {},
    } = wizardData;

    // Validate mandatory basics
    if (!name || !name.trim()) throw new Error('Step 1: Academy Name is required');
    if (!admin_email || !admin_email.trim()) throw new Error('Step 2: Administrator Email is required');
    if (!admin_password || admin_password.length < 6) throw new Error('Step 2: Administrator Password must be at least 6 characters');

    let resolvedSlug = (userSlug || name)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!resolvedSlug) throw new Error('Could not derive a valid URL slug for this academy');

    // 1. Provision Central Database & Tenant SQLite File
    const academy = provisionAcademyDb({
      name: name.trim(),
      slug: resolvedSlug,
      contact_email: contact_email || admin_email,
      contact_phone: contact_phone || admin_phone || null,
      address: address || null,
      city: city || 'Ahmedabad',
      logo_url,
      plan,
      admin_name: admin_name || `${name.trim()} Admin`,
      admin_email: admin_email.trim().toLowerCase(),
      admin_password,
      is_gst_registered: is_gst_registered ? 1 : 0,
      gst_number,
      gst_rate,
      legal_business_name,
      hsn_sac_code,
    });

    const academyId = academy.id;
    const db = getTenantDbById(academyId);

    // Save extended settings into tenant_settings
    const setSetting = db.prepare('INSERT OR REPLACE INTO tenant_settings (key, value) VALUES (?, ?)');
    setSetting.run('academy_code', (code || resolvedSlug.substring(0, 4)).toUpperCase());
    setSetting.run('country', country);
    setSetting.run('state', state || '');
    setSetting.run('timezone', timezone);
    setSetting.run('currency', currency);
    setSetting.run('currency_symbol', currency_symbol);
    setSetting.run('date_format', date_format);
    setSetting.run('setup_wizard_completed', '1');
    setSetting.run('setup_completed_at', new Date().toISOString());

    // 2. Provision Custom Domain if supplied
    if (custom_domain && custom_domain.trim()) {
      const cleanDom = custom_domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      try {
        centralDb.prepare(`
          INSERT OR IGNORE INTO domains (academy_id, domain, is_primary, is_custom, status)
          VALUES (?, ?, 0, 1, 'active')
        `).run(academyId, cleanDom);
      } catch (_) {}
    }

    // 3. Step 3: Branches Provisioning
    const branchMap = new Map(); // branchIndex/code -> branchId
    const branchList = Array.isArray(branches) && branches.length > 0 ? branches : [
      { name: 'Main Dojo / HQ', address: address || city, phone: contact_phone || admin_phone }
    ];

    const insBranch = db.prepare(`
      INSERT INTO branches (
        academy_id, name, address, phone, latitude, longitude, geofence_radius_meters, is_geofence_enforced, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (let i = 0; i < branchList.length; i++) {
      const b = branchList[i];
      const bName = (b.name || `Branch #${i + 1}`).trim();
      const lat = b.latitude ? Number(b.latitude) : 23.0225;
      const lng = b.longitude ? Number(b.longitude) : 72.5714;
      const res = insBranch.run(
        academyId,
        bName,
        b.address || null,
        b.phone || null,
        lat,
        lng,
        b.geofence_radius_meters ? Number(b.geofence_radius_meters) : 150,
        b.is_geofence_enforced ? 1 : 0
      );
      const branchId = Number(res.lastInsertRowid);
      branchMap.set(i, branchId);
      branchMap.set(bName.toLowerCase(), branchId);
      if (b.code) branchMap.set(b.code.toUpperCase(), branchId);
    }

    const defaultBranchId = branchMap.get(0) || 1;

    // 4. Step 4: Sports & Syllabus Disciplines
    const sportMap = new Map(); // sportName -> sportId
    const sportsList = Array.isArray(sports) && sports.length > 0 ? sports : [
      { name: 'Karate', description: 'Martial Arts' }
    ];

    const selSport = db.prepare('SELECT id FROM sports WHERE LOWER(name) = LOWER(?)');
    const insSport = db.prepare(`
      INSERT INTO sports (name, description, is_active)
      VALUES (?, ?, 1)
    `);

    const selCat = db.prepare('SELECT id FROM syllabus_categories WHERE academy_id = ? AND sport_id = ? AND LOWER(name) = LOWER(?)');
    const insCat = db.prepare(`
      INSERT INTO syllabus_categories (academy_id, sport_id, name, display_order)
      VALUES (?, ?, ?, ?)
    `);

    for (const sp of sportsList) {
      const sName = (typeof sp === 'string' ? sp : sp.name).trim();
      const desc = sp.description || `${sName} Training Program`;
      
      let sportId;
      const existingSport = selSport.get(sName);
      if (existingSport) {
        sportId = existingSport.id;
        db.prepare('UPDATE sports SET description = ?, is_active = 1 WHERE id = ?').run(desc, sportId);
      } else {
        const sRes = insSport.run(sName, desc);
        sportId = Number(sRes.lastInsertRowid);
      }
      sportMap.set(sName.toLowerCase(), sportId);

      // Seed standard categories for this sport
      const cats = sp.defaultCategories || ['Beginner Fundamentals', 'Intermediate Techniques', 'Advanced Mastery'];
      for (let cIdx = 0; cIdx < cats.length; cIdx++) {
        const catName = cats[cIdx];
        const existingCat = selCat.get(academyId, sportId, catName);
        if (!existingCat) {
          insCat.run(academyId, sportId, catName, cIdx + 1);
        }
      }
    }

    // 5. Step 6: Initial Staff & Coaches
    const coachMap = new Map(); // coachEmail/index -> coachRecordId
    const adminUser = db.prepare('SELECT id FROM users WHERE email = ?').get(admin_email.trim().toLowerCase());
    const adminUserId = adminUser ? adminUser.id : 1;

    if (Array.isArray(employees) && employees.length > 0) {
      for (let eIdx = 0; eIdx < employees.length; eIdx++) {
        const emp = employees[eIdx];
        if (!emp.email || !emp.name) continue;
        const eEmail = emp.email.trim().toLowerCase();
        const eRole = emp.role || 'coach';
        const eBranchId = emp.branch_id ? Number(emp.branch_id) : defaultBranchId;

        try {
          const userRes = UserService.createStaffUser(db, centralDb, academyId, {
            name: emp.name.trim(),
            email: eEmail,
            phone: emp.phone || null,
            password: emp.password || 'Sports@12345',
            role: eRole,
            branch_id: eBranchId,
            designation: emp.designation || 'Sports Coach',
            joining_date: emp.joining_date || new Date().toISOString().split('T')[0],
            compensation_mode: emp.compensation_mode || 'monthly',
            salary_amount: emp.salary_amount ? Number(emp.salary_amount) : 25000,
          });
          coachMap.set(eIdx, userRes.coachId || userRes.userId);
          coachMap.set(eEmail, userRes.coachId || userRes.userId);
        } catch (_) {}
      }
    }

    // 6. Step 5: Batches & Timetables
    const firstCoachId = coachMap.get(0) || null;
    const batchList = Array.isArray(batches) && batches.length > 0 ? batches : [
      {
        name: 'Morning Regular Batch',
        branch_id: defaultBranchId,
        sport_id: Array.from(sportMap.values())[0] || null,
        coach_id: firstCoachId,
        capacity: 30,
        start_time: '06:30',
        end_time: '08:00',
        days_of_week: ['Mon', 'Wed', 'Fri'],
      }
    ];

    const insBatch = db.prepare(`
      INSERT INTO batches (
        academy_id, branch_id, sport_id, coach_id, name, max_capacity, start_time, end_time, days_of_week, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const b of batchList) {
      const bBranchId = b.branch_id ? Number(b.branch_id) : defaultBranchId;
      const bSportId = b.sport_id ? Number(b.sport_id) : (Array.from(sportMap.values())[0] || null);
      const bCoachId = b.coach_id ? Number(b.coach_id) : firstCoachId;
      const days = Array.isArray(b.days_of_week) ? b.days_of_week.join(', ') : (b.days_of_week || 'Mon, Wed, Fri');

      insBatch.run(
        academyId,
        bBranchId,
        bSportId,
        bCoachId,
        b.name || 'Regular Batch',
        b.capacity ? Number(b.capacity) : 30,
        b.start_time || '07:00',
        b.end_time || '08:30',
        days
      );
    }

    // 7. Step 7: Smart Attendance Configuration
    const attModes = [];
    if (attendance_settings.is_qr_enabled !== 0) attModes.push('qr');
    if (attendance_settings.is_face_enabled !== 0) attModes.push('face');
    if (attendance_settings.is_nfc_enabled !== 0) attModes.push('nfc');
    if (attendance_settings.is_gps_enabled !== 0) attModes.push('gps');
    if (attendance_settings.is_coach_manual_enabled !== 0) attModes.push('coach_manual');

    SmartAttendanceEngine.saveSettings(db, academyId, null, {
      enabled_modes: attModes.length > 0 ? attModes : ['qr', 'coach_manual', 'gps', 'nfc'],
      default_mode: attendance_settings.default_attendance_mode || 'qr',
      duplicate_cooldown_mins: Number(attendance_settings.duplicate_scan_cooldown_minutes || attendance_settings.duplicate_cooldown_mins || 15),
      checkin_window_before_mins: Number(attendance_settings.early_checkin_window_minutes || 30),
      late_threshold_mins: Number(attendance_settings.late_checkin_grace_minutes || 15),
      face_liveness_required: 1,
      face_confidence_threshold: 0.85,
    });

    // 8. Step 8: Salary Configuration
    const setTenant = db.prepare('INSERT OR REPLACE INTO tenant_settings (key, value) VALUES (?, ?)');
    setTenant.run('payroll_salary_divisor_mode', salary_settings.salary_divisor_mode || 'working_days');
    setTenant.run('payroll_custom_divisor', String(salary_settings.custom_divisor || '26'));
    setTenant.run('payroll_overtime_multiplier', String(salary_settings.overtime_multiplier || '1.0'));
    setTenant.run('payroll_auto_checkout_hours', String(salary_settings.auto_checkout_hours || '12'));

    // 9. Step 9: Fee Structures
    if (fee_settings && fee_settings.base_monthly_fee) {
      try {
        db.prepare(`
          INSERT INTO fee_structures (
            name, sport_id, billing_frequency, amount, is_active
          ) VALUES (?, ?, 'monthly', ?, 1)
        `).run(
          fee_settings.name || 'Standard Monthly Training Fee',
          Array.from(sportMap.values())[0] || null,
          Number(fee_settings.base_monthly_fee) || 2000
        );
      } catch (_) {}
    }

    // Calculate initial setup completeness
    const completeness = this.getAcademySetupCompleteness(db, academyId);

    // Central Audit Log
    centralDb.prepare(`
      INSERT INTO central_audit_logs (user_id, user_email, action, entity, entity_id, details, ip_address)
      VALUES (?, 'superadmin', 'WIZARD_PROVISION_ACADEMY', 'academies', ?, ?, '127.0.0.1')
    `).run(superAdminUserId, String(academyId), `Completed 10-step onboarding wizard for ${name} (Score: ${completeness.score}%)`);

    return {
      success: true,
      academy: {
        id: academyId,
        name,
        slug: resolvedSlug,
        plan,
        primaryDomain: `${resolvedSlug}.internationalsportssolutions.test`,
      },
      completeness,
      message: `Academy '${name}' fully provisioned and ready for operations (${completeness.score}% configured)`,
    };
  }

  /**
   * Audits the setup completeness of an academy, returning actionable checklist
   * items and health score (0-100%).
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} academyId 
   */
  static getAcademySetupCompleteness(db, academyId) {
    const checks = [
      {
        id: 'admin_account',
        category: 'Administration',
        label: 'Academy Administrator Account',
        description: 'Designated user account with academy_admin role',
        weight: 15,
        test: () => {
          const row = db.prepare("SELECT count(*) as c FROM users WHERE role = 'academy_admin' AND status = 'active'").get();
          return (row?.c || 0) > 0;
        },
      },
      {
        id: 'branches',
        category: 'Infrastructure',
        label: 'Operational Training Branches',
        description: 'At least one physical training facility or dojo configured',
        weight: 15,
        test: () => {
          const row = db.prepare("SELECT count(*) as c FROM branches WHERE is_active = 1").get();
          return (row?.c || 0) > 0;
        },
      },
      {
        id: 'sports',
        category: 'Curriculum',
        label: 'Sports & Disciplines',
        description: 'Sports disciplines with syllabus categories attached',
        weight: 15,
        test: () => {
          const row = db.prepare("SELECT count(*) as c FROM sports WHERE is_active = 1").get();
          return (row?.c || 0) > 0;
        },
      },
      {
        id: 'coaches',
        category: 'Staffing',
        label: 'Coaches & Instructors',
        description: 'Instructors onboarded with assigned roles and salary structures',
        weight: 15,
        test: () => {
          const row = db.prepare("SELECT count(*) as c FROM users WHERE role IN ('coach', 'head_coach', 'trainer') AND status = 'active'").get();
          return (row?.c || 0) > 0;
        },
      },
      {
        id: 'batches',
        category: 'Operations',
        label: 'Batches & Timetable',
        description: 'Training batches linked to branch, sport, and coach',
        weight: 15,
        test: () => {
          const row = db.prepare("SELECT count(*) as c FROM batches WHERE is_active = 1").get();
          return (row?.c || 0) > 0;
        },
      },
      {
        id: 'smart_attendance',
        category: 'Attendance Engine',
        label: 'Smart Attendance Policies',
        description: 'Rules for QR scanning, duplicate cooldowns, and grace periods',
        weight: 10,
        test: () => {
          const row = db.prepare("SELECT count(*) as c FROM smart_attendance_settings").get();
          return (row?.c || 0) > 0;
        },
      },
      {
        id: 'payroll_settings',
        category: 'Finance',
        label: 'Salary & Payroll Policy',
        description: 'Configured working days divisor, leave policies, and overtime rules',
        weight: 10,
        test: () => {
          const row = db.prepare("SELECT count(*) as c FROM tenant_settings WHERE key = 'payroll_salary_divisor_mode'").get();
          return (row?.c || 0) > 0;
        },
      },
      {
        id: 'fee_structures',
        category: 'Billing',
        label: 'Fee Plans & Billing Structure',
        description: 'Tuition fees, installments, and admission fee policies',
        weight: 5,
        test: () => {
          const row = db.prepare("SELECT count(*) as c FROM fee_structures WHERE is_active = 1").get();
          return (row?.c || 0) > 0;
        },
      },
    ];

    let totalScore = 0;
    const completedItems = [];
    const missingItems = [];

    for (const check of checks) {
      let isPassed = false;
      try {
        isPassed = check.test();
      } catch (_) {
        isPassed = false;
      }

      const itemResult = {
        id: check.id,
        category: check.category,
        label: check.label,
        description: check.description,
        weight: check.weight,
        isCompleted: isPassed,
      };

      if (isPassed) {
        totalScore += check.weight;
        completedItems.push(itemResult);
      } else {
        missingItems.push(itemResult);
      }
    }

    return {
      score: totalScore,
      isFullyConfigured: totalScore === 100,
      isOperationallyReady: totalScore >= 75,
      completedItems,
      missingItems,
      completedCount: completedItems.length,
      totalCount: checks.length,
    };
  }
}
