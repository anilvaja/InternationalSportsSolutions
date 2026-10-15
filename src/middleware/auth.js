import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Middleware to verify JWT token from Authorization header or HTTP-only cookies
 */
export function authenticateToken(req, res, next) {
  let token = null;

  // 1. Check Bearer Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Check Cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

/**
 * Require valid login
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
}

/**
 * Require Super Admin role
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Super Admin privileges required' });
  }
  next();
}

/**
 * Require Academy Staff/Admin access
 */
export function requireAcademyStaff(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (req.user.isSuperAdmin) {
    return next();
  }
  if (!['academy_admin', 'academy_staff', 'coach'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Access denied: Academy staff credentials required' });
  }
  next();
}

/**
 * Helper to generate JWT token
 */
export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}
