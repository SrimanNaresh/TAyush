// Creates or updates a Super Admin login (Role 'Admin' + IsSuperAdmin = 1).
// The password is read from the SUPERADMIN_PASSWORD environment variable for
// this one run (never stored in a file) and saved only as a hash.
//   SUPERADMIN_PASSWORD=... node scripts/setSuperAdmin.js <username> [full name]
import 'dotenv/config';
import { getPool, sql } from '../src/db/pool.js';
import { hashPassword } from '../src/utils/password.js';

const username = (process.argv[2] || '').trim();
const fullName = (process.argv[3] || username).trim();
const password = process.env.SUPERADMIN_PASSWORD || '';
if (!username || password.length < 6) {
  console.error('Usage: SUPERADMIN_PASSWORD=<at least 6 chars> node scripts/setSuperAdmin.js <username> [full name]');
  process.exit(1);
}

const pool = await getPool();
const r = await pool.request()
  .input('u', sql.NVarChar, username)
  .input('f', sql.NVarChar, fullName)
  .input('p', sql.NVarChar, hashPassword(password))
  .query(`
    MERGE AppUser AS t USING (SELECT @u AS Username) s ON t.Username = s.Username
    WHEN MATCHED THEN UPDATE SET PasswordHash=@p, Role='Admin', IsSuperAdmin=1, IsActive=1, FullName=COALESCE(t.FullName, @f)
    WHEN NOT MATCHED THEN INSERT (Username, FullName, PasswordHash, Role, IsActive, IsSuperAdmin) VALUES (@u, @f, @p, 'Admin', 1, 1)
    OUTPUT $action AS Action, INSERTED.UserId, INSERTED.Username, INSERTED.Role, INSERTED.IsSuperAdmin;`);
console.log(r.recordset[0]);
await pool.close();
