import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { adminOnly, requireAccess } from '../../middleware/auth.js';
import { h, bad, notFound, str, withTx, nextCode, today } from '../helpers.js';

const router = Router();

function parseComponents(list) {
  if (!Array.isArray(list) || !list.length) throw bad('Add at least one component');
  const seen = new Set();
  return list.map((c, i) => {
    const name = str(c.component_name, 200, `Component ${i + 1} name`, { required: true });
    const key = name.toLowerCase();
    if (seen.has(key)) throw bad(`Component "${name}" is listed twice`);
    seen.add(key);
    return {
      component_id: c.component_id ? Number(c.component_id) : null,
      component_name: name,
      male_range: str(c.male_range, 200, 'Male range'),
      female_range: str(c.female_range, 200, 'Female range'),
      general_range: str(c.general_range, 200, 'General range'),
      sort_order: i + 1,
    };
  });
}

function parseCode(v) {
  const code = str(v, 20, 'Test ID');
  if (code && !/^[A-Za-z0-9._/-]+$/.test(code)) throw bad('Test ID may contain letters, digits, dot, dash, slash and underscore only');
  return code;
}

router.get('/', h(async (req, res) => {
  const pool = await getPool();
  const search = String(req.query.search || '').trim();
  const r = await pool.request().input('s', sql.NVarChar, `%${search}%`).query(`
    SELECT t.test_id, t.test_code, t.test_name, t.updated_at,
           (SELECT COUNT(*) FROM test_components c WHERE c.test_id = t.test_id) AS component_count,
           f.fee_amount, f.discount_amount, f.net_amount
    FROM test_master t LEFT JOIN test_fees f ON f.test_id = t.test_id
    WHERE @s = '%%' OR t.test_code LIKE @s OR t.test_name LIKE @s
    ORDER BY t.test_name`);
  res.json(r.recordset);
}));

// Flat rows (one per component), the same shape as the import template.
router.get('/export', h(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT t.test_code, t.test_name, c.component_name, c.male_range, c.female_range, c.general_range
    FROM test_master t LEFT JOIN test_components c ON c.test_id = t.test_id
    ORDER BY t.test_name, c.sort_order, c.component_id`);
  res.json(r.recordset);
}));

async function loadTest(pool, id) {
  const t = await pool.request().input('id', sql.Int, id).query('SELECT test_id, test_code, test_name FROM test_master WHERE test_id = @id');
  if (!t.recordset[0]) throw notFound('Test');
  const c = await pool.request().input('id', sql.Int, id).query(
    'SELECT component_id, component_name, male_range, female_range, general_range, sort_order FROM test_components WHERE test_id = @id ORDER BY sort_order, component_id');
  return { ...t.recordset[0], components: c.recordset };
}

router.get('/:id', h(async (req, res) => {
  res.json(await loadTest(await getPool(), Number(req.params.id)));
}));

async function insertComponent(tx, testId, c) {
  await tx.request().input('t', sql.Int, testId).input('n', sql.NVarChar, c.component_name)
    .input('m', sql.NVarChar, c.male_range).input('f', sql.NVarChar, c.female_range)
    .input('g', sql.NVarChar, c.general_range).input('s', sql.Int, c.sort_order)
    .query('INSERT INTO test_components (test_id, component_name, male_range, female_range, general_range, sort_order) VALUES (@t,@n,@m,@f,@g,@s)');
}

export async function createTest(tx, code, name, components) {
  const test_code = code || (await nextCode(tx, 'test_master', 'test_code', 'T', 4));
  const r = await tx.request().input('c', sql.NVarChar, test_code).input('n', sql.NVarChar, name)
    .query('INSERT INTO test_master (test_code, test_name) OUTPUT INSERTED.test_id VALUES (@c, @n)');
  const testId = r.recordset[0].test_id;
  for (const c of components) await insertComponent(tx, testId, c);
  // Every test gets a fee row so it shows in Test Fee Master straight away.
  await tx.request().input('t', sql.Int, testId).input('d', sql.Date, today())
    .query('INSERT INTO test_fees (test_id, fee_amount, discount_amount, effective_date) VALUES (@t, 0, 0, @d)');
  return { test_id: testId, test_code };
}

router.post('/', adminOnly, h(async (req, res) => {
  const b = req.body || {};
  const code = parseCode(b.test_code);
  const name = str(b.test_name, 200, 'Test name', { required: true });
  const components = parseComponents(b.components);
  const out = await withTx((tx) => createTest(tx, code, name, components));
  res.status(201).json(out);
}));

router.put('/:id', adminOnly, h(async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const code = parseCode(b.test_code);
  if (!code) throw bad('Test ID is required');
  const name = str(b.test_name, 200, 'Test name', { required: true });
  const components = parseComponents(b.components);
  await withTx(async (tx) => {
    const u = await tx.request().input('id', sql.Int, id).input('c', sql.NVarChar, code).input('n', sql.NVarChar, name)
      .query('UPDATE test_master SET test_code=@c, test_name=@n, updated_at=SYSDATETIME() WHERE test_id=@id');
    if (!u.rowsAffected[0]) throw notFound('Test');
    const existing = await tx.request().input('id', sql.Int, id).query('SELECT component_id FROM test_components WHERE test_id=@id');
    const keep = new Set(components.filter((c) => c.component_id).map((c) => c.component_id));
    // Delete removed ones first so a renamed/re-added name doesn't clash with the unique index.
    for (const { component_id } of existing.recordset) {
      if (!keep.has(component_id)) {
        await tx.request().input('c', sql.Int, component_id).query('DELETE FROM test_components WHERE component_id=@c');
      }
    }
    // Park kept names on temporary values, then write the real ones (allows swapping names).
    await tx.request().input('id', sql.Int, id)
      .query("UPDATE test_components SET component_name = CONCAT('~tmp~', component_id) WHERE test_id=@id");
    const ids = new Set(existing.recordset.map((x) => x.component_id));
    for (const c of components) {
      if (c.component_id && ids.has(c.component_id)) {
        await tx.request().input('c', sql.Int, c.component_id).input('n', sql.NVarChar, c.component_name)
          .input('m', sql.NVarChar, c.male_range).input('f', sql.NVarChar, c.female_range)
          .input('g', sql.NVarChar, c.general_range).input('s', sql.Int, c.sort_order)
          .query(`UPDATE test_components SET component_name=@n, male_range=@m, female_range=@f, general_range=@g,
                  sort_order=@s, updated_at=SYSDATETIME() WHERE component_id=@c`);
      } else {
        await insertComponent(tx, id, c);
      }
    }
  });
  res.json({ ok: true });
}));

router.delete('/:id', adminOnly, h(async (req, res) => {
  const id = Number(req.params.id);
  const pool = await getPool();
  const used = await pool.request().input('id', sql.Int, id).query('SELECT COUNT(*) AS n FROM assignment_tests WHERE test_id=@id');
  if (used.recordset[0].n) {
    return res.status(409).json({ error: `This test is assigned to ${used.recordset[0].n} patient assignment(s) and cannot be deleted` });
  }
  const r = await pool.request().input('id', sql.Int, id).query('DELETE FROM test_master WHERE test_id=@id');
  if (!r.rowsAffected[0]) throw notFound('Test');
  res.json({ ok: true });
}));

// Import: rows = [{ row, test_code, test_name, component_name, male_range, female_range, general_range }].
// Rows are grouped by Test Name; each group becomes one test. Existing tests
// (matched by Test ID or name) get their components added/updated by name.
router.post('/import', adminOnly, h(async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows || !rows.length) throw bad('The file has no data rows');
  if (rows.length > 20000) throw bad('Import at most 20,000 rows at a time');

  const skipped = [];
  const groups = new Map();
  rows.forEach((raw, i) => {
    const rowNo = raw.row || i + 2;
    try {
      const test_name = str(raw.test_name, 200, 'Test Name', { required: true });
      const component_name = str(raw.component_name, 200, 'Component Name', { required: true });
      const item = {
        rowNo,
        test_code: parseCode(raw.test_code),
        test_name,
        component_name,
        male_range: str(raw.male_range, 200, 'Male Range'),
        female_range: str(raw.female_range, 200, 'Female Range'),
        general_range: str(raw.general_range, 200, 'General Range'),
      };
      const key = test_name.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    } catch (e) {
      skipped.push({ row: rowNo, test_name: raw.test_name || '', reason: e.message });
    }
  });

  let created = 0, updated = 0, componentsSaved = 0;
  const pool = await getPool();
  for (const items of groups.values()) {
    const name = items[0].test_name;
    const codes = [...new Set(items.map((x) => x.test_code).filter(Boolean).map((c) => c.toUpperCase()))];
    if (codes.length > 1) {
      items.forEach((x) => skipped.push({ row: x.rowNo, test_name: name, reason: `Rows for this test have different Test IDs (${codes.join(', ')})` }));
      continue;
    }
    const code = items.find((x) => x.test_code)?.test_code || null;
    // Drop repeated component names inside the file (first one wins).
    const seen = new Set();
    const comps = [];
    for (const x of items) {
      const k = x.component_name.toLowerCase();
      if (seen.has(k)) { skipped.push({ row: x.rowNo, test_name: name, reason: `Component "${x.component_name}" repeats earlier in the file` }); continue; }
      seen.add(k);
      comps.push({ ...x, sort_order: comps.length + 1 });
    }
    try {
      const byName = (await pool.request().input('n', sql.NVarChar, name).query('SELECT test_id, test_code FROM test_master WHERE test_name=@n')).recordset[0];
      const byCode = code ? (await pool.request().input('c', sql.NVarChar, code).query('SELECT test_id, test_name FROM test_master WHERE test_code=@c')).recordset[0] : null;
      if (byCode && (!byName || byCode.test_id !== byName.test_id)) {
        throw new Error(`Test ID ${code} already belongs to "${byCode.test_name}"`);
      }
      if (byName && code && byName.test_code.toUpperCase() !== code.toUpperCase()) {
        throw new Error(`"${name}" already exists with Test ID ${byName.test_code}`);
      }
      await withTx(async (tx) => {
        if (!byName) {
          await createTest(tx, code, name, comps);
          created += 1;
        } else {
          const existing = (await tx.request().input('t', sql.Int, byName.test_id)
            .query('SELECT component_id, component_name, sort_order FROM test_components WHERE test_id=@t')).recordset;
          let order = existing.reduce((m, c) => Math.max(m, c.sort_order), 0);
          for (const c of comps) {
            const match = existing.find((e) => e.component_name.toLowerCase() === c.component_name.toLowerCase());
            if (match) {
              await tx.request().input('c', sql.Int, match.component_id)
                .input('m', sql.NVarChar, c.male_range).input('f', sql.NVarChar, c.female_range).input('g', sql.NVarChar, c.general_range)
                .query('UPDATE test_components SET male_range=@m, female_range=@f, general_range=@g, updated_at=SYSDATETIME() WHERE component_id=@c');
            } else {
              order += 1;
              await insertComponent(tx, byName.test_id, { ...c, sort_order: order });
            }
          }
          await tx.request().input('t', sql.Int, byName.test_id).query('UPDATE test_master SET updated_at=SYSDATETIME() WHERE test_id=@t');
          updated += 1;
        }
      });
      componentsSaved += comps.length;
    } catch (e) {
      const reason = e.number === 2627 || e.number === 2601 ? 'Duplicate Test ID or name' : e.message;
      comps.forEach((x) => skipped.push({ row: x.rowNo, test_name: name, reason }));
    }
  }
  skipped.sort((a, b) => a.row - b.row);
  res.json({ created, updated, componentsSaved, skipped });
}));

export default router;
