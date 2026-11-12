import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

// Installable app (PWA), from the Lab app's pwa.js.
// Registers the service worker. With autoUpdate a new version activates by
// itself; the page then reloads once so it runs the new code.
export function startPwa() {
  if (!('serviceWorker' in navigator)) return;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !navigator.serviceWorker.controller) return;
    reloaded = true;
    window.location.reload();
  });
  registerSW({
    immediate: true,
    // Look for a new version every hour while the app stays open.
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}

// Chrome / Edge / Android fire `beforeinstallprompt` once; keep it so an
// "Install App" button can show the browser's install dialog later.
let deferred = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// { canInstall, install(), iosHint }: iosHint is true on iPhone / iPad Safari,
// which has no install prompt (the user adds it from the Share menu).
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  const installed = isStandalone();
  return {
    canInstall: !installed && !!deferred,
    iosHint: !installed && !deferred && isIos(),
    install: async () => {
      if (!deferred) return false;
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      force((n) => n + 1);
      return outcome === 'accepted';
    },
  };
}
