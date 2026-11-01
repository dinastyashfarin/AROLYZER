// Admin sign-in: one shared password (ADMIN_PASSWORD) and a signed, httpOnly session cookie.
import crypto from 'node:crypto';

const COOKIE = 'arz_admin';
const b64 = b => Buffer.from(b).toString('base64url');
const hmac = (secret, s) => crypto.createHmac('sha256', secret).update(s).digest('base64url');
const same = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };

function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}

export function createAuth(cfg) {
  const sign = payload => { const body = b64(JSON.stringify(payload)); return body + '.' + hmac(cfg.sessionSecret, body); };
  const read = token => {
    if (!token || token.indexOf('.') < 0) return null;
    const [body, sig] = token.split('.');
    if (!same(sig, hmac(cfg.sessionSecret, body))) return null;
    try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
  };
  const cookieOpts = maxAgeSec => [`Path=/`, 'HttpOnly', 'SameSite=Strict', cfg.secureCookies ? 'Secure' : '', `Max-Age=${maxAgeSec}`].filter(Boolean).join('; ');
  return {
    enabled: !!cfg.adminPassword,
    checkPassword: pw => !!cfg.adminPassword && same(pw || '', cfg.adminPassword),
    login(res) {
      const maxAge = Math.round(cfg.sessionHours * 3600);
      res.setHeader('Set-Cookie', `${COOKIE}=${sign({ exp: Date.now() + maxAge * 1000, n: crypto.randomBytes(8).toString('hex') })}; ${cookieOpts(maxAge)}`);
    },
    logout(res) { res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieOpts(0)}`); },
    isAdmin: req => !!read(cookies(req)[COOKIE]),
    /** Admin API guard. Writes must carry the X-Arolyzer header, which other sites' forms can't send;
     *  together with the SameSite=Strict cookie this blocks cross-site requests. */
    require(req, res, next) {
      if (!read(cookies(req)[COOKIE])) return res.status(401).json({ error: 'Sign in first.' });
      if (!['GET', 'HEAD'].includes(req.method) && req.get('X-Arolyzer') !== '1') return res.status(403).json({ error: 'Missing request header.' });
      next();
    },
  };
}
