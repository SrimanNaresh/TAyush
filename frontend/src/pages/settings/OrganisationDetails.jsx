import { useEffect, useState } from 'react';
import { Building2, Save, Upload, Trash2 } from 'lucide-react';
import { Toast, Spinner, CardHeader } from '../../components/ui.jsx';
import { useToast } from '../../hooks/useToast.js';
import { organisationApi } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { isValidNumeric, isValidEmail } from '../../utils/validators.js';

const emptyForm = { name: '', doctorName: '', address: '', contactNo: '', email: '', logo: '', appName: '' };
const toForm = (d) => (d ? {
  name: d.Name || '', address: d.Address || '', contactNo: d.ContactNo || '',
  email: d.Email || '', logo: d.Logo || '', appName: d.AppName || '', doctorName: d.DoctorName || '',
} : { ...emptyForm });

// Settings > Organisation Details (from Pharmacy Details): name, address and
// contact printed on prescriptions, pharmacy receipts and lab reports. App
// Name is the name used when the app is installed. Admin only.
export default function OrganisationDetails() {
  const { toast, show } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    organisationApi.get().then((d) => setForm(toForm(d)))
      .catch(() => show('Failed to load organisation details', 'error'))
      .finally(() => setLoading(false));
  }, [show]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const uploadLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return show('Use a PNG or JPG file', 'error');
    if (file.size > 2 * 1024 * 1024) return show('Logo must be 2 MB or smaller', 'error');
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result }));
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return show('Name is required', 'error');
    if (!isValidEmail(form.email)) return show('Enter a valid email address', 'error');
    if (!isValidNumeric(form.contactNo)) return show('Contact No must contain numbers only', 'error');
    setSaving(true);
    try {
      setForm(toForm(await organisationApi.save(form)));
      show('Organisation details saved', 'success');
    } catch (err) {
      show(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <form onSubmit={save} className="card">
      <CardHeader icon={Building2} title="Organisation Details" subtitle="Printed on prescriptions, receipts and lab reports" />
      <fieldset disabled={!isAdmin} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={update('name')} placeholder="Ayush Clinic" />
        </div>
        <div>
          <label className="label">Doctor Name</label>
          <input className="input" value={form.doctorName} onChange={update('doctorName')} />
        </div>
        <div>
          <label className="label">Contact No</label>
          <input className="input" value={form.contactNo} onChange={update('contactNo')} inputMode="numeric" maxLength={15} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={form.email} onChange={update('email')} type="email" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Address</label>
          <textarea className="input min-h-[42px]" rows={2} value={form.address} onChange={update('address')} />
        </div>
        <div>
          <label className="label">App Name</label>
          <input className="input" value={form.appName} onChange={update('appName')} placeholder="Ayush All In One" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Logo</label>
          <div className="flex items-center gap-3">
            {form.logo
              ? <img src={form.logo} alt="Logo" className="h-14 w-14 rounded-lg border border-ink-100 object-contain" />
              : <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-ink-200 text-ink-300"><Building2 size={20} /></div>}
            <label className="btn-secondary cursor-pointer">
              <Upload size={15} /> Upload
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={uploadLogo} />
            </label>
            {form.logo && (
              <button type="button" className="btn-ghost text-red-500" onClick={() => setForm((f) => ({ ...f, logo: '' }))}>
                <Trash2 size={15} /> Remove
              </button>
            )}
          </div>
        </div>
      </fieldset>
      <div className="mt-4 flex items-center justify-end gap-3">
        {!isAdmin && <p className="text-xs text-ink-400">Only an Admin can change these details.</p>}
        <button type="submit" className="btn-primary" disabled={!isAdmin || saving}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <Toast toast={toast} />
    </form>
  );
}
