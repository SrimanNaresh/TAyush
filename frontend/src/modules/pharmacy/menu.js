// Pharmacy module menu (source: Ayush_Pharmacy config/menuItems.js). Each
// former top-level pharmacy menu (Item, Vendor, ...) is a sub-menu of Pharmacy.
// MenuKeys are unchanged (pharmacy.*).
export const PHARMACY_MENU = [
  { key: 'pharmacy.dashboard', label: 'Pharmacy Dashboard', to: '/pharmacy' },
  {
    label: 'Item',
    submenu: [
      { key: 'pharmacy.item', label: 'Master', to: '/pharmacy/item' },
      { key: 'pharmacy.item-list', label: 'List', to: '/pharmacy/item-list' },
      { key: 'pharmacy.item-list-new', label: 'Bulk Update', to: '/pharmacy/item-bulk-update' },
    ],
  },
  {
    label: 'Vendor',
    submenu: [
      { key: 'pharmacy.vendor-master', label: 'Master', to: '/pharmacy/vendor-master' },
      { key: 'pharmacy.vendor-list', label: 'List', to: '/pharmacy/vendor-list' },
      { key: 'pharmacy.vendor-payment', label: 'Payments', to: '/pharmacy/vendor-payment' },
    ],
  },
  {
    label: 'Purchase / Order',
    submenu: [
      { key: 'pharmacy.purchase-master', label: 'Master', to: '/pharmacy/purchase-order' },
      { key: 'pharmacy.purchase-master-list', label: 'List', to: '/pharmacy/purchase-order-list' },
    ],
  },
  {
    label: 'Stock In',
    submenu: [
      { key: 'pharmacy.stock-inward', label: 'Master', to: '/pharmacy/stock-in' },
      { key: 'pharmacy.stock-inward-list', label: 'List', to: '/pharmacy/stock-in-list' },
      { key: 'pharmacy.stock-ips', label: 'Three in One (IPS)', to: '/pharmacy/stock-ips' },
      {
        label: 'Adjustment',
        submenu: [
          { key: 'pharmacy.stock-adjustment', label: 'Adjustment Entry', to: '/pharmacy/stock-adjustment' },
          { key: 'pharmacy.stock-adjustment-list', label: 'Adjustment List', to: '/pharmacy/stock-adjustment-list' },
        ],
      },
    ],
  },
  {
    label: 'Return',
    submenu: [
      {
        label: 'Purchase Return',
        submenu: [
          { key: 'pharmacy.purchase-return', label: 'Return Entry', to: '/pharmacy/return' },
          { key: 'pharmacy.purchase-return-list', label: 'Return List', to: '/pharmacy/return-list' },
        ],
      },
      {
        label: 'Sales Return',
        submenu: [
          { key: 'pharmacy.sales-return', label: 'Sales Return Entry', to: '/pharmacy/sales-return' },
          { key: 'pharmacy.sales-return-list', label: 'Sales Return List', to: '/pharmacy/sales-return-list' },
        ],
      },
    ],
  },
  {
    label: 'Sales',
    submenu: [
      { key: 'pharmacy.sales-billing', label: 'Master', to: '/pharmacy/sales-billing' },
      { key: 'pharmacy.sales-billing-list', label: 'List', to: '/pharmacy/sales-billing-list' },
    ],
  },
  {
    label: 'Report',
    submenu: [
      { key: 'pharmacy.stock-report', label: 'Stock Report', to: '/pharmacy/stock-report' },
      { key: 'pharmacy.vendor-payments', label: 'Vendor Payments', to: '/pharmacy/vendor-payments' },
      { key: 'pharmacy.all-in-one-report', label: 'All in One', to: '/pharmacy/all-in-one-report' },
    ],
  },
];
