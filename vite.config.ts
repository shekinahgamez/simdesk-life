import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { APP } from './src/config/app';

/** Fills %APP_NAME% in index.html and writes the web app manifest (used for "Add to Home Screen"). */
function appIdentity(): Plugin {
  const manifest = JSON.stringify(
    {
      name: APP.name,
      short_name: APP.name,
      description: APP.tagline,
      start_url: './',
      scope: './',
      display: 'standalone', // opens full screen from the home screen, no Safari bar
      background_color: '#FBF9F7',
      theme_color: '#FBF9F7',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  );
  return {
    name: 'app-identity',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP.name),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.endsWith('/manifest.webmanifest')) return next();
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifest);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest });
    },
  };
}

/**
 * Offline copy: writes sw.js, a small helper that keeps the app's files on the device so the installed
 * app (home screen or desktop) opens with no internet. Pages load fresh when online (so updates show up
 * right away) and from the copy when offline. Supabase calls are never cached; saves have their own
 * offline copy (src/lib/sync).
 */
function offlineCopy(): Plugin {
  return {
    name: 'offline-copy',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const files = ['./', ...built.map((f) => `./${f}`), './icons/favicon-32.png', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];
      const version = `simdesk-${createHash('sha1').update(built.sort().join('|')).digest('hex').slice(0, 10)}`;
      const sw = `// Generated at build time (vite.config.ts → offlineCopy). Keeps SimDesk's files on this device.
const VERSION = ${JSON.stringify(version)};
const FILES = ${JSON.stringify(files)};
const FONTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('simdesk-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = FONTS.some((f) => req.url.startsWith(f));
  if (url.origin !== self.location.origin && !font) return; // Supabase and everything else: straight to the network
  if (req.mode === 'navigate') {
    // Fresh page when online; the saved copy when offline.
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put('./', copy));
      return res;
    }).catch(() => caches.match('./', { ignoreSearch: true, ignoreVary: true })));
    return;
  }
  // ignoreVary: servers mark files "Vary: Origin", and script requests carry an Origin the stored copy didn't.
  e.respondWith(caches.match(req, { ignoreSearch: !font, ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}

// Relative paths, so the same build works on GitHub Pages (/simdesk-life/), a custom domain, or a preview link.
export default defineConfig({
  base: './',
  plugins: [react(), appIdentity(), offlineCopy()],
});
