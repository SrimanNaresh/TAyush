import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Crown, CalendarClock, Pencil, RefreshCw, Users, UserPlus, ListChecks, IndianRupee, FileText,
  Receipt, CalendarDays, Wallet, Boxes, AlertTriangle, ClipboardList, Clock, CheckCircle2, FlaskConical,
  Activity, Stethoscope, Pill, TestTube, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { activityApi } from '../api/client.js';
import { usePlan, refreshPlan } from '../hooks/usePlan.js';
import { patientApi, confirmApi, prescriptionApi, billingApi } from '../modules/clinic/api.js';
import { dashboardApi as pharmacyDashboardApi } from '../modules/pharmacy/api.js';
import { dashboardApi as labDashboardApi } from '../modules/lab/api.js';
import { StatCards, QueueSteps } from '../modules/clinic/components/DashboardKit.jsx';

// Admin / Super Admin home: plan and validity, today's figures for every
// module, the clinic queue, pharmacy alerts and the latest activity across
// Clinic, Pharmacy and Lab, on one page. Each figure comes from that module's
// own API, so it matches the module's dashboard exactly.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtWhen = (d) => {
  if (!d) return '';
  const t = new Date(d);
  const sameDay = t.toDateString() === new Date().toDateString();
  return sameDay ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const MODULE_STYLE = {
  clinic: { icon: Stethoscope, chip: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  pharmacy: { icon: Pill, chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  lab: { icon: TestTube, chip: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
};

const PLAN_STYLE = {
  active: { label: 'Active', chip: 'bg-emerald-100 text-emerald-700' },
  expiring: { label: 'Expiring soon', chip: 'bg-amber-100 text-amber-800' },
  expired: { label: 'Expired', chip: 'bg-red-100 text-red-700' },
  none: { label: 'Not set', chip: 'bg-ink-100 text-ink-600' },
};

function Section({ icon: Icon, title, tone, to, children }) {
  return (
    <div className="card !p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}><Icon size={15} /></span>
        <p className="flex-1 text-14 font-bold text-ink-800">{title}</p>
        {to && <Link to={to} className="flex items-center gap-1 text-12 font-semibold text-brand-700 hover:underline">Open <ArrowRight size={12} /></Link>}
      </div>
      {children}
    </div>
  );
}

export default function SuperDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const plan = usePlan();
  const navigate = useNavigate();
  const [clinic, setClinic] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [lab, setLab] = useState(null);
  const [activity, setActivity] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const d = today();
    refreshPlan();
    const [patients, queue, rx, bill, ph, lb, act] = await Promise.all([
      patientApi.list().catch(() => []),
      confirmApi.list(d).catch(() => []),
      prescriptionApi.list().catch(() => []),
      billingApi.patients(d).catch(() => ({ totalAmount: 0 })),
      pharmacyDashboardApi.get().catch(() => null),
      labDashboardApi.get().catch(() => null),
      activityApi.list(30).catch(() => []),
    ]);
    setClinic({
      patients: patients.length,
      newToday: patients.filter((p) => String(p.CreatedAt || '').slice(0, 10) === d).length,
      queue,
      prescriptionsToday: rx.filter((x) => String(x.CreatedAt || '').slice(0, 10) === d).length,
      revenueToday: bill.totalAmount || 0,
    });
    setPharmacy(ph);
    setLab(lb);
    setActivity(act);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const ps = PLAN_STYLE[plan?.status || 'none'];
  const counts = { Confirm: 0, 'Pre-Examine': 0, Examine: 0, Billing: 0, Completed: 0 };
  for (const q of clinic?.queue || []) if (counts[q.Status] != null) counts[q.Status] += 1;
  const queueSteps = [
    { key: 'Confirm', label: 'Waiting', icon: Clock, color: 'text-brand-600 bg-brand-50' },
    { key: 'Pre-Examine', label: 'Vitals Pending', icon: Activity, color: 'text-rose-600 bg-rose-50' },
    { key: 'Examine', label: 'With Doctor', icon: Stethoscope, color: 'text-purple-600 bg-purple-50' },
    { key: 'Billing', label: 'Billing', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { key: 'Completed', label: 'Completed', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50' },
  ];
  const lc = lab?.counts || {};
  const shownActivity = moduleFilter === 'all' ? activity : activity.filter((a) => a.Module === moduleFilter);

  return (
    <div className="space-y-3">
      {/* Header strip: who, today, plan and validity */}
      <div className="flex flex-col gap-2 rounded-xl bg-gradient-to-br from-slate-800 via-ink-900 to-slate-900 px-4 py-2.5 text-white shadow-card sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-0.5">
          <h1 className="flex items-center gap-2 text-lg font-bold leading-tight sm:text-xl">
            <Crown size={17} className="text-amber-300" />
            Super Admin Dashboard
          </h1>
          <p className="flex items-center gap-1.5 text-12 font-medium text-white/70">
            <CalendarDays size={12} /> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="hidden text-12 text-white/70 md:block">All activity across Clinic, Pharmacy and Lab.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-12">
            <CalendarClock size={14} className="text-white/80" />
            <div className="leading-tight">
              <p className="font-semibold">{plan?.planName || 'No plan set'}</p>
              <p className="text-white/70">
                {plan?.validUntil ? <>Valid until {fmtDate(plan.validUntil)}{plan.daysLeft != null && ` · ${plan.daysLeft < 0 ? `${-plan.daysLeft} day(s) ago` : `${plan.daysLeft} day(s) left`}`}</> : 'Validity not set'}
              </p>
            </div>
            <span className={`ml-1 rounded-full px-2 py-0.5 text-11 font-semibold ${ps.chip}`}>{ps.label}</span>
          </div>
          {user?.isSuperAdmin && (
            <button type="button" onClick={() => navigate('/clinic/master/clinic-details?tab=validity')} title="Edit plan, validity and Menu Rights" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25">
              <Pencil size={14} />
            </button>
          )}
          <button type="button" onClick={load} disabled={loading} title="Refresh" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && !clinic ? (
        <div className="flex items-center justify-center py-16">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            {/* Today across the modules */}
            <Section icon={Stethoscope} title="Clinic — today" tone="bg-sky-50 text-sky-600" to="/clinic/dashboard/admin">
              <StatCards cards={[
                { label: 'Total Patients', value: clinic.patients, icon: Users, ring: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' },
                { label: 'New Patients Today', value: clinic.newToday, icon: UserPlus, ring: 'bg-teal-50 text-teal-600', bar: 'bg-teal-400' },
                { label: "Today's Tokens", value: clinic.queue.length, icon: ListChecks, ring: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400' },
                { label: "Today's Revenue", value: money(clinic.revenueToday), icon: IndianRupee, ring: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400' },
              ]} />
              <div className="mt-2.5"><QueueSteps steps={queueSteps} counts={counts} /></div>
              <p className="mt-2 text-12 text-ink-500"><FileText size={12} className="mr-1 inline" />{clinic.prescriptionsToday} prescription(s) written today</p>
            </Section>

            <Section icon={Pill} title="Pharmacy — today" tone="bg-emerald-50 text-emerald-600" to="/pharmacy">
              {pharmacy ? (
                <>
                  <StatCards cards={[
                    { label: `Today's Sales (${pharmacy.todayBills} bills)`, value: money(pharmacy.todaySales), icon: Receipt, ring: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400' },
                    { label: "This Month's Sales", value: money(pharmacy.monthSales), icon: CalendarDays, ring: 'bg-sky-50 text-sky-600', bar: 'bg-sky-500' },
                    { label: 'Payable to Vendors', value: money(pharmacy.payable), icon: Wallet, ring: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400' },
                    { label: 'Stock Value', value: money(pharmacy.stockValue), icon: Boxes, ring: 'bg-indigo-50 text-indigo-600', bar: 'bg-indigo-400' },
                  ]} />
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    <Link to="/pharmacy/stock-report" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-13 ${pharmacy.lowStockCount ? 'bg-amber-50 text-amber-800' : 'bg-ink-50 text-ink-500'}`}>
                      <AlertTriangle size={15} /> <b>{pharmacy.lowStockCount}</b> item(s) low on stock (≤ {pharmacy.lowStockLimit})
                    </Link>
                    <Link to="/pharmacy/stock-report" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-13 ${pharmacy.expiringCount ? 'bg-red-50 text-red-700' : 'bg-ink-50 text-ink-500'}`}>
                      <CalendarClock size={15} /> <b>{pharmacy.expiringCount}</b> batch(es) expiring in {pharmacy.expiryDays} days
                    </Link>
                  </div>
                </>
              ) : <p className="py-3 text-center text-12 text-ink-400">Pharmacy figures could not be loaded.</p>}
            </Section>

            <Section icon={TestTube} title="Lab — today" tone="bg-violet-50 text-violet-600" to="/lab">
              {lab ? (
                <StatCards cards={[
                  { label: `Assignments Today`, value: lc.assignments_today ?? 0, icon: ClipboardList, ring: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500' },
                  { label: 'Pending / Sample / In Progress', value: `${lc.pending ?? 0} / ${lc.sample_collected ?? 0} / ${lc.in_progress ?? 0}`, icon: FlaskConical, ring: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400' },
                  { label: 'Completed', value: lc.completed ?? 0, icon: CheckCircle2, ring: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400' },
                  { label: "Today's Lab Amount", value: money(lc.amount_today), icon: IndianRupee, ring: 'bg-sky-50 text-sky-600', bar: 'bg-sky-500' },
                ]} />
              ) : <p className="py-3 text-center text-12 text-ink-400">Lab figures could not be loaded.</p>}
            </Section>
          </div>

          {/* Right: the latest activity, newest first */}
          <aside className="card !p-3 shrink-0 xl:sticky xl:top-2 xl:w-80">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Recent Activity</p>
              <div className="flex gap-1">
                {['all', 'clinic', 'pharmacy', 'lab'].map((m) => (
                  <button key={m} type="button" onClick={() => setModuleFilter(m)}
                    className={`rounded-md px-1.5 py-0.5 text-11 font-semibold capitalize ${moduleFilter === m ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-ink-100'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {shownActivity.length === 0 ? (
              <p className="py-6 text-center text-12 text-ink-400">No activity yet.</p>
            ) : (
              <ul className="max-h-[70vh] space-y-0.5 overflow-y-auto pr-1">
                {shownActivity.map((a, i) => {
                  const st = MODULE_STYLE[a.Module] || MODULE_STYLE.clinic;
                  return (
                    <li key={`${a.Kind}-${a.At}-${i}`} className="flex items-start gap-2 rounded-lg px-1.5 py-1.5 hover:bg-ink-50">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${st.chip}`}><st.icon size={13} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-13 font-semibold text-ink-700">{a.Kind}: {a.Title}</p>
                        <p className="truncate text-11 text-ink-400">{a.Detail}{a.Amount != null && ` · ${money(a.Amount)}`}</p>
                      </div>
                      <span className="shrink-0 text-11 text-ink-400">{fmtWhen(a.At)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      )}

    </div>
  );
}
