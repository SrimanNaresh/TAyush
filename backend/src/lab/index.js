// Lab module router, mounted at /api/lab (source: T_Lab /api/*).
import { Router } from 'express';
import settingsRoutes from './routes/settings.js';
import testRoutes from './routes/tests.js';
import feeRoutes from './routes/fees.js';
import patientRoutes from './routes/patients.js';
import assignmentRoutes from './routes/assignments.js';
import resultRoutes from './routes/results.js';
import dashboardRoutes from './routes/dashboard.js';
import { errorHandler } from './helpers.js';

const router = Router();
router.use('/settings', settingsRoutes);
router.use('/tests', testRoutes);
router.use('/fees', feeRoutes);
router.use('/patients', patientRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/results', resultRoutes);
router.use('/dashboard', dashboardRoutes);
router.use((req, res) => res.status(404).json({ error: 'Not found' }));
router.use(errorHandler);

export default router;
