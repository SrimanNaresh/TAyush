import { lazy } from 'react';
import { Route, Outlet, Link } from 'react-router-dom';
import { ToastProvider, ConfirmProvider } from './components/ui.jsx';
import { useAuth } from './useLabAuth.js';

// Lab module routes (source: T_Lab App.jsx), under /lab. The printed report
// is a full page outside the app shell: see LAB_PRINT_ROUTES.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Tests = lazy(() => import('./pages/Tests.jsx'));
const Fees = lazy(() => import('./pages/Fees.jsx'));
const Assignments = lazy(() => import('./pages/Assignments.jsx'));
const AssignmentForm = lazy(() => import('./pages/AssignmentForm.jsx'));
const Results = lazy(() => import('./pages/Results.jsx'));
const Report = lazy(() => import('./pages/Report.jsx'));
const SettingsPage = lazy(() => import('./pages/Settings.jsx'));

function Guard({ perm, children }) {
  const { can } = useAuth();
  if (perm && !can(perm)) {
    return (
      <div className="card p-8 text-center text-sm text-ink-600">
        You do not have access to this screen. <Link className="font-semibold text-brand-700 underline" to="/lab">Go to Lab Dashboard</Link>
      </div>
    );
  }
  return children;
}

// Lab pages expect Lab's toast and confirm providers around them.
function LabShell() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Outlet />
      </ConfirmProvider>
    </ToastProvider>
  );
}

export const LAB_ROUTES = [
  <Route key="lab" path="/lab" element={<LabShell />}>
    <Route index element={<Dashboard />} />
    <Route path="tests" element={<Tests />} />
    <Route path="fees" element={<Fees />} />
    <Route path="assignments" element={<Assignments />} />
    <Route path="assignments/new" element={<Guard perm="editAssignments"><AssignmentForm /></Guard>} />
    <Route path="assignments/:id" element={<AssignmentForm />} />
    <Route path="results" element={<Results />} />
    <Route path="settings" element={<Guard perm="manageSettings"><SettingsPage /></Guard>} />
  </Route>,
];

export const LAB_PRINT_ROUTES = [
  <Route key="lab-print" path="/lab/results/:assignmentId/print" element={<LabShell />}>
    <Route index element={<Report />} />
  </Route>,
];
