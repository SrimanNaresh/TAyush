import { verifyToken } from '../utils/jwt.js';
import { getPool, sql } from '../db/pool.js';

// Every protected request re-reads the user (as Lab did), so a switched-off
// login or a role change takes effect at once rather than at token expiry.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
  try {
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, payload.userId)
      .query('SELECT UserId, Username, FullName, Role, IsActive, LinkedPatientId, IsSuperAdmin FROM AppUser WHERE UserId = @id');
    const u = r.recordset[0];
    if (!u || !u.IsActive) return res.status(401).json({ error: 'Your login is not active' });
    req.user = { userId: u.UserId, username: u.Username, fullName: u.FullName, role: u.Role, linkedPatientId: u.LinkedPatientId, isSuperAdmin: !!u.IsSuperAdmin };
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function superAdminOnly(req, res, next) {
  if (!req.user?.isSuperAdmin) return res.status(403).json({ error: 'Only a Super Admin can do this' });
  next();
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'Admin') return res.status(403).json({ error: 'Only an Admin can do this' });
  next();
}

// Allowed when the login is Admin or has one of the given Menu Access keys at
// the given level ('Full' to change data, 'View' also accepts Full).
async function hasAccess(user, keys, level) {
  if (user?.role === 'Admin') return true;
  if (!user?.userId) return false;
  const levels = level === 'View' ? ['Full', 'View'] : ['Full'];
  const pool = await getPool();
  const r = await pool.request().input('u', sql.Int, user.userId).query('SELECT MenuKey, AccessLevel FROM MenuAccess WHERE UserId = @u');
  return r.recordset.some((row) => keys.includes(row.MenuKey) && levels.includes(row.AccessLevel));
}

export function requireAccess(keys, level = 'Full') {
  const list = Array.isArray(keys) ? keys : [keys];
  return async (req, res, next) => {
    try {
      if (await hasAccess(req.user, list, level)) return next();
      res.status(403).json({ error: 'Your login does not have access to do this' });
    } catch (err) {
      next(err);
    }
  };
}
