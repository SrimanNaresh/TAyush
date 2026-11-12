import { useEffect, useState } from 'react';
import { planApi } from '../api/client.js';

// The installation's plan (name, validity, Menu Rights), read once and shared
// by the menu, Menu Access, the warning banner and the dashboards. Call
// refreshPlan() after saving it so every screen updates.
let cache = null;
let pending = null;
const listeners = new Set();

function load() {
  if (!pending) {
    pending = planApi.get()
      .then((p) => { cache = p; })
      .catch(() => { cache = cache || null; })
      .finally(() => { pending = null; listeners.forEach((fn) => fn(cache)); });
  }
  return pending;
}

export function refreshPlan(next) {
  if (next) {
    cache = next;
    listeners.forEach((fn) => fn(cache));
    return Promise.resolve(cache);
  }
  return load();
}

export function usePlan() {
  const [plan, setPlan] = useState(cache);
  useEffect(() => {
    listeners.add(setPlan);
    if (!cache) load();
    return () => { listeners.delete(setPlan); };
  }, []);
  return plan;
}

// Main menus the plan allows (Menu Rights). null modules = every menu.
// Dashboard and Configuration are always allowed.
export function planAllowsGroup(plan, group) {
  if (!plan?.modules) return true;
  if ((plan.alwaysOn || ['Dashboard', 'Configuration']).includes(group)) return true;
  return plan.modules.includes(group);
}
