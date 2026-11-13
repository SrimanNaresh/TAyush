// Core tables shared by Clinic, Pharmacy and Lab. Idempotent: safe to run on
// every deploy. Order matters: Patient before AppUser (FK LinkedPatientId).
export const coreSchema = `
IF OBJECT_ID('dbo.Patient','U') IS NULL
CREATE TABLE dbo.Patient (
    PatientId        INT IDENTITY(1,1) PRIMARY KEY,
    PatientCode      NVARCHAR(20)  NULL,
    Name             NVARCHAR(200) NOT NULL,
    Gender           NVARCHAR(10)  NULL,
    DateOfBirth      DATE NULL,
    Age              INT NULL,
    MobileNo         NVARCHAR(20)  NULL,
    Email            NVARCHAR(150) NULL,
    Address          NVARCHAR(500) NULL,
    ReferredBy       NVARCHAR(150) NULL,
    RegistrationDate DATE NOT NULL CONSTRAINT DF_Patient_Reg DEFAULT CAST(GETDATE() AS DATE),
    IsActive         BIT NOT NULL CONSTRAINT DF_Patient_Active DEFAULT 1,
    CreatedAt        DATETIME NOT NULL CONSTRAINT DF_Patient_Created DEFAULT GETDATE(),
    UpdatedAt        DATETIME NOT NULL CONSTRAINT DF_Patient_Updated DEFAULT GETDATE(),
    CONSTRAINT CK_Patient_Gender CHECK (Gender IS NULL OR Gender IN ('Male','Female','Other')),
    CONSTRAINT CK_Patient_Age CHECK (Age IS NULL OR Age BETWEEN 0 AND 150)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_Patient_Code')
    CREATE UNIQUE INDEX UX_Patient_Code ON dbo.Patient(PatientCode) WHERE PatientCode IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Patient_Name')
    CREATE INDEX IX_Patient_Name ON dbo.Patient(Name);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Patient_Mobile')
    CREATE INDEX IX_Patient_Mobile ON dbo.Patient(MobileNo);
-- Clinic registration: who referred the patient ('Doctor' or 'Patient').
-- For 'Doctor', the clinic/hospital name is kept in ReferredBy.
IF COL_LENGTH('dbo.Patient','ReferralType') IS NULL
    ALTER TABLE dbo.Patient ADD ReferralType NVARCHAR(20) NULL;

IF OBJECT_ID('dbo.AppUser','U') IS NULL
CREATE TABLE dbo.AppUser (
    UserId          INT IDENTITY(1,1) PRIMARY KEY,
    Username        NVARCHAR(100) NOT NULL CONSTRAINT UQ_AppUser_Username UNIQUE,
    FullName        NVARCHAR(150) NULL,
    PasswordHash    NVARCHAR(256) NOT NULL,
    Role            NVARCHAR(20)  NOT NULL CONSTRAINT DF_AppUser_Role DEFAULT 'Staff',
    IsActive        BIT NOT NULL CONSTRAINT DF_AppUser_Active DEFAULT 1,
    LinkedPatientId INT NULL CONSTRAINT FK_AppUser_Patient REFERENCES dbo.Patient(PatientId) ON DELETE SET NULL,
    CreatedAt       DATETIME NOT NULL CONSTRAINT DF_AppUser_Created DEFAULT GETDATE()
);

-- Super Admin (software owner): an Admin who also manages the plan and other
-- Super Admins. Stored as a flag so every existing Admin check still applies.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='IsSuperAdmin' AND Object_ID=Object_ID('AppUser'))
    ALTER TABLE dbo.AppUser ADD IsSuperAdmin BIT NOT NULL CONSTRAINT DF_AppUser_SuperAdmin DEFAULT 0;

-- Plan and validity of this installation (one row, Id 1), set by a Super Admin.
IF OBJECT_ID('dbo.Subscription','U') IS NULL
CREATE TABLE dbo.Subscription (
    Id          INT PRIMARY KEY CONSTRAINT CK_Subscription_Single CHECK (Id = 1),
    PlanName    NVARCHAR(100) NOT NULL,
    StartDate   DATE NULL,
    ValidUntil  DATE NULL,
    Notes       NVARCHAR(500) NULL,
    Modules     NVARCHAR(1000) NULL,
    UpdatedAt   DATETIME NOT NULL CONSTRAINT DF_Subscription_Updated DEFAULT GETDATE(),
    UpdatedBy   NVARCHAR(100) NULL
);
-- Menu Rights: the main menus included in the plan, as a JSON array of menu
-- names (NULL = every menu). Dashboard and Configuration are always included.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name='Modules' AND Object_ID=Object_ID('Subscription'))
    ALTER TABLE dbo.Subscription ADD Modules NVARCHAR(1000) NULL;

-- Plan master: the plans a Super Admin can pick on the Validity tab.
IF OBJECT_ID('dbo.PlanMaster','U') IS NULL
CREATE TABLE dbo.PlanMaster (
    PlanId     INT IDENTITY(1,1) PRIMARY KEY,
    Name       NVARCHAR(100) NOT NULL CONSTRAINT UQ_PlanMaster_Name UNIQUE,
    IsActive   BIT NOT NULL CONSTRAINT DF_PlanMaster_Active DEFAULT 1,
    CreatedAt  DATETIME NOT NULL CONSTRAINT DF_PlanMaster_Created DEFAULT GETDATE()
);

IF OBJECT_ID('dbo.MenuAccess','U') IS NULL
CREATE TABLE dbo.MenuAccess (
    AccessId     INT IDENTITY(1,1) PRIMARY KEY,
    UserId       INT NOT NULL CONSTRAINT FK_MenuAccess_User REFERENCES dbo.AppUser(UserId) ON DELETE CASCADE,
    MenuKey      NVARCHAR(100) NOT NULL,
    AccessLevel  NVARCHAR(20) NOT NULL CONSTRAINT DF_MenuAccess_Level DEFAULT 'No Access',
    CONSTRAINT UQ_MenuAccess UNIQUE (UserId, MenuKey)
);

IF OBJECT_ID('dbo.ClinicDetails','U') IS NULL
CREATE TABLE dbo.ClinicDetails (
    ClinicId    INT PRIMARY KEY,
    Name        NVARCHAR(200) NOT NULL CONSTRAINT DF_ClinicDetails_Name DEFAULT '',
    Address     NVARCHAR(500) NULL,
    ContactNo   NVARCHAR(20)  NULL,
    Email       NVARCHAR(200) NULL,
    Logo        NVARCHAR(MAX) NULL,
    AppName     NVARCHAR(100) NULL,
    DoctorName  NVARCHAR(200) NULL,
    UpdatedAt   DATETIME NOT NULL CONSTRAINT DF_ClinicDetails_Updated DEFAULT GETDATE()
);
`;
