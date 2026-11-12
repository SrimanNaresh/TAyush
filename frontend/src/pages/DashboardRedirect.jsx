import { Navigate } from 'react-router-dom';

// Every login lands on the Dashboard, which shows only the modules and pages
// that login's Menu Access grants (Admin sees all).
export default function DashboardRedirect() {
  return <Navigate to="/dashboard" replace />;
}
