import 'dotenv/config';
// Creates / upgrades every table in the app database (DB_NAME, T_AyushNew).
// Idempotent. Run with `npm run init-db`; the deploy script runs it each time.

import { getPool, sql } from './pool.js';
import { hashPassword } from '../utils/password.js';
import { coreSchema } from './schema/core.js';
import { labSchema, labViews } from './schema/lab.js';
import { pharmacySchema, pharmacyIndexes, seedPharmacy } from './schema/pharmacy.js';
import { clinicSchema } from './schema/clinic.js';
import { DEFAULT_APP_NAME } from '../core/routes/appInfo.js';



// Module schemas are added here in their phases (lab, pharmacy, clinic).
const SCHEMAS = [
  ['core', coreSchema],
  ['lab', labSchema],
  ['pharmacy', pharmacySchema],
  ['pharmacy indexes', pharmacyIndexes],
  ['clinic', clinicSchema],
];
const VIEWS = [...labViews];

async function init() {
  try {
    const pool = await getPool();
    for (const [name, batch] of SCHEMAS) {
      await pool.request().batch(batch);
      console.log(`Schema ready: ${name}`);
    }
    for (const v of VIEWS) await pool.request().batch(v);
    await seedPharmacy(pool, sql);

    // Lab report header (source default footer kept)
    await pool.request()
      .input('name', sql.NVarChar, process.env.LAB_NAME || 'Ayush Lab')
      .query(`IF NOT EXISTS (SELECT * FROM lab_settings WHERE setting_id = 1)
                INSERT INTO lab_settings (setting_id, lab_name, report_footer) VALUES (1, @name, 'This is a computer generated report.')`);

    await pool.request()
      .input('name', sql.NVarChar, DEFAULT_APP_NAME)
      .query(`IF NOT EXISTS (SELECT * FROM ClinicDetails WHERE ClinicId = 1)
                INSERT INTO ClinicDetails (ClinicId, Name, AppName) VALUES (1, @name, @name)`);

    // First Admin login. The password comes from .env, never from code.
    const exists = await pool.request().query("SELECT COUNT(*) AS n FROM AppUser WHERE Role = 'Admin'");
    if (exists.recordset[0].n === 0) {
      const password = process.env.ADMIN_INITIAL_PASSWORD;
      if (!password) throw new Error('ADMIN_INITIAL_PASSWORD is not set in .env');
      await pool.request()
        .input('u', sql.NVarChar, 'Admin')
        .input('p', sql.NVarChar, hashPassword(password))
        .query(`INSERT INTO AppUser (Username, FullName, PasswordHash, Role, IsActive) VALUES (@u, 'Administrator', @p, 'Admin', 1)`);
      console.log('Seeded first user: Admin (password from ADMIN_INITIAL_PASSWORD)');
    }

    // Super Admin logins are created on purpose (the software owner chose
    // 'Sriman', 2026-11-12); init-db never promotes anyone by itself.

    console.log('Database initialised:', process.env.DB_NAME);
    process.exit(0);
  } catch (err) {
    console.error('Schema init failed:', err.message);
    process.exit(1);
  }
}

init();
