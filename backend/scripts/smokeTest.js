// API smoke test. Usage: node scripts/smokeTest.js [--base http://localhost:5160]
// Signs in as Admin with ADMIN_INITIAL_PASSWORD from .env, exercises the core
// routes, and cleans up everything it creates.
import 'dotenv/config';

const argBase = process.argv.indexOf('--base');
const BASE = (argBase > 0 ? process.argv[argBase + 1] : `http://localhost:${process.env.PORT || 5160}`) + '/api';

let token = '';
let passed = 0;
let failed = 0;

async function call(method, path, body, auth = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

function check(name, ok, info = '') {
  if (ok) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name} ${info}`); }
}

async function run() {
  console.log(`Smoke test against ${BASE}`);

  let r = await call('GET', '/health', null, false);
  check('health', r.status === 200 && r.data?.status === 'ok');
  r = await call('GET', '/app-info', null, false);
  check('app-info public', r.status === 200 && !!r.data?.appName);
  r = await call('GET', '/manifest.webmanifest', null, false);
  check('manifest public', r.status === 200 && !!r.data?.name);

  r = await call('GET', '/core/users', null, false);
  check('protected route needs login', r.status === 401);
  r = await call('POST', '/auth/login', { username: 'Admin', password: 'wrong-password' }, false);
  check('wrong password refused', r.status === 401);

  r = await call('POST', '/auth/login', { username: 'Admin', password: process.env.ADMIN_INITIAL_PASSWORD }, false);
  check('admin login', r.status === 200 && !!r.data?.token, JSON.stringify(r.data));
  token = r.data?.token;
  const adminId = r.data?.user?.userId;
  r = await call('GET', '/auth/me');
  check('auth/me', r.data?.role === 'Admin');

  r = await call('GET', '/core/organisation');
  check('organisation get', r.status === 200 && r.data?.ClinicId === 1);
  const org = r.data;

  // User create / edit / menu access / switch off
  const uname = `smoke_${Date.now()}`;
  r = await call('POST', '/core/users', { username: uname, fullName: 'Smoke Test', password: 'Smoke#12345', role: 'Pharmacist' });
  check('user create', r.status === 201 && r.data?.Role === 'Pharmacist', JSON.stringify(r.data));
  const uid = r.data?.UserId;
  r = await call('POST', '/core/users', { username: uname, password: 'x' });
  check('duplicate username refused', r.status === 409);
  r = await call('PUT', `/core/users/${uid}`, { username: uname, fullName: 'Smoke Edited', role: 'Lab', isActive: true });
  check('user update', r.status === 200 && r.data?.FullName === 'Smoke Edited' && r.data?.Role === 'Lab');
  r = await call('PUT', `/core/menu-access/${uid}`, { items: [{ menuKey: 'settings.organisation', accessLevel: 'View' }] });
  check('menu access save', r.status === 200);
  r = await call('GET', `/core/menu-access/${uid}`);
  check('menu access read', r.data?.[0]?.AccessLevel === 'View');

  // Non-admin limits
  const adminToken = token;
  r = await call('POST', '/auth/login', { username: uname, password: 'Smoke#12345' }, false);
  check('staff login', r.status === 200);
  token = r.data?.token;
  r = await call('GET', '/core/users');
  check('staff cannot list users', r.status === 403);
  r = await call('PUT', `/core/menu-access/${uid}`, { items: [{ menuKey: 'settings.user', accessLevel: 'Full' }] });
  check('staff cannot grant access', r.status === 403);
  r = await call('GET', `/core/menu-access/${adminId}`);
  check('staff cannot read others access', r.status === 403);
  r = await call('GET', `/core/menu-access/${uid}`);
  check('staff reads own access', r.status === 200);
  r = await call('PUT', '/core/organisation', { name: 'Hacked' });
  check('staff cannot change organisation', r.status === 403);
  r = await call('POST', '/auth/change-password', { currentPassword: 'wrong', newPassword: 'Smoke#67890' });
  check('change password needs current password', r.status === 400);
  r = await call('POST', '/auth/change-password', { currentPassword: 'Smoke#12345', newPassword: 'Smoke#67890' });
  check('change own password', r.status === 200);
  r = await call('POST', '/auth/login', { username: uname, password: 'Smoke#67890' }, false);
  check('login with new password', r.status === 200);
  token = adminToken;
  r = await call('PUT', `/core/users/${uid}`, { username: uname, role: 'Lab', isActive: false });
  token = r.data ? (await call('POST', '/auth/login', { username: uname, password: 'Smoke#67890' }, false)).status : 0;
  check('switched-off login cannot sign in', token === 401);
  token = adminToken;
  await call('PUT', `/core/users/${uid}`, { username: uname, role: 'Lab', isActive: true });

  r = await call('PUT', '/core/organisation', { name: org.Name, address: org.Address, logo: org.Logo, email: org.Email, contactNo: org.ContactNo, appName: org.AppName, doctorName: org.DoctorName });
  check('organisation save (unchanged)', r.status === 200 && r.data?.Name === org.Name);

  r = await call('DELETE', `/core/users/${adminId}`);
  check('admin cannot delete self', r.status === 400);
  r = await call('DELETE', `/core/users/${uid}`);
  check('user switch off', r.status === 200);
  r = await call('POST', '/auth/login', { username: uname, password: 'Smoke#12345' }, false);
  check('switched-off login refused', r.status === 401);

  // Cleanup: smoke users are removed for good (they have no history).
  const { getPool, sql } = await import('../src/db/pool.js');
  const pool = await getPool();
  await pool.request().input('u', sql.NVarChar, 'smoke_%').query('DELETE FROM AppUser WHERE Username LIKE @u');
  await pool.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => { console.error(err); process.exit(1); });
