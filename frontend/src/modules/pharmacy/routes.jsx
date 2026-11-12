import { lazy } from 'react';
import { Route } from 'react-router-dom';

// Pharmacy module routes (source: Ayush_Pharmacy App.jsx). URLs are unchanged
// except the dashboard, which moved from /dashboard to /pharmacy.
const PharmacyDashboard = lazy(() => import('./pages/PharmacyDashboard.jsx'));
const VendorMaster = lazy(() => import('./pages/VendorMaster.jsx'));
const VendorList = lazy(() => import('./pages/VendorList.jsx'));
const ItemMaster = lazy(() => import('./pages/ItemMaster.jsx'));
const ItemListPage = lazy(() => import('./pages/ItemListPage.jsx'));
const ItemBulkUpdate = lazy(() => import('./pages/ItemBulkUpdate.jsx'));
const PurchaseOrder = lazy(() => import('./pages/PurchaseOrder.jsx'));
const PurchaseOrderList = lazy(() => import('./pages/PurchaseOrderList.jsx'));
const StockIn = lazy(() => import('./pages/StockIn.jsx'));
const StockInList = lazy(() => import('./pages/StockInList.jsx'));
const StockIps = lazy(() => import('./pages/StockIps.jsx'));
const StockReturnMaster = lazy(() => import('./pages/StockReturnMaster.jsx'));
const StockReturnList = lazy(() => import('./pages/StockReturnList.jsx'));
const SalesReturnMaster = lazy(() => import('./pages/SalesReturnMaster.jsx'));
const SalesReturnList = lazy(() => import('./pages/SalesReturnList.jsx'));
const StockAdjustment = lazy(() => import('./pages/StockAdjustment.jsx'));
const StockAdjustmentList = lazy(() => import('./pages/StockAdjustmentList.jsx'));
const SalesBilling = lazy(() => import('./pages/SalesBilling.jsx'));
const SalesBillingList = lazy(() => import('./pages/SalesBillingList.jsx'));
const StockReport = lazy(() => import('./pages/StockReport.jsx'));
const AllInOneReport = lazy(() => import('./pages/AllInOneReport.jsx'));
const VendorPayments = lazy(() => import('./pages/VendorPayments.jsx'));
const VendorPaymentEntry = lazy(() => import('./pages/VendorPaymentEntry.jsx'));

const PAGES = [
  ['/pharmacy', PharmacyDashboard],
  ['/pharmacy/item', ItemMaster],
  ['/pharmacy/item-list', ItemListPage],
  ['/pharmacy/item-bulk-update', ItemBulkUpdate],
  ['/pharmacy/purchase-order', PurchaseOrder],
  ['/pharmacy/purchase-order-list', PurchaseOrderList],
  ['/pharmacy/stock-in', StockIn],
  ['/pharmacy/stock-in-list', StockInList],
  ['/pharmacy/stock-ips', StockIps],
  ['/pharmacy/stock-adjustment', StockAdjustment],
  ['/pharmacy/stock-adjustment-list', StockAdjustmentList],
  ['/pharmacy/return', StockReturnMaster],
  ['/pharmacy/return-list', StockReturnList],
  ['/pharmacy/sales-return', SalesReturnMaster],
  ['/pharmacy/sales-return-list', SalesReturnList],
  ['/pharmacy/vendor-master', VendorMaster],
  ['/pharmacy/vendor-list', VendorList],
  ['/pharmacy/vendor-payment', VendorPaymentEntry],
  ['/pharmacy/sales-billing', SalesBilling],
  ['/pharmacy/sales-billing-list', SalesBillingList],
  ['/pharmacy/stock-report', StockReport],
  ['/pharmacy/vendor-payments', VendorPayments],
  ['/pharmacy/all-in-one-report', AllInOneReport],
];

export const PHARMACY_ROUTES = PAGES.map(([path, Page]) => <Route key={path} path={path} element={<Page />} />);
