// Master list of assignable menu items (leaf pages), grouped for display.
// MenuKey is the stable identifier stored in the MenuAccess table; keys are
// prefixed by module (clinic.*, pharmacy.*, lab.*, settings.*).
// `to` is the route path. The menus are built from this single list and
// filtered by the signed-in user's Menu Access.
//
// Top level: one group per module. A module group's items are its own
// sub-menus (e.g. Pharmacy > Item, Vendor, Sales ...), which the top bar shows
// as one wide panel with a column per sub-menu.
// Module pages are added here in their phases:
import { LAB_MENU } from '../modules/lab/menu.js';
import { PHARMACY_MENU } from '../modules/pharmacy/menu.js';
import { CLINIC_MENU, CLINIC_DASHBOARDS, REGISTRATION_MENU, CLINIC_SETTINGS, BILLING_MENU } from '../modules/clinic/menu.js';

export const MENU_GROUPS = [
  // A group whose only page has the group's own name shows as a plain link.
  {
    group: 'Dashboard',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/dashboard' },
      ...CLINIC_DASHBOARDS,
    ],
  },
  { group: 'Registration', items: REGISTRATION_MENU },
  { group: 'Clinic', items: CLINIC_MENU },
  { group: 'Billing', items: BILLING_MENU },
  { group: 'Pharmacy', items: PHARMACY_MENU },
  { group: 'Lab', items: LAB_MENU },
  {
    group: 'Settings',
    items: [
      { key: 'settings.organisation', label: 'Organisation Details', to: '/settings/organisation' },
      { key: 'settings.user', label: 'User Master', to: '/settings/user' },
      { key: 'settings.menu-access', label: 'Menu Access', to: '/settings/menu-access' },
      ...CLINIC_SETTINGS,
    ],
  },
].filter((g) => g.items.length > 0);

// A group's items can nest submenus to any depth; recurse all the way down so
// access checks/grants still see every real leaf.
function flattenLeaves(items, groupLabel) {
  return items.flatMap((it) =>
    it.submenu ? flattenLeaves(it.submenu, groupLabel) : [{ ...it, group: groupLabel }]
  );
}
export const ALL_MENU_ITEMS = MENU_GROUPS.flatMap((g) => flattenLeaves(g.items, g.group));

export const ACCESS_LEVELS = ['Full', 'View', 'No Access'];

// Admin always sees every page. Any other login sees only the pages granted
// Full / View in Menu Access (nothing granted yet = Dashboard only), so a new
// pharmacy login never sees clinic or lab screens by default.
export function makeAllowed(user, accessMap) {
  if (user?.role === 'Admin') return () => true;
  return (key) => key === 'dashboard' || ['Full', 'View'].includes(accessMap?.get(key));
}
