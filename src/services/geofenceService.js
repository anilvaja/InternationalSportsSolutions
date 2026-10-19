/**
 * Geofence & GPS Punch Tracking Service
 * Implements Haversine distance calculations and geofence boundary enforcement
 */

/**
 * Calculates distance in meters between two GPS coordinates using Haversine formula
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters rounded to nearest integer
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return Infinity;
  }
  const R = 6371e3; // Earth's mean radius in meters
  const phi1 = (Number(lat1) * Math.PI) / 180;
  const phi2 = (Number(lat2) * Math.PI) / 180;
  const deltaPhi = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const deltaLambda = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Resolves the assigned branch for a user in the tenant database
 * @param {import('better-sqlite3').Database} db 
 * @param {object} user 
 * @param {number} [branchIdHint] 
 * @returns {object|null}
 */
export function resolveUserBranch(db, user, branchIdHint = null) {
  const userId = user.userId || user.id;

  // 1. If explicit branch provided and exists
  if (branchIdHint) {
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(branchIdHint);
    if (branch) return branch;
  }

  // 2. Check user_branch_assignments
  try {
    const assigned = db.prepare(`
      SELECT b.* FROM user_branch_assignments uba
      JOIN branches b ON b.id = uba.branch_id
      WHERE uba.user_id = ?
      LIMIT 1
    `).get(userId);
    if (assigned) return assigned;
  } catch (e) {
    // table might not exist in old migrations
  }

  // 3. Check coaches table for assigned branch
  try {
    const coach = db.prepare('SELECT branch_id FROM coaches WHERE user_id = ? OR email = ? LIMIT 1').get(userId, user.email);
    if (coach && coach.branch_id) {
      const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(coach.branch_id);
      if (branch) return branch;
    }
  } catch (e) {}

  // 4. Default to first active branch in academy
  return db.prepare('SELECT * FROM branches ORDER BY id ASC LIMIT 1').get() || null;
}

/**
 * Validates and records a staff punch with GPS geofence checks
 * @param {import('better-sqlite3').Database} db 
 * @param {object} user 
 * @param {object} payload 
 * @param {string} ipAddress 
 * @param {string} userAgent 
 */
export function processStaffPunch(db, user, payload, ipAddress = '', userAgent = '') {
  const userId = user.userId || user.id;
  const { punch_type, latitude, longitude, accuracy, accuracy_meters, branch_id } = payload;

  if (!punch_type || !['punch_in', 'punch_out'].includes(punch_type)) {
    throw { status: 400, message: "Invalid punch type. Allowed: 'punch_in' or 'punch_out'" };
  }

  const lat = Number(latitude);
  const lon = Number(longitude);
  const acc = accuracy !== undefined ? Number(accuracy) : (accuracy_meters !== undefined ? Number(accuracy_meters) : null);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw { status: 400, message: 'Valid GPS latitude and longitude coordinates are required' };
  }

  // Resolve target branch
  const branch = resolveUserBranch(db, user, branch_id);
  if (!branch) {
    throw { status: 400, message: 'No branch location configured for this user or academy' };
  }

  const branchLat = branch.latitude;
  const branchLon = branch.longitude;
  const radiusMeters = branch.geofence_radius_meters || 100;
  const isEnforced = branch.is_geofence_enforced !== undefined ? Boolean(branch.is_geofence_enforced) : true;

  if (branchLat === null || branchLon === null) {
    throw { status: 400, message: `Branch '${branch.name}' has no geofence coordinates configured` };
  }

  const distanceMeters = calculateHaversineDistance(lat, lon, branchLat, branchLon);
  const isWithinGeofence = distanceMeters <= radiusMeters ? 1 : 0;

  // Strict Geofence Enforcement Check
  // Punch-In is strictly blocked outside geofence boundary.
  // Punch-Out is permitted even if out-of-range, but flagged with a warning note for admin audit.
  const isOutOfRange = isEnforced && !isWithinGeofence;
  if (isOutOfRange && punch_type === 'punch_in') {
    throw {
      status: 403,
      message: `Out of range: you are ${distanceMeters} meters away. Punch is allowed only within ${radiusMeters} meters of ${branch.name}.`,
      distance_meters: distanceMeters,
      allowed_radius_meters: radiusMeters,
      branch_name: branch.name,
      is_within_geofence: 0,
    };
  }

  // Record Punch Entry
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  const deviceInfoWithWarning = isOutOfRange
    ? `${userAgent || 'Browser GPS Client'} [OUT_OF_RANGE_WARNING: ${distanceMeters}m from branch]`
    : (userAgent || 'Browser GPS Client');

  const insertStmt = db.prepare(`
    INSERT INTO staff_punches (
      user_id, branch_id, punch_type, latitude, longitude,
      accuracy_meters, distance_meters, is_within_geofence, device_info, ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = insertStmt.run(
    userId,
    branch.id,
    punch_type,
    lat,
    lon,
    acc,
    distanceMeters,
    isWithinGeofence,
    deviceInfoWithWarning,
    ipAddress || '127.0.0.1'
  );

  const punchRecord = db.prepare('SELECT * FROM staff_punches WHERE id = ?').get(info.lastInsertRowid);

  // Sync with staff_time_punches for payroll / shift log integration if present
  try {
    if (punch_type === 'punch_in') {
      db.prepare(`
        INSERT INTO staff_time_punches (user_id, punch_date, punch_in_time, status, punch_type, ip_address)
        VALUES (?, ?, datetime('now'), 'in_progress', 'duty', ?)
      `).run(userId, todayStr, ipAddress);
    } else if (punch_type === 'punch_out') {
      const activeTimePunch = db.prepare(`
        SELECT * FROM staff_time_punches 
        WHERE user_id = ? AND status = 'in_progress' 
        ORDER BY id DESC LIMIT 1
      `).get(userId);

      if (activeTimePunch) {
        db.prepare(`
          UPDATE staff_time_punches 
          SET punch_out_time = datetime('now'),
              status = 'completed',
              duration_minutes = ROUND((strftime('%s', 'now') - strftime('%s', punch_in_time)) / 60)
          WHERE id = ?
        `).run(activeTimePunch.id);
      }
    }
  } catch (e) {
    // Non-fatal if staff_time_punches is optional
  }

  const warningMsg = isOutOfRange
    ? `Punch-out accepted with location warning: you are ${distanceMeters}m away from ${branch.name}. Marked for admin review.`
    : `Successfully recorded ${punch_type.replace('_', ' ')} at ${branch.name}`;

  return {
    success: true,
    message: warningMsg,
    warning: isOutOfRange ? warningMsg : null,
    out_of_range_flag: Boolean(isOutOfRange),
    punch: punchRecord,
    distance_meters: distanceMeters,
    allowed_radius_meters: radiusMeters,
    is_within_geofence: Boolean(isWithinGeofence),
    branch: {
      id: branch.id,
      name: branch.name,
      latitude: branch.latitude,
      longitude: branch.longitude,
      radius_meters: radiusMeters,
    },
  };
}

/**
 * Returns latest punch status and branch geofence configuration for the authenticated user
 * @param {import('better-sqlite3').Database} db 
 * @param {object} user 
 */
export function getStaffPunchStatus(db, user) {
  const userId = user.userId || user.id;
  const branch = resolveUserBranch(db, user);

  const lastPunch = db.prepare(`
    SELECT * FROM staff_punches 
    WHERE user_id = ? 
    ORDER BY id DESC LIMIT 1
  `).get(userId);

  const isPunchedIn = lastPunch && lastPunch.punch_type === 'punch_in';

  // Today's punches
  const todayPunches = db.prepare(`
    SELECT * FROM staff_punches 
    WHERE user_id = ? AND date(punched_at) = date('now')
    ORDER BY id DESC
  `).all(userId);

  return {
    success: true,
    isPunchedIn: Boolean(isPunchedIn),
    lastPunch: lastPunch || null,
    todayPunches: todayPunches || [],
    branch: branch ? {
      id: branch.id,
      name: branch.name,
      latitude: branch.latitude,
      longitude: branch.longitude,
      radius_meters: branch.geofence_radius_meters || 100,
      is_geofence_enforced: Boolean(branch.is_geofence_enforced),
    } : null,
  };
}
