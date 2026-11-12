import 'dotenv/config'; // first: later imports (jwt.js) read process.env at load time
import express from 'express';
import cors from 'cors';


import { requireAuth } from './middleware/auth.js';
import authRoutes from './core/routes/auth.js';
import appInfoRoutes from './core/routes/appInfo.js';
import manifestRoutes from './core/routes/manifest.js';
import userRoutes from './core/routes/users.js';
import menuAccessRoutes from './core/routes/menuAccess.js';
import organisationRoutes from './core/routes/organisation.js';
import labRoutes from './lab/index.js';
import pharmacyRoutes from './pharmacy/index.js';
import clinicRoutes from './clinic/index.js';
import linkRoutes from './links/index.js';



const app = express();
app.use(cors());
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '15mb' })); // lab imports send up to 20,000 rows

// Public
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.use('/api/auth', authRoutes);
app.use('/api', manifestRoutes);
app.use('/api', appInfoRoutes);

app.use('/api', requireAuth);

// A Patient login (Clinic patient portal) may only read its own records and
// the organisation name; everything else is staff-only.
const PATIENT_ALLOWED = [/^\/core\/organisation$/, /^\/clinic\/patient-documents(\/\d+\/download)?$/];
app.use('/api', (req, res, next) => {
  if (req.user?.role !== 'Patient') return next();
  if (req.method === 'GET' && PATIENT_ALLOWED.some((re) => re.test(req.path))) return next();
  res.status(403).json({ error: 'Not available for a patient login' });
});

// Core (shared by every module)
app.use('/api/core/users', userRoutes);
app.use('/api/core/menu-access', menuAccessRoutes);
app.use('/api/core/organisation', organisationRoutes);

// Modules
app.use('/api/lab', labRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/clinic', clinicRoutes);
app.use('/api/links', linkRoutes); // cross-module pre-fill (read-only)

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 5160;
// HOST is set to 127.0.0.1 on the server (deploy/ecosystem.config.cjs) so only
// nginx reaches the API; locally it listens on every interface as before.
const HOST = process.env.HOST;
if (HOST) app.listen(PORT, HOST, () => console.log(`API running on http://${HOST}:${PORT}`));
else app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
