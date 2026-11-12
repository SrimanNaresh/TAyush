// Clinic checks for the merged app: the visit workflow (register -> confirm ->
// vitals -> doctor -> bill), shared patients with Lab, server-side Menu Access
// for saving, and the Patient-login lock. Creates its own records and removes
// them afterwards.
//   node scripts/clinicChecks.js [--base http://localhost:5160]
import 'dotenv/config';

const argBase = process.argv.indexOf('--base');
const API = (argBase > 0 ? process.argv[argBase + 1] : `http://localhost:${process.env.PORT || 5160}`) + '/api';
const tag = Date.now().toString(36).toUpperCase();
let pass = 0;
let fail = 0;
const made = { patients: [], meds: [], tests: [], emps: [] };

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
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function main() {
  console.log(`Clinic checks against ${API}  (tag ${tag})`);
  const A = (await call(null, 'POST', '/auth/login', { username: 'Admin', password: process.env.ADMIN_INITIAL_PASSWORD })).data?.token;
  check('admin signs in', !!A);

  for (const p of ['/clinic/medications', '/clinic/lab-tests', '/clinic/employees', '/clinic/patients', '/clinic/patients/next-id',
    '/clinic/vitals', '/clinic/prescriptions', '/clinic/prescriptions/follow-up', '/clinic/confirmations', '/clinic/clinic-details',
    '/clinic/partner-pharmacies', `/clinic/billing?from=${today()}&to=${today()}`, `/clinic/billing/patients?date=${today()}`,
    '/clinic/reports/patients', `/clinic/reports/visits?from=${today()}&to=${today()}`]) {
    const r = await call(A, 'GET', p);
    check(`GET ${p}`, r.status === 200, r.data);
  }

  // Masters
  const med = await call(A, 'POST', '/clinic/medications', { medicineName: `Arnica ${tag}`, genericName: 'Arnica', category: 'Dilution' });
  check('medication created', med.status === 201 || med.status === 200, med.data);
  if (med.data?.MedicationId) made.meds.push(med.data.MedicationId);
  const lt = await call(A, 'POST', '/clinic/lab-tests', { testName: `CBC ${tag}` });
  check('clinic lab test created', [200, 201].includes(lt.status), lt.data);
  if (lt.data?.TestId) made.tests.push(lt.data.TestId);
  const emp = await call(A, 'POST', '/clinic/employees', { name: `Dr Check ${tag}`, empType: 'Doctor', doctorFee: 200, shifts: [] });
  check('employee created', [200, 201].includes(emp.status), emp.data);
  const empId = emp.data?.employeeId || emp.data?.EmployeeId;
  if (empId) made.emps.push(empId);

  // Patient (shared with Lab)
  const pt = await call(A, 'POST', '/clinic/patients', { name: `Clinic Patient ${tag}`, mobileNo: '9876511111', address: 'Check', age: 40 });
  check('clinic registers patient with a P-code', pt.status === 201 && /^P\d{6}$/.test(pt.data?.PatientCode || ''), pt.data);
  const PID = pt.data?.PatientId;
  if (PID) made.patients.push(PID);
  const labView = (await call(A, 'GET', `/lab/patients?search=${encodeURIComponent('Clinic Patient ' + tag)}`)).data || [];
  check('clinic patient appears in Lab patients', labView.length === 1 && labView[0].patient_code === pt.data?.PatientCode, labView);

  // Visit workflow
  const cf = await call(A, 'POST', '/clinic/confirmations', { patientId: PID });
  check('patient confirmed into queue', cf.status === 201 && cf.data?.Status === 'Confirm', cf.data);
  check('second confirm today refused', (await call(A, 'POST', '/clinic/confirmations', { patientId: PID })).status >= 400);
  const vs = await call(A, 'POST', '/clinic/vitals', { patientId: PID, height: 170, weight: 70, bloodPressure: '120/80', pulseRate: 72, temperature: 98.4 });
  check('vitals saved', [200, 201].includes(vs.status), vs.data);
  const status = async () => (await call(A, 'GET', '/clinic/confirmations')).data?.find((c) => c.PatientId === PID)?.Status;
  check('queue moves to Pre-Examine after vitals', (await status()) === 'Pre-Examine', await status());
  check('examine', (await call(A, 'POST', '/clinic/confirmations/examine', { patientId: PID })).status === 200);
  check('queue moves to Examine', (await status()) === 'Examine', await status());
  const rx = await call(A, 'POST', '/clinic/prescriptions', {
    patientId: PID, doctorId: made.emps[0], diagnosis: 'Check', notes: 'n', complete: true,
    items: [{ medicationId: made.meds[0], medicineName: `Arnica ${tag}`, dosage: '4 pills', frequency: 'TDS', duration: '5 days' }],
    labTestIds: made.tests,
  });
  check('prescription saved', rx.status === 201 && rx.data?.prescriptionId, rx.data);
  check('queue moves to Billing', (await status()) === 'Billing', await status());
  const hist = await call(A, 'GET', `/clinic/prescriptions/history/${PID}`);
  check('prescription history has the medicine', JSON.stringify(hist.data || '').includes(`Arnica ${tag}`), hist.data);
  const bill = await call(A, 'PUT', `/clinic/billing/patients/${PID}`, { date: today(), doctorFees: 200, extraFees: 50, notes: 'check' });
  check('patient bill saved', bill.status === 200, bill.data);
  check('queue Completed after bill', (await status()) === 'Completed', await status());
  const rep = await call(A, 'GET', `/clinic/billing?from=${today()}&to=${today()}`);
  check('billing report answers for today', rep.status === 200, rep.data);

  // Permissions
  const mk = async (name, role, keys, linkedPatientId) => {
    const u = `chk_${name}_${tag}`.toLowerCase();
    const r = await call(A, 'POST', '/core/users', { username: u, role, password: 'pass-' + tag, linkedPatientId });
    if (keys.length) await call(A, 'PUT', `/core/menu-access/${r.data.UserId}`, { items: keys.map((menuKey) => ({ menuKey, accessLevel: 'Full' })) });
    return (await call(null, 'POST', '/auth/login', { username: u, password: 'pass-' + tag })).data?.token;
  };
  const RECEPTION = await mk('recep', 'Reception', ['clinic.registration.patient', 'clinic.confirm.search']);
  const PHARM = await mk('pharm', 'Pharmacist', ['pharmacy.sales-billing']);
  const r1 = await call(RECEPTION, 'POST', '/clinic/patients', { name: `Recep Patient ${tag}` });
  check('reception with access registers a patient', r1.status === 201, r1.data);
  if (r1.data?.PatientId) made.patients.push(r1.data.PatientId);
  check('reception without Doctor access cannot prescribe', (await call(RECEPTION, 'POST', '/clinic/prescriptions', { patientId: PID })).status === 403);
  check('pharmacy login cannot register clinic patients', (await call(PHARM, 'POST', '/clinic/patients', { name: 'X' })).status === 403);
  check('pharmacy login can read clinic patients (as in source)', (await call(PHARM, 'GET', '/clinic/patients')).status === 200);

  // Patient login lock
  const PT = await mk('portal', 'Patient', [], PID);
  check('patient login signs in', !!PT);
  check('patient login reads own records list', [200, 503].includes((await call(PT, 'GET', '/clinic/patient-documents')).status));
  check('patient login reads organisation name', (await call(PT, 'GET', '/core/organisation')).status === 200);
  check('patient login cannot list patients', (await call(PT, 'GET', '/clinic/patients')).status === 403);
  check('patient login cannot read lab', (await call(PT, 'GET', '/lab/patients')).status === 403);
  check('patient login cannot read pharmacy', (await call(PT, 'GET', '/pharmacy/vendors')).status === 403);
  check('patient login cannot list users', (await call(PT, 'GET', '/core/users')).status === 403);

  // Clinic Master writes the shared organisation row
  const before = (await call(A, 'GET', '/clinic/clinic-details')).data;
  const cd = await call(A, 'PUT', '/clinic/clinic-details', { name: before?.Name || 'Ayush', address: before?.Address, doctorName: before?.DoctorName, logo: before?.Logo,
    email: before?.Email, contactNo: before?.ContactNo, pageHeight: 21, pageWidth: 14.8, appName: before?.AppName });
  check('clinic master saves page size on the shared row', cd.status === 200 && Number(cd.data?.PageHeight) === 21, cd.data);
  const org = (await call(A, 'GET', '/core/organisation')).data;
  check('organisation details see the same row', Number(org?.PageHeight) === 21, org);
  check('clinic details cannot be deleted', (await call(A, 'DELETE', '/clinic/clinic-details')).status === 404);
}

main()
  .catch((e) => { fail++; console.error('Check run crashed:', e); })
  .finally(async () => {
    try {
      const { getPool, sql } = await import('../src/db/pool.js');
      const pool = await getPool();
      for (const id of made.patients) {
        await pool.request().input('id', sql.Int, id).query(`
          DELETE FROM PatientBill WHERE PatientId = @id;
          DELETE FROM AppUser WHERE LinkedPatientId = @id;
          DELETE FROM Patient WHERE PatientId = @id;`); // vitals, prescriptions, confirmations cascade
      }
      for (const id of made.meds) await pool.request().input('id', sql.Int, id).query('DELETE FROM Medication WHERE MedicationId = @id');
      for (const id of made.tests) await pool.request().input('id', sql.Int, id).query('DELETE FROM LabTest WHERE TestId = @id');
      for (const id of made.emps) await pool.request().input('id', sql.Int, id).query('DELETE FROM Employee WHERE EmployeeId = @id');
      await pool.request().input('t', sql.NVarChar, `%${tag.toLowerCase()}`).query("DELETE FROM AppUser WHERE Username LIKE 'chk[_]%' AND Username LIKE @t");
      await pool.request().query('UPDATE ClinicDetails SET PageHeight = NULL, PageWidth = NULL WHERE ClinicId = 1');
      await pool.close();
    } catch (e) { console.log('cleanup failed', e.message); }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
