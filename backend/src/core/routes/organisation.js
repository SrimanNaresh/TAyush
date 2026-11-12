import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { adminOnly } from '../../middleware/auth.js';

const router = Router();

// The organisation's own details (one row, ClinicId = 1), shared by every
// module: printed on clinic prescriptions, pharmacy receipts and lab reports.
// AppName is the software name on the login page and browser tab.
// Module-specific print settings (clinic letter pad, lab report footer) get
// their own partial-update routes in their phases, so saving this form never
// blanks them.
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT TOP 1 * FROM ClinicDetails WHERE ClinicId = 1');
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', adminOnly, async (req, res) => {
  try {
    const { name, address, logo, email, contactNo, appName, doctorName } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name.trim())
      .input('address', sql.NVarChar, address?.trim() || null)
      .input('logo', sql.NVarChar(sql.MAX), logo || null)
      .input('email', sql.NVarChar, email?.trim() || null)
      .input('contactNo', sql.NVarChar, contactNo?.trim() || null)
      .input('appName', sql.NVarChar, appName?.trim() || null)
      .input('doctorName', sql.NVarChar, doctorName?.trim() || null)
      .query(`
        MERGE ClinicDetails AS target
        USING (SELECT 1 AS ClinicId) AS source ON target.ClinicId = source.ClinicId
        WHEN MATCHED THEN UPDATE SET Name=@name, Address=@address, Logo=@logo, Email=@email,
          ContactNo=@contactNo, AppName=@appName, DoctorName=@doctorName, UpdatedAt=GETDATE()
        WHEN NOT MATCHED THEN INSERT (ClinicId, Name, Address, Logo, Email, ContactNo, AppName, DoctorName)
          VALUES (1, @name, @address, @logo, @email, @contactNo, @appName, @doctorName)
        OUTPUT INSERTED.*;
      `);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
