// Phase 5 link checks: a clinic prescription is matched by name to Pharmacy
// items and Lab tests; unmatched names come back as null; a Patient login
// cannot use the link. Creates its own records and removes them afterwards.
//   node scripts/linkChecks.js [--base http://localhost:5160]
import 'dotenv/config';

const argBase = process.argv.indexOf('--base');
const API = (argBase > 0 ? process.argv[argBase + 1] : `http://localhost:${process.env.PORT || 5160}`) + '/api';
const tag = Date.now().toString(36).toUpperCase();
let pass = 0;
let fail = 0;
const made = {};

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
  else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info).slice(0, 400) : '')); }
}

async function main() {
  console.log(`Link checks against ${API}  (tag ${tag})`);
  const A = (await call(null, 'POST', '/auth/login', { username: 'Admin', password: process.env.ADMIN_INITIAL_PASSWORD })).data?.token;

  // Same names in Pharmacy / Lab as in the prescription (different case and spaces on purpose)
  const item = await call(A, 'POST', '/pharmacy/item-master', { name: `Arnica Link ${tag}`, mrp: 100, cgst: 6, sgst: 6, schedule: 'None', status: 'Active' });
  made.itemId = item.data?.ItemId;
  check('pharmacy item created', !!made.itemId, item.data);
  const test = await call(A, 'POST', '/lab/tests', { test_name: `Sugar Link ${tag}`, components: [{ component_name: 'FBS', general_range: '70-110' }] });
  made.testId = test.data?.test_id;
  check('lab test created', !!made.testId, test.data);
  const clinicTest = await call(A, 'POST', '/clinic/lab-tests', { testName: `sugar link ${tag}` });
  made.clinicTestId = clinicTest.data?.TestId;
  const otherTest = await call(A, 'POST', '/clinic/lab-tests', { testName: `Unknown Test ${tag}` });
  made.otherTestId = otherTest.data?.TestId;

  const pt = await call(A, 'POST', '/clinic/patients', { name: `Link Patient ${tag}`, mobileNo: '9876533333' });
  made.patientId = pt.data?.PatientId;
  const rx = await call(A, 'POST', '/clinic/prescriptions', {
    patientId: made.patientId, diagnosis: 'link',
    items: [{ medicineName: `  arnica   link ${tag} `, dosage: '4 pills' }, { medicineName: `Not Stocked ${tag}` }],
    labTestIds: [made.clinicTestId, made.otherTestId],
  });
  const RX = rx.data?.prescriptionId;
  check('prescription created', !!RX, rx.data);

  const link = await call(A, 'GET', `/links/prescription/${RX}`);
  check('link answers', link.status === 200, link.data);
  check('patient comes with the link', link.data?.patient?.PatientId === made.patientId && link.data?.patient?.MobileNo === '9876533333', link.data?.patient);
  const meds = link.data?.medicines || [];
  check('medicine matched to pharmacy item by name', meds.some((m) => m.pharmacyItem?.ItemId === made.itemId), meds);
  check('unknown medicine comes back unmatched', meds.some((m) => /Not Stocked/.test(m.name) && m.pharmacyItem === null), meds);
  const tests = link.data?.labTests || [];
  check('clinic lab test matched to lab test by name', tests.some((t) => t.labTest?.test_id === made.testId), tests);
  check('unknown lab test comes back unmatched', tests.some((t) => /Unknown Test/.test(t.name) && t.labTest === null), tests);
  check('missing prescription is 404', (await call(A, 'GET', '/links/prescription/99999999')).status === 404);

  // Saving the pre-filled lab assignment goes through the normal Lab rules
  const as = await call(A, 'POST', '/lab/assignments', { patient_id: made.patientId, test_ids: [made.testId], notes: `From prescription #${RX}` });
  check('lab assignment saved for the shared patient', as.status === 201, as.data);
  made.assignmentId = as.data?.assignment_id;

  const u = `chk_linkpt_${tag}`.toLowerCase();
  await call(A, 'POST', '/core/users', { username: u, role: 'Patient', password: 'pass-' + tag, linkedPatientId: made.patientId });
  const PT = (await call(null, 'POST', '/auth/login', { username: u, password: 'pass-' + tag })).data?.token;
  check('patient login cannot use links', (await call(PT, 'GET', `/links/prescription/${RX}`)).status === 403);
}

main()
  .catch((e) => { fail++; console.error('Check run crashed:', e); })
  .finally(async () => {
    try {
      const { getPool, sql } = await import('../src/db/pool.js');
      const pool = await getPool();
      const q = (text, v) => pool.request().input('v', sql.Int, v ?? 0).query(text);
      await q('DELETE FROM test_assignments WHERE assignment_id = @v', made.assignmentId);
      await q('DELETE FROM AppUser WHERE LinkedPatientId = @v', made.patientId);
      await q('DELETE FROM Patient WHERE PatientId = @v', made.patientId); // prescriptions cascade
      await q('DELETE FROM LabTest WHERE TestId = @v', made.clinicTestId);
      await q('DELETE FROM LabTest WHERE TestId = @v', made.otherTestId);
      await q('DELETE FROM test_master WHERE test_id = @v', made.testId);
      await q('DELETE FROM PharmacyItem WHERE ItemId = @v', made.itemId);
      await pool.close();
    } catch (e) { console.log('cleanup failed', e.message); }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
