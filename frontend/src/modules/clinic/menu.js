// Clinic module menu (source: Demo Source config/menuItems.js). MenuKeys are
// the source keys with a 'clinic.' prefix; paths have a /clinic prefix. The
// source Settings (users, menu access, DB details) and Pharmacy groups are
// replaced by core Settings and the Pharmacy module.
//
// Dashboards and Registration sit in the main menu (config/menuItems.js), not
// under Clinic: patients are shared by every module. Keys and paths unchanged,
// so saved Menu Access still applies.
export const CLINIC_DASHBOARDS = [
  { key: 'clinic.dashboard.admin', label: 'Admin Dashboard', to: '/clinic/dashboard/admin' },
  { key: 'clinic.dashboard.reception', label: 'Reception Dashboard', to: '/clinic/dashboard/reception' },
  { key: 'clinic.dashboard.doctor', label: 'Doctor Dashboard', to: '/clinic/dashboard/doctor' },
];

// Two sections (like Pharmacy / Lab), so the top bar shows them as cards.
export const REGISTRATION_MENU = [
  {
    label: 'Patient',
    submenu: [
      { key: 'clinic.registration.patient', label: 'Patient Details', to: '/clinic/registration/patient' },
      { key: 'clinic.registration.patient-list', label: 'List', to: '/clinic/registration/patient-list' },
    ],
  },
  {
    label: 'Employee',
    submenu: [
      { key: 'clinic.registration.employee', label: 'Employee Details', to: '/clinic/registration/employee' },
      { key: 'clinic.registration.employee-list', label: 'List', to: '/clinic/registration/employee-list' },
    ],
  },
];

// Clinic Master and the letter-pad setup sit in the main Settings menu.
export const CLINIC_SETTINGS = [
  { key: 'clinic.settings.clinic-master', label: 'Clinic Master', to: '/clinic/master/clinic-details' },
  { key: 'clinic.coming-up.letter-pad-prescription', label: 'Prescription for Your Letter Pad', to: '/clinic/coming-up/letter-pad-prescription' },
];

// Billing sits in the main menu (config/menuItems.js).
// Two sections (like Pharmacy / Lab), so the top bar shows them as cards.
export const BILLING_MENU = [
  {
    label: 'Bill Entry',
    submenu: [
      { key: 'clinic.billing.patient-bill', label: 'Patient Bill', to: '/clinic/billing/patient-bill' },
    ],
  },
  {
    label: 'Bill Reports',
    submenu: [
      { key: 'clinic.billing.month-wise', label: 'Month Wise', to: '/clinic/billing/month-wise' },
      { key: 'clinic.billing.custom', label: 'Custom', to: '/clinic/billing/custom' },
    ],
  },
];

// Order (user, 2026-11-12): Patient Queue, Consultation, Pharmacy, Lab, Reports.
// In the main Reports menu (config/menuItems.js).
export const CLINIC_REPORTS = [
  { key: 'clinic.reports.prescriptions', label: 'Patient Prescriptions', to: '/clinic/reports/prescriptions' },
  { key: 'clinic.reports.follow-up-patients', label: 'Follow Up Patients', to: '/clinic/reports/follow-up-patients' },
];

export const CLINIC_MENU = [
  {
    label: 'Patient Queue',
    submenu: [
      { key: 'clinic.confirm.search', label: 'Confirm & Search', to: '/clinic/confirm/search' },
      { key: 'clinic.confirm.list', label: 'Confirm List', to: '/clinic/confirm/list' },
      { key: 'clinic.confirm.vital-sign', label: 'Vital Sign', to: '/clinic/confirm/vital-sign' },
      { key: 'clinic.confirm.vital-sign-list', label: 'Vital Sign List', to: '/clinic/confirm/vital-sign-list' },
    ],
  },
  {
    label: 'Consultation',
    submenu: [
      { key: 'clinic.confirm.prescription', label: 'Examine', to: '/clinic/confirm/prescription' },
      { key: 'clinic.confirm.prescription-print', label: 'Prescription Preview', to: '/clinic/confirm/prescription-print' },
      { key: 'clinic.reports.medical-history', label: 'Patient Medical History', to: '/clinic/reports/medical-history' },
    ],
  },
  // Pharmacy and Lab are sections of their own, the same kind as Consultation.
  {
    // Medicines received in Pharmacy > Stock In (read-only here)
    label: 'Pharmacy',
    submenu: [
      { key: 'clinic.master.medication-list', label: 'Medication List', to: '/clinic/master/medication-list' },
    ],
  },
  {
    // Tests from Lab > Masters > Test Master (read-only here)
    label: 'Lab',
    submenu: [
      { key: 'clinic.master.test-master', label: 'Test List', to: '/clinic/master/test-master' },
    ],
  },
  {
    label: 'Reports',
    submenu: [
      { key: 'clinic.reports.patient-list', label: 'Patient List', to: '/clinic/reports/patient-list' },
      { key: 'clinic.reports.patient-records', label: 'Patient Records', to: '/clinic/reports/patient-records' },
      { key: 'clinic.reports.date-wise-visit-list', label: 'Date Wise Visit List', to: '/clinic/reports/date-wise-visit-list' },
    ],
  },
];
