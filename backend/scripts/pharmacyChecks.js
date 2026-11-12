// Pharmacy checks for the merged app: every read route answers under
// /api/pharmacy, the pick-list seed is there, and saving needs Admin or Full
// Menu Access on a matching page (server side). Creates its own records and
// removes them afterwards.
//   node scripts/pharmacyChecks.js [--base http://localhost:5160]
import 'dotenv/config';

const argBase = process.argv.indexOf('--base');
const API = (argBase > 0 ? process.argv[argBase + 1] : `http://localhost:${process.env.PORT || 5160}`) + '/api';
const tag = Date.now().toString(36).toUpperCase();
let pass = 0;
let fail = 0;

async function call(token, method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data };
}
function check(name, ok, info) {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info).slice(0, 300) : '')); }
}

const vendorsToRemove = [];

async function main() {
  console.log(`Pharmacy checks against ${API}  (tag ${tag})`);
  const A = (await call(null, 'POST', '/auth/login', { username: 'Admin', password: process.env.ADMIN_INITIAL_PASSWORD })).data?.token;
  check('admin signs in', !!A);

  check('pharmacy needs sign-in', (await call(null, 'GET', '/pharmacy/vendors')).status === 401);

  // Every read route of the source answers under /api/pharmacy
  for (const p of ['/pharmacy/vendors', '/pharmacy/pharmacy-items', '/pharmacy/item-master', '/pharmacy/item-master/lists',
    '/pharmacy/purchase-orders', '/pharmacy/stock-ins', '/pharmacy/stock-returns', '/pharmacy/stock-adjustments',
    '/pharmacy/sales-billings', '/pharmacy/sales-returns', '/pharmacy/sales-returns/customers', '/pharmacy/dashboard',
    '/pharmacy/pharmacy-reports/stock', '/pharmacy/pharmacy-reports/vendor-payments', '/pharmacy/pharmacy-reports/all-in-one/screens',
    '/pharmacy/vendor-bill-payments/invoices']) {
    const r = await call(A, 'GET', p);
    check(`GET ${p}`, r.status === 200, r.data);
  }

  const lists = (await call(A, 'GET', '/pharmacy/item-master/lists')).data || {};
  check('unit / potency / category seed present', lists.unit?.length >= 14 && lists.potency?.length >= 6 && lists.category?.length >= 12,
    { unit: lists.unit?.length, potency: lists.potency?.length, category: lists.category?.length });

  // Vendor validation and create (Admin)
  check('vendor name required', (await call(A, 'POST', '/pharmacy/vendors', {})).status === 400);
  const v = await call(A, 'POST', '/pharmacy/vendors', { vendorName: `Check Vendor ${tag}`, contactNo: '9876500000', address: 'Check street' });
  check('admin creates vendor', v.status === 201 && v.data?.VendorId, v.data);
  if (v.data?.VendorId) vendorsToRemove.push(v.data.VendorId);

  // Logins for permission checks
  const mk = async (name, role, keys) => {
    const u = `chk_${name}_${tag}`.toLowerCase();
    const r = await call(A, 'POST', '/core/users', { username: u, role, password: 'pass-' + tag });
    if (keys.length) await call(A, 'PUT', `/core/menu-access/${r.data.UserId}`, { items: keys.map((menuKey) => ({ menuKey, accessLevel: 'Full' })) });
    return (await call(null, 'POST', '/auth/login', { username: u, password: 'pass-' + tag })).data?.token;
  };
  const LAB = await mk('lab', 'Lab', ['lab.results']);
  const VIEWER = await mk('viewer', 'Pharmacist', []);
  const CLERK = await mk('vendorclerk', 'Pharmacist', ['pharmacy.vendor-master']);
  const SALES = await mk('sales', 'Pharmacist', ['pharmacy.sales-billing']);

  check('lab login cannot create vendors', (await call(LAB, 'POST', '/pharmacy/vendors', { vendorName: 'X' + tag })).status === 403);
  check('login without access can still read vendors', (await call(VIEWER, 'GET', '/pharmacy/vendors')).status === 200);
  check('login without access cannot create vendors', (await call(VIEWER, 'POST', '/pharmacy/vendors', { vendorName: 'X' + tag })).status === 403);
  check('sales login cannot create vendors', (await call(SALES, 'POST', '/pharmacy/vendors', { vendorName: 'X' + tag })).status === 403);
  check('sales login cannot save stock in', (await call(SALES, 'POST', '/pharmacy/stock-ins', {})).status === 403);
  check('sales login reaches sales validation', (await call(SALES, 'POST', '/pharmacy/sales-billings', {})).status === 400);
  const cv = await call(CLERK, 'POST', '/pharmacy/vendors', { vendorName: `Clerk Vendor ${tag}`, contactNo: '9876500001', address: 'Clerk street' });
  check('vendor-master login creates vendor', cv.status === 201, cv.data);
  if (cv.data?.VendorId) vendorsToRemove.push(cv.data.VendorId);
  check('vendor-master login cannot import items', (await call(CLERK, 'POST', '/pharmacy/item-master/import', { rows: [] })).status === 403);

  // Document number code from .env
  const code = process.env.CLINIC_CODE || 'AP';
  check(`document code is ${code}`, code === 'TA');
}

main()
  .catch((e) => { fail++; console.error('Check run crashed:', e); })
  .finally(async () => {
    try {
      const { getPool, sql } = await import('../src/db/pool.js');
      const pool = await getPool();
      for (const id of vendorsToRemove) await pool.request().input('id', sql.Int, id).query('DELETE FROM Vendor WHERE VendorId = @id');
      await pool.request().input('t', sql.NVarChar, `%${tag.toLowerCase()}`).query("DELETE FROM AppUser WHERE Username LIKE 'chk[_]%' AND Username LIKE @t");
      await pool.close();
    } catch (e) { console.log('cleanup failed', e.message); }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
