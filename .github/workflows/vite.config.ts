import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { APP } from './src/config/app';

/**
 * Keeps the app's name in one place (src/config/app.ts): fills %APP_NAME% in index.html and
 * writes the web app manifest, which is what phones and computers use for "Add to Home Screen" / "Install".
 */
function appIdentity(): Plugin {
  const manifest = JSON.stringify(
    {
      name: APP.name,
      short_name: APP.name,
      description: APP.tagline,
      start_url: './',
      scope: './',
      display: 'standalone',
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

// BASE_PATH is the folder the site is served from: "/simdesk-life/" on GitHub Pages
// (yourname.github.io/simdesk-life/), or "/" once a custom domain is connected.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), appIdentity()],
  build: { chunkSizeWarningLimit: 900 },
});
