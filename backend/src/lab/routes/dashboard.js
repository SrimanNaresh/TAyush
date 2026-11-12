import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { h } from '../helpers.js';

const router = Router();

router.get('/', h(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM Patient) AS patients,
      (SELECT COUNT(*) FROM Patient WHERE RegistrationDate = CAST(GETDATE() AS DATE)) AS patients_today,
      (SELECT COUNT(*) FROM test_master) AS tests,
      (SELECT COUNT(*) FROM test_assignments WHERE assignment_date = CAST(GETDATE() AS DATE)) AS assignments_today,
      (SELECT COUNT(*) FROM test_assignments WHERE status = 'Pending') AS pending,
      (SELECT COUNT(*) FROM test_assignments WHERE status = 'Sample Collected') AS sample_collected,
      (SELECT COUNT(*) FROM test_assignments WHERE status = 'In Progress') AS in_progress,
      (SELECT COUNT(*) FROM test_assignments WHERE status = 'Completed') AS completed,
      (SELECT ISNULL(SUM(net_amount), 0) FROM test_assignments WHERE assignment_date = CAST(GETDATE() AS DATE)) AS amount_today;
    SELECT TOP (8) a.assignment_id, a.assignment_no, a.assignment_date, a.status, a.net_amount, p.full_name, p.patient_code
    FROM test_assignments a JOIN lab_patients p ON p.patient_id = a.patient_id
    WHERE a.status <> 'Completed' ORDER BY a.assignment_id DESC;`);
  res.json({ counts: r.recordsets[0][0], open: r.recordsets[1] });
}));

export default router;
