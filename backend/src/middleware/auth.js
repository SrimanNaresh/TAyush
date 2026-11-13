import { verifyToken } from '../utils/jwt.js';
import { getPool, sql } from '../db/pool.js';

// The database is on another machine, so each lookup costs a network round
// trip. The login row and its Menu Access rows are kept in memory for a short
// time instead of being re-read on every request. Any change made through
// Users or Menu Access clears the cache at once (clearAuthCache), so a
// switched-off login or a role/access change still applies immediately; a
// change made straight in the database applies within CACHE_MS.
const CACHE_MS = 60 * 1000;
const userCache = new Map();   // userId -> { at, user }
const accessCache = new Map(); // userId -> { at, rows }

function fresh(entry) {
  return entry && Date.now() - entry.at < CACHE_MS;
}

export function clearAuthCache() {
  userCache.clear();
  accessCache.clear();
}

async function loadUser(userId) {
  const hit = userCache.get(userId);
  if (fresh(hit)) return hit.user;
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, userId)
    .query('SELECT UserId, Username, FullName, Role, IsActive, LinkedPatientId, IsSuperAdmin FROM AppUser WHERE UserId = @id');
  const user = r.recordset[0] || null;
  userCache.set(userId, { at: Date.now(), user });
  return user;
}

async function loadAccess(userId) {
  const hit = accessCache.get(userId);
  if (fresh(hit)) return hit.rows;
  const pool = await getPool();
  const r = await pool.request().input('u', sql.Int, userId).query('SELECT MenuKey, AccessLevel FROM MenuAccess WHERE UserId = @u');
  accessCache.set(userId, { at: Date.now(), rows: r.recordset });
  return r.recordset;
}

// Every protected request checks the user is still active (from the short
// cache above), so a switched-off login stops working straight away.
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
    const u = await loadUser(payload.userId);
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
  const rows = await loadAccess(user.userId);
  return rows.some((row) => keys.includes(row.MenuKey) && levels.includes(row.AccessLevel));
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
