import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { settingsApi, errMsg } from '../api.js';
import { PageHeader, Spinner, ErrorState, Field, useLoad, useToast } from '../components/ui.jsx';

export default function SettingsPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => settingsApi.get());
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errs, setErrs] = useState({});
  useEffect(() => { if (data) setF({ lab_name: '', address: '', phone: '', email: '', report_footer: '', ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ''])) }); }, [data]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.lab_name.trim()) er.lab_name = 'Lab name is required';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) er.email = 'Enter a valid email';
    setErrs(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try { await settingsApi.save(f); toast('Settings saved'); reload(); } catch (ex) { toast(errMsg(ex), 'error'); } finally { setSaving(false); }
  };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !f) return <Spinner />;
  return (
    <div className="max-w-2xl">
      <PageHeader title="Lab Settings" subtitle="Shown in the header and footer of printed reports" />
      <form onSubmit={submit} noValidate className="card grid gap-3 p-4 sm:grid-cols-2">
        <Field label="Lab name" htmlFor="s-name" required error={errs.lab_name} className="sm:col-span-2"><input id="s-name" className="input" value={f.lab_name} onChange={set('lab_name')} maxLength={150} /></Field>
        <Field label="Address" htmlFor="s-addr" className="sm:col-span-2"><textarea id="s-addr" rows={2} className="input" value={f.address} onChange={set('address')} maxLength={400} /></Field>
        <Field label="Phone" htmlFor="s-phone"><input id="s-phone" className="input" value={f.phone} onChange={set('phone')} maxLength={50} /></Field>
        <Field label="Email" htmlFor="s-email" error={errs.email}><input id="s-email" type="email" className="input" value={f.email} onChange={set('email')} maxLength={150} /></Field>
        <Field label="Report footer" htmlFor="s-foot" className="sm:col-span-2"><input id="s-foot" className="input" value={f.report_footer} onChange={set('report_footer')} maxLength={400} /></Field>
        <div className="sm:col-span-2"><button className="btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save settings'}</button></div>
      </form>
    </div>
  );
}
