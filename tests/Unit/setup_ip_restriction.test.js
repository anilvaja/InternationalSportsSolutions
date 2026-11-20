import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSetupIpAllowed, requireSetupIpForHtml, requireSetupIpForApi } from '../../src/middleware/setupIpGuard.js';

describe('Setup & Reset IP Restriction Security Suite', () => {

  it('1. Recognizes authorized IP 49.36.72.72 from cf-connecting-ip', () => {
    const req = {
      headers: { 'cf-connecting-ip': '49.36.72.72' },
      ip: '160.153.0.110'
    };
    const { allowed, clientIp } = isSetupIpAllowed(req);
    assert.strictEqual(allowed, true);
    assert.strictEqual(clientIp, '49.36.72.72');
  });

  it('2. Recognizes authorized IP 49.36.72.72 from x-forwarded-for header', () => {
    const req = {
      headers: { 'x-forwarded-for': '49.36.72.72, 160.153.0.110' },
      ip: '160.153.0.110'
    };
    const { allowed, clientIp } = isSetupIpAllowed(req);
    assert.strictEqual(allowed, true);
    assert.strictEqual(clientIp, '49.36.72.72');
  });

  it('3. Recognizes authorized IP 49.36.72.72 with IPv6 mapping (::ffff:49.36.72.72)', () => {
    const req = {
      headers: {},
      ip: '::ffff:49.36.72.72'
    };
    const { allowed, clientIp } = isSetupIpAllowed(req);
    assert.strictEqual(allowed, true);
    assert.strictEqual(clientIp, '49.36.72.72');
  });

  it('4. Allows localhost loopbacks for local development (127.0.0.1, ::1, ::ffff:127.0.0.1)', () => {
    assert.strictEqual(isSetupIpAllowed({ headers: {}, ip: '127.0.0.1' }).allowed, true);
    assert.strictEqual(isSetupIpAllowed({ headers: {}, ip: '::1' }).allowed, true);
    assert.strictEqual(isSetupIpAllowed({ headers: {}, ip: '::ffff:127.0.0.1' }).allowed, true);
  });

  it('5. Strictly rejects unauthorized public IP addresses', () => {
    const unauthorizedIps = ['198.51.100.1', '203.0.113.195', '1.1.1.1', '160.153.0.110'];
    for (const ip of unauthorizedIps) {
      const res = isSetupIpAllowed({ headers: { 'cf-connecting-ip': ip }, ip });
      assert.strictEqual(res.allowed, false, `IP ${ip} should be rejected`);
      assert.strictEqual(res.clientIp, ip);
    }
  });

  it('6. requireSetupIpForHtml invokes next() for 49.36.72.72 and blocks unauthorized IP with 403 HTML', () => {
    let nextCalled = false;
    const reqAllowed = {
      headers: { 'cf-connecting-ip': '49.36.72.72' },
      ip: '10.0.0.1'
    };
    const resAllowed = {};
    requireSetupIpForHtml(reqAllowed, resAllowed, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);

    let statusCaptured = null;
    let bodyCaptured = null;
    const reqBlocked = {
      headers: { 'cf-connecting-ip': '198.51.100.25' },
      ip: '198.51.100.25'
    };
    const resBlocked = {
      status(code) {
        statusCaptured = code;
        return {
          send(html) { bodyCaptured = html; }
        };
      }
    };
    let blockedNextCalled = false;
    requireSetupIpForHtml(reqBlocked, resBlocked, () => { blockedNextCalled = true; });
    assert.strictEqual(blockedNextCalled, false);
    assert.strictEqual(statusCaptured, 403);
    assert.match(bodyCaptured, /Platform Setup Restricted/);
    assert.match(bodyCaptured, /198\.51\.100\.25/);
  });

  it('7. requireSetupIpForApi invokes next() for 49.36.72.72 and blocks unauthorized IP with 403 JSON', () => {
    let nextCalled = false;
    const reqAllowed = {
      headers: { 'cf-connecting-ip': '49.36.72.72' },
      ip: '10.0.0.1'
    };
    const resAllowed = {};
    requireSetupIpForApi(reqAllowed, resAllowed, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);

    let statusCaptured = null;
    let jsonCaptured = null;
    const reqBlocked = {
      headers: { 'cf-connecting-ip': '198.51.100.99' },
      ip: '198.51.100.99'
    };
    const resBlocked = {
      status(code) {
        statusCaptured = code;
        return {
          json(obj) { jsonCaptured = obj; }
        };
      }
    };
    let blockedNextCalled = false;
    requireSetupIpForApi(reqBlocked, resBlocked, () => { blockedNextCalled = true; });
    assert.strictEqual(blockedNextCalled, false);
    assert.strictEqual(statusCaptured, 403);
    assert.strictEqual(jsonCaptured.success, false);
    assert.match(jsonCaptured.error, /Access Denied/);
    assert.match(jsonCaptured.error, /198\.51\.100\.99/);
  });
});
