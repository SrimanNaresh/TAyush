import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { adminOnly, requireAccess } from '../../middleware/auth.js';
import { h, bad, notFound, str, dateOnly, withTx, nextCode, today, STATUSES, refreshAssignmentStatus } from '../helpers.js';

const router = Router();

// Lab staff who may change a test's status (source: any lab login).
const STATUS_KEYS = ['lab.assignment-new', 'lab.assignment-list', 'lab.results'];

router.get('/', h(async (req, res) => {
  const pool = await getPool();
  const search = String(req.query.search || '').trim();
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const patientId = Number(req.query.patient_id) || null;
  const r = await pool.request()
    .input('s', sql.NVarChar, `%${search}%`).input('st', sql.NVarChar, status).input('pid', sql.Int, patientId)
    .query(`
      SELECT TOP (500) a.assignment_id, a.assignment_no, a.assignment_date, a.status, a.total_fee, a.total_discount, a.net_amount,
             p.patient_id, p.patient_code, p.full_name, p.phone,
             (SELECT COUNT(*) FROM assignment_tests x WHERE x.assignment_id = a.assignment_id) AS test_count,
             (SELECT STRING_AGG(x.test_name, ', ') FROM assignment_tests x WHERE x.assignment_id = a.assignment_id) AS test_names,
             r.status AS result_status
      FROM test_assignments a
      JOIN lab_patients p ON p.patient_id = a.patient_id
      LEFT JOIN patient_results r ON r.assignment_id = a.assignment_id
      WHERE (@st IS NULL OR a.status = @st) AND (@pid IS NULL OR a.patient_id = @pid)
        AND (@s = '%%' OR a.assignment_no LIKE @s OR p.patient_code LIKE @s OR p.full_name LIKE @s OR p.phone LIKE @s)
      ORDER BY a.assignment_id DESC`);
  res.json(r.recordset);
}));

export async function loadAssignment(q, id) {
  const a = await q.request().input('id', sql.Int, id).query(`
    SELECT a.assignment_id, a.assignment_no, a.assignment_date, a.status, a.total_fee, a.total_discount, a.net_amount, a.notes,
           a.created_at, COALESCE(u.FullName, u.Username) AS created_by_name,
           p.patient_id, p.patient_code, p.full_name, p.gender, p.date_of_birth, p.age, p.phone, p.email, p.address, p.referred_by,
           r.result_id, r.status AS result_status, r.completed_at
    FROM test_assignments a
    JOIN lab_patients p ON p.patient_id = a.patient_id
    LEFT JOIN AppUser u ON u.UserId = a.created_by
    LEFT JOIN patient_results r ON r.assignment_id = a.assignment_id
    WHERE a.assignment_id = @id`);
  if (!a.recordset[0]) throw notFound('Assignment');
  const t = await q.request().input('id', sql.Int, id).query(`
    SELECT x.assignment_test_id, x.test_id, x.test_code, x.test_name, x.fee_amount, x.discount_amount, x.net_amount, x.status,
           (SELECT COUNT(*) FROM result_values v WHERE v.assignment_test_id = x.assignment_test_id) AS value_count
    FROM assignment_tests x WHERE x.assignment_id = @id ORDER BY x.assignment_test_id`);
  return { ...a.recordset[0], tests: t.recordset };
}

router.get('/:id', h(async (req, res) => {
  res.json(await loadAssignment(await getPool(), Number(req.params.id)));
}));

function parseTestIds(v) {
  const ids = [...new Set((Array.isArray(v) ? v : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) throw bad('Select at least one test');
  if (ids.length > 200) throw bad('Too many tests in one assignment');
  return ids;
}

// Prices always come from Test Fee Master on the server, never from the browser.
async function addTests(tx, assignmentId, testIds) {
  for (const testId of testIds) {
    const r = await tx.request().input('a', sql.Int, assignmentId).input('t', sql.Int, testId).query(`
      INSERT INTO assignment_tests (assignment_id, test_id, test_code, test_name, fee_amount, discount_amount)
      SELECT @a, t.test_id, t.test_code, t.test_name, ISNULL(f.fee_amount, 0), ISNULL(f.discount_amount, 0)
      FROM test_master t LEFT JOIN test_fees f ON f.test_id = t.test_id WHERE t.test_id = @t`);
    if (!r.rowsAffected[0]) throw bad(`Test #${testId} no longer exists`);
  }
}

async function refreshTotals(tx, id) {
  await tx.request().input('id', sql.Int, id).query(`
    UPDATE a SET total_fee = ISNULL(s.fee, 0), total_discount = ISNULL(s.disc, 0), updated_at = SYSDATETIME()
    FROM test_assignments a
    OUTER APPLY (SELECT SUM(fee_amount) AS fee, SUM(discount_amount) AS disc FROM assignment_tests WHERE assignment_id = a.assignment_id) s
    WHERE a.assignment_id = @id`);
  await refreshAssignmentStatus(tx, id);
}

router.post('/', requireAccess('lab.assignment-new'), h(async (req, res) => {
  const b = req.body || {};
  const patientId = Number(b.patient_id);
  if (!patientId) throw bad('Select a patient');
  const testIds = parseTestIds(b.test_ids);
  const date = dateOnly(b.assignment_date, 'Assignment date') || today();
  const notes = str(b.notes, 400, 'Notes');
  const out = await withTx(async (tx) => {
    const p = await tx.request().input('p', sql.Int, patientId).query('SELECT PatientId FROM Patient WHERE PatientId=@p');
    if (!p.recordset[0]) throw bad('Patient not found');
    const no = await nextCode(tx, 'test_assignments', 'assignment_no', 'LA', 6);
    const r = await tx.request().input('no', sql.NVarChar, no).input('p', sql.Int, patientId).input('d', sql.Date, date)
      .input('n', sql.NVarChar, notes).input('u', sql.Int, req.user.userId)
      .query(`INSERT INTO test_assignments (assignment_no, patient_id, assignment_date, notes, created_by)
              OUTPUT INSERTED.assignment_id VALUES (@no, @p, @d, @n, @u)`);
    const id = r.recordset[0].assignment_id;
    await addTests(tx, id, testIds);
    await refreshTotals(tx, id);
    return { assignment_id: id, assignment_no: no };
  });
  res.status(201).json(out);
}));

// Edit date / notes / test list. Tests already kept keep their original price;
// a test can only be removed while it has no result values.
router.put('/:id', requireAccess('lab.assignment-new'), h(async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const testIds = parseTestIds(b.test_ids);
  const date = dateOnly(b.assignment_date, 'Assignment date', { required: true });
  const notes = str(b.notes, 400, 'Notes');
  await withTx(async (tx) => {
    const cur = await loadAssignment(tx, id);
    const removed = cur.tests.filter((t) => !testIds.includes(t.test_id));
    const blocked = removed.filter((t) => t.value_count > 0);
    if (blocked.length) throw bad(`Results are already entered for ${blocked.map((t) => t.test_name).join(', ')}; it cannot be removed`);
    for (const t of removed) {
      await tx.request().input('x', sql.Int, t.assignment_test_id).query('DELETE FROM assignment_tests WHERE assignment_test_id=@x');
    }
    const have = new Set(cur.tests.map((t) => t.test_id));
    await addTests(tx, id, testIds.filter((t) => !have.has(t)));
    await tx.request().input('id', sql.Int, id).input('d', sql.Date, date).input('n', sql.NVarChar, notes)
      .query('UPDATE test_assignments SET assignment_date=@d, notes=@n, updated_at=SYSDATETIME() WHERE assignment_id=@id');
    await refreshTotals(tx, id);
  });
  res.json({ ok: true });
}));

// Status of one test (Attendant / Assistant mark samples collected, work started ...).
router.patch('/:id/tests/:atId/status', requireAccess(STATUS_KEYS), h(async (req, res) => {
  const status = req.body?.status;
  if (!STATUSES.includes(status)) throw bad('Unknown status');
  if (status === 'Completed') throw bad('A test becomes Completed when its results are saved as completed');
  const id = Number(req.params.id);
  await withTx(async (tx) => {
    const r = await tx.request().input('a', sql.Int, id).input('x', sql.Int, Number(req.params.atId)).input('s', sql.NVarChar, status)
      .query('UPDATE assignment_tests SET status=@s, updated_at=SYSDATETIME() WHERE assignment_id=@a AND assignment_test_id=@x');
    if (!r.rowsAffected[0]) throw notFound('Assigned test');
    await refreshAssignmentStatus(tx, id);
  });
  res.json({ ok: true });
}));

// Set every not-yet-completed test of the assignment to one status (e.g. all samples collected).
router.patch('/:id/status', requireAccess(STATUS_KEYS), h(async (req, res) => {
  const status = req.body?.status;
  if (!['Pending', 'Sample Collected', 'In Progress'].includes(status)) throw bad('Status must be Pending, Sample Collected or In Progress');
  const id = Number(req.params.id);
  await withTx(async (tx) => {
    await tx.request().input('a', sql.Int, id).input('s', sql.NVarChar, status)
      .query("UPDATE assignment_tests SET status=@s, updated_at=SYSDATETIME() WHERE assignment_id=@a AND status <> 'Completed'");
    await refreshAssignmentStatus(tx, id);
  });
  res.json({ ok: true });
}));

router.delete('/:id', adminOnly, h(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, Number(req.params.id)).query('DELETE FROM test_assignments WHERE assignment_id=@id');
  if (!r.rowsAffected[0]) throw notFound('Assignment');
  res.json({ ok: true });
}));

export default router;
