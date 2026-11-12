import { lazy } from 'react';
import { Route } from 'react-router-dom';

// Clinic module routes (source: Demo Source App.jsx), each path with a
// /clinic prefix. Demo Source's own pharmacy pages, DB Details, User Master and
// Menu Access are not here (Pharmacy module and core Settings replace them).
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const ReceptionDashboard = lazy(() => import('./pages/ReceptionDashboard.jsx'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard.jsx'));
const Medication = lazy(() => import('./pages/master/Medication.jsx'));
const MedicationList = lazy(() => import('./pages/master/MedicationList.jsx'));
const TestMaster = lazy(() => import('./pages/master/TestMaster.jsx'));
const ClinicDetails = lazy(() => import('./pages/master/ClinicDetails.jsx'));
const LetterPadPrescription = lazy(() => import('./pages/comingUp/LetterPadPrescription.jsx'));
const Employee = lazy(() => import('./pages/registration/Employee.jsx'));
const EmployeeList = lazy(() => import('./pages/registration/EmployeeList.jsx'));
const Patient = lazy(() => import('./pages/registration/Patient.jsx'));
const PatientList = lazy(() => import('./pages/registration/PatientList.jsx'));
const ConfirmSearch = lazy(() => import('./pages/confirm/ConfirmSearch.jsx'));
const ConfirmList = lazy(() => import('./pages/confirm/ConfirmList.jsx'));
const VitalSign = lazy(() => import('./pages/confirm/VitalSign.jsx'));
const VitalSignList = lazy(() => import('./pages/confirm/VitalSignList.jsx'));
const Prescription = lazy(() => import('./pages/confirm/Prescription.jsx'));
const PrescriptionPrint = lazy(() => import('./pages/confirm/PrescriptionPrint.jsx'));
const ReportPatientList = lazy(() => import('./pages/reports/ReportPatientList.jsx'));
const ReportMedicalHistory = lazy(() => import('./pages/reports/ReportMedicalHistory.jsx'));
const ReportPrescriptions = lazy(() => import('./pages/reports/ReportPrescriptions.jsx'));
const ReportVisitList = lazy(() => import('./pages/reports/ReportVisitList.jsx'));
const PatientRecords = lazy(() => import('./pages/reports/PatientRecords.jsx'));
const FollowUpPatients = lazy(() => import('./pages/reports/FollowUpPatients.jsx'));
const BillingPatientBill = lazy(() => import('./pages/billing/BillingPatientBill.jsx'));
const BillingMonthWise = lazy(() => import('./pages/billing/BillingMonthWise.jsx'));
const BillingCustom = lazy(() => import('./pages/billing/BillingCustom.jsx'));

const PAGES = [
  ['/clinic/dashboard/admin', AdminDashboard],
  ['/clinic/dashboard/reception', ReceptionDashboard],
  ['/clinic/dashboard/doctor', DoctorDashboard],
  ['/clinic/master/medication', Medication],
  ['/clinic/master/medication-list', MedicationList],
  ['/clinic/master/test-master', TestMaster],
  ['/clinic/master/clinic-details', ClinicDetails],
  ['/clinic/coming-up/letter-pad-prescription', LetterPadPrescription],
  ['/clinic/registration/employee', Employee],
  ['/clinic/registration/employee-list', EmployeeList],
  ['/clinic/registration/patient', Patient],
  ['/clinic/registration/patient-list', PatientList],
  ['/clinic/confirm/search', ConfirmSearch],
  ['/clinic/confirm/list', ConfirmList],
  ['/clinic/confirm/vital-sign', VitalSign],
  ['/clinic/confirm/vital-sign-list', VitalSignList],
  ['/clinic/confirm/prescription', Prescription],
  ['/clinic/confirm/prescription-print', PrescriptionPrint],
  ['/clinic/reports/patient-list', ReportPatientList],
  ['/clinic/reports/medical-history', ReportMedicalHistory],
  ['/clinic/reports/prescriptions', ReportPrescriptions],
  ['/clinic/reports/patient-records', PatientRecords],
  ['/clinic/reports/date-wise-visit-list', ReportVisitList],
  ['/clinic/reports/follow-up-patients', FollowUpPatients],
  ['/clinic/billing/patient-bill', BillingPatientBill],
  ['/clinic/billing/month-wise', BillingMonthWise],
  ['/clinic/billing/custom', BillingCustom],
];

export const CLINIC_ROUTES = PAGES.map(([path, Page]) => <Route key={path} path={path} element={<Page />} />);

// A Patient login gets the clinic's patient portal, never the staff shell.
export const PatientPortal = lazy(() => import('./pages/patient/PatientPortal.jsx'));
