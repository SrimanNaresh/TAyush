import { Router } from 'express';
import { readAppName } from './appInfo.js';

const router = Router();

// PWA manifest built per request, so the installed app's name follows App Name
// in Organisation Details. Public: it must be fetchable before login.
router.get('/manifest.webmanifest', async (req, res) => {
  const appName = await readAppName();
  res.set('Content-Type', 'application/manifest+json');
  res.json({
    name: appName,
    short_name: appName,
    description: 'Clinic, pharmacy and laboratory in one app.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3563eb',
    lang: 'en',
    scope: '/',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
});

export default router;
