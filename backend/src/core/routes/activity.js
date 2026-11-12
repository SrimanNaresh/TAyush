import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { adminOnly } from '../../middleware/auth.js';
import { docNoSql } from '../../pharmacy/utils/docNumber.js';

const router = Router();

// Recent activity across Clinic, Pharmacy and Lab for the Admin home page:
// the latest events of each kind, merged newest first. Read-only.
// ?limit= (default 25, max 100)
router.get('/', adminOnly, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const pool = await getPool();
    const r = await pool.request().input('lim', sql.Int, limit).query(`
      SELECT TOP (@lim) * FROM (
        SELECT TOP (@lim) 'clinic' AS Module, 'Patient registered' AS Kind, p.Name AS Title,
               ISNULL(p.PatientCode, 'ID ' + CAST(p.PatientId AS VARCHAR(10))) AS Detail, p.CreatedAt AS At, NULL AS Amount
        FROM Patient p ORDER BY p.CreatedAt DESC
        UNION ALL
        SELECT TOP (@lim) 'clinic', 'Token confirmed', p.Name, 'Token ' + ISNULL(CAST(c.TokenNo AS VARCHAR(10)), '-') + ' · ' + c.Status, c.ConfirmedAt, NULL
        FROM PatientConfirmation c JOIN Patient p ON p.PatientId = c.PatientId ORDER BY c.ConfirmedAt DESC
        UNION ALL
        SELECT TOP (@lim) 'clinic', 'Prescription written', p.Name, ISNULL(pr.Diagnosis, ''), pr.CreatedAt, NULL
        FROM Prescription pr JOIN Patient p ON p.PatientId = pr.PatientId ORDER BY pr.CreatedAt DESC
        UNION ALL
        SELECT TOP (@lim) 'clinic', 'Patient bill', p.Name, 'Bill date ' + CONVERT(VARCHAR(10), b.BillDate, 105), b.UpdatedAt,
               ISNULL(b.DoctorFees, 0) + ISNULL(b.ExtraFees, 0)
        FROM PatientBill b JOIN Patient p ON p.PatientId = b.PatientId ORDER BY b.UpdatedAt DESC
        UNION ALL
        SELECT TOP (@lim) 'pharmacy', 'Sale', ISNULL(h.CustomerName, 'Walk-in'), ${docNoSql('S', 'h.SalesBillingId')}, h.CreatedAt, h.TotalAmount
        FROM SalesBilling h WHERE h.IsActive = 1 ORDER BY h.CreatedAt DESC
        UNION ALL
        SELECT TOP (@lim) 'pharmacy', 'Stock In', v.VendorName, ${docNoSql('SI', 'h.StockInId')}, h.CreatedAt, NULL
        FROM StockIn h JOIN Vendor v ON v.VendorId = h.VendorId WHERE h.IsActive = 1 ORDER BY h.CreatedAt DESC
        UNION ALL
        SELECT TOP (@lim) 'lab', 'Tests assigned', p.full_name, a.assignment_no + ' · ' + a.status, a.created_at, a.net_amount
        FROM test_assignments a JOIN lab_patients p ON p.patient_id = a.patient_id ORDER BY a.created_at DESC
        UNION ALL
        SELECT TOP (@lim) 'lab', 'Results completed', p.full_name, a.assignment_no, r.completed_at, NULL
        FROM patient_results r JOIN test_assignments a ON a.assignment_id = r.assignment_id
        JOIN lab_patients p ON p.patient_id = r.patient_id
        WHERE r.status = 'Completed' ORDER BY r.completed_at DESC
      ) ev
      WHERE ev.At IS NOT NULL
      ORDER BY ev.At DESC`);
    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
