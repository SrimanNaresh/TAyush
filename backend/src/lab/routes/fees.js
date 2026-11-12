import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { adminOnly, requireAccess } from '../../middleware/auth.js';
import { h, bad, money, dateOnly, withTx, today } from '../helpers.js';

const router = Router();

router.get('/', h(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT t.test_id, t.test_code, t.test_name,
           ISNULL(f.fee_amount, 0) AS fee_amount, ISNULL(f.discount_amount, 0) AS discount_amount,
           ISNULL(f.net_amount, 0) AS net_amount, f.effective_date, f.updated_at, CAST(CASE WHEN f.fee_id IS NULL THEN 1 ELSE 0 END AS BIT) AS missing
    FROM test_master t LEFT JOIN test_fees f ON f.test_id = t.test_id
    ORDER BY t.test_name`);
  res.json(r.recordset);
}));

// Adds a fee row (0 / 0, today) for any test that doesn't have one yet.
router.post('/sync', adminOnly, h(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().input('d', sql.Date, today()).query(`
    INSERT INTO test_fees (test_id, fee_amount, discount_amount, effective_date)
    SELECT t.test_id, 0, 0, @d FROM test_master t WHERE NOT EXISTS (SELECT 1 FROM test_fees f WHERE f.test_id = t.test_id)`);
  res.json({ added: r.rowsAffected[0] || 0 });
}));

router.put('/', adminOnly, h(async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) throw bad('Nothing to save');
  const errors = [];
  const clean = rows.map((r) => {
    try {
      const fee = money(r.fee_amount, 'Fee');
      const disc = money(r.discount_amount, 'Discount');
      if (disc > fee) throw bad('Discount cannot be more than the fee');
      return { test_id: Number(r.test_id), fee, disc, eff: dateOnly(r.effective_date, 'Effective date', { required: true }) };
    } catch (e) {
      errors.push({ test_id: r.test_id, error: e.message });
      return null;
    }
  });
  if (errors.length) throw bad('Some rows are not valid', { errors });
  await withTx(async (tx) => {
    for (const r of clean) {
      await tx.request().input('t', sql.Int, r.test_id).input('f', sql.Decimal(12, 2), r.fee)
        .input('d', sql.Decimal(12, 2), r.disc).input('e', sql.Date, r.eff)
        .query(`MERGE test_fees AS x USING (SELECT @t AS test_id) s ON x.test_id = s.test_id
                WHEN MATCHED THEN UPDATE SET fee_amount=@f, discount_amount=@d, effective_date=@e, updated_at=SYSDATETIME()
                WHEN NOT MATCHED THEN INSERT (test_id, fee_amount, discount_amount, effective_date) VALUES (@t,@f,@d,@e);`);
    }
  });
  res.json({ saved: clean.length });
}));

export default router;
