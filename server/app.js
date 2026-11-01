// Builds the Express app. Kept separate from index.js so tests can run it without opening a port.
import express from 'express';
import helmet from 'helmet';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createAuth } from './lib/auth.js';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';

export function createApp({ db, cfg, content, mailer, sender, log = console }) {
  const app = express();
  const auth = createAuth(cfg);
  app.disable('x-powered-by');
  app.set('trust proxy', cfg.trustProxy);

  app.use((req, res, next) => { res.locals.nonce = crypto.randomBytes(16).toString('base64'); next(); });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'wasm-unsafe-eval' lets the 3D model's mesh decoder (WebAssembly) run
        scriptSrc: ["'self'", "'wasm-unsafe-eval'", (req, res) => `'nonce-${res.locals.nonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'blob:', 'data:'],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: cfg.publicUrl.startsWith('https://') ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: cfg.publicUrl.startsWith('https://'),
  }));

  app.get('/healthz', (req, res) => { db.prepare('SELECT 1').get(); res.json({ ok: true }); });
  app.use(publicRoutes({ db, cfg, content, mailer, log }));
  app.use('/api/admin', adminRoutes({ db, cfg, content, mailer, auth, sender }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // the built site (npm run build -> dist/)
  if (fs.existsSync(cfg.distDir)) {
    app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(cfg.distDir, 'admin.html'), { headers: { 'Cache-Control': 'no-store' } }));
    app.use('/assets', express.static(path.join(cfg.distDir, 'assets'), {
      setHeaders: (res, p) => {
        res.setHeader('Cache-Control', /-[\w-]{8}\.(js|css)$/.test(p) ? 'public, max-age=31536000, immutable' : 'public, max-age=86400');
        // email images are loaded by mail apps and the admin preview, which run on other origins
        if (/[\\/]email-[^\\/]+$/.test(p)) res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }));
    app.use(express.static(cfg.distDir, { extensions: ['html'], setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
  } else {
    app.get('/', (req, res) => res.type('text').send('API is running. Run `npm run build` to serve the site from here, or use `npm run dev` while working on it.'));
  }
  app.use((req, res) => {
    const nf = path.join(cfg.distDir, 'index.html');
    if (req.accepts('html') && fs.existsSync(nf)) return res.status(404).redirect('/');
    res.status(404).type('text').send('Not found');
  });
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    log.error('[http]', err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON.' });
    res.status(500).json({ error: 'Something went wrong on our side.' });
  });
  return app;
}
