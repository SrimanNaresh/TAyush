// Cross-module links (Phase 5), mounted at /api/links. Read-only: they only
// tell a receiving screen what to pre-fill; saving goes through that module's
// own API and rules.
import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { CURRENT_STOCK } from '../pharmacy/utils/stockEvents.js';
import { batchStock } from '../pharmacy/utils/batchStock.js';

const router = Router();
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// A prescription with its medicines matched to Pharmacy items and its lab
// tests matched to Lab Test Master entries (by name).
router.get('/prescription/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Bad prescription id' });
    const pool = await getPool();
    const head = await pool.request().input('id', sql.Int, id).query(`
      SELECT pr.PrescriptionId, pr.PatientId, pr.CreatedAt, pr.Diagnosis,
             p.Name AS PatientName, p.MobileNo, p.PatientCode
      FROM Prescription pr JOIN Patient p ON p.PatientId = pr.PatientId
      WHERE pr.PrescriptionId = @id`);
    const rx = head.recordset[0];
    if (!rx) return res.status(404).json({ error: 'Prescription not found' });

    const [items, tests, pharmacyItems, labTests] = await Promise.all([
      pool.request().input('id', sql.Int, id).query(`
        SELECT pi.MedicineName, pi.Dosage, pi.Frequency, pi.Duration, pi.Instructions, m.MedicineName AS MasterName
        FROM PrescriptionItem pi LEFT JOIN Medication m ON m.MedicationId = pi.MedicationId
        WHERE pi.PrescriptionId = @id ORDER BY pi.ItemId`),
      pool.request().input('id', sql.Int, id).query('SELECT TestId, TestName FROM PrescriptionLabTest WHERE PrescriptionId = @id'),
      pool.request().query('SELECT ItemId, Name FROM PharmacyItem WHERE IsActive = 1'),
      pool.request().query('SELECT test_id, test_code, test_name FROM test_master'),
    ]);

    const itemByName = new Map(pharmacyItems.recordset.map((i) => [norm(i.Name), i]));
    const testByName = new Map(labTests.recordset.map((t) => [norm(t.test_name), t]));
    const testById = new Map(labTests.recordset.map((t) => [t.test_id, t]));

    res.json({
      prescription: { PrescriptionId: rx.PrescriptionId, CreatedAt: rx.CreatedAt, Diagnosis: rx.Diagnosis },
      patient: { PatientId: rx.PatientId, Name: rx.PatientName, MobileNo: rx.MobileNo, PatientCode: rx.PatientCode },
      medicines: items.recordset.map((m) => {
        const name = m.MedicineName || m.MasterName || '';
        const hit = itemByName.get(norm(name)) || itemByName.get(norm(m.MasterName));
        return { name, dosage: m.Dosage, frequency: m.Frequency, duration: m.Duration, pharmacyItem: hit ? { ItemId: hit.ItemId, Name: hit.Name } : null };
      }),
      labTests: tests.recordset.map((t) => {
        // Prescriptions now store the Lab test_id; older ones are matched by name.
        const hit = testById.get(t.TestId) || testByName.get(norm(t.TestName));
        return { name: t.TestName, labTest: hit ? { test_id: hit.test_id, test_code: hit.test_code, test_name: hit.test_name } : null };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clinic's lab test list = Lab > Masters > Test Master (user decision
// 2026-11-12: the clinic's own LabTest table is no longer used). Shaped like
// the old clinic rows (TestId, TestName, IsActive) so clinic screens keep working.
router.get('/lab-tests', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const pool = await getPool();
    const r = await pool.request().input('s', sql.NVarChar, `%${search}%`).query(`
      SELECT t.test_id AS TestId, t.test_code AS TestCode, t.test_name AS TestName, CAST(1 AS BIT) AS IsActive,
             (SELECT COUNT(*) FROM test_components c WHERE c.test_id = t.test_id) AS ComponentCount,
             f.fee_amount AS Fee, f.discount_amount AS Discount, f.net_amount AS NetAmount
      FROM test_master t LEFT JOIN test_fees f ON f.test_id = t.test_id
      WHERE @s = '%%' OR t.test_code LIKE @s OR t.test_name LIKE @s
      ORDER BY t.test_name`);
    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clinic's medicine list = Pharmacy items received through Stock In (user
// decision 2026-11-12: the clinic Medication master is no longer used).
// One row per item: names, current stock (the Stock Report's sum), latest
// Stock In MRP and the nearest expiry among batches that still have stock.
// ?search= filters by name / generic; ?inStock=1 keeps only items with stock.
router.get('/medicines', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const pool = await getPool();
    const r = await pool.request()
      .input('s', sql.NVarChar, `%${search}%`)
      .input('itemId', sql.Int, null)
      .query(`
        SELECT i.ItemId, i.Name AS MedicineName, g.Name AS GenericName, m.Name AS Manufacturer,
               i.Category, i.Potency, i.Pack, u.Name AS Unit,
               ISNULL(st.CurrentStock, 0) AS Stock,
               last.MRP, last.InDate AS LastStockIn
        FROM PharmacyItem i
        CROSS APPLY (
          SELECT TOP 1 l.MRP, h.InDate
          FROM StockInItem l JOIN StockIn h ON h.StockInId = l.StockInId AND h.IsActive = 1
          WHERE l.ItemId = i.ItemId ORDER BY h.InDate DESC, l.LineId DESC
        ) last
        LEFT JOIN GenericNameMaster g ON g.GenericNameId = i.GenericNameId
        LEFT JOIN ManufacturerMaster m ON m.ManufacturerId = i.ManufacturerId
        LEFT JOIN UnitMaster u ON u.UnitId = i.UnitId
        LEFT JOIN (${CURRENT_STOCK}) st ON st.ItemId = i.ItemId
        WHERE i.IsActive = 1
          AND (@s = '%%' OR i.Name LIKE @s OR g.Name LIKE @s)
        ORDER BY i.Name`);
    let rows = r.recordset;
    if (req.query.inStock === '1') rows = rows.filter((x) => Number(x.Stock) > 0);
    const batches = await batchStock(pool.request(), rows.map((x) => x.ItemId));
    const nearest = new Map();
    for (const b of batches) {
      if (Number(b.AvailableQty) > 0 && b.ExpiryDate && !nearest.has(b.ItemId)) nearest.set(b.ItemId, b.ExpiryDate);
    }
    res.json(rows.map((x) => ({ ...x, NearestExpiry: nearest.get(x.ItemId) || null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
