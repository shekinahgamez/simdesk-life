import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH is the folder the site is served from: "/simdesk/" on GitHub Pages
// (yourname.github.io/simdesk/), or "/" once a custom domain is connected.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 },
});
