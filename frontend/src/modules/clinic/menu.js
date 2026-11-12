// Clinic module menu (source: Demo Source config/menuItems.js). MenuKeys are
// the source keys with a 'clinic.' prefix; paths have a /clinic prefix. The
// source Settings (users, menu access, DB details) and Pharmacy groups are
// replaced by core Settings and the Pharmacy module.
export const CLINIC_MENU = [
  {
    label: 'Dashboards',
    submenu: [
      { key: 'clinic.dashboard.admin', label: 'Admin Dashboard', to: '/clinic/dashboard/admin' },
      { key: 'clinic.dashboard.reception', label: 'Reception Dashboard', to: '/clinic/dashboard/reception' },
      { key: 'clinic.dashboard.doctor', label: 'Doctor Dashboard', to: '/clinic/dashboard/doctor' },
    ],
  },
  {
    label: 'Registration',
    submenu: [
      { key: 'clinic.registration.employee', label: 'Employee', to: '/clinic/registration/employee' },
      { key: 'clinic.registration.employee-list', label: 'Employee List', to: '/clinic/registration/employee-list' },
      { key: 'clinic.registration.patient', label: 'Patient', to: '/clinic/registration/patient' },
      { key: 'clinic.registration.patient-list', label: 'Patient List', to: '/clinic/registration/patient-list' },
    ],
  },
  {
    label: 'Consultation',
    submenu: [
      { key: 'clinic.confirm.prescription', label: "Doctor's", to: '/clinic/confirm/prescription' },
      { key: 'clinic.confirm.prescription-print', label: 'Prescription Preview', to: '/clinic/confirm/prescription-print' },
      { key: 'clinic.reports.medical-history', label: 'Patient Medical History', to: '/clinic/reports/medical-history' },
      {
        label: 'Medication',
        submenu: [
          { key: 'clinic.master.medication', label: 'Medication', to: '/clinic/master/medication' },
          { key: 'clinic.master.medication-list', label: 'Medication List', to: '/clinic/master/medication-list' },
        ],
      },
      {
        label: 'Lab',
        submenu: [
          { key: 'clinic.master.test-master', label: 'Test Master', to: '/clinic/master/test-master' },
        ],
      },
    ],
  },
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
    label: 'Billing',
    submenu: [
      { key: 'clinic.billing.patient-bill', label: 'Patient Bill', to: '/clinic/billing/patient-bill' },
      { key: 'clinic.billing.month-wise', label: 'Month Wise', to: '/clinic/billing/month-wise' },
      { key: 'clinic.billing.custom', label: 'Custom', to: '/clinic/billing/custom' },
    ],
  },
  {
    label: 'Reports',
    submenu: [
      { key: 'clinic.reports.patient-list', label: 'Patient List', to: '/clinic/reports/patient-list' },
      { key: 'clinic.reports.prescriptions', label: 'Patient Prescriptions', to: '/clinic/reports/prescriptions' },
      { key: 'clinic.reports.patient-records', label: 'Patient Records', to: '/clinic/reports/patient-records' },
      { key: 'clinic.reports.date-wise-visit-list', label: 'Date Wise Visit List', to: '/clinic/reports/date-wise-visit-list' },
      { key: 'clinic.reports.follow-up-patients', label: 'Follow Up Patients', to: '/clinic/reports/follow-up-patients' },
    ],
  },
  {
    label: 'Clinic Setup',
    submenu: [
      { key: 'clinic.settings.clinic-master', label: 'Clinic Master', to: '/clinic/master/clinic-details' },
      { key: 'clinic.coming-up.letter-pad-prescription', label: 'Prescription for Your Letter Pad', to: '/clinic/coming-up/letter-pad-prescription' },
    ],
  },
];
