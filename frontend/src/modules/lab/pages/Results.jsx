import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Save, CheckCircle2, Printer } from 'lucide-react';
import { resultApi, patientApi, errMsg } from '../api.js';
import { useAuth } from '../useLabAuth.js';
import { PageHeader, Spinner, ErrorState, EmptyState, StatusBadge, Field, useToast } from '../components/ui.jsx';
import PatientPicker from '../components/PatientPicker.jsx';
import { PhoneFooter } from '../../../components/PhoneLayout.jsx';
import { fmtDate } from '../utils/format.js';

const rowKey = (r) => `${r.assignment_test_id}:${r.component_id ?? 'v' + r.value_id}`;

export default function Results() {
  const { can } = useAuth();
  const toast = useToast();
  const editable = can('enterResults');
  const [params, setParams] = useSearchParams();
  const patientId = params.get('patient');
  const assignmentId = params.get('assignment');

  const [patient, setPatient] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [entry, setEntry] = useState(null);
  const [values, setValues] = useState({});
  const [orig, setOrig] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    setErr('');
    if (!patientId) { setPatient(null); setAssignments(null); return; }
    if (!patient || String(patient.patient_id) !== patientId) patientApi.get(patientId).then(setPatient).catch((e) => setErr(errMsg(e)));
    setAssignments(null);
    resultApi.forPatient(patientId).then(setAssignments).catch((e) => setErr(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const loadEntry = async () => {
    setEntry(null);
    if (!assignmentId) return;
    try {
      const e = await resultApi.entry(assignmentId);
      setEntry(e);
      const v = Object.fromEntries(e.rows.map((r) => [rowKey(r), r.result_value || '']));
      setValues(v); setOrig(v);
    } catch (ex) { setErr(errMsg(ex)); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadEntry(); }, [assignmentId]);

  const pickPatient = (p) => {
    setPatient(p);
    setEntry(null);
    setParams(p ? { patient: p.patient_id } : {});
  };
  const pickAssignment = (aid) => setParams({ patient: patientId, assignment: aid });

  const dirty = entry && Object.keys(values).some((k) => (values[k] || '') !== (orig[k] || ''));
  const filled = Object.values(values).filter((v) => v.trim()).length;

  const save = async (complete) => {
    if (complete && !filled) return toast('Enter at least one result before completing', 'error');
    setBusy(complete ? 'complete' : 'draft');
    try {
      const payload = entry.rows.map((r) => ({ assignment_test_id: r.assignment_test_id, component_id: r.component_id, value_id: r.value_id, result_value: values[rowKey(r)] || '' }));
      const res = await resultApi.save(assignmentId, payload, complete);
      toast(complete ? `Results completed (${res.saved} value(s)). The report can now be printed.` : `Draft saved (${res.saved} value(s))`);
      await loadEntry();
      resultApi.forPatient(patientId).then(setAssignments).catch(() => {});
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(''); }
  };

  const a = entry?.assignment;
  const canPrint = a?.result_status === 'Completed' && !dirty;
  // Group rows by test for display.
  const groups = [];
  (entry?.rows || []).forEach((r) => {
    let g = groups.find((x) => x.assignment_test_id === r.assignment_test_id);
    if (!g) { g = { assignment_test_id: r.assignment_test_id, test_name: r.test_name, status: r.test_status, rows: [] }; groups.push(g); }
    g.rows.push(r);
  });

  return (
    <div>
      <PageHeader title="Result Entry" subtitle="Select a patient, then an assignment, and enter component results" />
      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-2">
        <Field label="Patient" htmlFor="rp-patient"><PatientPicker id="rp-patient" value={patient} onChange={pickPatient} /></Field>
        {patientId && (
          <Field label="Assignment" htmlFor="rp-assign">
            {!assignments ? <p className="py-2 text-sm text-ink-500">Loading assignments…</p> : !assignments.length ? (
              <p className="py-2 text-sm text-ink-500">No tests assigned to this patient. {can('editAssignments') && <Link className="font-semibold text-brand-700 underline" to={`/lab/assignments/new?patient=${patientId}`}>Assign tests</Link>}</p>
            ) : (
              <select id="rp-assign" className="input" value={assignmentId || ''} onChange={(e) => pickAssignment(e.target.value)}>
                <option value="">Select assignment…</option>
                {assignments.map((x) => (
                  <option key={x.assignment_id} value={x.assignment_id}>
                    {x.assignment_no} · {fmtDate(x.assignment_date)} · {x.result_status === 'Completed' ? 'Completed' : x.result_status === 'Draft' ? 'Draft' : x.status} — {x.test_names}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
      </div>

      {err && <ErrorState message={err} onRetry={() => { setErr(''); loadEntry(); }} />}
      {!err && !patientId && <div className="card-flush"><EmptyState message="Search for a patient to begin." /></div>}
      {!err && assignmentId && !entry && <Spinner />}
      {!err && entry && (
        <div className="card-flush">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink-900">{a.assignment_no} · {a.full_name} <span className="font-normal text-ink-500">({a.gender}{a.age !== null ? `, ${a.age} y` : ''})</span></p>
              <p className="flex items-center gap-2 text-xs text-ink-500">Result: <StatusBadge status={a.result_status || 'Draft'} /> {a.result_status ? '' : '(not started)'}</p>
            </div>
            <div className="hidden flex-wrap gap-2 md:flex">
              {editable && <button className="btn-secondary" onClick={() => save(false)} disabled={!!busy || !entry.rows.length}><Save size={16} /> {busy === 'draft' ? 'Saving…' : 'Save draft'}</button>}
              {editable && <button className="btn-primary" onClick={() => save(true)} disabled={!!busy || !entry.rows.length}><CheckCircle2 size={16} /> {busy === 'complete' ? 'Saving…' : 'Save & complete'}</button>}
              {canPrint
                ? <Link className="btn-secondary" to={`/lab/results/${assignmentId}/print`} target="_blank"><Printer size={16} /> Print</Link>
                : <button className="btn-secondary" disabled title={dirty ? 'Save your changes first' : 'Printing is available once results are completed'}><Printer size={16} /> Print</button>}
            </div>
          </div>
          {!entry.rows.length ? <EmptyState message="The assigned tests have no components. Add components in Test Master." /> : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="table">
                  <thead><tr><th>Test Name</th><th>Component Name</th><th className="w-56">Result</th><th>Male Range</th><th>Female Range</th><th>General Range</th></tr></thead>
                  <tbody>
                    {groups.map((g) => g.rows.map((r, i) => (
                      <tr key={rowKey(r)}>
                        {i === 0 && <td rowSpan={g.rows.length} className="border-r border-ink-100 bg-ink-50/40 font-semibold text-ink-900">{g.test_name}</td>}
                        <td>{r.component_name}{r.orphan && <span className="ml-1 text-xs text-amber-700">(removed from test)</span>}</td>
                        <td><input className="input-sm" value={values[rowKey(r)] || ''} onChange={(e) => setValues({ ...values, [rowKey(r)]: e.target.value })} maxLength={200} disabled={!editable} aria-label={`Result for ${g.test_name} ${r.component_name}`} /></td>
                        <td className="text-ink-600">{r.male_range}</td>
                        <td className="text-ink-600">{r.female_range}</td>
                        <td className="text-ink-600">{r.general_range}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-ink-100 md:hidden">
                {groups.map((g) => (
                  <div key={g.assignment_test_id} className="p-3">
                    <div className="mb-2 flex items-center justify-between gap-2"><p className="font-semibold text-ink-900">{g.test_name}</p><StatusBadge status={g.status} /></div>
                    <div className="space-y-3">
                      {g.rows.map((r) => (
                        <div key={rowKey(r)}>
                          <label className="label" htmlFor={`m-${rowKey(r)}`}>{r.component_name}</label>
                          <input id={`m-${rowKey(r)}`} className="input" value={values[rowKey(r)] || ''} onChange={(e) => setValues({ ...values, [rowKey(r)]: e.target.value })} maxLength={200} disabled={!editable} />
                          <p className="mt-0.5 text-xs text-ink-500">M: {r.male_range || '—'} · F: {r.female_range || '—'} · G: {r.general_range || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {entry.rows.length > 0 && (
            <PhoneFooter>
              {editable && <button className="btn-secondary px-2" onClick={() => save(false)} disabled={!!busy}><Save size={15} /> {busy === 'draft' ? '…' : 'Draft'}</button>}
              {editable && <button className="btn-primary px-2" onClick={() => save(true)} disabled={!!busy}><CheckCircle2 size={15} /> {busy === 'complete' ? '…' : 'Complete'}</button>}
              {canPrint
                ? <Link className="btn-secondary px-2" to={`/lab/results/${assignmentId}/print`} target="_blank"><Printer size={15} /> Print</Link>
                : <button className="btn-secondary px-2" disabled><Printer size={15} /> Print</button>}
            </PhoneFooter>
          )}
          <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">{filled} of {entry.rows.length} result(s) entered. Only components with a result are printed.{dirty ? ' You have unsaved changes.' : ''}</p>
        </div>
      )}
    </div>
  );
}
