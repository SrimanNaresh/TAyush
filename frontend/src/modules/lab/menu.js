// Lab module menu (MenuKey prefix 'lab.'). Source: T_Lab config/menuItems.js.
export const LAB_MENU = [
  { key: 'lab.dashboard', label: 'Lab Dashboard', to: '/lab' },
  { key: 'lab.results', label: 'Result Entry', to: '/lab/results' },
  { key: 'lab.settings', label: 'Lab Settings', to: '/lab/settings' },
  {
    label: 'Assignment',
    submenu: [
      { key: 'lab.assignment-new', label: 'Assign Tests', to: '/lab/assignments/new' },
      { key: 'lab.assignment-list', label: 'Assignment List', to: '/lab/assignments' },
    ],
  },
  {
    label: 'Masters',
    submenu: [
      { key: 'lab.tests', label: 'Test Master', to: '/lab/tests' },
      { key: 'lab.fees', label: 'Test Fee Master', to: '/lab/fees' },
    ],
  },
];
