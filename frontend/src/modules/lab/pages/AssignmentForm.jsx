import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Search, FileText, Printer, TestTube } from 'lucide-react';
import { assignmentApi, feeApi, patientApi, errMsg } from '../api.js';
import { linkApi } from '../../../api/client.js';
import { useAuth } from '../useLabAuth.js';
import { PageHeader, Spinner, ErrorState, StatusBadge, Field, useToast, useConfirm } from '../components/ui.jsx';
import PatientPicker from '../components/PatientPicker.jsx';
import { PhoneFooter } from '../../../components/PhoneLayout.jsx';
import { money, todayStr, ymd, fmtDate } from '../utils/format.js';

const MANUAL = ['Pending', 'Sample Collected', 'In Progress'];

export default function AssignmentForm() {
  const { id } = useParams();
  const isNew = !id;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useAuth();
  const editable = can('editAssignments');

  const [tests, setTests] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [patient, setPatient] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoadErr('');
    try {
      const [fees, a] = await Promise.all([feeApi.list(), isNew ? null : assignmentApi.get(id)]);
      setTests(fees);
      if (a) {
        setAssignment(a);
        setPatient({ patient_id: a.patient_id, patient_code: a.patient_code, full_name: a.full_name, gender: a.gender, age: a.age, phone: a.phone });
        setDate(ymd(a.assignment_date));
        setNotes(a.notes || '');
        setSelected(a.tests.map((t) => t.test_id));
      } else if (params.get('prescription')) {
        // Phase 5 link: patient and prescribed tests from a clinic prescription.
        const link = await linkApi.prescription(params.get('prescription'));
        setPatient(await patientApi.get(link.patient.PatientId));
        const known = new Set(fees.map((f) => f.test_id));
        setSelected(link.labTests.filter((t) => t.labTest && known.has(t.labTest.test_id)).map((t) => t.labTest.test_id));
        const missing = link.labTests.filter((t) => !t.labTest || !known.has(t.labTest.test_id)).map((t) => t.name);
        if (missing.length) toast(`Not in Lab Test Master, add by hand: ${missing.join(', ')}`, 'error');
        setNotes(`From prescription #${link.prescription.PrescriptionId}`);
      } else if (params.get('patient')) {
        setPatient(await patientApi.get(params.get('patient')));
      }
    } catch (e) { setLoadErr(errMsg(e)); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  // Price per selected test: the saved price for tests already on the assignment, otherwise today's fee.
  const lines = useMemo(() => {
    if (!tests) return [];
    return selected.map((tid) => {
      const saved = assignment?.tests.find((t) => t.test_id === tid);
      if (saved) return { ...saved, saved: true };
      const t = tests.find((x) => x.test_id === tid);
      return t ? { test_id: tid, test_code: t.test_code, test_name: t.test_name, fee_amount: t.fee_amount, discount_amount: t.discount_amount, net_amount: t.net_amount, status: 'Pending', value_count: 0 } : null;
    }).filter(Boolean);
  }, [selected, tests, assignment]);
  const totals = lines.reduce((s, l) => ({ fee: s.fee + Number(l.fee_amount), disc: s.disc + Number(l.discount_amount) }), { fee: 0, disc: 0 });

  const toggle = (tid) => setSelected((s) => (s.includes(tid) ? s.filter((x) => x !== tid) : [...s, tid]));
  const shownTests = (tests || []).filter((t) => {
    const f = filter.trim().toLowerCase();
    return !f || t.test_name.toLowerCase().includes(f) || t.test_code.toLowerCase().includes(f);
  });

  const save = async () => {
    const errs = {};
    if (!patient) errs.patient = 'Select a patient';
    if (!selected.length) errs.tests = 'Select at least one test';
    if (!date) errs.date = 'Date is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = { patient_id: patient.patient_id, assignment_date: date, notes, test_ids: selected };
      if (isNew) {
        const r = await assignmentApi.create(body);
        toast(`Assignment ${r.assignment_no} saved`);
        navigate(`/lab/assignments/${r.assignment_id}`, { replace: true });
      } else {
        await assignmentApi.update(id, body);
        toast('Assignment updated');
        load();
      }
    } catch (e) { toast(errMsg(e), 'error'); } finally { setSaving(false); }
  };

  const setTestStatus = async (t, status) => {
    try { await assignmentApi.setTestStatus(id, t.assignment_test_id, status); toast(`${t.test_name}: ${status}`); load(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const setAll = async (status) => {
    try { await assignmentApi.setStatus(id, status); toast(`Open tests marked ${status}`); load(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const remove = async () => {
    if (!(await confirm({ message: `Delete assignment ${assignment.assignment_no}? Its assigned tests and any entered results will be deleted. This cannot be undone.` }))) return;
    try { await assignmentApi.remove(id); toast('Assignment deleted'); navigate('/lab/assignments', { replace: true }); } catch (e) { toast(errMsg(e), 'error'); }
  };

  if (loadErr) return <ErrorState message={loadErr} onRetry={load} />;
  if (!tests || (!isNew && !assignment)) return <Spinner />;

  const locked = !editable;
  return (
    <div>
      <PageHeader
        title={isNew ? 'Assign tests' : `Assignment ${assignment.assignment_no}`}
        subtitle={isNew ? 'Choose a patient and the tests to perform' : <span className="inline-flex items-center gap-2">{fmtDate(assignment.assignment_date)} <StatusBadge status={assignment.status} />{assignment.created_by_name && <span>· by {assignment.created_by_name}</span>}</span>}
        actions={<>
          <Link to="/lab/assignments" className="btn-secondary"><ArrowLeft size={16} /> Back</Link>
          {!isNew && assignment.result_status === 'Completed' && <Link to={`/lab/results/${id}/print`} target="_blank" className="btn-secondary"><Printer size={16} /> Print report</Link>}
          {!isNew && <Link to={`/lab/results?assignment=${id}&patient=${assignment.patient_id}`} className="btn-secondary"><FileText size={16} /> Results</Link>}
          {!isNew && can('deleteAssignments') && <button className="btn-danger" onClick={remove}><Trash2 size={16} /> Delete</button>}
          {!locked && <button className="btn-primary max-md:hidden" onClick={save} disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save'}</button>}
        </>} />
      {!locked && (
        <PhoneFooter>
          <button className="btn-primary" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : `Save · ₹ ${money(totals.fee - totals.disc)}`}</button>
        </PhoneFooter>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="min-w-0 space-y-4">
          <div className="card space-y-3 p-4">
            <Field label="Patient" htmlFor="patient-picker" required error={errors.patient}>
              <PatientPicker value={patient} onChange={setPatient} disabled={!isNew || locked} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Assignment date" htmlFor="af-date" required error={errors.date}>
                <input id="af-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} disabled={locked} />
              </Field>
              <Field label="Notes" htmlFor="af-notes"><input id="af-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} disabled={locked} /></Field>
            </div>
          </div>

          {!locked && (
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-bold text-ink-800">Select tests</h2>
              {errors.tests && <p className="field-error mb-2" role="alert">{errors.tests}</p>}
              <div className="relative mb-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input className="input pl-9" placeholder="Filter tests…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter tests" />
              </div>
              {!tests.length ? <p className="py-4 text-center text-sm text-ink-500">No tests in Test Master yet.</p> : (
                <ul className="max-h-80 divide-y divide-ink-100 overflow-auto rounded-lg border border-ink-200">
                  {shownTests.map((t) => {
                    const on = selected.includes(t.test_id);
                    const saved = assignment?.tests.find((x) => x.test_id === t.test_id);
                    const fixed = saved && saved.value_count > 0;
                    return (
                      <li key={t.test_id}>
                        <label className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${on ? 'bg-brand-50/60' : 'hover:bg-ink-50'}`}>
                          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={on} disabled={fixed} onChange={() => toggle(t.test_id)} aria-label={`${t.test_name}, ₹ ${money(t.net_amount)}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink-900">{t.test_name}</span>
                            <span className="block text-xs text-ink-500">{t.test_code}{fixed ? ' · results entered' : ''}</span>
                          </span>
                          <span className="whitespace-nowrap text-sm font-semibold">₹ {money(t.net_amount)}</span>
                        </label>
                      </li>
                    );
                  })}
                  {!shownTests.length && <li className="px-3 py-3 text-sm text-ink-500">No tests match.</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="card-flush min-w-0 self-start">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-bold text-ink-800">Assigned tests ({lines.length})</h2>
            {!isNew && assignment.status !== 'Completed' && (
              <button className="btn-secondary min-h-[32px] text-xs" onClick={() => setAll('Sample Collected')}><TestTube size={14} /> Mark all samples collected</button>
            )}
          </div>
          {!lines.length ? <p className="p-6 text-center text-sm text-ink-500">No tests selected.</p> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Test</th><th className="text-right">Fee</th><th className="text-right">Disc.</th><th className="text-right">Net</th>{!isNew && <th>Status</th>}</tr></thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.test_id}>
                      <td><p className="font-medium text-ink-900">{l.test_name}</p><p className="text-xs text-ink-500">{l.test_code}{!l.saved && !isNew ? ' · new' : ''}</p></td>
                      <td className="text-right">{money(l.fee_amount)}</td>
                      <td className="text-right">{money(l.discount_amount)}</td>
                      <td className="text-right font-semibold">{money(l.net_amount)}</td>
                      {!isNew && <td>{l.saved ? (
                        l.status === 'Completed' ? <StatusBadge status="Completed" /> : (
                          <select className="input-sm w-40" value={l.status} onChange={(e) => setTestStatus(l, e.target.value)} aria-label={`Status of ${l.test_name}`}>
                            {MANUAL.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        )) : <span className="text-xs text-ink-400">Save first</span>}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-ink-50 font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{money(totals.fee)}</td>
                    <td className="px-3 py-2 text-right">{money(totals.disc)}</td>
                    <td className="px-3 py-2 text-right text-brand-800">₹ {money(totals.fee - totals.disc)}</td>
                    {!isNew && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="px-4 py-2 text-xs text-ink-500">Prices come from Test Fee Master when a test is added and stay fixed on this assignment afterwards. Tests become Completed when their results are completed.</p>
        </div>
      </div>
    </div>
  );
}
