// Cross-module links (Phase 5), mounted at /api/links. Read-only: they only
// tell a receiving screen what to pre-fill; saving goes through that module's
// own API and rules.
import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';

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

    res.json({
      prescription: { PrescriptionId: rx.PrescriptionId, CreatedAt: rx.CreatedAt, Diagnosis: rx.Diagnosis },
      patient: { PatientId: rx.PatientId, Name: rx.PatientName, MobileNo: rx.MobileNo, PatientCode: rx.PatientCode },
      medicines: items.recordset.map((m) => {
        const name = m.MedicineName || m.MasterName || '';
        const hit = itemByName.get(norm(name)) || itemByName.get(norm(m.MasterName));
        return { name, dosage: m.Dosage, frequency: m.Frequency, duration: m.Duration, pharmacyItem: hit ? { ItemId: hit.ItemId, Name: hit.Name } : null };
      }),
      labTests: tests.recordset.map((t) => {
        const hit = testByName.get(norm(t.TestName));
        return { name: t.TestName, labTest: hit ? { test_id: hit.test_id, test_code: hit.test_code, test_name: hit.test_name } : null };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
