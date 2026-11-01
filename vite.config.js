import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const root = import.meta.dirname;

// Fills %SITE_TITLE% and friends in the HTML pages from content/site.json
function siteMeta() {
  return {
    name: 'site-meta',
    transformIndexHtml(html) {
      const site = JSON.parse(readFileSync(resolve(root, 'content/site.json'), 'utf8'));
      return html
        .replace(/%SITE_TITLE%/g, esc(site.title))
        .replace(/%SITE_WAITLIST_TITLE%/g, esc(site.waitlistTitle))
        .replace(/%SITE_DESCRIPTION%/g, esc(site.description));
    },
  };
}

const API = process.env.API_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), siteMeta()],
  server: {
    // during `npm run dev` the Node server handles these
    proxy: { '/api': API, '/confirm': API, '/unsubscribe': API },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        waitlist: resolve(root, 'waitlist.html'),
        admin: resolve(root, 'admin.html'),
      },
      output: {
        // Vite 8 (rolldown) requires a function here, not an object map.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
        },
      },
    },
  },
});
