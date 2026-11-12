import { Link } from 'react-router-dom';
import { Users, ClipboardList, FlaskConical, IndianRupee, Plus, FileText } from 'lucide-react';
import { dashboardApi } from '../api.js';
import { useAuth } from '../useLabAuth.js';
import { PageHeader, Spinner, ErrorState, EmptyState, StatusBadge, useLoad } from '../components/ui.jsx';
import { fmtDate, money } from '../utils/format.js';

function Stat({ label, value, icon: Icon, to }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-4 hover:border-brand-300">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon size={20} /></span>
      <div>
        <p className="text-xl font-bold text-ink-900">{value}</p>
        <p className="text-xs font-medium text-ink-500">{label}</p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const { data, loading, error, reload } = useLoad(() => dashboardApi.get());
  return (
    <div>
      <PageHeader title={`Welcome, ${user?.fullName || ''}`} subtitle={`Signed in as ${user?.role}`}
        actions={<>
          {can('editPatients') && <Link to="/clinic/registration/patient" className="btn-secondary"><Plus size={16} /> Patient</Link>}
          {can('editAssignments') && <Link to="/lab/assignments/new" className="btn-primary"><Plus size={16} /> Assign tests</Link>}
          {can('enterResults') && <Link to="/lab/results" className="btn-secondary"><FileText size={16} /> Enter results</Link>}
        </>} />
      {loading && !data ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={`Patients (${data.counts.patients_today} today)`} value={data.counts.patients} icon={Users} to="/clinic/registration/patient-list" />
            <Stat label="Assignments today" value={data.counts.assignments_today} icon={ClipboardList} to="/lab/assignments" />
            <Stat label="Tests in master" value={data.counts.tests} icon={FlaskConical} to="/lab/tests" />
            <Stat label="Billed today" value={'₹ ' + money(data.counts.amount_today)} icon={IndianRupee} to="/lab/assignments" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Pending', data.counts.pending], ['Sample Collected', data.counts.sample_collected], ['In Progress', data.counts.in_progress], ['Completed', data.counts.completed]].map(([s, n]) => (
              <Link key={s} to={`/lab/assignments?status=${encodeURIComponent(s)}`} className="card flex items-center justify-between p-3 hover:border-brand-300">
                <StatusBadge status={s} /><span className="text-lg font-bold">{n}</span>
              </Link>
            ))}
          </div>
          <div className="card-flush mt-4">
            <h2 className="border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-800">Open assignments</h2>
            {!data.open.length ? <EmptyState message="No open assignments." /> : (
              <ul className="divide-y divide-ink-100">
                {data.open.map((a) => (
                  <li key={a.assignment_id}>
                    <Link to={`/lab/assignments/${a.assignment_id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-brand-50/40">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{a.full_name} <span className="font-normal text-ink-500">· {a.patient_code}</span></p>
                        <p className="text-xs text-ink-500">{a.assignment_no} · {fmtDate(a.assignment_date)} · ₹ {money(a.net_amount)}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
