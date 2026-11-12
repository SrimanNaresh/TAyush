import { useEffect, useState } from 'react';
import { CalendarClock, Save, Lock, ShieldCheck, Plus, Pencil, Trash2 } from 'lucide-react';
import { CardHeader, Modal } from '../../../components/ui.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { planApi } from '../../../api/client.js';
import { usePlan, refreshPlan } from '../../../hooks/usePlan.js';

// Clinic Master > Validity: the plan (name, start and end date) and its Menu
// Rights (which main menus the plan includes). Only a Super Admin can change
// it; an Admin sees it read-only. Menu Access and the top menu show only the
// main menus ticked here (Dashboard and Configuration are always on).
const STATUS = {
  active: { label: 'Active', chip: 'bg-emerald-100 text-emerald-700' },
  expiring: { label: 'Expiring soon', chip: 'bg-amber-100 text-amber-800' },
  expired: { label: 'Expired', chip: 'bg-red-100 text-red-700' },
  none: { label: 'Not set', chip: 'bg-ink-100 text-ink-600' },
};
const ALL = ['Registration', 'Clinic', 'Pharmacy', 'Lab', 'Billing', 'Reports'];
const day = (d) => (d ? String(d).slice(0, 10) : '');

export default function ValidityTab({ show }) {
  const { user } = useAuth();
  const canEdit = !!user?.isSuperAdmin;
  const plan = usePlan();
  const all = plan?.allModules || ALL;
  const alwaysOn = plan?.alwaysOn || ['Dashboard', 'Configuration'];
  const [f, setF] = useState({ planName: '', startDate: '', validUntil: '', notes: '', modules: ALL });
  const [saving, setSaving] = useState(false);
  // Plan master list + its Add / Edit dialog
  const [plans, setPlans] = useState([]);
  const [planDlg, setPlanDlg] = useState(null); // { mode: 'add' | 'edit', id?, name }
  const loadPlans = () => planApi.plans().then(setPlans).catch(() => setPlans([]));
  useEffect(() => { loadPlans(); }, []);
  const selectedPlan = plans.find((p) => p.Name === f.planName);

  const savePlanName = async (e) => {
    e.preventDefault();
    const name = (planDlg?.name || '').trim();
    if (!name) return show('Plan name is required', 'error');
    try {
      const saved = planDlg.mode === 'add' ? await planApi.addPlan(name) : await planApi.renamePlan(planDlg.id, name);
      await loadPlans();
      if (planDlg.mode === 'edit' && f.planName === planDlg.oldName) await refreshPlan();
      setF((x) => ({ ...x, planName: saved.Name }));
      show(planDlg.mode === 'add' ? 'Plan added' : 'Plan renamed', 'success');
      setPlanDlg(null);
    } catch (err) {
      show(err.response?.data?.error || 'Could not save the plan', 'error');
    }
  };
  const deletePlan = async () => {
    if (!selectedPlan) return;
    if (!window.confirm(`Delete plan "${selectedPlan.Name}"?`)) return;
    try {
      await planApi.removePlan(selectedPlan.PlanId);
      await loadPlans();
      setF((x) => ({ ...x, planName: '' }));
      show('Plan deleted', 'success');
    } catch (err) {
      show(err.response?.data?.error || 'Could not delete the plan', 'error');
    }
  };

  useEffect(() => {
    if (!plan) return;
    setF({
      planName: plan.planName || '',
      startDate: day(plan.startDate),
      validUntil: day(plan.validUntil),
      notes: plan.notes || '',
      modules: plan.modules || all,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toggle = (m) => setF((x) => ({ ...x, modules: x.modules.includes(m) ? x.modules.filter((y) => y !== m) : [...x.modules, m] }));

  const save = async (e) => {
    e.preventDefault();
    if (!f.planName.trim()) return show('Plan is required', 'error');
    if (!f.validUntil) return show('End Date is required', 'error');
    if (f.startDate && f.validUntil < f.startDate) return show('End Date must be on or after the Start Date', 'error');
    setSaving(true);
    try {
      const saved = await planApi.save({ ...f, modules: all.filter((m) => f.modules.includes(m)) });
      await refreshPlan(saved);
      show('Validity and Menu Rights saved', 'success');
    } catch (err) {
      show(err.response?.data?.error || 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const st = STATUS[plan?.status || 'none'];

  return (
    <form onSubmit={save} className="card">
      <CardHeader
        icon={CalendarClock}
        title="Validity"
        subtitle="Plan, its start and end date, and the main menus it includes"
        actions={
          <div className="flex items-center gap-2 text-12">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${st.chip}`}>{st.label}</span>
            {plan?.daysLeft != null && <span className="text-ink-500">{plan.daysLeft < 0 ? `Ended ${-plan.daysLeft} day(s) ago` : `${plan.daysLeft} day(s) left`}</span>}
          </div>
        }
      />
      {!canEdit && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-12 text-ink-500">
          <Lock size={13} /> Only a Super Admin can change the plan and Menu Rights.
        </p>
      )}
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label">Plan *</label>
            <div className="flex gap-1">
              <select className="input min-w-0 flex-1" value={f.planName} onChange={set('planName')}>
                <option value="">Select plan</option>
                {/* keep a saved plan name visible even if it is not in the list */}
                {f.planName && !plans.some((p) => p.Name === f.planName) && <option value={f.planName}>{f.planName}</option>}
                {plans.map((p) => <option key={p.PlanId} value={p.Name}>{p.Name}</option>)}
              </select>
              {canEdit && (
                <>
                  <button type="button" className="btn-secondary !px-2" title="Add plan" onClick={() => setPlanDlg({ mode: 'add', name: '' })}><Plus size={15} /></button>
                  <button type="button" className="btn-secondary !px-2" title="Edit selected plan" disabled={!selectedPlan}
                    onClick={() => setPlanDlg({ mode: 'edit', id: selectedPlan.PlanId, name: selectedPlan.Name, oldName: selectedPlan.Name })}><Pencil size={15} /></button>
                  <button type="button" className="btn-secondary !px-2 text-red-500" title="Delete selected plan" disabled={!selectedPlan} onClick={deletePlan}><Trash2 size={15} /></button>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="label">Start Date</label>
            <input type="date" className="input" value={f.startDate} onChange={set('startDate')} />
          </div>
          <div>
            <label className="label">End Date *</label>
            <input type="date" className="input" value={f.validUntil} onChange={set('validUntil')} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={f.notes} onChange={set('notes')} placeholder="Users, support included..." maxLength={500} />
          </div>
        </div>

        <div className="border-t border-ink-100 pt-3">
          <p className="label flex items-center gap-1.5"><ShieldCheck size={13} /> Menu Rights (main menus in this plan)</p>
          <p className="mb-2 text-11 text-ink-400">Menu Access and the top menu show only the ticked menus. Dashboard and Configuration are always included.</p>
          <div className="flex flex-wrap gap-2">
            {alwaysOn.map((m) => (
              <span key={m} className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-ink-50 px-3 py-1.5 text-13 text-ink-500">
                <input type="checkbox" checked readOnly disabled className="h-4 w-4" /> {m}
              </span>
            ))}
            {all.map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-13 ${f.modules.includes(m) ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-ink-200 text-ink-600'}`}>
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.modules.includes(m)} onChange={() => toggle(m)} /> {m}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {canEdit && (
        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save Validity'}</button>
        </div>
      )}
      <Modal open={!!planDlg} onClose={() => setPlanDlg(null)} title={planDlg?.mode === 'add' ? 'Add Plan' : 'Edit Plan'}>
        {planDlg && (
          <div className="space-y-3">
            <div>
              <label className="label">Plan Name *</label>
              <input className="input" autoFocus value={planDlg.name} maxLength={100}
                onChange={(e) => setPlanDlg((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') savePlanName(e); }}
                placeholder="e.g. All In One - Yearly" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPlanDlg(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={savePlanName}><Save size={16} /> Save</button>
            </div>
          </div>
        )}
      </Modal>
      {plan?.updatedBy && <p className="mt-2 text-right text-11 text-ink-400">Last changed by {plan.updatedBy}{plan.updatedAt && ` on ${new Date(plan.updatedAt).toLocaleString('en-GB')}`}</p>}
    </form>
  );
}
