import { useEffect, useState } from 'react';
import { FlaskConical, Save, Search, Pencil } from 'lucide-react';
import { CardHeader, Spinner, EmptyState } from '../../../components/ui.jsx';
import { settingsApi, errMsg } from '../../lab/api.js';

// Clinic Master > Lab Details: the lab's report header and footer (the same
// record as Lab > Lab Settings), printed on every lab report. Same layout as
// Pharmacy Details: search on the right, the form in compact rows with Save on
// the last row, then the saved record in a table with an edit action.
const EMPTY = { lab_name: '', address: '', phone: '', email: '', report_footer: '' };
const clean = (s) => ({ ...EMPTY, ...Object.fromEntries(Object.entries(s || {}).map(([k, v]) => [k, v ?? ''])) });

export default function LabDetailsTab({ show }) {
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.get()
      .then((s) => { const c = clean(s); setForm(c); setSaved(c.lab_name ? c : null); })
      .catch((e) => show(errMsg(e), 'error'))
      .finally(() => setLoading(false));
  }, [show]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.lab_name.trim()) return show('Lab name is required', 'error');
    setSaving(true);
    try {
      await settingsApi.save(form);
      setSaved({ ...form });
      show('Lab details saved', 'success');
    } catch (err) {
      show(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const edit = () => { setForm(clean(saved)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const q = search.trim().toLowerCase();
  const matches = saved && (!q || Object.values(saved).some((v) => String(v || '').toLowerCase().includes(q)));

  if (loading) return <Spinner />;

  return (
    <div className="card">
      <form onSubmit={save}>
        <CardHeader
          icon={FlaskConical}
          title="Lab Details"
          subtitle="Printed on the header and footer of every lab report"
          actions={
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" placeholder="Search lab..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label">Lab Name *</label>
            <input className="input" value={form.lab_name} onChange={set('lab_name')} placeholder="e.g. Ayush Lab" maxLength={150} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="e.g. 98765 43210" maxLength={50} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={set('email')} placeholder="lab@example.com" maxLength={150} />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={set('address')} placeholder="Full lab address" maxLength={400} />
          </div>
          <div className="sm:col-span-2 xl:col-span-3">
            <label className="label">Report Footer</label>
            <input className="input" value={form.report_footer} onChange={set('report_footer')} placeholder="e.g. This is a computer generated report." maxLength={400} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save Lab'}</button>
          </div>
        </div>
      </form>

      <div className="mt-4 border-t border-ink-100 pt-4">
        {!matches ? (
          <EmptyState message={saved ? 'No lab matches your search.' : 'No lab details saved.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-13">
              <thead>
                <tr className="table-head">
                  <th className="rounded-l-lg px-2.5 py-1.5">Lab Name</th>
                  <th className="px-2.5 py-1.5">Phone</th>
                  <th className="px-2.5 py-1.5">Email</th>
                  <th className="px-2.5 py-1.5">Address</th>
                  <th className="px-2.5 py-1.5">Report Footer</th>
                  <th className="rounded-r-lg px-2.5 py-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="table-row">
                  <td className="px-2.5 py-1 font-medium text-slate-700">{saved.lab_name}</td>
                  <td className="px-2.5 py-1 text-slate-500">{saved.phone || '-'}</td>
                  <td className="px-2.5 py-1 text-slate-500">{saved.email || '-'}</td>
                  <td className="px-2.5 py-1 text-slate-500">{saved.address || '-'}</td>
                  <td className="max-w-xs truncate px-2.5 py-1 text-slate-500">{saved.report_footer || '-'}</td>
                  <td className="px-2.5 py-1">
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn-ghost !p-1" title="Edit lab" onClick={edit}><Pencil size={15} /></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
