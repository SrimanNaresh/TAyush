// Lab end-to-end checks (source: T_Lab scripts/checks.js), adapted to the
// merged app: lab routes live under /api/lab, logins are core AppUser rows and
// the Attendant / Assistant roles are Lab logins with Menu Access (Full on
// lab.patients + lab.assignment-new, or Full on lab.results).
// Creates its own records with a unique suffix and deletes them afterwards.
//   node scripts/labChecks.js [--base http://localhost:5160]
import 'dotenv/config';

const argBase = process.argv.indexOf('--base');
const API = (argBase > 0 ? process.argv[argBase + 1] : (process.env.API_URL || `http://localhost:${process.env.PORT || 5160}`)) + '/api';
const ADMIN_USER = process.env.CHECK_ADMIN_USER || 'Admin';
const ADMIN_PASSWORD = process.env.CHECK_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD;
// Core paths stay at /api; everything else is a lab path.
const CORE_PATHS = ['/auth', '/core', '/health'];
const route = (path) => (CORE_PATHS.some((c) => path === c || path.startsWith(c + '/')) ? path : '/lab' + path);
const tag = Date.now().toString(36).toUpperCase();
let pass = 0, fail = 0;

async function call(token, method, path, body) {
  const r = await fetch(API + route(path), {
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
  else { fail++; console.log('  FAIL ' + name + (info ? '  -> ' + JSON.stringify(info) : '')); }
}

const cleanup = [];
async function main() {
  console.log(`Checks against ${API}  (tag ${tag})`);
  check('health is public', (await call(null, 'GET', '/health')).status === 200);
  check('data needs sign-in', (await call(null, 'GET', '/patients')).status === 401);
  check('bad password refused', (await call(null, 'POST', '/auth/login', { username: ADMIN_USER, password: 'wrong-' + tag })).status === 401);
  const login = await call(null, 'POST', '/auth/login', { username: ADMIN_USER, password: ADMIN_PASSWORD });
  check('admin signs in', login.status === 200 && login.data.user.role === 'Admin', login.data);
  const A = login.data.token;

  // Users for role checks
  const ACCESS = {
    Attendant: ['lab.patients', 'lab.assignment-new'],
    Assistant: ['lab.results'],
  };
  const mk = async (role) => {
    const u = `chk_${role.toLowerCase()}_${tag}`.toLowerCase();
    const r = await call(A, 'POST', '/core/users', { username: u, fullName: role + ' check', role: 'Lab', password: 'pass-' + tag });
    await call(A, 'PUT', `/core/menu-access/${r.data.UserId}`, { items: ACCESS[role].map((menuKey) => ({ menuKey, accessLevel: 'Full' })) });
    return (await call(null, 'POST', '/auth/login', { username: u, password: 'pass-' + tag })).data.token;
  };
  const AT = await mk('Attendant');
  const AS = await mk('Assistant');

  // Test Master
  check('test needs a component', (await call(A, 'POST', '/tests', { test_name: 'X' + tag, components: [] })).status === 400);
  check('duplicate component names refused', (await call(A, 'POST', '/tests', { test_name: 'X' + tag,
    components: [{ component_name: 'A' }, { component_name: 'a' }] })).status === 400);
  const t1 = await call(A, 'POST', '/tests', { test_name: `CBC ${tag}`, components: [
    { component_name: 'Hemoglobin', male_range: '13-17', female_range: '12-15', general_range: '12-17' },
    { component_name: 'WBC', general_range: '4000-11000' },
    { component_name: 'Platelets', general_range: '1.5-4.5 L' }] });
  check('test created with generated ID', t1.status === 201 && /^T\d{4}$/.test(t1.data.test_code), t1.data);
  const T1 = t1.data.test_id;
  const t2 = await call(A, 'POST', '/tests', { test_code: `CHK-${tag}`, test_name: `Sugar ${tag}`, components: [{ component_name: 'FBS', general_range: '70-110' }] });
  check('test created with supplied ID', t2.status === 201 && t2.data.test_code === `CHK-${tag}`, t2.data);
  const T2 = t2.data.test_id;
  cleanup.push(['DELETE', `/tests/${T1}`], ['DELETE', `/tests/${T2}`]);
  check('duplicate test name refused', (await call(A, 'POST', '/tests', { test_name: `CBC ${tag}`, components: [{ component_name: 'A' }] })).status === 409);
  check('attendant cannot create tests', (await call(AT, 'POST', '/tests', { test_name: 'Y' + tag, components: [{ component_name: 'A' }] })).status === 403);
  check('assistant can view tests', (await call(AS, 'GET', '/tests')).status === 200);

  // Test import grouping
  const imp = await call(A, 'POST', '/tests/import', { rows: [
    { row: 2, test_code: `IMP-${tag}`, test_name: `Lipid ${tag}`, component_name: 'HDL', general_range: '>40' },
    { row: 3, test_code: '', test_name: `Lipid ${tag}`, component_name: 'LDL', general_range: '<100' },
    { row: 4, test_name: `Thyroid ${tag}`, component_name: 'TSH' },
    { row: 5, test_name: '', component_name: 'Orphan' },
    { row: 6, test_code: `CHK-${tag}`, test_name: `Other ${tag}`, component_name: 'Z' }] });
  check('import groups rows into tests', imp.data?.created === 2 && imp.data.componentsSaved === 3, imp.data);
  check('import reports skipped rows', imp.data?.skipped?.length === 2 && imp.data.skipped.some((s) => s.row === 5) && imp.data.skipped.some((s) => s.row === 6), imp.data?.skipped);
  const list = (await call(A, 'GET', `/tests?search=${tag}`)).data;
  const lipid = list.find((t) => t.test_name === `Lipid ${tag}`);
  const thy = list.find((t) => t.test_name === `Thyroid ${tag}`);
  check('import keeps supplied Test ID', lipid?.test_code === `IMP-${tag}` && lipid.component_count === 2, lipid);
  check('import generates missing Test ID', /^T\d{4}$/.test(thy?.test_code || ''), thy);
  if (lipid) cleanup.push(['DELETE', `/tests/${lipid.test_id}`]);
  if (thy) cleanup.push(['DELETE', `/tests/${thy.test_id}`]);

  // Fees
  const fees = (await call(A, 'GET', '/fees')).data;
  check('new tests appear in fee master', fees.some((f) => f.test_id === T1));
  check('discount above fee refused', (await call(A, 'PUT', '/fees', { rows: [{ test_id: T1, fee_amount: 100, discount_amount: 150, effective_date: '2026-01-01' }] })).status === 400);
  check('negative fee refused', (await call(A, 'PUT', '/fees', { rows: [{ test_id: T1, fee_amount: -5, discount_amount: 0, effective_date: '2026-01-01' }] })).status === 400);
  check('attendant cannot edit fees', (await call(AT, 'PUT', '/fees', { rows: [{ test_id: T1, fee_amount: 1, discount_amount: 0, effective_date: '2026-01-01' }] })).status === 403);
  const fs = await call(A, 'PUT', '/fees', { rows: [
    { test_id: T1, fee_amount: 350, discount_amount: 50, effective_date: '2026-01-01' },
    { test_id: T2, fee_amount: 120.5, discount_amount: 0, effective_date: '2026-01-01' }] });
  check('fees saved', fs.status === 200, fs.data);
  const f1 = (await call(A, 'GET', '/fees')).data.find((f) => f.test_id === T1);
  check('net = fee - discount', Number(f1.net_amount) === 300, f1);
  check('fee sync works', (await call(A, 'POST', '/fees/sync')).status === 200);

  // Patients
  check('patient needs name', (await call(AT, 'POST', '/patients', { gender: 'Male' })).status === 400);
  check('bad gender refused', (await call(AT, 'POST', '/patients', { full_name: 'X', gender: 'Q' })).status === 400);
  check('future DOB refused', (await call(AT, 'POST', '/patients', { full_name: 'X', gender: 'Male', date_of_birth: '2999-01-01' })).status === 400);
  check('bad email refused', (await call(AT, 'POST', '/patients', { full_name: 'X', gender: 'Male', email: 'nope' })).status === 400);
  check('assistant cannot register patients', (await call(AS, 'POST', '/patients', { full_name: 'X', gender: 'Male' })).status === 403);
  const p1 = await call(AT, 'POST', '/patients', { full_name: `Check Patient ${tag}`, gender: 'Female', date_of_birth: '1990-06-15', phone: '9876543210' });
  check('attendant registers patient with generated ID', p1.status === 201 && /^P\d{6}$/.test(p1.data.patient_code), p1.data);
  const P1 = p1.data.patient_id;
  const pg = (await call(A, 'GET', `/patients/${P1}`)).data;
  check('age calculated from DOB', pg.age >= 35 && pg.age <= 37, pg);
  check('patient search by phone', (await call(A, 'GET', '/patients?search=9876543210')).data.some((p) => p.patient_id === P1));
  const pimp = await call(A, 'POST', '/patients/import', { rows: [
    { row: 2, full_name: `Check Patient ${tag}`, gender: 'F', date_of_birth: '1990-06-15' },
    { row: 3, patient_code: p1.data.patient_code, full_name: 'Someone', gender: 'Male' },
    { row: 4, patient_code: `PI-${tag}`, full_name: `Imported ${tag}`, gender: 'male', age: 40 },
    { row: 5, full_name: '', gender: 'Male' }] });
  check('patient import skips duplicates and invalid rows', pimp.data?.created === 1 && pimp.data.duplicates.length === 2 && pimp.data.invalid.length === 1, pimp.data);
  const pi = (await call(A, 'GET', `/patients?search=PI-${tag}`)).data[0];
  if (pi) cleanup.push(['DELETE', `/patients/${pi.patient_id}`]);

  // Assignment
  check('assignment needs tests', (await call(AT, 'POST', '/assignments', { patient_id: P1, test_ids: [] })).status === 400);
  check('assistant cannot create assignments', (await call(AS, 'POST', '/assignments', { patient_id: P1, test_ids: [T1] })).status === 403);
  const as = await call(AT, 'POST', '/assignments', { patient_id: P1, test_ids: [T1, T2], fee_amount: 1 });
  check('assignment created', as.status === 201 && /^LA\d{6}$/.test(as.data.assignment_no), as.data);
  const AID = as.data.assignment_id;
  cleanup.unshift(['DELETE', `/assignments/${AID}`]);
  cleanup.push(['DELETE', `/patients/${P1}`]);
  let ad = (await call(A, 'GET', `/assignments/${AID}`)).data;
  check('assignment prices come from fee master', Number(ad.total_fee) === 470.5 && Number(ad.total_discount) === 50 && Number(ad.net_amount) === 420.5, ad);
  check('patient with assignments cannot be deleted', (await call(A, 'DELETE', `/patients/${P1}`)).status === 409);
  check('assigned test cannot be deleted', (await call(A, 'DELETE', `/tests/${T1}`)).status === 409);
  await call(A, 'PUT', '/fees', { rows: [{ test_id: T1, fee_amount: 999, discount_amount: 0, effective_date: '2026-02-01' }] });
  ad = (await call(A, 'GET', `/assignments/${AID}`)).data;
  check('assigned price is kept after fee change', Number(ad.total_fee) === 470.5, ad.total_fee);
  check('attendant marks samples collected', (await call(AT, 'PATCH', `/assignments/${AID}/status`, { status: 'Sample Collected' })).status === 200);
  ad = (await call(A, 'GET', `/assignments/${AID}`)).data;
  check('assignment status follows tests', ad.status === 'Sample Collected', ad.status);

  // Results
  const entry = (await call(AS, 'GET', `/results/assignment/${AID}`)).data;
  check('result entry lists every component', entry.rows.length === 4, entry.rows.length);
  check('report blocked before completion', (await call(A, 'GET', `/results/assignment/${AID}/report`)).status === 409);
  check('attendant cannot enter results', (await call(AT, 'PUT', `/results/assignment/${AID}`, { values: [], complete: false })).status === 403);
  check('cannot complete with no values', (await call(AS, 'PUT', `/results/assignment/${AID}`, { values: [], complete: true })).status === 400);
  const hb = entry.rows.find((r) => r.component_name === 'Hemoglobin');
  const wbc = entry.rows.find((r) => r.component_name === 'WBC');
  const draft = await call(AS, 'PUT', `/results/assignment/${AID}`, { values: [
    { assignment_test_id: hb.assignment_test_id, component_id: hb.component_id, result_value: '13.2' }], complete: false });
  check('draft saved', draft.status === 200 && draft.data.status === 'Draft', draft.data);
  ad = (await call(A, 'GET', `/assignments/${AID}`)).data;
  check('draft puts test In Progress', ad.tests.find((t) => t.test_id === T1).status === 'In Progress' && ad.status === 'In Progress', ad.tests);
  const done = await call(AS, 'PUT', `/results/assignment/${AID}`, { values: [
    { assignment_test_id: hb.assignment_test_id, component_id: hb.component_id, result_value: '13.2' },
    { assignment_test_id: wbc.assignment_test_id, component_id: wbc.component_id, result_value: '7200' },
    { assignment_test_id: wbc.assignment_test_id, component_id: 999999999, result_value: 'x' }].slice(0, 2), complete: true });
  check('results completed', done.status === 200 && done.data.status === 'Completed', done.data);
  check('foreign component refused', (await call(AS, 'PUT', `/results/assignment/${AID}`, { values: [
    { assignment_test_id: wbc.assignment_test_id, component_id: 999999999, result_value: 'x' }], complete: true })).status === 400);
  ad = (await call(A, 'GET', `/assignments/${AID}`)).data;
  check('test with values is Completed, untouched test is not', ad.tests.find((t) => t.test_id === T1).status === 'Completed'
    && ad.tests.find((t) => t.test_id === T2).status === 'Sample Collected', ad.tests);
  const rep = await call(AT, 'GET', `/results/assignment/${AID}/report`);
  const comps = rep.data?.tests?.flatMap((t) => t.components) || [];
  check('report prints only entered results', rep.status === 200 && comps.length === 2 && rep.data.tests.length === 1
    && !comps.some((c) => c.component_name === 'Platelets'), rep.data?.tests);
  const edit = await call(A, 'PUT', `/tests/${T1}`, { test_code: t1.data.test_code, test_name: `CBC ${tag}`,
    components: entry.rows.filter((r) => r.test_id === T1 && r.component_name !== 'WBC').map((r) => ({ ...r })) });
  check('component removed from test master', edit.status === 200, edit.data);
  const rep2 = await call(A, 'GET', `/results/assignment/${AID}/report`);
  check('report keeps value of removed component', rep2.data?.tests?.[0]?.components?.some((c) => c.component_name === 'WBC'), rep2.data?.tests);

  // Users
  check('attendant cannot manage users', (await call(AT, 'GET', '/core/users')).status === 403);

  // Merged-app extras
  check('pharmacy login cannot register lab patients', await (async () => {
    const u = `chk_pharm_${tag}`.toLowerCase();
    await call(A, 'POST', '/core/users', { username: u, role: 'Pharmacist', password: 'pass-' + tag });
    const t = (await call(null, 'POST', '/auth/login', { username: u, password: 'pass-' + tag })).data.token;
    return (await call(t, 'POST', '/patients', { full_name: 'X', gender: 'Male' })).status === 403;
  })());
  check('lab patient is in shared Patient list', (await call(A, 'GET', `/patients?search=${encodeURIComponent('Check Patient ' + tag)}`)).data.length === 1);
}

main()
  .catch((e) => { fail++; console.error('Check run crashed:', e); })
  .finally(async () => {
    try {
      const A = (await call(null, 'POST', '/auth/login', { username: ADMIN_USER, password: ADMIN_PASSWORD })).data?.token;
      for (const [m, p] of cleanup) {
        const r = await call(A, m, p);
        if (r.status !== 200) console.log(`  cleanup ${m} ${p} -> ${r.status} ${JSON.stringify(r.data)}`);
      }
      // Check logins have no history once their records are gone: remove them for good.
      const { getPool, sql } = await import('../src/db/pool.js');
      const pool = await getPool();
      await pool.request().input('t', sql.NVarChar, `%${tag.toLowerCase()}`).query("DELETE FROM AppUser WHERE Username LIKE 'chk[_]%' AND Username LIKE @t");
      await pool.close();
    } catch (e) { console.log('cleanup failed', e.message); }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
