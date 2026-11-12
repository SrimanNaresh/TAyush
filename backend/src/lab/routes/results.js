import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { adminOnly, requireAccess } from '../../middleware/auth.js';
import { h, bad, withTx, str, refreshAssignmentStatus } from '../helpers.js';
import { loadAssignment } from './assignments.js';

const router = Router();

// A patient's assignments, for the result-entry picker.
router.get('/patient/:patientId', h(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().input('p', sql.Int, Number(req.params.patientId)).query(`
    SELECT a.assignment_id, a.assignment_no, a.assignment_date, a.status, r.status AS result_status,
           (SELECT STRING_AGG(x.test_name, ', ') FROM assignment_tests x WHERE x.assignment_id = a.assignment_id) AS test_names
    FROM test_assignments a LEFT JOIN patient_results r ON r.assignment_id = a.assignment_id
    WHERE a.patient_id = @p ORDER BY a.assignment_id DESC`);
  res.json(r.recordset);
}));

// Assigned tests with their components (current Test Master) and any values
// already saved. Values whose component was later removed from the test are
// still listed, using the copy saved with the value.
async function loadEntry(q, assignmentId) {
  const a = await loadAssignment(q, assignmentId);
  const comps = await q.request().input('id', sql.Int, assignmentId).query(`
    SELECT x.assignment_test_id, x.test_id, x.test_name, x.status AS test_status,
           c.component_id, c.component_name, c.male_range, c.female_range, c.general_range, c.sort_order
    FROM assignment_tests x JOIN test_components c ON c.test_id = x.test_id
    WHERE x.assignment_id = @id
    ORDER BY x.assignment_test_id, c.sort_order, c.component_id`);
  const vals = a.result_id
    ? (await q.request().input('r', sql.Int, a.result_id).query(`
        SELECT value_id, assignment_test_id, test_id, component_id, test_name, component_name,
               male_range, female_range, general_range, result_value, sort_order
        FROM result_values WHERE result_id = @r`)).recordset
    : [];
  const rows = comps.recordset.map((c) => {
    const v = vals.find((x) => x.component_id === c.component_id && x.assignment_test_id === c.assignment_test_id);
    return { ...c, result_value: v?.result_value || '' };
  });
  for (const v of vals) {
    if (v.component_id === null || !rows.some((r) => r.component_id === v.component_id && r.assignment_test_id === v.assignment_test_id)) {
      const t = a.tests.find((x) => x.assignment_test_id === v.assignment_test_id);
      rows.push({ ...v, test_status: t?.status, orphan: true });
    }
  }
  return { assignment: a, rows };
}

router.get('/assignment/:id', h(async (req, res) => {
  res.json(await loadEntry(await getPool(), Number(req.params.id)));
}));

// Save values. Blank values are not stored. complete=true marks the result
// Completed and each test that has a value Completed; otherwise tests with
// values become In Progress.
router.put('/assignment/:id', requireAccess('lab.results'), h(async (req, res) => {
  const id = Number(req.params.id);
  const complete = req.body?.complete === true;
  const input = Array.isArray(req.body?.values) ? req.body.values : [];
  const out = await withTx(async (tx) => {
    const { assignment, rows } = await loadEntry(tx, id);
    const filled = [];
    for (const v of input) {
      const value = str(v.result_value, 200, 'Result');
      if (!value) continue;
      const row = rows.find((r) => r.assignment_test_id === Number(v.assignment_test_id)
        && (v.component_id ? r.component_id === Number(v.component_id) : r.value_id === Number(v.value_id)));
      if (!row) throw bad('A result row does not belong to this assignment; reload and try again');
      filled.push({ ...row, result_value: value });
    }
    if (complete && !filled.length) throw bad('Enter at least one result before completing');

    let resultId = assignment.result_id;
    if (!resultId) {
      const r = await tx.request().input('a', sql.Int, id).input('p', sql.Int, assignment.patient_id).input('u', sql.Int, req.user.userId)
        .query('INSERT INTO patient_results (assignment_id, patient_id, entered_by) OUTPUT INSERTED.result_id VALUES (@a, @p, @u)');
      resultId = r.recordset[0].result_id;
    }
    await tx.request().input('r', sql.Int, resultId).query('DELETE FROM result_values WHERE result_id = @r');
    for (const [i, v] of filled.entries()) {
      await tx.request().input('r', sql.Int, resultId).input('at', sql.Int, v.assignment_test_id).input('t', sql.Int, v.test_id)
        .input('c', sql.Int, v.component_id || null).input('tn', sql.NVarChar, v.test_name).input('cn', sql.NVarChar, v.component_name)
        .input('m', sql.NVarChar, v.male_range).input('f', sql.NVarChar, v.female_range).input('g', sql.NVarChar, v.general_range)
        .input('v', sql.NVarChar, v.result_value).input('s', sql.Int, i + 1)
        .query(`INSERT INTO result_values (result_id, assignment_test_id, test_id, component_id, test_name, component_name,
                  male_range, female_range, general_range, result_value, sort_order)
                VALUES (@r,@at,@t,@c,@tn,@cn,@m,@f,@g,@v,@s)`);
    }
    await tx.request().input('r', sql.Int, resultId).input('s', sql.NVarChar, complete ? 'Completed' : 'Draft').input('u', sql.Int, req.user.userId)
      .query(`UPDATE patient_results SET status=@s, entered_by=@u, updated_at=SYSDATETIME(),
              completed_at = CASE WHEN @s = 'Completed' THEN SYSDATETIME() ELSE NULL END WHERE result_id=@r`);

    const withValues = new Set(filled.map((v) => v.assignment_test_id));
    for (const t of assignment.tests) {
      let status = t.status;
      if (withValues.has(t.assignment_test_id)) status = complete ? 'Completed' : 'In Progress';
      else if (['In Progress', 'Completed'].includes(t.status)) status = 'Sample Collected';
      if (status !== t.status) {
        await tx.request().input('x', sql.Int, t.assignment_test_id).input('s', sql.NVarChar, status)
          .query('UPDATE assignment_tests SET status=@s, updated_at=SYSDATETIME() WHERE assignment_test_id=@x');
      }
    }
    await refreshAssignmentStatus(tx, id);
    return { result_id: resultId, status: complete ? 'Completed' : 'Draft', saved: filled.length };
  });
  res.json(out);
}));

// Printable report: only for completed results, only rows with a value.
router.get('/assignment/:id/report', h(async (req, res) => {
  const pool = await getPool();
  const a = await loadAssignment(pool, Number(req.params.id));
  if (a.result_status !== 'Completed') return res.status(409).json({ error: 'Results are not completed yet, so the report cannot be printed' });
  const v = await pool.request().input('r', sql.Int, a.result_id).query(`
    SELECT v.assignment_test_id, v.test_name, v.component_name, v.male_range, v.female_range, v.general_range, v.result_value
    FROM result_values v JOIN assignment_tests x ON x.assignment_test_id = v.assignment_test_id
    LEFT JOIN test_components c ON c.component_id = v.component_id
    WHERE v.result_id = @r AND LEN(LTRIM(v.result_value)) > 0
    ORDER BY x.assignment_test_id, ISNULL(c.sort_order, 9999), v.sort_order`);
  const s = await pool.request().query('SELECT lab_name, address, phone, email, report_footer FROM lab_settings WHERE setting_id = 1');
  const tests = [];
  for (const row of v.recordset) {
    let t = tests.find((x) => x.assignment_test_id === row.assignment_test_id);
    if (!t) { t = { assignment_test_id: row.assignment_test_id, test_name: row.test_name, components: [] }; tests.push(t); }
    t.components.push(row);
  }
  const { tests: _all, ...head } = a;
  res.json({ lab: s.recordset[0] || {}, assignment: head, tests });
}));

export default router;
