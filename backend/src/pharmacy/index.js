// Pharmacy module router, mounted at /api/pharmacy (source: Ayush_Pharmacy /api/*).
import { Router } from 'express';
import { requireAccess } from '../middleware/auth.js';
import vendorRoutes from './routes/vendor.js';
import pharmacyItemRoutes from './routes/pharmacyItem.js';
import pharmacyReportRoutes from './routes/pharmacyReport.js';
import itemMasterRoutes from './routes/itemMaster.js';
import purchaseOrderRoutes from './routes/purchaseOrder.js';
import stockInRoutes from './routes/stockIn.js';
import vendorPaymentRoutes from './routes/vendorPayment.js';
import stockReturnRoutes from './routes/stockReturn.js';
import stockAdjustmentRoutes from './routes/stockAdjustment.js';
import salesBillingRoutes from './routes/salesBilling.js';
import salesReturnRoutes from './routes/salesReturn.js';
import dashboardRoutes from './routes/dashboard.js';

// Saving (POST / PUT / PATCH / DELETE) needs Admin or Full Menu Access on one
// of the pages that save through that API. Reading stays open to any login,
// as in the source. Admin-only rules inside the routes are unchanged.
const writesNeed = (keys) => {
  const check = requireAccess(keys);
  return (req, res, next) => (req.method === 'GET' ? next() : check(req, res, next));
};

const IPS = 'pharmacy.stock-ips'; // Three in One creates vendor, items, order and Stock In
const PO = 'pharmacy.purchase-master';

const router = Router();
router.use('/vendors', writesNeed(['pharmacy.vendor-master', PO, IPS]), vendorRoutes);
router.use('/pharmacy-items', pharmacyItemRoutes);
router.use('/pharmacy-reports', pharmacyReportRoutes);
router.use('/item-master', writesNeed(['pharmacy.item', 'pharmacy.item-list-new', PO, 'pharmacy.stock-inward', IPS]), itemMasterRoutes);
router.use('/purchase-orders', writesNeed([PO, IPS]), purchaseOrderRoutes);
router.use('/stock-ins', writesNeed(['pharmacy.stock-inward', IPS]), stockInRoutes);
router.use('/vendor-bill-payments', writesNeed(['pharmacy.vendor-payment']), vendorPaymentRoutes);
router.use('/stock-returns', writesNeed(['pharmacy.purchase-return']), stockReturnRoutes);
router.use('/stock-adjustments', writesNeed(['pharmacy.stock-adjustment']), stockAdjustmentRoutes);
router.use('/sales-billings', writesNeed(['pharmacy.sales-billing']), salesBillingRoutes);
router.use('/sales-returns', writesNeed(['pharmacy.sales-return']), salesReturnRoutes);
router.use('/dashboard', dashboardRoutes);
router.use((req, res) => res.status(404).json({ error: 'Not found' }));

export default router;
