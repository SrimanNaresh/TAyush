import { Router } from 'express';
import { getPool } from '../../db/pool.js';

export const DEFAULT_APP_NAME = 'Ayush All In One';

export async function readAppName() {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT TOP 1 AppName FROM ClinicDetails WHERE ClinicId = 1');
    return result.recordset[0]?.AppName?.trim() || DEFAULT_APP_NAME;
  } catch {
    return DEFAULT_APP_NAME; // DB not reachable: the login page still needs a name
  }
}

const router = Router();

// Public: the login page shows the software name before anyone signs in.
router.get('/app-info', async (req, res) => {
  res.json({ appName: await readAppName() });
});

export default router;
