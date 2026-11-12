// Clinic tables (source: Demo Source initDb.js), unchanged except:
//  - Patient, AppUser, MenuAccess come from the core schema
//  - ClinicDetails is the core organisation row (clinic columns added below)
//  - the Demo Source pharmacy, mail and Google Drive tables are not used
//  - the one-off status-label migration for old data is not needed in a new DB
export const clinicSchema = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Medication' AND xtype='U')
CREATE TABLE Medication (
    MedicationId   INT IDENTITY(1,1) PRIMARY KEY,
    MedicineName   NVARCHAR(200) NOT NULL,
    GenericName    NVARCHAR(200) NULL,
    Category       NVARCHAR(100) NULL,
    IsActive       BIT NOT NULL DEFAULT 1,
    CreatedAt      DATETIME NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LabTest' AND xtype='U')
CREATE TABLE LabTest (
    TestId         INT IDENTITY(1,1) PRIMARY KEY,
    TestName       NVARCHAR(200) NOT NULL,
    IsActive       BIT NOT NULL DEFAULT 1,
    CreatedAt      DATETIME NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Employee' AND xtype='U')
CREATE TABLE Employee (
    EmployeeId   INT IDENTITY(1,1) PRIMARY KEY,
    Name         NVARCHAR(200) NOT NULL,
    MobileNo     NVARCHAR(20) NULL,
    Address      NVARCHAR(500) NULL,
    EmpType      NVARCHAR(50) NULL,
    IsActive     BIT NOT NULL DEFAULT 1,
    CreatedAt    DATETIME NOT NULL DEFAULT GETDATE()
);

-- Consultation fee, applicable only to EmpType='Doctor'. Feeds the Doctor
-- picker on Billing > Patient Bill.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='DoctorFee' AND Object_ID=Object_ID('Employee'))
    ALTER TABLE Employee ADD DoctorFee DECIMAL(10,2) NULL;

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EmployeeShift' AND xtype='U')
CREATE TABLE EmployeeShift (
    ShiftId     INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId  INT NOT NULL,
    DayOfWeek   NVARCHAR(10) NULL,
    FromTime    NVARCHAR(12) NULL,
    ToTime      NVARCHAR(12) NULL,
    CONSTRAINT FK_EmployeeShift_Employee FOREIGN KEY (EmployeeId)
        REFERENCES Employee(EmployeeId) ON DELETE CASCADE
);

-- Add DayOfWeek if the table already existed without it
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='DayOfWeek' AND Object_ID=Object_ID('EmployeeShift'))
    ALTER TABLE EmployeeShift ADD DayOfWeek NVARCHAR(10) NULL;



IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VitalSign' AND xtype='U')
CREATE TABLE VitalSign (
    VitalId        INT IDENTITY(1,1) PRIMARY KEY,
    PatientId      INT NOT NULL,
    Height         DECIMAL(6,2) NULL,
    Weight         DECIMAL(6,2) NULL,
    BloodPressure  NVARCHAR(20) NULL,
    PulseRate      INT NULL,
    Temperature    DECIMAL(5,2) NULL,
    Comments       NVARCHAR(1000) NULL,
    RecordedAt     DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_VitalSign_Patient FOREIGN KEY (PatientId)
        REFERENCES Patient(PatientId) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Prescription' AND xtype='U')
CREATE TABLE Prescription (
    PrescriptionId INT IDENTITY(1,1) PRIMARY KEY,
    PatientId      INT NOT NULL,
    DoctorId       INT NULL,
    Diagnosis      NVARCHAR(1000) NULL,
    Notes          NVARCHAR(1000) NULL,
    CreatedAt      DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Prescription_Patient FOREIGN KEY (PatientId)
        REFERENCES Patient(PatientId) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='NextVisitDate' AND Object_ID=Object_ID('Prescription'))
    ALTER TABLE Prescription ADD NextVisitDate DATE NULL;

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PrescriptionItem' AND xtype='U')
CREATE TABLE PrescriptionItem (
    ItemId          INT IDENTITY(1,1) PRIMARY KEY,
    PrescriptionId  INT NOT NULL,
    MedicationId    INT NULL,
    MedicineName    NVARCHAR(200) NULL,
    Dosage          NVARCHAR(100) NULL,
    Frequency       NVARCHAR(100) NULL,
    Duration        NVARCHAR(100) NULL,
    Instructions    NVARCHAR(500) NULL,
    CONSTRAINT FK_PrescriptionItem_Prescription FOREIGN KEY (PrescriptionId)
        REFERENCES Prescription(PrescriptionId) ON DELETE CASCADE
);

-- Lab tests ordered on a prescription (from the Test Master catalog). TestName
-- is snapshotted here (like PrescriptionItem does for MedicineName) so a
-- prescription still shows the correct name even if the test is later
-- renamed or deactivated in the catalog.
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PrescriptionLabTest' AND xtype='U')
CREATE TABLE PrescriptionLabTest (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    PrescriptionId  INT NOT NULL,
    TestId          INT NOT NULL,
    TestName        NVARCHAR(200) NOT NULL,
    CONSTRAINT FK_PrescriptionLabTest_Prescription FOREIGN KEY (PrescriptionId)
        REFERENCES Prescription(PrescriptionId) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PatientConfirmation' AND xtype='U')
CREATE TABLE PatientConfirmation (
    ConfirmId    INT IDENTITY(1,1) PRIMARY KEY,
    PatientId    INT NOT NULL,
    TokenNo      INT NULL,
    Status       NVARCHAR(20) NOT NULL DEFAULT 'Confirmed',
    ConfirmedAt  DATETIME NOT NULL DEFAULT GETDATE(),
    Notes        NVARCHAR(500) NULL,
    CONSTRAINT FK_PatientConfirmation_Patient FOREIGN KEY (PatientId)
        REFERENCES Patient(PatientId) ON DELETE CASCADE
);

-- Add TokenNo / Status if the table already existed without them
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='TokenNo' AND Object_ID=Object_ID('PatientConfirmation'))
    ALTER TABLE PatientConfirmation ADD TokenNo INT NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='Status' AND Object_ID=Object_ID('PatientConfirmation'))
    ALTER TABLE PatientConfirmation ADD Status NVARCHAR(20) NOT NULL DEFAULT 'Confirmed';

-- ClinicDetails is created by the core schema (shared Organisation Details);
-- the clinic-only columns from the source CREATE are added here.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='Latitude' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD Latitude DECIMAL(10,7) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='Longitude' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD Longitude DECIMAL(10,7) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='MapUrl' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD MapUrl NVARCHAR(1000) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='PrescriptionAttachment' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD PrescriptionAttachment NVARCHAR(MAX) NULL;

-- Attachment print size (cm), added after initial release
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='AttachmentHeight' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD AttachmentHeight DECIMAL(6,2) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='AttachmentWidth' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD AttachmentWidth DECIMAL(6,2) NULL;

-- Widened from INT (px) to DECIMAL (cm); safe no-op if already DECIMAL
ALTER TABLE ClinicDetails ALTER COLUMN AttachmentHeight DECIMAL(6,2) NULL;
ALTER TABLE ClinicDetails ALTER COLUMN AttachmentWidth DECIMAL(6,2) NULL;

-- Clinic Details redesign: doctor name, logo, email, contact number
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='DoctorName' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD DoctorName NVARCHAR(200) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='Logo' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD Logo NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='Email' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD Email NVARCHAR(200) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='ContactNo' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD ContactNo NVARCHAR(20) NULL;

-- Printed prescription page size (cm), sets the physical paper size via @page
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='PageHeight' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD PageHeight DECIMAL(6,2) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='PageWidth' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD PageWidth DECIMAL(6,2) NULL;

-- Software brand name (sidebar/login/browser tab) — distinct from the clinic's
-- own name, which is what shows in the top header and PWA install name.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='AppName' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD AppName NVARCHAR(100) NULL;

-- Positions of the drag-and-drop parameter blocks (Vital Sign / Medication)
-- placed on the PrescriptionAttachment letterhead image — stored as a JSON
-- array of { id, type, x, y } (x/y are percentages, so placement stays
-- correct regardless of how large the image is shown on screen).
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='LetterPadFields' AND Object_ID=Object_ID('ClinicDetails'))
    ALTER TABLE ClinicDetails ADD LetterPadFields NVARCHAR(MAX) NULL;

-- Manually-entered Doctor Fees / Extra Fees per patient per day, layered on top
-- of the auto-calculated visit rate on the Billing > Patient Bill screen.
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PatientBill' AND xtype='U')
CREATE TABLE PatientBill (
    BillId       INT IDENTITY(1,1) PRIMARY KEY,
    PatientId    INT NOT NULL,
    BillDate     DATE NOT NULL,
    DoctorFees   DECIMAL(10,2) NOT NULL DEFAULT 0,
    ExtraFees    DECIMAL(10,2) NOT NULL DEFAULT 0,
    Notes        NVARCHAR(500) NULL,
    CreatedAt    DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt    DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_PatientBill_PatientDate UNIQUE (PatientId, BillDate),
    CONSTRAINT FK_PatientBill_Patient FOREIGN KEY (PatientId)
        REFERENCES Patient(PatientId) ON DELETE CASCADE
);

-- Which doctor this bill's Doctor Fees came from (picked on the Patient Bill
-- screen). SET NULL on delete so removing a doctor never touches billing history.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='DoctorId' AND Object_ID=Object_ID('PatientBill'))
    ALTER TABLE PatientBill ADD DoctorId INT NULL;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name='FK_PatientBill_Doctor')
    ALTER TABLE PatientBill ADD CONSTRAINT FK_PatientBill_Doctor FOREIGN KEY (DoctorId)
        REFERENCES Employee(EmployeeId) ON DELETE SET NULL;

-- Patient records/attachments stored in Google Drive (via a single service
-- account connection, not per-user OAuth). This table only indexes them —
-- the files themselves live in Drive. Admin/Doctor can browse any patient's
-- documents; a Patient-role login is always restricted server-side to its
-- own LinkedPatientId (see backend/src/routes/patientDocuments.js).
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PatientDocument' AND xtype='U')
CREATE TABLE PatientDocument (
    DocumentId    INT IDENTITY(1,1) PRIMARY KEY,
    PatientId     INT NOT NULL,
    FileName      NVARCHAR(300) NOT NULL,
    DriveFileId   NVARCHAR(200) NOT NULL,
    Category      NVARCHAR(100) NULL,
    DocumentDate  DATE NOT NULL,
    UploadedBy    NVARCHAR(100) NULL,
    CreatedAt     DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_PatientDocument_Patient FOREIGN KEY (PatientId)
        REFERENCES Patient(PatientId) ON DELETE CASCADE
);

-- Storage is provider-agnostic (Cloudinary now, Google Drive later — see
-- backend/src/utils/cloudinaryService.js / googleDriveService.js). DriveFileId
-- predates this and is left frozen/unused; the table had zero real rows when
-- this was added, so relaxing it to nullable is safe.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='StorageProvider' AND Object_ID=Object_ID('PatientDocument'))
    ALTER TABLE PatientDocument ADD StorageProvider NVARCHAR(20) NOT NULL DEFAULT 'cloudinary';
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='StorageFileId' AND Object_ID=Object_ID('PatientDocument'))
    ALTER TABLE PatientDocument ADD StorageFileId NVARCHAR(400) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='StorageResourceType' AND Object_ID=Object_ID('PatientDocument'))
    ALTER TABLE PatientDocument ADD StorageResourceType NVARCHAR(20) NULL;
IF EXISTS (SELECT * FROM sys.columns WHERE Name='DriveFileId' AND Object_ID=Object_ID('PatientDocument') AND is_nullable = 0)
    ALTER TABLE PatientDocument ALTER COLUMN DriveFileId NVARCHAR(200) NULL;

-- Clinic Master > partner pharmacies list (source table name kept)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Pharmacy' AND xtype='U')
CREATE TABLE Pharmacy (
    PharmacyId  INT IDENTITY(1,1) PRIMARY KEY,
    Name        NVARCHAR(200) NOT NULL,
    Address     NVARCHAR(500) NULL,
    ContactNo   NVARCHAR(20) NULL,
    CreatedAt   DATETIME NOT NULL DEFAULT GETDATE()
);
`;
