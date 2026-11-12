import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { adminOnly, requireAccess } from '../../middleware/auth.js';
import { h, bad, notFound, str, dateOnly, withTx, nextCode, today, ageFrom } from '../helpers.js';

const router = Router();

const GENDERS = { male: 'Male', m: 'Male', female: 'Female', f: 'Female', other: 'Other', o: 'Other' };

// Age shown is always worked out from the date of birth when there is one.
const AGE_NOW = `CASE WHEN p.date_of_birth IS NULL THEN p.age ELSE
  DATEDIFF(YEAR, p.date_of_birth, CAST(GETDATE() AS DATE)) -
  CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.date_of_birth, CAST(GETDATE() AS DATE)), p.date_of_birth) > CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END END`;
const COLS = `p.patient_id, p.patient_code, p.full_name, p.gender, p.date_of_birth, ${AGE_NOW} AS age, p.phone, p.email,
  p.address, p.referred_by, p.registration_date, p.created_at, p.updated_at`;

export function parsePatient(b) {
  const patient_code = str(b.patient_code, 20, 'Patient ID');
  if (patient_code && !/^[A-Za-z0-9._/-]+$/.test(patient_code)) throw bad('Patient ID may contain letters, digits, dot, dash, slash and underscore only');
  const full_name = str(b.full_name, 150, 'Full name', { required: true });
  const gender = GENDERS[String(b.gender || '').trim().toLowerCase()];
  if (!gender) throw bad('Gender must be Male, Female or Other');
  const registration_date = dateOnly(b.registration_date, 'Registration date') || today();
  const date_of_birth = dateOnly(b.date_of_birth, 'Date of birth');
  if (date_of_birth && date_of_birth > today()) throw bad('Date of birth cannot be in the future');
  if (date_of_birth && date_of_birth > registration_date) throw bad('Date of birth cannot be after the registration date');
  let age = null;
  if (date_of_birth) age = ageFrom(date_of_birth);
  else if (b.age !== '' && b.age !== null && b.age !== undefined) {
    age = Number(b.age);
    if (!Number.isInteger(age) || age < 0 || age > 150) throw bad('Age must be a whole number between 0 and 150');
  }
  if (age !== null && age > 150) throw bad('Age must be 150 or less');
  const phone = str(b.phone, 20, 'Phone');
  if (phone && !/^[0-9+()\-\s]{5,20}$/.test(phone)) throw bad('Phone may contain digits, spaces, +, - and brackets only');
  const email = str(b.email, 150, 'Email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Email is not valid');
  return {
    patient_code, full_name, gender, date_of_birth, age, phone, email,
    address: str(b.address, 400, 'Address'),
    referred_by: str(b.referred_by, 150, 'Referred by'),
    registration_date,
  };
}

function bind(q, p) {
  return q.input('code', sql.NVarChar, p.patient_code).input('name', sql.NVarChar, p.full_name)
    .input('gender', sql.NVarChar, p.gender).input('dob', sql.Date, p.date_of_birth).input('age', sql.Int, p.age)
    .input('phone', sql.NVarChar, p.phone).input('email', sql.NVarChar, p.email)
    .input('addr', sql.NVarChar, p.address).input('ref', sql.NVarChar, p.referred_by).input('reg', sql.Date, p.registration_date);
}

// Patients live in the shared Patient table (also used by Clinic). Reads go
// through the lab_patients view, which keeps Lab's own column names.
const nextPatientCode = (tx) => nextCode(tx, 'Patient', 'PatientCode', 'P', 6);

async function insertPatient(tx, p) {
  const code = p.patient_code || (await nextPatientCode(tx));
  const r = await bind(tx.request(), { ...p, patient_code: code }).query(`
    INSERT INTO Patient (PatientCode, Name, Gender, DateOfBirth, Age, MobileNo, Email, Address, ReferredBy, RegistrationDate)
    OUTPUT INSERTED.PatientId AS patient_id VALUES (@code,@name,@gender,@dob,@age,@phone,@email,@addr,@ref,@reg)`);
  return { patient_id: r.recordset[0].patient_id, patient_code: code };
}

router.get('/', h(async (req, res) => {
  const pool = await getPool();
  const search = String(req.query.search || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 5000);
  const r = await pool.request().input('s', sql.NVarChar, `%${search}%`).input('lim', sql.Int, limit).query(`
    SELECT TOP (@lim) ${COLS} FROM lab_patients p
    WHERE p.is_active = 1 -- Clinic deletes patients softly; hide those here too
      AND (@s = '%%' OR p.patient_code LIKE @s OR p.full_name LIKE @s OR p.phone LIKE @s OR p.email LIKE @s)
    ORDER BY p.patient_id DESC`);
  res.json(r.recordset);
}));

router.get('/export', h(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().query(`SELECT ${COLS} FROM lab_patients p WHERE p.is_active = 1 ORDER BY p.patient_code`);
  res.json(r.recordset);
}));

router.get('/:id', h(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, Number(req.params.id)).query(`SELECT ${COLS} FROM lab_patients p WHERE p.patient_id=@id`);
  if (!r.recordset[0]) throw notFound('Patient');
  res.json(r.recordset[0]);
}));

router.post('/', requireAccess('lab.patients'), h(async (req, res) => {
  const p = parsePatient(req.body || {});
  const out = await withTx((tx) => insertPatient(tx, p));
  res.status(201).json(out);
}));

router.put('/:id', requireAccess('lab.patients'), h(async (req, res) => {
  const p = parsePatient(req.body || {});
  const id = Number(req.params.id);
  await withTx(async (tx) => {
    // A patient registered in Clinic may have no Patient ID yet: Lab gives it the next one.
    if (!p.patient_code) {
      const cur = await tx.request().input('id', sql.Int, id).query('SELECT PatientCode FROM Patient WHERE PatientId=@id');
      if (!cur.recordset[0]) throw notFound('Patient');
      if (cur.recordset[0].PatientCode) throw bad('Patient ID is required');
      p.patient_code = await nextPatientCode(tx);
    }
    const r = await bind(tx.request().input('id', sql.Int, id), p).query(`
      UPDATE Patient SET PatientCode=@code, Name=@name, Gender=@gender, DateOfBirth=@dob, Age=@age, MobileNo=@phone,
        Email=@email, Address=@addr, ReferredBy=@ref, RegistrationDate=@reg, UpdatedAt=GETDATE()
      WHERE PatientId=@id`);
    if (!r.rowsAffected[0]) throw notFound('Patient');
  });
  res.json({ ok: true });
}));

router.delete('/:id', adminOnly, h(async (req, res) => {
  const id = Number(req.params.id);
  const pool = await getPool();
  const used = await pool.request().input('id', sql.Int, id).query('SELECT COUNT(*) AS n FROM test_assignments WHERE patient_id=@id');
  if (used.recordset[0].n) {
    return res.status(409).json({ error: `This patient has ${used.recordset[0].n} test assignment(s) and cannot be deleted` });
  }
  const r = await pool.request().input('id', sql.Int, id).query('DELETE FROM Patient WHERE PatientId=@id');
  if (!r.rowsAffected[0]) throw notFound('Patient');
  res.json({ ok: true });
}));

// Import: duplicates (same Patient ID, or same name + date of birth, in the
// database or earlier in the file) are skipped and reported, never merged.
router.post('/import', requireAccess('lab.patients'), h(async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows || !rows.length) throw bad('The file has no data rows');
  if (rows.length > 20000) throw bad('Import at most 20,000 rows at a time');
  const pool = await getPool();
  const existing = (await pool.request().query('SELECT patient_code, full_name, date_of_birth FROM lab_patients')).recordset;
  const codes = new Set(existing.filter((e) => e.patient_code).map((e) => e.patient_code.toUpperCase()));
  const nameDob = new Set(existing.filter((e) => e.date_of_birth)
    .map((e) => `${e.full_name.toLowerCase()}|${e.date_of_birth.toISOString().slice(0, 10)}`));

  let created = 0;
  const duplicates = [];
  const invalid = [];
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNo = raw.row || i + 2;
    let p;
    try {
      p = parsePatient(raw);
    } catch (e) {
      invalid.push({ row: rowNo, name: raw.full_name || '', reason: e.message });
      continue;
    }
    const nd = p.date_of_birth ? `${p.full_name.toLowerCase()}|${p.date_of_birth}` : null;
    if (p.patient_code && codes.has(p.patient_code.toUpperCase())) {
      duplicates.push({ row: rowNo, name: p.full_name, reason: `Patient ID ${p.patient_code} already exists` });
      continue;
    }
    if (nd && nameDob.has(nd)) {
      duplicates.push({ row: rowNo, name: p.full_name, reason: 'Same name and date of birth already exists' });
      continue;
    }
    try {
      const out = await withTx((tx) => insertPatient(tx, p));
      codes.add(out.patient_code.toUpperCase());
      if (nd) nameDob.add(nd);
      created += 1;
    } catch (e) {
      invalid.push({ row: rowNo, name: p.full_name, reason: e.number === 2627 ? 'Duplicate Patient ID' : e.message });
    }
  }
  res.json({ created, duplicates, invalid });
}));

export default router;
