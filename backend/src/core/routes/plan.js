import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { superAdminOnly } from '../../middleware/auth.js';

const router = Router();

// Plan and validity of this installation (one row). Every signed-in login may
// read it (the app shows a warning banner near / after expiry); only a Super
// Admin changes it. status: 'none' | 'active' | 'expiring' (<= 15 days) | 'expired'.
export const WARN_DAYS = 15;

// Main menus a plan can include (Menu Rights). Dashboard and Configuration are
// always on, so the app can never lock its own settings away.
export const PLAN_MODULES = ['Registration', 'Clinic', 'Pharmacy', 'Lab', 'Billing', 'Reports'];
export const ALWAYS_ON = ['Dashboard', 'Configuration'];

function readModules(raw) {
  if (!raw) return null;
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((m) => PLAN_MODULES.includes(m)) : null;
  } catch {
    return null;
  }
}

function shape(row) {
  if (!row) return { planName: null, startDate: null, validUntil: null, notes: null, modules: null, allModules: PLAN_MODULES, alwaysOn: ALWAYS_ON, daysLeft: null, status: 'none', warnDays: WARN_DAYS };
  let daysLeft = null;
  let status = 'active';
  if (row.ValidUntil) {
    const end = new Date(row.ValidUntil);
    const today = new Date();
    const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    daysLeft = Math.round((e - t) / 86400000);
    status = daysLeft < 0 ? 'expired' : daysLeft <= WARN_DAYS ? 'expiring' : 'active';
  }
  return {
    planName: row.PlanName,
    startDate: row.StartDate,
    validUntil: row.ValidUntil,
    notes: row.Notes,
    // null = every menu is included
    modules: readModules(row.Modules),
    allModules: PLAN_MODULES,
    alwaysOn: ALWAYS_ON,
    updatedAt: row.UpdatedAt,
    updatedBy: row.UpdatedBy,
    daysLeft,
    status,
    warnDays: WARN_DAYS,
  };
}

router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT TOP 1 * FROM Subscription WHERE Id = 1');
    res.json(shape(r.recordset[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));

router.put('/', superAdminOnly, async (req, res) => {
  try {
    const { planName, startDate, validUntil, notes, modules } = req.body || {};
    if (modules != null && (!Array.isArray(modules) || modules.some((m) => !PLAN_MODULES.includes(m)))) {
      return res.status(400).json({ error: 'Menu Rights has an unknown menu' });
    }
    if (!String(planName || '').trim()) return res.status(400).json({ error: 'Plan name is required' });
    if (String(planName).trim().length > 100) return res.status(400).json({ error: 'Plan name must be at most 100 characters' });
    if (startDate && !isDate(startDate)) return res.status(400).json({ error: 'Start date is not valid' });
    if (!isDate(validUntil)) return res.status(400).json({ error: 'Valid until date is required' });
    if (startDate && validUntil < startDate) return res.status(400).json({ error: 'Valid until must be on or after the start date' });
    const pool = await getPool();
    const r = await pool.request()
      .input('name', sql.NVarChar, String(planName).trim())
      .input('start', sql.Date, startDate || null)
      .input('until', sql.Date, validUntil)
      .input('notes', sql.NVarChar, String(notes || '').trim().slice(0, 500) || null)
      .input('by', sql.NVarChar, req.user.username)
      // all menus ticked is stored as NULL (= every menu, including ones added later)
      .input('modules', sql.NVarChar, modules == null || modules.length === PLAN_MODULES.length ? null : JSON.stringify(modules))
      .query(`
        MERGE Subscription AS t USING (SELECT 1 AS Id) s ON t.Id = s.Id
        WHEN MATCHED THEN UPDATE SET PlanName=@name, StartDate=@start, ValidUntil=@until, Notes=@notes, Modules=@modules, UpdatedAt=GETDATE(), UpdatedBy=@by
        WHEN NOT MATCHED THEN INSERT (Id, PlanName, StartDate, ValidUntil, Notes, Modules, UpdatedBy) VALUES (1, @name, @start, @until, @notes, @modules, @by)
        OUTPUT INSERTED.*;`);
    res.json(shape(r.recordset[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Plan master (the list of plans to pick from) -------------------------
const cleanName = (v) => String(v || '').trim().replace(/\s+/g, ' ');

router.get('/plans', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT PlanId, Name FROM PlanMaster WHERE IsActive = 1 ORDER BY Name');
    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function nameTaken(pool, name, exceptId = null) {
  const r = await pool.request().input('n', sql.NVarChar, name).input('id', sql.Int, exceptId)
    .query('SELECT COUNT(*) AS n FROM PlanMaster WHERE IsActive = 1 AND LOWER(Name) = LOWER(@n) AND (@id IS NULL OR PlanId <> @id)');
  return r.recordset[0].n > 0;
}

router.post('/plans', superAdminOnly, async (req, res) => {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Plan name is required' });
    if (name.length > 100) return res.status(400).json({ error: 'Plan name must be at most 100 characters' });
    const pool = await getPool();
    if (await nameTaken(pool, name)) return res.status(409).json({ error: 'That plan already exists' });
    // A deleted plan with the same name comes back instead of a duplicate row.
    const r = await pool.request().input('n', sql.NVarChar, name).query(`
      IF EXISTS (SELECT 1 FROM PlanMaster WHERE LOWER(Name) = LOWER(@n))
        UPDATE PlanMaster SET IsActive = 1, Name = @n OUTPUT INSERTED.PlanId, INSERTED.Name WHERE LOWER(Name) = LOWER(@n)
      ELSE
        INSERT INTO PlanMaster (Name) OUTPUT INSERTED.PlanId, INSERTED.Name VALUES (@n)`);
    res.status(201).json(r.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Renaming a plan also renames it on the Validity record if it is the current one.
router.put('/plans/:id', superAdminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Plan name is required' });
    if (name.length > 100) return res.status(400).json({ error: 'Plan name must be at most 100 characters' });
    const pool = await getPool();
    if (await nameTaken(pool, name, id)) return res.status(409).json({ error: 'That plan already exists' });
    const old = await pool.request().input('id', sql.Int, id).query('SELECT Name FROM PlanMaster WHERE PlanId = @id AND IsActive = 1');
    if (!old.recordset[0]) return res.status(404).json({ error: 'Plan not found' });
    const r = await pool.request().input('id', sql.Int, id).input('n', sql.NVarChar, name).input('old', sql.NVarChar, old.recordset[0].Name)
      .query(`UPDATE PlanMaster SET Name = @n OUTPUT INSERTED.PlanId, INSERTED.Name WHERE PlanId = @id;
              UPDATE Subscription SET PlanName = @n WHERE Id = 1 AND PlanName = @old;`);
    res.json(r.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete hides the plan; the plan in use on the Validity record can't be deleted.
router.delete('/plans/:id', superAdminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, id).query(`
      SELECT p.Name, CASE WHEN s.Id IS NULL THEN 0 ELSE 1 END AS InUse
      FROM PlanMaster p LEFT JOIN Subscription s ON s.Id = 1 AND s.PlanName = p.Name
      WHERE p.PlanId = @id AND p.IsActive = 1`);
    const row = r.recordset[0];
    if (!row) return res.status(404).json({ error: 'Plan not found' });
    if (row.InUse) return res.status(409).json({ error: `${row.Name} is the current plan on Validity — pick another plan first` });
    await pool.request().input('id', sql.Int, id).query('UPDATE PlanMaster SET IsActive = 0 WHERE PlanId = @id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
