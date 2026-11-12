import { getPool, sql } from '../db/pool.js';

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const bad = (msg, extra) => new HttpError(400, msg, extra);
export const notFound = (what = 'Record') => new HttpError(404, `${what} not found`);

// Wraps an async route so thrown errors reach the error handler.
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Turns SQL Server constraint errors into readable messages.
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
  const n = err.number || err.originalError?.info?.number;
  const m = err.message || '';
  if (n === 2627 || n === 2601) {
    if (/test_master_code/.test(m)) return res.status(409).json({ error: 'That Test ID is already used' });
    if (/test_master_name/.test(m)) return res.status(409).json({ error: 'A test with that name already exists' });
    if (/test_components_name/.test(m)) return res.status(409).json({ error: 'Component names must be unique within a test' });
    if (/Patient_Code/.test(m)) return res.status(409).json({ error: 'That Patient ID is already used' });
    if (/AppUser_Username/.test(m)) return res.status(409).json({ error: 'That username is already taken' });
    if (/assignment_tests/.test(m)) return res.status(409).json({ error: 'A test can only be assigned once per assignment' });
    return res.status(409).json({ error: 'Duplicate record' });
  }
  if (n === 547) {
    if (/DELETE/.test(m)) return res.status(409).json({ error: 'This record is in use by other records and cannot be deleted' });
    return res.status(400).json({ error: 'The data failed a validation rule (amounts, dates or linked record)' });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error: ' + m });
}

export async function withTx(fn) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const out = await fn(tx);
    await tx.commit();
    return out;
  } catch (e) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    throw e;
  }
}

// Next code like P000001 / T0001 / LA000001. Locks the table range for the
// transaction so two saves can't pick the same number.
export async function nextCode(tx, table, column, prefix, width) {
  const r = await tx.request()
    .input('p', sql.NVarChar, prefix)
    .input('len', sql.Int, prefix.length + width)
    .query(`SELECT MAX(TRY_CAST(SUBSTRING(${column}, LEN(@p) + 1, 20) AS INT)) AS n
            FROM ${table} WITH (UPDLOCK, HOLDLOCK)
            WHERE ${column} LIKE @p + '%' AND LEN(${column}) = @len`);
  const n = (r.recordset[0].n || 0) + 1;
  return prefix + String(n).padStart(width, '0');
}

export const str = (v, max, label, { required = false } = {}) => {
  const s = v === null || v === undefined ? '' : String(v).trim();
  if (required && !s) throw bad(`${label} is required`);
  if (s.length > max) throw bad(`${label} must be ${max} characters or fewer`);
  return s || null;
};

export function dateOnly(v, label, { required = false } = {}) {
  if (v === null || v === undefined || v === '') {
    if (required) throw bad(`${label} is required`);
    return null;
  }
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00Z'))) throw bad(`${label} must be a valid date`);
  return s;
}

export function money(v, label) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) throw bad(`${label} must be a number`);
  if (n < 0) throw bad(`${label} cannot be negative`);
  if (n > 9999999999) throw bad(`${label} is too large`);
  return Math.round(n * 100) / 100;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function ageFrom(dob, on = today()) {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = on.split('-').map(Number);
  let a = ty - y;
  if (tm < m || (tm === m && td < d)) a -= 1;
  return a;
}

export const STATUSES = ['Pending', 'Sample Collected', 'In Progress', 'Completed'];

// Assignment status follows its tests: all done -> Completed; any started ->
// In Progress; any sample taken -> Sample Collected; otherwise Pending.
export async function refreshAssignmentStatus(tx, assignmentId) {
  await tx.request().input('id', sql.Int, assignmentId).query(`
    UPDATE test_assignments SET updated_at = SYSDATETIME(), status =
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM assignment_tests WHERE assignment_id = @id) THEN 'Pending'
        WHEN NOT EXISTS (SELECT 1 FROM assignment_tests WHERE assignment_id = @id AND status <> 'Completed') THEN 'Completed'
        WHEN EXISTS (SELECT 1 FROM assignment_tests WHERE assignment_id = @id AND status IN ('In Progress','Completed')) THEN 'In Progress'
        WHEN EXISTS (SELECT 1 FROM assignment_tests WHERE assignment_id = @id AND status = 'Sample Collected') THEN 'Sample Collected'
        ELSE 'Pending' END
    WHERE assignment_id = @id`);
}
