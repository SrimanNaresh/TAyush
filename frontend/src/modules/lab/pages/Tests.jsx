import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, X, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { testApi, errMsg } from '../api.js';
import { useAuth } from '../useLabAuth.js';
import { PageHeader, Spinner, ErrorState, EmptyState, Modal, Field, useLoad, useToast, useConfirm, useDebounced } from '../components/ui.jsx';
import SheetTools, { IssueTable } from '../components/SheetTools.jsx';
import { downloadXlsx, downloadCsv, readSheet } from '../utils/sheet.js';
import { money } from '../utils/format.js';

const COLS = [
  { header: 'Test ID', key: 'test_code', width: 12, text: true, aliases: ['testcode', 'id'] },
  { header: 'Test Name', key: 'test_name', width: 28, required: true, aliases: ['test'] },
  { header: 'Component Name', key: 'component_name', width: 26, required: true, aliases: ['component', 'parameter'] },
  { header: 'Male Range', key: 'male_range', width: 18, aliases: ['male'] },
  { header: 'Female Range', key: 'female_range', width: 18, aliases: ['female'] },
  { header: 'General Range', key: 'general_range', width: 18, aliases: ['general', 'normalrange', 'range'] },
];

const blank = () => ({ key: Math.random(), component_id: null, component_name: '', male_range: '', female_range: '', general_range: '' });

function TestForm({ open, testId, readOnly, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({}); setLoadErr('');
    if (!testId) { setF({ test_code: '', test_name: '', components: [blank()] }); return; }
    setF(null);
    testApi.get(testId)
      .then((t) => setF({ ...t, components: t.components.map((c) => ({ ...c, key: c.component_id, male_range: c.male_range || '', female_range: c.female_range || '', general_range: c.general_range || '' })) }))
      .catch((e) => setLoadErr(errMsg(e)));
  }, [open, testId]);

  const setComp = (i, k, v) => setF((s) => ({ ...s, components: s.components.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  const move = (i, d) => setF((s) => {
    const c = [...s.components];
    const j = i + d;
    if (j < 0 || j >= c.length) return s;
    [c[i], c[j]] = [c[j], c[i]];
    return { ...s, components: c };
  });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.test_name.trim()) errs.test_name = 'Test name is required';
    if (testId && !String(f.test_code).trim()) errs.test_code = 'Test ID is required';
    const filled = f.components.filter((c) => c.component_name.trim() || c.male_range || c.female_range || c.general_range);
    if (!filled.length) errs.components = 'Add at least one component';
    const names = new Set();
    filled.forEach((c) => {
      const n = c.component_name.trim().toLowerCase();
      if (!n) errs.components = 'Every component needs a name';
      else if (names.has(n)) errs.components = `Component "${c.component_name.trim()}" is listed twice`;
      names.add(n);
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = { test_code: f.test_code, test_name: f.test_name, components: filled };
      if (testId) { await testApi.update(testId, body); toast('Test updated'); }
      else { const r = await testApi.create(body); toast(`Test ${r.test_code} created`); }
      onSaved();
    } catch (ex) { toast(errMsg(ex), 'error'); } finally { setSaving(false); }
  };

  const title = readOnly ? 'Test details' : testId ? 'Edit test' : 'New test';
  return (
    <Modal open={open} onClose={onClose} title={title} size="xl"
      footer={readOnly ? <button className="btn-secondary" onClick={onClose}>Close</button> : <>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" form="test-form" disabled={saving || !f}>{saving ? 'Saving…' : 'Save test'}</button>
      </>}>
      {loadErr ? <ErrorState message={loadErr} /> : !f ? <Spinner /> : (
        <form id="test-form" onSubmit={submit} noValidate>
          <fieldset disabled={readOnly} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Test ID" htmlFor="tf-code" error={errors.test_code}>
                <input id="tf-code" className="input" value={f.test_code} onChange={(e) => setF({ ...f, test_code: e.target.value })} placeholder={testId ? '' : 'Leave blank to generate'} maxLength={20} />
              </Field>
              <Field label="Test name" htmlFor="tf-name" required error={errors.test_name} className="sm:col-span-2">
                <input id="tf-name" className="input" value={f.test_name} onChange={(e) => setF({ ...f, test_name: e.target.value })} maxLength={200} />
              </Field>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-800">Components ({f.components.length})</h3>
                {!readOnly && <button type="button" className="btn-secondary" onClick={() => setF({ ...f, components: [...f.components, blank()] })}><Plus size={15} /> Add component</button>}
              </div>
              {errors.components && <p className="field-error mb-2" role="alert">{errors.components}</p>}
              <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 px-1 pb-1 text-xs font-semibold text-ink-500 md:grid">
                <span>Component name *</span><span>Male range</span><span>Female range</span><span>General range</span><span className="w-[108px]" />
              </div>
              <div className="space-y-2">
                {f.components.map((c, i) => (
                  <div key={c.key} className="grid grid-cols-1 gap-2 rounded-lg border border-ink-200 p-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:border-0 md:p-0">
                    <input className="input-sm" aria-label={`Component ${i + 1} name`} placeholder="Component name" value={c.component_name} onChange={(e) => setComp(i, 'component_name', e.target.value)} maxLength={200} />
                    <div className="grid grid-cols-3 gap-2 md:contents">
                      <input className="input-sm" aria-label={`Component ${i + 1} male range`} placeholder="Male" value={c.male_range} onChange={(e) => setComp(i, 'male_range', e.target.value)} maxLength={200} />
                      <input className="input-sm" aria-label={`Component ${i + 1} female range`} placeholder="Female" value={c.female_range} onChange={(e) => setComp(i, 'female_range', e.target.value)} maxLength={200} />
                      <input className="input-sm" aria-label={`Component ${i + 1} general range`} placeholder="General" value={c.general_range} onChange={(e) => setComp(i, 'general_range', e.target.value)} maxLength={200} />
                    </div>
                    {!readOnly && (
                      <div className="flex justify-end">
                        <button type="button" className="btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={15} /></button>
                        <button type="button" className="btn-icon" onClick={() => move(i, 1)} disabled={i === f.components.length - 1} aria-label="Move down"><ArrowDown size={15} /></button>
                        <button type="button" className="btn-icon hover:text-red-600" onClick={() => setF({ ...f, components: f.components.filter((_, j) => j !== i) })} disabled={f.components.length === 1} aria-label={`Remove component ${i + 1}`}><X size={16} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}

export default function Tests() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const { data, loading, error, reload } = useLoad(() => testApi.list(q), [q]);
  const [form, setForm] = useState({ open: false, id: null });
  const editable = can('editTests');

  const remove = async (t) => {
    if (!(await confirm({ message: `Delete test "${t.test_name}" and its ${t.component_count} component(s)? Its fee row is deleted too.` }))) return;
    try { await testApi.remove(t.test_id); toast('Test deleted'); reload(); } catch (e) { toast(errMsg(e), 'error'); }
  };

  const template = () => downloadXlsx('tests-template.xlsx', 'Tests', COLS, [
    { test_code: 'T0001', test_name: 'Complete Blood Count', component_name: 'Hemoglobin', male_range: '13.5-17.5 g/dL', female_range: '12.0-15.5 g/dL', general_range: '12-17.5 g/dL' },
    { test_code: 'T0001', test_name: 'Complete Blood Count', component_name: 'WBC Count', male_range: '', female_range: '', general_range: '4000-11000 /cumm' },
    { test_code: '', test_name: 'Blood Sugar Fasting', component_name: 'Glucose (Fasting)', male_range: '', female_range: '', general_range: '70-110 mg/dL' },
  ], [
    'Test Master import',
    'One row per component. Rows with the same Test Name become one test with several components.',
    'Test ID: keep the same ID on every row of a test, or leave it blank to generate one (T0001 ...).',
    'Test Name and Component Name are required. Ranges are free text (e.g. 13.5-17.5 g/dL).',
    'If the test already exists, its components are added or their ranges updated (matched by Component Name).',
    'Delete the sample rows before importing.',
  ]);
  const exportRows = async (kind) => {
    const rows = await testApi.exportRows();
    if (!rows.length) throw new Error('There are no tests to export');
    if (kind === 'csv') downloadCsv('tests.csv', COLS, rows);
    else await downloadXlsx('tests.xlsx', 'Tests', COLS, rows);
  };
  const importFile = async (file) => {
    const rows = await readSheet(file, COLS);
    const res = await testApi.importRows(rows);
    reload();
    return { ...res, total: rows.length };
  };

  const list = data || [];
  return (
    <div>
      <PageHeader title="Test Master" subtitle="Tests and their components with reference ranges"
        actions={<>
          <SheetTools canImport={editable} onTemplate={template} onExport={exportRows} onImport={importFile}
            renderResult={(r) => (
              <div>
                <p className="text-sm">Read <b>{r.total}</b> row(s): <b className="text-emerald-700">{r.created} test(s) created</b>, {r.updated} updated, {r.componentsSaved} component(s) saved, {r.skipped.length} row(s) skipped.</p>
                <IssueTable title="Skipped rows" rows={r.skipped} />
              </div>
            )} />
          {editable && <button className="btn-primary" onClick={() => setForm({ open: true, id: null })}><Plus size={16} /> New test</button>}
        </>} />
      <div className="card-flush">
        <div className="border-b border-ink-100 p-3">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search by Test ID or name…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tests" />
          </div>
        </div>
        {loading && !data ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : !list.length ? (
          <EmptyState message={q ? 'No tests match your search.' : 'No tests yet. Add one or import from Excel.'} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead><tr><th>Test ID</th><th>Test name</th><th className="text-right">Components</th><th className="text-right">Net fee (₹)</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.test_id}>
                      <td className="font-mono text-xs font-semibold">{t.test_code}</td>
                      <td className="font-medium text-ink-900">{t.test_name}</td>
                      <td className="text-right">{t.component_count}</td>
                      <td className="text-right">{money(t.net_amount)}</td>
                      <td className="whitespace-nowrap text-right">
                        {editable ? <>
                          <button className="btn-icon" onClick={() => setForm({ open: true, id: t.test_id })} aria-label={`Edit ${t.test_name}`}><Pencil size={16} /></button>
                          <button className="btn-icon hover:text-red-600" onClick={() => remove(t)} aria-label={`Delete ${t.test_name}`}><Trash2 size={16} /></button>
                        </> : <button className="btn-icon" onClick={() => setForm({ open: true, id: t.test_id })} aria-label={`View ${t.test_name}`}><Eye size={16} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-ink-100 md:hidden">
              {list.map((t) => (
                <li key={t.test_id} className="flex items-center justify-between gap-2 p-3">
                  <button className="min-w-0 text-left" onClick={() => setForm({ open: true, id: t.test_id })}>
                    <p className="font-semibold text-ink-900">{t.test_name}</p>
                    <p className="text-xs text-ink-500">{t.test_code} · {t.component_count} component(s) · ₹ {money(t.net_amount)}</p>
                  </button>
                  {editable && <button className="btn-icon" onClick={() => remove(t)} aria-label={`Delete ${t.test_name}`}><Trash2 size={17} /></button>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <TestForm open={form.open} testId={form.id} readOnly={!editable} onClose={() => setForm({ open: false, id: null })}
        onSaved={() => { setForm({ open: false, id: null }); reload(); }} />
    </div>
  );
}
