import express from 'express';
import { resolveTenant } from '../middleware/tenantResolver.js';
import { requireAuth } from '../middleware/auth.js';
import { processStaffPunch, getStaffPunchStatus } from '../services/geofenceService.js';

export const staffRouter = express.Router();

staffRouter.use(requireAuth, resolveTenant);

/**
 * POST /api/staff/punch
 * Records a GPS-geofenced punch in / punch out for staff & coaches
 */
staffRouter.post('/punch', (req, res) => {
  try {
    const db = req.tenantDb;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || 'Browser GPS Client';

    const result = processStaffPunch(db, req.user, req.body, clientIp, userAgent);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to process punch',
      distance_meters: err.distance_meters,
      allowed_radius_meters: err.allowed_radius_meters,
      branch_name: err.branch_name,
      is_within_geofence: err.is_within_geofence,
    });
  }
});

/**
 * GET /api/staff/punch/status
 * Returns current punch status, last punch, and branch geofence configuration
 */
staffRouter.get('/punch/status', (req, res) => {
  try {
    const db = req.tenantDb;
    const status = getStaffPunchStatus(db, req.user);
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
