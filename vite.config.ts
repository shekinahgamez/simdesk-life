import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
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

// Relative paths, so the same build works on GitHub Pages (/simdesk-life/), a custom domain, or a preview link.
export default defineConfig({
  base: './',
  plugins: [react(), appIdentity()],
});
