/**
 * Location & Proximity Service
 * Implements GPS Haversine Geofencing and BLE (Bluetooth Low Energy) proximity signals.
 * 
 * Strict Architecture Rule:
 * BLE is a supporting verification signal, NEVER sufficient alone for confirmed attendance.
 */
export class LocationProximityService {
  /**
   * Calculates Haversine distance in meters between two GPS coordinates
   * 
   * @param {number} lat1 
   * @param {number} lon1 
   * @param {number} lat2 
   * @param {number} lon2 
   * @returns {number} Distance in meters
   */
  static haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c * 10) / 10;
  }

  /**
   * Verifies if probe coordinates are within the branch's configured geofence radius.
   * 
   * @param {import('better-sqlite3').Database} db 
   * @param {number} branchId 
   * @param {object} probeCoords { latitude, longitude, accuracy }
   * @param {object} settings { gps_geofence_meters, gps_enforce_strict }
   * @returns {object}
   */
  static verifyGeofence(db, branchId, { latitude, longitude, accuracy = null }, settings = {}) {
    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
      return {
        valid: false,
        reason: 'NO_COORDINATES',
        message: 'GPS location coordinates were not provided',
      };
    }

    const branch = db.prepare(`
      SELECT id, name, latitude, longitude, geofence_radius_meters, is_geofence_enforced
      FROM branches
      WHERE id = ?
    `).get(Number(branchId));

    if (!branch) {
      return { valid: false, reason: 'BRANCH_NOT_FOUND', message: `Branch #${branchId} not found` };
    }

    // If branch has no configured GPS, use academy default or fallback
    if (!branch.latitude || !branch.longitude) {
      return {
        valid: true,
        isWithinGeofence: true,
        distanceMeters: 0,
        branchCoords: null,
        warning: 'Branch has no configured GPS coordinates. Geofencing bypassed gracefully.',
      };
    }

    const allowedRadius = settings.gps_geofence_meters || branch.geofence_radius_meters || 150;
    const distanceMeters = this.haversineDistanceMeters(
      Number(latitude),
      Number(longitude),
      branch.latitude,
      branch.longitude
    );

    // Accuracy threshold check: If GPS accuracy is worse than 120m, flag potential spoofing or indoor drift
    const isDegradedAccuracy = accuracy !== null && accuracy > 120;
    const isWithinGeofence = distanceMeters <= allowedRadius;

    if (!isWithinGeofence) {
      return {
        valid: false,
        isWithinGeofence: false,
        distanceMeters,
        allowedRadius,
        accuracy,
        branchName: branch.name,
        reason: 'OUTSIDE_GEOFENCE',
        message: `You are currently ${Math.round(distanceMeters)}m away from ${branch.name} (allowed radius: ${allowedRadius}m). Check-in rejected.`,
      };
    }

    return {
      valid: true,
      isWithinGeofence: true,
      distanceMeters,
      allowedRadius,
      accuracy,
      isDegradedAccuracy,
      branchName: branch.name,
      message: `Within ${branch.name} perimeter (${Math.round(distanceMeters)}m from center)`,
    };
  }

  /**
   * Evaluates BLE proximity as a secondary supporting verification signal.
   * Rule: BLE is NEVER sufficient alone for confirmed attendance.
   * 
   * @param {object} bleData { beaconUuid, rssi, major, minor }
   * @returns {object}
   */
  static evaluateBleSignal(bleData = {}) {
    if (!bleData || !bleData.beaconUuid) {
      return {
        supported: false,
        signalStrength: null,
        status: 'NO_BEACON_DETECTED',
        isStandaloneSufficient: false, // Strict architectural guarantee
        message: 'No BLE beacon detected in range',
      };
    }

    const rssi = Number(bleData.rssi) || -100;
    let strength = 'WEAK';
    if (rssi >= -65) {
      strength = 'IMMEDIATE'; // Within ~1-2 meters
    } else if (rssi >= -80) {
      strength = 'NEAR';      // Within ~2-10 meters
    } else if (rssi >= -92) {
      strength = 'FAR';       // ~10-20 meters
    }

    return {
      supported: true,
      beaconUuid: bleData.beaconUuid,
      rssi,
      strength,
      isStandaloneSufficient: false, // Strict architectural guarantee
      status: 'BEACON_VERIFIED',
      message: `BLE proximity verified (${strength}, RSSI ${rssi} dBm)`,
    };
  }
}

