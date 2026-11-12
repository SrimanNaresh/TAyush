import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { adminOnly, requireAccess } from '../../middleware/auth.js';
import { h, str, bad } from '../helpers.js';

const router = Router();

router.get('/', h(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().query('SELECT lab_name, address, phone, email, report_footer FROM lab_settings WHERE setting_id = 1');
  res.json(r.recordset[0] || { lab_name: 'Ayush Lab' });
}));

router.put('/', adminOnly, h(async (req, res) => {
  const b = req.body || {};
  const email = str(b.email, 150, 'Email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Email is not valid');
  const pool = await getPool();
  await pool.request()
    .input('n', sql.NVarChar, str(b.lab_name, 150, 'Lab name', { required: true }))
    .input('a', sql.NVarChar, str(b.address, 400, 'Address'))
    .input('p', sql.NVarChar, str(b.phone, 50, 'Phone'))
    .input('e', sql.NVarChar, email)
    .input('f', sql.NVarChar, str(b.report_footer, 400, 'Report footer'))
    .query(`MERGE lab_settings AS t USING (SELECT 1 AS id) s ON t.setting_id = s.id
            WHEN MATCHED THEN UPDATE SET lab_name=@n, address=@a, phone=@p, email=@e, report_footer=@f, updated_at=SYSDATETIME()
            WHEN NOT MATCHED THEN INSERT (setting_id, lab_name, address, phone, email, report_footer) VALUES (1,@n,@a,@p,@e,@f);`);
  res.json({ ok: true });
}));

export default router;
