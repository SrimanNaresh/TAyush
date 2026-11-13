import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Stethoscope, FileText, ListChecks, Clock, Activity, CheckCircle2, Calendar, Printer, History,
} from 'lucide-react';
import { Spinner, EmptyState } from '../../../components/ui.jsx';
import { StatCards, DashTabs, QueueSteps, QuickActionsPanel } from '../components/DashboardKit.jsx';
import { patientApi, confirmApi, prescriptionApi } from '../api.js';

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
  { label: 'Examine', desc: 'Write today\'s prescription', to: '/clinic/confirm/prescription', icon: Stethoscope, color: 'from-purple-500 to-indigo-600' },
  { label: 'Prescription Preview', desc: 'Preview and print', to: '/clinic/confirm/prescription-print', icon: Printer, color: 'from-indigo-400 to-indigo-600' },
  { label: 'Confirm List', desc: "Today's token queue", to: '/clinic/confirm/list', icon: ListChecks, color: 'from-amber-400 to-amber-600' },
  { label: 'Patient List', desc: 'Search all patients', to: '/clinic/reports/patient-list', icon: Users, color: 'from-slate-400 to-slate-600' },
  { label: 'Medical History', desc: 'Review past visits', to: '/clinic/reports/medical-history', icon: History, color: 'from-teal-400 to-teal-600' },
];

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('queue');
  const [patients, setPatients] = useState([]);
  const [queue, setQueue] = useState([]);
  const [prescriptionsToday, setPrescriptionsToday] = useState(0);

  useEffect(() => {
    Promise.all([
      patientApi.list().catch(() => []),
      confirmApi.list(today()).catch(() => []),
      prescriptionApi.list().catch(() => []),
    ]).then(([p, c, pr]) => {
      setPatients(p);
      setQueue(c);
      setPrescriptionsToday(pr.filter((x) => (x.CreatedAt || '').slice(0, 10) === today()).length);
      setLoading(false);
    });
  }, []);

  const counts = {
    Confirm: queue.filter((q) => q.Status === 'Confirm').length,
    'Pre-Examine': queue.filter((q) => q.Status === 'Pre-Examine').length,
    Examine: queue.filter((q) => q.Status === 'Examine').length,
    Billing: queue.filter((q) => q.Status === 'Billing').length,
    Completed: queue.filter((q) => q.Status === 'Completed').length,
  };
  const inQueue = counts['Pre-Examine'] + counts.Examine;

  const cards = [
    { label: 'Total Patients', value: patients.length, icon: Users, ring: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' },
    { label: 'Waiting for Consultation', value: inQueue, icon: Clock, ring: 'bg-rose-50 text-rose-600', bar: 'bg-rose-400' },
    { label: 'Billing Today', value: counts.Billing, icon: CheckCircle2, ring: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400' },
    { label: 'Prescriptions Today', value: prescriptionsToday, icon: FileText, ring: 'bg-purple-50 text-purple-600', bar: 'bg-purple-400' },
  ];

  const queueSteps = [
    { key: 'Confirm', label: 'Waiting', icon: Clock, color: 'text-brand-600 bg-brand-50' },
    { key: 'Pre-Examine', label: 'Vitals Pending', icon: Activity, color: 'text-rose-600 bg-rose-50' },
    { key: 'Examine', label: 'With Doctor', icon: Stethoscope, color: 'text-purple-600 bg-purple-50' },
    { key: 'Billing', label: 'Billing', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { key: 'Completed', label: 'Completed', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50' },
  ];

  const waiting = queue
    .filter((q) => q.Status === 'Pre-Examine' || q.Status === 'Examine')
    .sort((a, b) => (a.TokenNo || 0) - (b.TokenNo || 0));

  const openPrescription = (row) =>
    navigate('/clinic/confirm/prescription', { state: { patient: { PatientId: row.PatientId, Name: row.PatientName, MobileNo: row.MobileNo, Address: row.Address } } });

  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-4 py-2.5 text-white shadow-card sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
          <h1 className="text-lg font-bold leading-tight sm:text-xl">Doctor Dashboard</h1>
          <p className="flex items-center gap-1.5 text-12 font-medium text-white/80">
            <Calendar size={12} /> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="hidden text-12 text-white/80 md:block">See who's waiting, open a consultation and write prescriptions — all from one place.</p>
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
                  { key: 'waiting', label: 'Waiting for Consultation', icon: Stethoscope, badge: waiting.length },
                ]}
                tab={tab}
                onChange={setTab}
              />
              {tab === 'queue' && <QueueSteps steps={queueSteps} counts={counts} />}
              {tab === 'waiting' && (waiting.length === 0 ? (
                <EmptyState message="No patients waiting right now." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-13">
                    <thead>
                      <tr className="table-head">
                        <th className="rounded-l-lg px-2.5 py-1.5">Token</th>
                        <th className="px-2.5 py-1.5">Patient</th>
                        <th className="px-2.5 py-1.5">Mobile</th>
                        <th className="px-2.5 py-1.5">Confirmed</th>
                        <th className="px-2.5 py-1.5">Status</th>
                        <th className="rounded-r-lg px-2.5 py-1.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waiting.map((r) => (
                        <tr key={r.ConfirmId} className="table-row">
                          <td className="px-2.5 py-1">
                            <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 px-2 text-sm font-bold text-white">
                              {r.TokenNo ?? '-'}
                            </span>
                          </td>
                          <td className="px-2.5 py-1">
                            <p className="font-medium text-slate-700">{r.PatientName}</p>
                            <p className="text-xs text-slate-400">ID #{r.PatientId}</p>
                          </td>
                          <td className="px-2.5 py-1 text-slate-500">{r.MobileNo || '-'}</td>
                          <td className="px-2.5 py-1 text-slate-500">{fmtTime(r.ConfirmedAt)}</td>
                          <td className="px-2.5 py-1">
                            <span className={`badge ${statusColor[r.Status] || 'bg-slate-100 text-slate-600'}`}>{r.Status}</span>
                          </td>
                          <td className="px-2.5 py-1 text-right">
                            <button className="btn-secondary py-1.5 text-xs" onClick={() => openPrescription(r)}>
                              <Stethoscope size={13} /> Open
                            </button>
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
