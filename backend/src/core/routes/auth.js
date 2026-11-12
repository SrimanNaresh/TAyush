import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { verifyPassword, hashPassword } from '../../utils/password.js';
import { signToken } from '../../utils/jwt.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

const toPayload = (u) => ({
  userId: u.UserId,
  username: u.Username,
  fullName: u.FullName || null,
  role: u.Role,
  linkedPatientId: u.LinkedPatientId || null,
  isSuperAdmin: !!u.IsSuperAdmin,
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
    const pool = await getPool();
    const result = await pool
      .request()
      .input('u', sql.NVarChar, username.trim())
      .query('SELECT UserId, Username, FullName, PasswordHash, IsActive, Role, LinkedPatientId, IsSuperAdmin FROM AppUser WHERE Username = @u');
    const user = result.recordset[0];
    if (!user || !user.IsActive || !verifyPassword(password, user.PasswordHash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const payload = toPayload(user);
    res.json({ token: signToken(payload), user: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const { userId, username, fullName, role, linkedPatientId, isSuperAdmin } = req.user;
  res.json({ userId, username, fullName, role, linkedPatientId, isSuperAdmin });
});

// Any signed-in login changes its own password (from Lab's change-password).
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
    if (String(newPassword).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, req.user.userId).query('SELECT PasswordHash FROM AppUser WHERE UserId = @id');
    if (!r.recordset[0] || !verifyPassword(currentPassword, r.recordset[0].PasswordHash)) {
      return res.status(400).json({ error: 'Current password is not correct' });
    }
    await pool.request().input('id', sql.Int, req.user.userId).input('h', sql.NVarChar, hashPassword(newPassword))
      .query('UPDATE AppUser SET PasswordHash = @h WHERE UserId = @id');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
