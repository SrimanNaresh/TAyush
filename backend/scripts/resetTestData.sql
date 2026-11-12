-- Removes test rows left by local UI checks and resets identity counters of
-- empty tables, so the first real documents get number 1 (pharmacy document
-- numbers are built from row ids). ONLY for a database with no real data yet.
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
DELETE FROM SalesReturnItem;  DELETE FROM SalesReturn;
DELETE FROM SalesBillingItem; DELETE FROM SalesBilling;
DELETE FROM StockAdjustmentItem; DELETE FROM StockAdjustment;
DELETE FROM VendorPayment;
DELETE FROM StockReturnItem; DELETE FROM StockReturn;
DELETE FROM StockInItem; DELETE FROM StockIn;
DELETE FROM PurchaseOrderItem; DELETE FROM PurchaseOrder;
DELETE FROM PharmacyItem; DELETE FROM Vendor;
DELETE FROM result_values; DELETE FROM patient_results; DELETE FROM assignment_tests; DELETE FROM test_assignments;
DELETE FROM test_fees; DELETE FROM test_components; DELETE FROM test_master;
DELETE FROM PatientDocument; DELETE FROM PatientBill; DELETE FROM PatientConfirmation; DELETE FROM VitalSign;
DELETE FROM PrescriptionLabTest; DELETE FROM PrescriptionItem; DELETE FROM Prescription;
DELETE FROM Medication; DELETE FROM LabTest; DELETE FROM EmployeeShift; DELETE FROM Employee; DELETE FROM Pharmacy;
DELETE FROM AppUser WHERE Role = 'Patient';
DELETE FROM Patient;

DECLARE @t sysname, @sql nvarchar(400);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
  SELECT OBJECT_NAME(ic.object_id) FROM sys.identity_columns ic
  JOIN sys.tables tb ON tb.object_id = ic.object_id
  WHERE ic.last_value IS NOT NULL AND OBJECT_NAME(ic.object_id) NOT IN ('AppUser', 'MenuAccess',
    'UnitMaster', 'PotencyMaster', 'CategoryMaster', 'GenericNameMaster', 'ManufacturerMaster');
OPEN c;
FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'IF NOT EXISTS (SELECT 1 FROM ' + QUOTENAME(@t) + N') DBCC CHECKIDENT (''' + @t + N''', RESEED, 0) WITH NO_INFOMSGS;';
  EXEC (@sql);
  FETCH NEXT FROM c INTO @t;
END
CLOSE c; DEALLOCATE c;
SELECT OBJECT_NAME(object_id) AS tbl, last_value FROM sys.identity_columns WHERE last_value IS NOT NULL ORDER BY 1;
