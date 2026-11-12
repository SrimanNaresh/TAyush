// Clinic module router, mounted at /api/clinic (source: Demo Source /api/*).
import { Router } from 'express';
import { requireAccess } from '../middleware/auth.js';
import medicationRoutes from './routes/medication.js';
import labTestRoutes from './routes/labTest.js';
import employeeRoutes from './routes/employee.js';
import patientRoutes from './routes/patient.js';
import vitalSignRoutes from './routes/vitalSign.js';
import prescriptionRoutes from './routes/prescription.js';
import reportRoutes from './routes/reports.js';
import confirmationRoutes from './routes/confirmation.js';
import clinicDetailsRoutes from './routes/clinicDetails.js';
import billingRoutes from './routes/billing.js';
import patientDocumentsRoutes from './routes/patientDocuments.js';
import partnerPharmacyRoutes from './routes/partnerPharmacy.js';

// Saving (POST / PUT / DELETE) needs Admin or Full Menu Access on one of the
// clinic pages that save through that API; reading stays open to staff, as in
// the source. Patient documents keep the source's own role rules.
const writesNeed = (keys) => {
  const check = requireAccess(keys.map((k) => `clinic.${k}`));
  return (req, res, next) => (req.method === 'GET' ? next() : check(req, res, next));
};
const DOCTOR = 'confirm.prescription';

const router = Router();
router.use('/medications', writesNeed(['master.medication', 'master.medication-list']), medicationRoutes);
router.use('/lab-tests', writesNeed(['master.test-master']), labTestRoutes);
router.use('/employees', writesNeed(['registration.employee', 'registration.employee-list']), employeeRoutes);
router.use('/patients', writesNeed(['registration.patient', 'registration.patient-list']), patientRoutes);
router.use('/vitals', writesNeed(['confirm.vital-sign', 'confirm.vital-sign-list']), vitalSignRoutes);
router.use('/prescriptions', writesNeed([DOCTOR, 'confirm.prescription-print', 'reports.follow-up-patients']), prescriptionRoutes);
router.use('/reports', reportRoutes);
router.use('/confirmations', writesNeed(['confirm.search', 'confirm.list', 'registration.patient', DOCTOR]), confirmationRoutes);
router.use('/clinic-details', writesNeed(['settings.clinic-master', 'coming-up.letter-pad-prescription']), clinicDetailsRoutes);
router.use('/partner-pharmacies', writesNeed(['settings.clinic-master']), partnerPharmacyRoutes);
router.use('/billing', writesNeed(['billing.patient-bill']), billingRoutes);
router.use('/patient-documents', patientDocumentsRoutes);
router.use((req, res) => res.status(404).json({ error: 'Not found' }));

export default router;
