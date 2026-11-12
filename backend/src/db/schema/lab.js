// Lab tables (source: T_Lab initDb.js), unchanged except:
//  - patients  -> shared dbo.Patient (read through the lab_patients view)
//  - app_users -> shared dbo.AppUser
// Relationship rules (from the source)
//   test_master  1-n test_components   (components deleted with their test)
//   test_master  1-1 test_fees         (fee row deleted with its test)
//   Patient      1-n test_assignments  (RESTRICT: a patient with assignments can't be deleted)
//   test_assignments 1-n assignment_tests (deleted with the assignment)
//   assignment_tests n-1 test_master   (RESTRICT: an assigned test can't be deleted)
//   test_assignments 1-1 patient_results (deleted with the assignment)
//   patient_results 1-n result_values  (deleted with the result)
//   result_values n-1 test_components  (SET NULL: the value keeps its own copy of the
//                                       component name and ranges for printing)
export const labSchema = `
IF OBJECT_ID('dbo.lab_settings','U') IS NULL
CREATE TABLE dbo.lab_settings (
    setting_id    INT NOT NULL CONSTRAINT PK_lab_settings PRIMARY KEY CONSTRAINT CK_lab_settings_single CHECK (setting_id = 1),
    lab_name      NVARCHAR(150) NOT NULL,
    address       NVARCHAR(400) NULL,
    phone         NVARCHAR(50)  NULL,
    email         NVARCHAR(150) NULL,
    report_footer NVARCHAR(400) NULL,
    updated_at    DATETIME2(0) NOT NULL CONSTRAINT DF_lab_settings_updated DEFAULT SYSDATETIME()
);

IF OBJECT_ID('dbo.test_master','U') IS NULL
CREATE TABLE dbo.test_master (
    test_id    INT IDENTITY(1,1) CONSTRAINT PK_test_master PRIMARY KEY,
    test_code  NVARCHAR(20)  NOT NULL CONSTRAINT UQ_test_master_code UNIQUE,
    test_name  NVARCHAR(200) NOT NULL CONSTRAINT UQ_test_master_name UNIQUE,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_test_master_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_test_master_updated DEFAULT SYSDATETIME(),
    CONSTRAINT CK_test_master_code CHECK (LEN(LTRIM(test_code)) > 0),
    CONSTRAINT CK_test_master_name CHECK (LEN(LTRIM(test_name)) > 0)
);

IF OBJECT_ID('dbo.test_components','U') IS NULL
CREATE TABLE dbo.test_components (
    component_id   INT IDENTITY(1,1) CONSTRAINT PK_test_components PRIMARY KEY,
    test_id        INT NOT NULL CONSTRAINT FK_test_components_test REFERENCES dbo.test_master(test_id) ON DELETE CASCADE,
    component_name NVARCHAR(200) NOT NULL,
    male_range     NVARCHAR(200) NULL,
    female_range   NVARCHAR(200) NULL,
    general_range  NVARCHAR(200) NULL,
    sort_order     INT NOT NULL CONSTRAINT DF_test_components_sort DEFAULT 0,
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_test_components_created DEFAULT SYSDATETIME(),
    updated_at     DATETIME2(0) NOT NULL CONSTRAINT DF_test_components_updated DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_test_components_name UNIQUE (test_id, component_name),
    CONSTRAINT CK_test_components_name CHECK (LEN(LTRIM(component_name)) > 0)
);

IF OBJECT_ID('dbo.test_fees','U') IS NULL
CREATE TABLE dbo.test_fees (
    fee_id          INT IDENTITY(1,1) CONSTRAINT PK_test_fees PRIMARY KEY,
    test_id         INT NOT NULL CONSTRAINT UQ_test_fees_test UNIQUE
                        CONSTRAINT FK_test_fees_test REFERENCES dbo.test_master(test_id) ON DELETE CASCADE,
    fee_amount      DECIMAL(12,2) NOT NULL CONSTRAINT DF_test_fees_fee DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_test_fees_disc DEFAULT 0,
    net_amount      AS (fee_amount - discount_amount) PERSISTED,
    effective_date  DATE NOT NULL CONSTRAINT DF_test_fees_eff DEFAULT CAST(GETDATE() AS DATE),
    created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_test_fees_created DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_test_fees_updated DEFAULT SYSDATETIME(),
    CONSTRAINT CK_test_fees_amounts CHECK (fee_amount >= 0 AND discount_amount >= 0 AND discount_amount <= fee_amount)
);

IF OBJECT_ID('dbo.test_assignments','U') IS NULL
CREATE TABLE dbo.test_assignments (
    assignment_id   INT IDENTITY(1,1) CONSTRAINT PK_test_assignments PRIMARY KEY,
    assignment_no   NVARCHAR(20) NOT NULL CONSTRAINT UQ_test_assignments_no UNIQUE,
    patient_id      INT NOT NULL CONSTRAINT FK_test_assignments_patient REFERENCES dbo.Patient(PatientId),
    assignment_date DATE NOT NULL CONSTRAINT DF_test_assignments_date DEFAULT CAST(GETDATE() AS DATE),
    status          NVARCHAR(20) NOT NULL CONSTRAINT DF_test_assignments_status DEFAULT 'Pending'
                        CONSTRAINT CK_test_assignments_status CHECK (status IN ('Pending','Sample Collected','In Progress','Completed')),
    total_fee       DECIMAL(12,2) NOT NULL CONSTRAINT DF_test_assignments_fee DEFAULT 0,
    total_discount  DECIMAL(12,2) NOT NULL CONSTRAINT DF_test_assignments_disc DEFAULT 0,
    net_amount      AS (total_fee - total_discount) PERSISTED,
    notes           NVARCHAR(400) NULL,
    created_by      INT NULL CONSTRAINT FK_test_assignments_user REFERENCES dbo.AppUser(UserId),
    created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_test_assignments_created DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_test_assignments_updated DEFAULT SYSDATETIME(),
    CONSTRAINT CK_test_assignments_amounts CHECK (total_fee >= 0 AND total_discount >= 0 AND total_discount <= total_fee)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_test_assignments_patient') CREATE INDEX IX_test_assignments_patient ON dbo.test_assignments(patient_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_test_assignments_status')  CREATE INDEX IX_test_assignments_status  ON dbo.test_assignments(status, assignment_date);

IF OBJECT_ID('dbo.assignment_tests','U') IS NULL
CREATE TABLE dbo.assignment_tests (
    assignment_test_id INT IDENTITY(1,1) CONSTRAINT PK_assignment_tests PRIMARY KEY,
    assignment_id      INT NOT NULL CONSTRAINT FK_assignment_tests_assignment REFERENCES dbo.test_assignments(assignment_id) ON DELETE CASCADE,
    test_id            INT NOT NULL CONSTRAINT FK_assignment_tests_test REFERENCES dbo.test_master(test_id),
    test_code          NVARCHAR(20)  NOT NULL,
    test_name          NVARCHAR(200) NOT NULL,
    fee_amount         DECIMAL(12,2) NOT NULL,
    discount_amount    DECIMAL(12,2) NOT NULL,
    net_amount         AS (fee_amount - discount_amount) PERSISTED,
    status             NVARCHAR(20) NOT NULL CONSTRAINT DF_assignment_tests_status DEFAULT 'Pending'
                           CONSTRAINT CK_assignment_tests_status CHECK (status IN ('Pending','Sample Collected','In Progress','Completed')),
    created_at         DATETIME2(0) NOT NULL CONSTRAINT DF_assignment_tests_created DEFAULT SYSDATETIME(),
    updated_at         DATETIME2(0) NOT NULL CONSTRAINT DF_assignment_tests_updated DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_assignment_tests UNIQUE (assignment_id, test_id),
    CONSTRAINT CK_assignment_tests_amounts CHECK (fee_amount >= 0 AND discount_amount >= 0 AND discount_amount <= fee_amount)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_assignment_tests_test') CREATE INDEX IX_assignment_tests_test ON dbo.assignment_tests(test_id);

IF OBJECT_ID('dbo.patient_results','U') IS NULL
CREATE TABLE dbo.patient_results (
    result_id     INT IDENTITY(1,1) CONSTRAINT PK_patient_results PRIMARY KEY,
    assignment_id INT NOT NULL CONSTRAINT UQ_patient_results_assignment UNIQUE
                      CONSTRAINT FK_patient_results_assignment REFERENCES dbo.test_assignments(assignment_id) ON DELETE CASCADE,
    patient_id    INT NOT NULL CONSTRAINT FK_patient_results_patient REFERENCES dbo.Patient(PatientId),
    status        NVARCHAR(20) NOT NULL CONSTRAINT DF_patient_results_status DEFAULT 'Draft'
                      CONSTRAINT CK_patient_results_status CHECK (status IN ('Draft','Completed')),
    completed_at  DATETIME2(0) NULL,
    entered_by    INT NULL CONSTRAINT FK_patient_results_user REFERENCES dbo.AppUser(UserId),
    created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_patient_results_created DEFAULT SYSDATETIME(),
    updated_at    DATETIME2(0) NOT NULL CONSTRAINT DF_patient_results_updated DEFAULT SYSDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_patient_results_patient') CREATE INDEX IX_patient_results_patient ON dbo.patient_results(patient_id);

IF OBJECT_ID('dbo.result_values','U') IS NULL
CREATE TABLE dbo.result_values (
    value_id           INT IDENTITY(1,1) CONSTRAINT PK_result_values PRIMARY KEY,
    result_id          INT NOT NULL CONSTRAINT FK_result_values_result REFERENCES dbo.patient_results(result_id) ON DELETE CASCADE,
    assignment_test_id INT NOT NULL CONSTRAINT FK_result_values_assignment_test REFERENCES dbo.assignment_tests(assignment_test_id),
    test_id            INT NOT NULL CONSTRAINT FK_result_values_test REFERENCES dbo.test_master(test_id),
    component_id       INT NULL CONSTRAINT FK_result_values_component REFERENCES dbo.test_components(component_id) ON DELETE SET NULL,
    test_name          NVARCHAR(200) NOT NULL,
    component_name     NVARCHAR(200) NOT NULL,
    male_range         NVARCHAR(200) NULL,
    female_range       NVARCHAR(200) NULL,
    general_range      NVARCHAR(200) NULL,
    result_value       NVARCHAR(200) NOT NULL,
    sort_order         INT NOT NULL CONSTRAINT DF_result_values_sort DEFAULT 0,
    created_at         DATETIME2(0) NOT NULL CONSTRAINT DF_result_values_created DEFAULT SYSDATETIME(),
    updated_at         DATETIME2(0) NOT NULL CONSTRAINT DF_result_values_updated DEFAULT SYSDATETIME(),
    CONSTRAINT CK_result_values_value CHECK (LEN(LTRIM(result_value)) > 0)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_result_values_result') CREATE INDEX IX_result_values_result ON dbo.result_values(result_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_result_values_component')
    CREATE UNIQUE INDEX UX_result_values_component ON dbo.result_values(result_id, component_id) WHERE component_id IS NOT NULL;
`;

// Lab's view of the shared Patient table, with Lab's own column names.
// CREATE OR ALTER must be alone in its batch.
export const labViews = [`
CREATE OR ALTER VIEW dbo.lab_patients AS
SELECT PatientId AS patient_id, PatientCode AS patient_code, Name AS full_name, Gender AS gender,
       DateOfBirth AS date_of_birth, Age AS age, MobileNo AS phone, Email AS email, Address AS address,
       ReferredBy AS referred_by, RegistrationDate AS registration_date, CreatedAt AS created_at, UpdatedAt AS updated_at,
       IsActive AS is_active
FROM dbo.Patient`];
