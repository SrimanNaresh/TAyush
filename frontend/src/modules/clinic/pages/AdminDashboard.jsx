import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserPlus, Pill, ShieldCheck, ArrowRight,
  ListChecks, Clock, Activity, Stethoscope, CheckCircle2, Calendar,
  IndianRupee, CalendarDays, FileText, UserCog, Building2,
} from 'lucide-react';
import { Spinner, EmptyState } from '../../../components/ui.jsx';
import { patientApi, employeeApi, userApi, confirmApi, prescriptionApi, billingApi } from '../api.js';
import { linkApi } from '../../../api/client.js';
import { QuickActionsPanel } from '../components/DashboardKit.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-');
const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const statusColor = {
  Confirm: 'bg-brand-100 text-brand-700',
  'Pre-Examine': 'bg-rose-100 text-rose-700',
  Examine: 'bg-purple-100 text-purple-700',
  Billing: 'bg-emerald-100 text-emerald-700',
  Completed: 'bg-teal-100 text-teal-800',
};

const quickLinks = [
  { label: 'User Master', desc: 'Manage login accounts', to: '/settings/user', icon: UserCog, color: 'from-slate-500 to-slate-700' },
  { label: 'Menu Access', desc: 'Grant screen permissions', to: '/settings/menu-access', icon: ShieldCheck, color: 'from-amber-500 to-amber-700' },
  { label: 'Clinic Master', desc: 'Branding and contact details', to: '/clinic/master/clinic-details', icon: Building2, color: 'from-teal-500 to-teal-700' },
  { label: 'Medication List', desc: 'Medicines from Pharmacy Stock In', to: '/clinic/master/medication-list', icon: Pill, color: 'from-brand-500 to-brand-700' },
  { label: 'Employee List', desc: 'Manage clinic staff', to: '/clinic/registration/employee-list', icon: UserPlus, color: 'from-emerald-500 to-emerald-700' },
  { label: 'Billing Month Wise', desc: 'Revenue reports', to: '/clinic/billing/month-wise', icon: IndianRupee, color: 'from-rose-500 to-rose-700' },
];

const TABS = [
  { key: 'operations', label: "Today's Operations", icon: ListChecks },
  { key: 'tokens', label: "Today's Tokens", icon: Clock },
  { key: 'team', label: 'Team Dashboards', icon: Users },
];

const teamDashboards = [
  { label: 'Reception Dashboard', desc: 'Patients, tokens and vitals', to: '/clinic/dashboard/reception', icon: Users, color: 'from-brand-400 to-teal-600' },
  { label: 'Doctor Dashboard', desc: 'Consultations and prescriptions', to: '/clinic/dashboard/doctor', icon: Stethoscope, color: 'from-indigo-500 to-purple-600' },
];

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('operations');
  const [patients, setPatients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [medications, setMedications] = useState([]);
  const [users, setUsers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [prescriptionsToday, setPrescriptionsToday] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueMonth, setRevenueMonth] = useState(0);

  useEffect(() => {
    Promise.all([
      patientApi.list().catch(() => []),
      employeeApi.list().catch(() => []),
      linkApi.medicines().catch(() => []),
      userApi.list().catch(() => []),
      confirmApi.list(today()).catch(() => []),
      prescriptionApi.list().catch(() => []),
      billingApi.patients(today()).catch(() => ({ totalAmount: 0 })),
      billingApi.report(firstOfMonth(), today()).catch(() => ({ totalAmount: 0 })),
    ]).then(([p, e, m, u, c, pr, billToday, billMonth]) => {
      setPatients(p);
      setEmployees(e);
      setMedications(m);
      setUsers(u);
      setQueue(c);
      setPrescriptionsToday(pr.filter((x) => (x.CreatedAt || '').slice(0, 10) === today()).length);
      setRevenueToday(billToday.totalAmount || 0);
      setRevenueMonth(billMonth.totalAmount || 0);
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

  const overviewCards = [
    { label: 'Total Patients', value: patients.length, icon: Users, ring: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' },
    { label: 'Total Employees', value: employees.length, icon: UserPlus, ring: 'bg-teal-50 text-teal-600', bar: 'bg-teal-400' },
    { label: 'Total Medications', value: medications.length, icon: Pill, ring: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400' },
    { label: 'User Accounts', value: users.length, icon: UserCog, ring: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' },
  ];

  const revenueCards = [
    { label: "Today's Revenue", value: fmtMoney(revenueToday), icon: IndianRupee, ring: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400' },
    { label: "This Month's Revenue", value: fmtMoney(revenueMonth), icon: CalendarDays, ring: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' },
    { label: 'Prescriptions Today', value: prescriptionsToday, icon: FileText, ring: 'bg-purple-50 text-purple-600', bar: 'bg-purple-400' },
  ];

  const queueSteps = [
    { key: 'Confirm', label: 'Waiting', icon: Clock, color: 'text-brand-600 bg-brand-50' },
    { key: 'Pre-Examine', label: 'Vitals Pending', icon: Activity, color: 'text-rose-600 bg-rose-50' },
    { key: 'Examine', label: 'With Doctor', icon: Stethoscope, color: 'text-purple-600 bg-purple-50' },
    { key: 'Billing', label: 'Billing', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { key: 'Completed', label: 'Completed', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50' },
  ];

  const recent = [...queue].sort((a, b) => (a.TokenNo || 0) - (b.TokenNo || 0)).slice(0, 8);

  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 via-slate-800 to-ink-900 px-4 py-2.5 text-white shadow-card sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
          <h1 className="text-lg font-bold leading-tight sm:text-xl">Admin Dashboard</h1>
          <p className="flex items-center gap-1.5 text-12 font-medium text-white/70">
            <Calendar size={12} /> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="hidden text-12 text-white/70 md:block">A clinic-wide view of patients, staff, revenue and today's operations.</p>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          {/* Main column: compact stat cards, then one tabbed card */}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[...overviewCards, ...revenueCards].map((c) => (
                <div key={c.label} className="relative overflow-hidden rounded-xl border border-ink-100 bg-white px-3 py-2.5 shadow-card">
                  <span className={`absolute left-0 top-0 h-full w-1 ${c.bar}`} />
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-11 font-medium leading-tight text-ink-500">{c.label}</p>
                      <p className="mt-0.5 text-xl font-bold leading-tight text-ink-800">{c.value}</p>
                    </div>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.ring}`}>
                      <c.icon size={16} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              {/* Tabs: Today's Operations | Today's Tokens | Team Dashboards */}
              <div className="-mt-1 mb-3 flex flex-wrap gap-1 border-b border-ink-100" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-13 font-semibold transition-colors ${
                      tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    <t.icon size={15} /> {t.label}
                    {t.key === 'tokens' && <span className="rounded-full bg-ink-100 px-1.5 text-11 text-ink-600">{queue.length}</span>}
                  </button>
                ))}
              </div>

              {tab === 'operations' && (
                <>
                  <p className="mb-2 text-12 text-ink-400">Where every confirmed patient stands right now</p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                    {queueSteps.map((s) => (
                      <div key={s.key} className={`rounded-xl px-3 py-2.5 ${s.color}`}>
                        <s.icon size={16} />
                        <p className="mt-1 text-xl font-bold">{counts[s.key]}</p>
                        <p className="text-xs font-medium opacity-80">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {tab === 'team' && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {teamDashboards.map((q) => (
                    <Link key={q.to} to={q.to} className="group flex items-center gap-3 rounded-xl border border-ink-100 p-3 transition-colors hover:bg-ink-50">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${q.color} text-white shadow-sm`}>
                        <q.icon size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink-700">{q.label}</p>
                        <p className="truncate text-xs text-ink-400">{q.desc}</p>
                      </div>
                      <ArrowRight size={16} className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-500" />
                    </Link>
                  ))}
                </div>
              )}

              {tab === 'tokens' && (recent.length === 0 ? (
              <EmptyState message="No confirmations for today yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-13">
                  <thead>
                    <tr className="table-head">
                      <th className="rounded-l-lg px-2.5 py-1.5">Token</th>
                      <th className="px-2.5 py-1.5">Patient</th>
                      <th className="px-2.5 py-1.5">Mobile</th>
                      <th className="px-2.5 py-1.5">Confirmed</th>
                      <th className="rounded-r-lg px-2.5 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.ConfirmId} className="table-row">
                        <td className="px-2.5 py-1">
                          <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-brand-gradient px-2 text-sm font-bold text-white">
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
