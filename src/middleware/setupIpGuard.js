/**
 * Setup & Reset IP Guard Middleware
 * Restricts access to sensitive platform setup, reset, and re-initialization utilities
 * to authorized administrative IP addresses (49.36.72.72 and localhost for local development).
 */

/**
 * Extracts normalized client IP address considering Cloudflare, reverse proxies, and local development.
 * @param {import('express').Request} req
 * @returns {string}
 */
export function getClientIp(req) {
  let ip = req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip ||
    '';

  // Normalize IPv6-mapped IPv4 addresses (e.g. ::ffff:49.36.72.72 -> 49.36.72.72)
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Normalize IPv6 loopback
  if (ip === '::1' || ip === 'localhost') {
    ip = '127.0.0.1';
  }

  return ip;
}

/**
 * Checks whether client IP is allowed to access setup and reset tools.
 * @param {import('express').Request} req
 * @returns {{ allowed: boolean, clientIp: string }}
 */
export function isSetupIpAllowed(req) {
  const clientIp = getClientIp(req);
  
  const allowedIps = new Set([
    '49.36.72.72',
    '127.0.0.1',
    ...(process.env.SETUP_ALLOWED_IPS ? process.env.SETUP_ALLOWED_IPS.split(',').map(s => s.trim()) : [])
  ]);

  return {
    allowed: allowedIps.has(clientIp),
    clientIp
  };
}

/**
 * Middleware for HTML setup/reset pages (/setup, /resetup, /reset)
 */
export function requireSetupIpForHtml(req, res, next) {
  const { allowed, clientIp } = isSetupIpAllowed(req);

  if (!allowed) {
    return res.status(403).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>403 Forbidden — Setup Access Restricted</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-block;
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      margin: 0 0 12px;
      color: #ffffff;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 20px;
    }
    .ip-box {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 13px;
      color: #38bdf8;
      margin-bottom: 24px;
      word-break: break-all;
    }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 10px 20px;
      border-radius: 8px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">403 Access Denied</div>
    <h1>Platform Setup Restricted</h1>
    <p>Platform initialization and factory reset utilities are strictly restricted to authorized administrative IP addresses.</p>
    <div class="ip-box">Your Client IP: ${clientIp || 'Unknown'}</div>
    <a href="/" class="btn">Return to Home</a>
  </div>
</body>
</html>
    `.trim());
  }

  next();
}

/**
 * Middleware for setup/reset API endpoints (/api/public/setup)
 */
export function requireSetupIpForApi(req, res, next) {
  const { allowed, clientIp } = isSetupIpAllowed(req);

  if (!allowed) {
    return res.status(403).json({
      success: false,
      error: `Access Denied: Platform setup and reset utilities are restricted to authorized administrative IP addresses. Your IP (${clientIp || 'Unknown'}) is not authorized.`
    });
  }

  next();
}
