import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, ListChecks, Activity, Search, ClipboardList, Clock, Stethoscope, CheckCircle2, Calendar,
} from 'lucide-react';
import { Spinner, EmptyState } from '../../../components/ui.jsx';
import { StatCards, DashTabs, QueueSteps, QuickActionsPanel } from '../components/DashboardKit.jsx';
import { patientApi, confirmApi, vitalApi } from '../api.js';

const today = () => new Date().toISOString().slice(0, 10);
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-');

const statusColor = {
  Confirm: 'bg-brand-100 text-brand-700',
  'Pre-Examine': 'bg-rose-100 text-rose-700',
  Examine: 'bg-purple-100 text-purple-700',
  Billing: 'bg-emerald-100 text-emerald-700',
  Completed: 'bg-teal-100 text-teal-800',
};

const quickLinks = [
  { label: 'Register Patient', desc: 'Enroll a new patient', to: '/clinic/registration/patient', icon: UserPlus, color: 'from-brand-400 to-brand-600' },
  { label: 'Confirm & Search', desc: 'Find and confirm a patient', to: '/clinic/confirm/search', icon: Search, color: 'from-teal-400 to-teal-600' },
  { label: 'Record Vital Sign', desc: 'Capture patient vitals', to: '/clinic/confirm/vital-sign', icon: Activity, color: 'from-rose-400 to-rose-600' },
  { label: 'Confirm List', desc: "Today's token queue", to: '/clinic/confirm/list', icon: ListChecks, color: 'from-amber-400 to-amber-600' },
  { label: 'Vital Sign List', desc: 'Browse recorded vitals', to: '/clinic/confirm/vital-sign-list', icon: ClipboardList, color: 'from-indigo-400 to-indigo-600' },
  { label: 'Patient List', desc: 'Search all patients', to: '/clinic/reports/patient-list', icon: Users, color: 'from-slate-400 to-slate-600' },
];

export default function ReceptionDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('queue');
  const [patients, setPatients] = useState([]);
  const [queue, setQueue] = useState([]);
  const [vitalsToday, setVitalsToday] = useState(0);

  useEffect(() => {
    Promise.all([
      patientApi.list().catch(() => []),
      confirmApi.list(today()).catch(() => []),
      vitalApi.list({ date: today() }).catch(() => []),
    ]).then(([p, c, v]) => {
      setPatients(p);
      setQueue(c);
      setVitalsToday(v.length);
      setLoading(false);
    });
  }, []);

  const newToday = patients.filter((p) => (p.CreatedAt || '').slice(0, 10) === today()).length;
  const counts = {
    Confirm: queue.filter((q) => q.Status === 'Confirm').length,
    'Pre-Examine': queue.filter((q) => q.Status === 'Pre-Examine').length,
    Examine: queue.filter((q) => q.Status === 'Examine').length,
    Billing: queue.filter((q) => q.Status === 'Billing').length,
    Completed: queue.filter((q) => q.Status === 'Completed').length,
  };

  const cards = [
    { label: 'Total Patients', value: patients.length, icon: Users, ring: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' },
    { label: 'New Patients Today', value: newToday, icon: UserPlus, ring: 'bg-teal-50 text-teal-600', bar: 'bg-teal-400' },
    { label: "Today's Tokens", value: queue.length, icon: ListChecks, ring: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400' },
    { label: 'Vitals Recorded Today', value: vitalsToday, icon: Activity, ring: 'bg-rose-50 text-rose-600', bar: 'bg-rose-400' },
  ];

  const queueSteps = [
    { key: 'Confirm', label: 'Waiting', icon: Clock, color: 'text-brand-600 bg-brand-50' },
    { key: 'Pre-Examine', label: 'Vitals Pending', icon: Activity, color: 'text-rose-600 bg-rose-50' },
    { key: 'Examine', label: 'With Doctor', icon: Stethoscope, color: 'text-purple-600 bg-purple-50' },
    { key: 'Billing', label: 'Billing', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { key: 'Completed', label: 'Completed', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50' },
  ];

  const recent = [...queue].sort((a, b) => (a.TokenNo || 0) - (b.TokenNo || 0)).slice(0, 8);

  const openVital = (row) =>
    navigate('/clinic/confirm/vital-sign', { state: { patient: { PatientId: row.PatientId, Name: row.PatientName, MobileNo: row.MobileNo, Address: row.Address } } });

  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-xl bg-brand-gradient px-4 py-2.5 text-white shadow-card sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
          <h1 className="text-lg font-bold leading-tight sm:text-xl">Reception Dashboard</h1>
          <p className="flex items-center gap-1.5 text-12 font-medium text-white/80">
            <Calendar size={12} /> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="hidden text-12 text-white/80 md:block">Register patients, confirm today's tokens and record vitals — all from one place.</p>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          {/* Main column: compact stat cards, then one tabbed card */}
          <div className="min-w-0 flex-1 space-y-3">
            <StatCards cards={cards} />
            <div className="card">
              <DashTabs
                tabs={[
                  { key: 'queue', label: "Today's Queue", icon: ListChecks },
                  { key: 'tokens', label: "Today's Tokens", icon: Clock, badge: recent.length },
                ]}
                tab={tab}
                onChange={setTab}
              />
              {tab === 'queue' && <QueueSteps steps={queueSteps} counts={counts} />}
              {tab === 'tokens' && (recent.length === 0 ? (
                <EmptyState message="No confirmations for today yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="table-head">
                        <th className="rounded-l-lg px-3 py-3">Token</th>
                        <th className="px-3 py-3">Patient</th>
                        <th className="px-3 py-3">Mobile</th>
                        <th className="px-3 py-3">Confirmed</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="rounded-r-lg px-3 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r) => (
                        <tr key={r.ConfirmId} className="table-row">
                          <td className="px-3 py-3">
                            <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-brand-gradient px-2 text-sm font-bold text-white">
                              {r.TokenNo ?? '-'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-700">{r.PatientName}</p>
                            <p className="text-xs text-slate-400">ID #{r.PatientId}</p>
                          </td>
                          <td className="px-3 py-3 text-slate-500">{r.MobileNo || '-'}</td>
                          <td className="px-3 py-3 text-slate-500">{fmtTime(r.ConfirmedAt)}</td>
                          <td className="px-3 py-3">
                            <span className={`badge ${statusColor[r.Status] || 'bg-slate-100 text-slate-600'}`}>{r.Status}</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            {r.Status === 'Confirm' && (
                              <button className="btn-secondary py-1.5 text-xs" onClick={() => openVital(r)}>
                                <Activity size={13} /> Record Vital
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          {/* Right column: Quick Actions with search */}
          <QuickActionsPanel links={quickLinks} />
        </div>
      )}
    </div>
  );
}
