import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { hashPassword } from '../../utils/password.js';
import { adminOnly, clearAuthCache } from '../../middleware/auth.js';

const router = Router();

// Any change to logins or their access clears the auth cache once it is saved.
router.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', clearAuthCache);
  next();
});

// One user list for Clinic, Pharmacy and Lab. What each login can open is set
// per page in Menu Access; the role only marks Admin (manages users/settings)
// and Patient (portal login locked to its LinkedPatientId).
export const ROLES = ['Admin', 'Doctor', 'Reception', 'Pharmacist', 'Lab', 'Staff', 'Patient'];
// 'Super Admin' is shown and chosen like a role but stored as Role 'Admin' +
// IsSuperAdmin = 1, so every Admin rule applies to it. Only a Super Admin can
// grant it, take it away, or change a Super Admin's login.
const SUPER = 'Super Admin';
const COLUMNS = "INSERTED.UserId, INSERTED.Username, INSERTED.FullName, INSERTED.IsActive, INSERTED.CreatedAt, CASE WHEN INSERTED.IsSuperAdmin = 1 THEN 'Super Admin' ELSE INSERTED.Role END AS Role, INSERTED.LinkedPatientId";

function readBody(body) {
  const { username, fullName, password, isActive = true, role = 'Staff', linkedPatientId } = body;
  const isSuperAdmin = role === SUPER;
  const effectiveRole = isSuperAdmin ? 'Admin' : ROLES.includes(role) ? role : 'Staff';
  return {
    isSuperAdmin,
    username: username?.trim() || '',
    fullName: fullName?.trim() || null,
    password,
    isActive: !!isActive,
    role: effectiveRole,
    linkedPatientId: effectiveRole === 'Patient' && linkedPatientId ? Number(linkedPatientId) : null,
  };
}

// List users (never the password hash). Optional ?search=
router.get('/', adminOnly, async (req, res) => {
  try {
    const { search = '' } = req.query;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('search', sql.NVarChar, `%${search}%`)
      .query(`
        SELECT u.UserId, u.Username, u.FullName, u.IsActive, u.CreatedAt,
               CASE WHEN u.IsSuperAdmin = 1 THEN 'Super Admin' ELSE u.Role END AS Role, u.LinkedPatientId, p.Name AS LinkedPatientName
        FROM AppUser u
        LEFT JOIN Patient p ON p.PatientId = u.LinkedPatientId
        WHERE (@search = '%%' OR u.Username LIKE @search OR u.FullName LIKE @search)
        ORDER BY u.UserId DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/roles', (req, res) => res.json(req.user?.isSuperAdmin ? [SUPER, ...ROLES] : ROLES));

router.post('/', adminOnly, async (req, res) => {
  try {
    const b = readBody(req.body);
    if (!b.username) return res.status(400).json({ error: 'Username is required' });
    if (!b.password) return res.status(400).json({ error: 'Password is required' });
    if (b.role === 'Patient' && !b.linkedPatientId) return res.status(400).json({ error: 'A linked patient is required for the Patient role' });
    if (b.isSuperAdmin && !req.user.isSuperAdmin) return res.status(403).json({ error: 'Only a Super Admin can create a Super Admin' });
    const pool = await getPool();
    const dupe = await pool.request().input('u', sql.NVarChar, b.username)
      .query('SELECT COUNT(*) AS n FROM AppUser WHERE Username = @u');
    if (dupe.recordset[0].n > 0) return res.status(409).json({ error: 'Username already exists' });
    const result = await pool.request()
      .input('u', sql.NVarChar, b.username)
      .input('fullName', sql.NVarChar, b.fullName)
      .input('p', sql.NVarChar, hashPassword(b.password))
      .input('active', sql.Bit, b.isActive ? 1 : 0)
      .input('role', sql.NVarChar, b.role)
      .input('patientId', sql.Int, b.linkedPatientId)
      .input('super', sql.Bit, b.isSuperAdmin ? 1 : 0)
      .query(`INSERT INTO AppUser (Username, FullName, PasswordHash, IsActive, Role, LinkedPatientId, IsSuperAdmin)
              OUTPUT ${COLUMNS} VALUES (@u, @fullName, @p, @active, @role, @patientId, @super)`);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Password is only changed when a new one is given.
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const b = readBody(req.body);
    if (!b.username) return res.status(400).json({ error: 'Username is required' });
    if (b.role === 'Patient' && !b.linkedPatientId) return res.status(400).json({ error: 'A linked patient is required for the Patient role' });
    const isSelf = Number(req.params.id) === Number(req.user.userId);
    if (isSelf && (b.role !== 'Admin' || !b.isActive)) return res.status(400).json({ error: 'You cannot remove Admin or switch off your own login' });
    if (isSelf && req.user.isSuperAdmin && !b.isSuperAdmin) return res.status(400).json({ error: 'You cannot remove Super Admin from your own login' });
    const pool = await getPool();
    const target = await pool.request().input('id', sql.Int, req.params.id).query('SELECT IsSuperAdmin FROM AppUser WHERE UserId = @id');
    if (!target.recordset[0]) return res.status(404).json({ error: 'User not found' });
    if ((target.recordset[0].IsSuperAdmin || b.isSuperAdmin) && !req.user.isSuperAdmin) {
      return res.status(403).json({ error: 'Only a Super Admin can change a Super Admin login' });
    }
    const dupe = await pool.request()
      .input('u', sql.NVarChar, b.username)
      .input('id', sql.Int, req.params.id)
      .query('SELECT COUNT(*) AS n FROM AppUser WHERE Username = @u AND UserId <> @id');
    if (dupe.recordset[0].n > 0) return res.status(409).json({ error: 'Username already exists' });
    const request = pool.request()
      .input('id', sql.Int, req.params.id)
      .input('u', sql.NVarChar, b.username)
      .input('fullName', sql.NVarChar, b.fullName)
      .input('active', sql.Bit, b.isActive ? 1 : 0)
      .input('role', sql.NVarChar, b.role)
      .input('patientId', sql.Int, b.linkedPatientId)
      .input('super', sql.Bit, b.isSuperAdmin ? 1 : 0);
    let query = 'UPDATE AppUser SET Username=@u, FullName=@fullName, IsActive=@active, Role=@role, LinkedPatientId=@patientId, IsSuperAdmin=@super';
    if (b.password && String(b.password).trim()) {
      request.input('p', sql.NVarChar, hashPassword(b.password));
      query += ', PasswordHash=@p';
    }
    query += ` OUTPUT ${COLUMNS} WHERE UserId=@id`;
    const result = await request.query(query);
    if (!result.recordset.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete (as in Pharmacy): the login is switched off, its history stays.
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    if (Number(req.params.id) === Number(req.user.userId)) return res.status(400).json({ error: 'You cannot delete your own login' });
    const pool = await getPool();
    const target = await pool.request().input('id', sql.Int, req.params.id).query('SELECT IsSuperAdmin FROM AppUser WHERE UserId = @id');
    if (target.recordset[0]?.IsSuperAdmin && !req.user.isSuperAdmin) return res.status(403).json({ error: 'Only a Super Admin can switch off a Super Admin login' });
    await pool.request().input('id', sql.Int, req.params.id).query('UPDATE AppUser SET IsActive = 0 WHERE UserId = @id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
