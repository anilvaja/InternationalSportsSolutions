import fs from 'fs';
import path from 'path';
import { getCentralDb } from '../db/centralDb.js';
import { getTenantDbById } from '../db/connectionManager.js';
import { config } from '../config/index.js';

/**
 * Data Dictionary metadata descriptions for all primary schema columns
 */
const DATA_DICTIONARY_DESCRIPTIONS = {
  // Global & Common
  id: 'Auto-incrementing unique primary key identifier',
  created_at: 'UTC timestamp when record was initially created',
  updated_at: 'UTC timestamp of the most recent modification',
  academy_id: 'Tenant isolation identifier linking record to the parent Academy',
  status: 'Lifecycle status flag (e.g. active, inactive, pending, suspended)',
  name: 'Full human-readable descriptive name or title',
  title: 'Entity title or headline',
  description: 'Detailed description, notes, or contextual narrative',
  email: 'Contact email address (used for alerts and notifications)',
  phone: 'Contact telephone or WhatsApp mobile number',
  address: 'Physical street address',
  city: 'City location',
  country: 'Country jurisdiction',
  notes: 'Optional administrative or internal notes',

  // Academies & Central
  slug: 'URL-friendly unique subdomain and route identifier',
  logo_url: 'Static or cloud asset URL for academy branding logo',
  plan: 'Subscribed SaaS tier (starter, professional, enterprise)',
  max_branches: 'Subscription quota limit for total physical branches/dojos',
  max_students: 'Subscription quota limit for total enrolled active students',
  max_coaches: 'Subscription quota limit for total active coaching staff',
  db_path: 'Relative or absolute filesystem path to dedicated SQLite database',
  is_gst_registered: '1 if academy is registered for Goods & Services Tax (India), 0 otherwise',
  gst_number: '15-character official GSTIN registration identifier',
  gst_rate: 'Applicable GST percentage rate (default: 18%)',
  legal_business_name: 'Registered legal entity or company trade name',
  hsn_sac_code: 'Statutory SAC service classification code (e.g. 999293 for sports training)',

  // Students
  student_code: 'Human-readable unique student identifier (e.g. STU-916270-676)',
  admission_number: 'Official academic / academy admission registration number',
  first_name: 'Given / first name of the student',
  last_name: 'Surname / family name of the student',
  date_of_birth: 'Student date of birth (YYYY-MM-DD)',
  gender: 'Gender identity (male, female, other)',
  blood_group: 'Medical blood group identifier (e.g. B+, O-, A+)',
  guardian_name: 'Full name of primary parent or legal guardian',
  guardian_phone: 'Emergency contact telephone of primary guardian',
  guardian_email: 'Email address of primary guardian for billing/notices',
  father_name: 'Full name of student father',
  father_phone: 'Direct contact phone of student father',
  mother_name: 'Full name of student mother',
  mother_phone: 'Direct contact phone of student mother',
  allergies: 'Documented medical allergies, asthma, or drug sensitivities',
  emergency_medical_instructions: 'Critical instructions in case of injury or allergic reaction',
  doctor_clinic_contact: 'Family physician or primary clinic emergency contact',
  previous_sports_experience: 'Athletic background and prior martial arts / sports disciplines',
  goals_notes: 'Student competitive aspirations, targets, or grading goals',
  belt_rank: 'Current martial arts belt rank (e.g. White Belt, Yellow, Black)',
  current_technique_id: 'Foreign key to current syllabus technique student is practicing',
  current_technique_status: 'Progress state of current technique (keep, promote, review)',

  // Branches & Facilities
  latitude: 'GPS geographic latitude coordinate for geofence validation',
  longitude: 'GPS geographic longitude coordinate for geofence validation',
  radius_meters: 'Geofence circular perimeter tolerance in meters (default: 100m)',
  is_geofence_enforced: '1 if staff punches require device location within perimeter',
  capacity: 'Maximum concurrent student or room capacity',

  // Batches
  branch_id: 'Foreign key reference to branch / dojo facility',
  sport_id: 'Foreign key reference to sport or martial art discipline',
  coach_id: 'Foreign key reference to assigned coach or instructor',
  start_time: 'Daily scheduled start time (HH:MM e.g. 06:30)',
  end_time: 'Daily scheduled end time (HH:MM e.g. 08:00)',
  days_of_week: 'Comma-separated active days of week (e.g. Mon, Wed, Fri)',
  max_students_per_batch: 'Capacity cap for students in this batch',

  // Fees & Billing
  invoice_number: 'Unique commercial invoice identifier (e.g. INV-005800-565)',
  receipt_number: 'Official serialized receipt number (e.g. REC-1001)',
  due_date: 'Invoice payment deadline date (YYYY-MM-DD)',
  period_start: 'Beginning date of the coaching coverage period',
  period_end: 'Ending date of the coaching coverage period',
  months_count: 'Number of months covered by this fee installment',
  base_fee: 'Standard pre-discount curriculum tuition fee',
  discount_percentage: 'Percentage discount rate applied (0-100%)',
  discount_amount: 'Monetary discount subtracted from base fee',
  discount_reason: 'Justification for discount approval',
  tax_amount: 'Calculated GST or sales tax component',
  net_amount: 'Final payable invoice fee after discount and tax',
  paid_amount: 'Cumulative amount paid towards this invoice',
  balance_amount: 'Outstanding unpaid balance remaining on invoice',
  payment_mode: 'Payment transaction channel (upi, cash, card, netbanking, cheque)',
  transaction_reference: 'Bank / UPI reference or cheque UTR identifier',
  next_installment_date: 'Scheduled date when next billing cycle begins',

  // Events
  event_date: 'Date the tournament, workshop, or competition starts',
  event_end_date: 'Date the tournament, workshop, or competition concludes',
  event_type: 'Classification of event (tournament, workshop, grading, seminar)',
  fee: 'Registration or entrance fee for participant',
  max_participants: 'Maximum registered student cap',
  registration_approval_required: '1 if organizer confirmation is required before confirmed status',
  eligibility_snapshot_version: 'Incremented version counter of student eligibility snapshot',

  // Attendance & Time Tracking
  attendance_id: 'Foreign key to parent batch session attendance record',
  student_id: 'Foreign key to student record',
  punch_in_time: 'ISO timestamp when employee clocked in',
  punch_out_time: 'ISO timestamp when employee clocked out',
  duration_minutes: 'Total duration of time punch shift in minutes',
  overtime_minutes: 'Minutes worked exceeding standard shift hours',
  technique_id: 'Foreign key to syllabus technique covered during attendance session',
  technique_status: 'Outcome of technique practice: keep, promote, review',
};

export class DbViewerService {
  /**
   * 1. Lists all available databases on the host system
   */
  static listDatabases() {
    const centralDb = getCentralDb();
    const centralDbPath = config.centralDbPath;
    let centralSize = 0;
    try {
      if (fs.existsSync(centralDbPath)) {
        centralSize = fs.statSync(centralDbPath).size;
      }
    } catch {}

    const centralTableCount = centralDb.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().c;

    const dbList = [
      {
        id: 'central',
        name: 'Central Platform Database (central.db)',
        type: 'central',
        slug: 'central',
        plan: 'system',
        status: 'system',
        path: centralDbPath,
        sizeBytes: centralSize,
        sizeFormatted: (centralSize / 1024).toFixed(1) + ' KB',
        tableCount: centralTableCount,
        description: 'Multi-tenant master registry, subscriptions, plans, global users & domains',
      }
    ];

    const academies = centralDb.prepare('SELECT id, name, slug, plan, status, db_path FROM academies ORDER BY id ASC').all();

    for (const a of academies) {
      const resolvedPath = path.isAbsolute(a.db_path) ? a.db_path : path.join(process.cwd(), a.db_path);
      let size = 0;
      let tableCount = 0;
      try {
        if (fs.existsSync(resolvedPath)) {
          size = fs.statSync(resolvedPath).size;
        }
        const tDb = getTenantDbById(a.id);
        tableCount = tDb.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().c;
      } catch (e) {
        console.warn(`Could not inspect DB for academy ${a.id}:`, e.message);
      }

      dbList.push({
        id: a.id,
        dbKey: `academy_${a.id}`,
        name: `${a.name} (Tenant #${a.id})`,
        type: 'tenant',
        academyId: a.id,
        slug: a.slug,
        plan: a.plan || 'standard',
        status: a.status || 'active',
        path: resolvedPath,
        sizeBytes: size,
        sizeFormatted: size > 1048576 ? (size / 1048576).toFixed(2) + ' MB' : (size / 1024).toFixed(1) + ' KB',
        tableCount,
        description: `Dedicated isolated SQLite database for ${a.name}`,
      });
    }

    return dbList;
  }

  /**
   * Helper to resolve Database handle
   */
  static getTargetDb(dbKey) {
    if (dbKey === 'central' || dbKey === '0') {
      return { db: getCentralDb(), name: 'Central Platform DB', isCentral: true };
    }

    const academyId = Number(String(dbKey).replace('academy_', ''));
    if (!academyId) {
      throw new Error(`Invalid database key: ${dbKey}`);
    }

    const db = getTenantDbById(academyId);
    return { db, name: `Tenant #${academyId} DB`, isCentral: false, academyId };
  }

  /**
   * 2. Lists all tables in a database with row counts and statistics
   */
  static listTables(dbKey) {
    const { db } = this.getTargetDb(dbKey);
    const tables = db.prepare(`
      SELECT name, type 
      FROM sqlite_master 
      WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC
    `).all();

    return tables.map(t => {
      let rowCount = 0;
      let colCount = 0;
      try {
        const countRes = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
        rowCount = countRes ? countRes.c : 0;
      } catch (e) {
        rowCount = -1;
      }

      try {
        const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
        colCount = cols.length;
      } catch (e) {}

      return {
        name: t.name,
        type: t.type,
        rowCount,
        colCount,
      };
    });
  }

  /**
   * 3. Retrieves detailed Table Schema & Data Dictionary
   */
  static getTableSchema(dbKey, tableName) {
    const { db } = this.getTargetDb(dbKey);
    const cleanTable = tableName.replace(/"/g, '');

    const columns = db.prepare(`PRAGMA table_info("${cleanTable}")`).all();
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${cleanTable}")`).all();
    const indexList = db.prepare(`PRAGMA index_list("${cleanTable}")`).all();

    // Enrich columns with Data Dictionary definitions
    const enrichedColumns = columns.map(c => {
      const colNameLower = c.name.toLowerCase();
      let description = DATA_DICTIONARY_DESCRIPTIONS[colNameLower] || '';

      if (!description) {
        if (colNameLower.endsWith('_id')) {
          const entity = colNameLower.replace(/_id$/, '').replace(/_/g, ' ');
          description = `Foreign key reference linking to ${entity} identifier`;
        } else if (colNameLower.startsWith('is_') || colNameLower.startsWith('has_')) {
          description = `Boolean toggle flag (1 = True, 0 = False)`;
        } else if (colNameLower.endsWith('_at') || colNameLower.endsWith('_time') || colNameLower.endsWith('_date')) {
          description = `Chronological timestamp or date value`;
        } else if (colNameLower.endsWith('_count') || colNameLower.endsWith('_total')) {
          description = `Computed numerical total or tally counter`;
        } else if (colNameLower.endsWith('_amount') || colNameLower.endsWith('_fee') || colNameLower.endsWith('_price')) {
          description = `Monetary currency value in INR (₹)`;
        } else {
          description = `Stores attribute value for ${c.name.replace(/_/g, ' ')}`;
        }
      }

      const fkMatch = foreignKeys.find(fk => fk.from === c.name);

      return {
        cid: c.cid,
        name: c.name,
        type: c.type || 'TEXT',
        notnull: Boolean(c.notnull),
        defaultValue: c.dflt_value,
        isPrimaryKey: Boolean(c.pk),
        foreignKey: fkMatch ? { targetTable: fkMatch.table, targetColumn: fkMatch.to } : null,
        description,
      };
    });

    const primaryKeys = enrichedColumns.filter(c => c.isPrimaryKey).map(c => ({ name: c.name, type: c.type }));

    return {
      tableName: cleanTable,
      columns: enrichedColumns,
      primaryKeys,
      foreignKeys,
      indexes: indexList,
      totalColumns: enrichedColumns.length,
    };
  }

  /**
   * 4. Browses Paginated Table Data with Search & Sorting
   */
  static getTableData(dbKey, tableName, options = {}) {
    const { db } = this.getTargetDb(dbKey);
    const cleanTable = tableName.replace(/"/g, '');

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(options.limit) || 25));
    const offset = (page - 1) * limit;
    const search = (options.search || '').trim();
    const sortBy = options.sortBy ? options.sortBy.replace(/"/g, '') : null;
    const sortDir = (options.sortDir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Verify valid columns
    const columnsInfo = db.prepare(`PRAGMA table_info("${cleanTable}")`).all();
    const validColNames = columnsInfo.map(c => c.name);

    let whereClause = '';
    const params = [];

    if (search && validColNames.length > 0) {
      const searchConditions = validColNames
        .filter(c => {
          const colInfo = columnsInfo.find(ci => ci.name === c);
          const type = (colInfo?.type || '').toUpperCase();
          return type.includes('CHAR') || type.includes('TEXT') || type.includes('CLOB') || type === '';
        })
        .map(c => `"${c}" LIKE ?`);

      if (searchConditions.length > 0) {
        whereClause = ` WHERE (${searchConditions.join(' OR ')})`;
        params.push(...searchConditions.map(() => `%${search}%`));
      }
    }

    const totalCountQuery = `SELECT COUNT(*) as c FROM "${cleanTable}"${whereClause}`;
    const totalCount = db.prepare(totalCountQuery).get(...params).c;

    let orderClause = '';
    if (sortBy && validColNames.includes(sortBy)) {
      orderClause = ` ORDER BY "${sortBy}" ${sortDir}`;
    } else {
      const pkCol = columnsInfo.find(c => c.pk === 1);
      if (pkCol) {
        orderClause = ` ORDER BY "${pkCol.name}" DESC`;
      }
    }

    const dataQuery = `SELECT * FROM "${cleanTable}"${whereClause}${orderClause} LIMIT ? OFFSET ?`;
    const rows = db.prepare(dataQuery).all(...params, limit, offset);

    return {
      tableName: cleanTable,
      columns: columnsInfo.map(c => ({ name: c.name, type: c.type, isPk: Boolean(c.pk) })),
      rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * 5. Modifies / Updates an existing row
   */
  static updateRow(dbKey, tableName, pkColumn, pkValue, updates) {
    const { db } = this.getTargetDb(dbKey);
    const cleanTable = tableName.replace(/"/g, '');
    const cleanPk = pkColumn.replace(/"/g, '');

    const columnsInfo = db.prepare(`PRAGMA table_info("${cleanTable}")`).all();
    const validColNames = columnsInfo.map(c => c.name);

    const updateFields = [];
    const values = [];

    for (const [key, val] of Object.entries(updates)) {
      if (validColNames.includes(key) && key !== cleanPk) {
        updateFields.push(`"${key}" = ?`);
        values.push(val === '' ? null : val);
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid columns specified for update');
    }

    values.push(pkValue);
    const sql = `UPDATE "${cleanTable}" SET ${updateFields.join(', ')} WHERE "${cleanPk}" = ?`;
    const res = db.prepare(sql).run(...values);

    return {
      success: true,
      changes: res.changes,
      message: `Successfully updated row where ${cleanPk} = ${pkValue}`,
    };
  }

  /**
   * 6. Inserts a new row into the specified table
   */
  static insertRow(dbKey, tableName, data) {
    const { db } = this.getTargetDb(dbKey);
    const cleanTable = tableName.replace(/"/g, '');

    const columnsInfo = db.prepare(`PRAGMA table_info("${cleanTable}")`).all();
    const validColNames = columnsInfo.map(c => c.name);

    const cols = [];
    const placeholders = [];
    const values = [];

    for (const [key, val] of Object.entries(data)) {
      if (validColNames.includes(key)) {
        cols.push(`"${key}"`);
        placeholders.push('?');
        values.push(val === '' ? null : val);
      }
    }

    if (cols.length === 0) {
      throw new Error('No valid columns provided for insertion');
    }

    const sql = `INSERT INTO "${cleanTable}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const res = db.prepare(sql).run(...values);

    return {
      success: true,
      lastInsertRowid: res.lastInsertRowid,
      changes: res.changes,
      message: `Successfully inserted new record (Row ID: ${res.lastInsertRowid})`,
    };
  }

  /**
   * 7. Deletes a row by primary key
   */
  static deleteRow(dbKey, tableName, pkColumn, pkValue) {
    const { db } = this.getTargetDb(dbKey);
    const cleanTable = tableName.replace(/"/g, '');
    const cleanPk = pkColumn.replace(/"/g, '');

    const sql = `DELETE FROM "${cleanTable}" WHERE "${cleanPk}" = ?`;
    const res = db.prepare(sql).run(pkValue);

    return {
      success: true,
      changes: res.changes,
      message: `Successfully deleted row where ${cleanPk} = ${pkValue}`,
    };
  }

  /**
   * 8. Executes an Arbitrary Raw SQL Query in Safe Super Admin Environment
   */
  static executeRawQuery(dbKey, sql) {
    const { db } = this.getTargetDb(dbKey);
    const query = (sql || '').trim();

    if (!query) {
      throw new Error('SQL query statement cannot be empty');
    }

    const isSelect = /^(SELECT|PRAGMA|EXPLAIN)/i.test(query);
    const startTime = Date.now();

    if (isSelect) {
      const stmt = db.prepare(query);
      const rows = stmt.all();
      const timeMs = Date.now() - startTime;
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        success: true,
        type: 'select',
        rows,
        columns,
        count: rows.length,
        timeMs,
      };
    } else {
      const stmt = db.prepare(query);
      const result = stmt.run();
      const timeMs = Date.now() - startTime;

      return {
        success: true,
        type: 'mutation',
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
        timeMs,
      };
    }
  }
}
