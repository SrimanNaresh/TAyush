import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      // The manifest is served dynamically by the backend (/api/manifest.webmanifest)
      // so the installed app's name reflects this deployment's Organisation Details name —
      // skip generating a static one, and don't auto-inject a <link rel="manifest">
      // (index.html points at the dynamic endpoint instead).
      manifest: false,
      // API calls are never precached/cached by the service worker — pharmacy
      // data must always come from the network, never a stale offline copy.
      // Only the app shell (JS/CSS/HTML/icons) is precached for installability.
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    port: 5174, // 5173 is often taken by other local apps
    // API_TARGET lets the API run on another port locally (e.g. when 5000 is taken).
    proxy: {
      '/api': process.env.API_TARGET || 'http://localhost:5160',
    },
  },
});
