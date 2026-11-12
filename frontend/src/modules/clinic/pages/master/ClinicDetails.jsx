import { useEffect, useState, useCallback } from 'react';
import { Building2, Save, Upload, Pencil, Trash2, List, Image, Mail, Phone, Stethoscope, Store, Search, Plus, AppWindow, FlaskConical, CalendarClock } from 'lucide-react';
import { PageHeader, Toast, Spinner, EmptyState, Modal, CardHeader } from '../../../../components/ui.jsx';
import { DashTabs } from '../../components/DashboardKit.jsx';
import LabDetailsTab from '../../components/LabDetailsTab.jsx';
import ValidityTab from '../../components/ValidityTab.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { clinicApi, pharmacyApi } from '../../api.js';
import { isValidText, isValidNumeric, isValidEmail } from '../../../../utils/validators.js';

const emptyForm = {
  name: '', doctorName: '', logo: '', address: '', email: '', contactNo: '',
  pageHeight: '', pageWidth: '', appName: '',
};
const toForm = (data) => data ? {
  name: data.Name ?? data.name ?? '',
  doctorName: data.DoctorName ?? data.doctorName ?? '',
  logo: data.Logo ?? data.logo ?? '',
  address: data.Address ?? data.address ?? '',
  email: data.Email ?? data.email ?? '',
  contactNo: data.ContactNo ?? data.contactNo ?? '',
  pageHeight: data.PageHeight ?? data.pageHeight ?? '',
  pageWidth: data.PageWidth ?? data.pageWidth ?? '',
  appName: data.AppName ?? data.appName ?? '',
} : { ...emptyForm };

const emptyPharmacy = { name: '', address: '', contactNo: '' };

export default function ClinicDetails() {
  const { toast, show } = useToast();
  const [form, setForm] = useState(emptyForm);
  // Tabs: Clinic Details | Clinic List | Pharmacy Details | Lab Details
  // ?tab=validity opens the Validity tab (link from the Super Admin dashboard)
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'details');
  const [clinicSearch, setClinicSearch] = useState('');
  const [savedClinic, setSavedClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    clinicApi.get().then((data) => { setSavedClinic(data); setForm(toForm(data)); }).catch(() => show('Failed to load clinic details', 'error')).finally(() => setLoading(false));
  }, [show]);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const uploadLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return show('Use a PNG or JPG file', 'error');
    if (file.size > 2 * 1024 * 1024) return show('Logo must be 2 MB or smaller', 'error');
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, logo: reader.result }));
    reader.readAsDataURL(file);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return show('Clinic name is required', 'error');
    if (!isValidText(form.name)) return show('Clinic Name must contain letters only', 'error');
    if (!isValidText(form.doctorName)) return show('Doctor Name must contain letters only', 'error');
    if (!isValidText(form.appName)) return show('App Name must contain letters only', 'error');
    if (!isValidEmail(form.email)) return show('Enter a valid email address', 'error');
    if (!isValidNumeric(form.contactNo)) return show('Contact No must contain numbers only', 'error');
    setSaving(true);
    try {
      const saved = await clinicApi.save({
        ...form,
        pageHeight: form.pageHeight ? Number(Number(form.pageHeight).toFixed(2)) : null,
        pageWidth: form.pageWidth ? Number(Number(form.pageWidth).toFixed(2)) : null,
      });
      setSavedClinic(saved);
      show('Clinic details saved', 'success');
    } catch (err) {
      show(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cq = clinicSearch.trim().toLowerCase();
  const clinicMatches = !cq || [savedClinic?.Name, savedClinic?.DoctorName, savedClinic?.ContactNo, savedClinic?.Address]
    .some((v) => String(v || '').toLowerCase().includes(cq));
  const editClinic = () => { setForm(toForm(savedClinic)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  // Delete clinic is not offered: this row is the shared Organisation Details.

  // Pharmacy Details: a separate list of pharmacies (add / search / edit / delete).
  const [pharmacyRows, setPharmacyRows] = useState([]);
  const [pharmacyLoading, setPharmacyLoading] = useState(true);
  const [pharmacySearch, setPharmacySearch] = useState('');
  const [pharmacyForm, setPharmacyForm] = useState(emptyPharmacy);
  const [pharmacySaving, setPharmacySaving] = useState(false);
  const [pharmacyEditing, setPharmacyEditing] = useState(null);

  const loadPharmacy = useCallback(async (q = '') => {
    setPharmacyLoading(true);
    try {
      setPharmacyRows(await pharmacyApi.list(q));
    } catch {
      show('Failed to load pharmacies', 'error');
    } finally {
      setPharmacyLoading(false);
    }
  }, [show]);

  useEffect(() => { loadPharmacy(); }, [loadPharmacy]);
  useEffect(() => {
    const t = setTimeout(() => loadPharmacy(pharmacySearch), 350);
    return () => clearTimeout(t);
  }, [pharmacySearch, loadPharmacy]);

  const updatePharmacyForm = (key) => (event) => setPharmacyForm((current) => ({ ...current, [key]: event.target.value }));

  const savePharmacy = async (event) => {
    event.preventDefault();
    if (!pharmacyForm.name.trim()) return show('Pharmacy name is required', 'error');
    if (!isValidText(pharmacyForm.name)) return show('Pharmacy Name must contain letters only', 'error');
    if (!isValidNumeric(pharmacyForm.contactNo)) return show('Contact No must contain numbers only', 'error');
    setPharmacySaving(true);
    try {
      await pharmacyApi.create(pharmacyForm);
      show('Pharmacy saved', 'success');
      setPharmacyForm(emptyPharmacy);
      loadPharmacy(pharmacySearch);
    } catch (err) {
      show(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setPharmacySaving(false);
    }
  };

  const savePharmacyEdit = async () => {
    if (!pharmacyEditing.Name?.trim()) return show('Pharmacy name is required', 'error');
    if (!isValidText(pharmacyEditing.Name)) return show('Pharmacy Name must contain letters only', 'error');
    if (!isValidNumeric(pharmacyEditing.ContactNo)) return show('Contact No must contain numbers only', 'error');
    try {
      await pharmacyApi.update(pharmacyEditing.PharmacyId, {
        name: pharmacyEditing.Name,
        address: pharmacyEditing.Address,
        contactNo: pharmacyEditing.ContactNo,
      });
      show('Pharmacy updated', 'success');
      setPharmacyEditing(null);
      loadPharmacy(pharmacySearch);
    } catch (err) {
      show(err.response?.data?.error || 'Update failed', 'error');
    }
  };

  const deletePharmacy = async (row) => {
    if (!confirm(`Delete pharmacy "${row.Name}"?`)) return;
    try {
      await pharmacyApi.remove(row.PharmacyId);
      show('Pharmacy deleted', 'success');
      loadPharmacy(pharmacySearch);
    } catch (err) {
      show(err.response?.data?.error || 'Delete failed', 'error');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Clinic Master" />

      <div className="card mb-3 !pb-0">
        <DashTabs
          tabs={[
            { key: 'details', label: 'Clinic Details', icon: Building2 },
            { key: 'pharmacy', label: 'Pharmacy Details', icon: Store, badge: pharmacyRows.length },
            { key: 'lab', label: 'Lab Details', icon: FlaskConical },
            { key: 'validity', label: 'Validity', icon: CalendarClock },
          ]}
          tab={tab}
          onChange={setTab}
        />
      </div>

      {/* Same pattern as Pharmacy Details: one card, search on the right,
          the form in compact rows with Save on the last row, then the saved
          clinic in a table with an edit action. */}
      {tab === 'details' && (
      <div className="card">
        <form onSubmit={save}>
          <CardHeader
            icon={Building2}
            title="Clinic Details"
            subtitle="These details appear on printed prescriptions"
            actions={
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input className="input pl-9" placeholder="Search clinic..." value={clinicSearch} onChange={(e) => setClinicSearch(e.target.value)} />
              </div>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="label">Clinic Name *</label>
              <input className="input" value={form.name} onChange={update('name')} placeholder="Clinic name" />
            </div>
            <div>
              <label className="label"><Stethoscope size={13} className="mb-0.5 inline" /> Doctor Name</label>
              <input className="input" value={form.doctorName} onChange={update('doctorName')} placeholder="e.g. Dr. Rico V. Sailles" />
            </div>
            <div>
              <label className="label"><Mail size={13} className="mb-0.5 inline" /> Email ID</label>
              <input type="email" className="input" value={form.email} onChange={update('email')} placeholder="clinic@example.com" />
            </div>
            <div>
              <label className="label"><Phone size={13} className="mb-0.5 inline" /> Contact No</label>
              <input type="tel" inputMode="numeric" className="input" value={form.contactNo} onChange={update('contactNo')} placeholder="e.g. 98765 43210" />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={update('address')} placeholder="Full clinic address" />
            </div>
            <div>
              <label className="label"><Image size={13} className="mb-0.5 inline" /> Logo</label>
              <div className="flex items-center gap-2">
                <label className="flex h-[42px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-brand-200 bg-brand-50/50 px-3 text-sm text-brand-700 hover:bg-brand-50">
                  <Upload size={16} className="shrink-0" />
                  <span className="truncate">{form.logo ? 'Replace logo' : 'Choose PNG or JPG'}</span>
                  <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={uploadLogo} />
                </label>
                {form.logo && <img src={form.logo} alt="Clinic logo preview" className="h-[42px] w-[42px] shrink-0 rounded-lg border border-ink-100 object-contain p-1" />}
              </div>
            </div>
            <div>
              <label className="label"><AppWindow size={13} className="mb-0.5 inline" /> App Name</label>
              <input className="input" value={form.appName} onChange={update('appName')} placeholder="e.g. Ayush Pro" title='Name shown when the app is installed on a device. Leave blank to use "Ayush Pro".' />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save Clinic'}</button>
            </div>
          </div>
        </form>

        <div className="mt-4 border-t border-ink-100 pt-4">
          {!savedClinic || !clinicMatches ? (
            <EmptyState message={savedClinic ? 'No clinic matches your search.' : 'No clinic details saved.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-head">
                    <th className="rounded-l-lg px-3 py-3">Clinic Name</th>
                    <th className="px-3 py-3">Doctor</th>
                    <th className="px-3 py-3">Contact</th>
                    <th className="px-3 py-3">Address</th>
                    <th className="rounded-r-lg px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="table-row">
                    <td className="px-3 py-3 font-medium text-slate-700">{savedClinic.Name}</td>
                    <td className="px-3 py-3 text-slate-500">{savedClinic.DoctorName || '-'}</td>
                    <td className="px-3 py-3 text-slate-500">{savedClinic.ContactNo || '-'}</td>
                    <td className="px-3 py-3 text-slate-500">{savedClinic.Address || '-'}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" className="btn-ghost px-2 py-1" title="Edit clinic" onClick={editClinic}><Pencil size={15} /></button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {tab === 'pharmacy' && (
      <div className="card">
        <form onSubmit={savePharmacy}>
          <CardHeader
            icon={Store}
            title="Pharmacy Details"
            subtitle="Add pharmacies linked to this clinic"
            actions={
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input className="input pl-9" placeholder="Search pharmacies..." value={pharmacySearch} onChange={(e) => setPharmacySearch(e.target.value)} />
              </div>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div>
              <label className="label">Pharmacy Name *</label>
              <input className="input" value={pharmacyForm.name} onChange={updatePharmacyForm('name')} placeholder="e.g. City Pharmacy" />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={pharmacyForm.address} onChange={updatePharmacyForm('address')} placeholder="Pharmacy address" />
            </div>
            <div>
              <label className="label">Contact No</label>
              <input type="tel" inputMode="numeric" className="input" value={pharmacyForm.contactNo} onChange={updatePharmacyForm('contactNo')} placeholder="e.g. 98765 43210" />
            </div>
            <div>
              <button type="submit" className="btn-primary w-full" disabled={pharmacySaving}>
                <Plus size={16} /> {pharmacySaving ? 'Saving...' : 'Add Pharmacy'}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-5 border-t border-ink-100 pt-4">
          {pharmacyLoading ? (
            <Spinner />
          ) : pharmacyRows.length === 0 ? (
            <EmptyState message="No pharmacies found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-head">
                    <th className="rounded-l-lg px-3 py-3">Pharmacy Name</th>
                    <th className="px-3 py-3">Address</th>
                    <th className="px-3 py-3">Contact No</th>
                    <th className="rounded-r-lg px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pharmacyRows.map((r) => (
                    <tr key={r.PharmacyId} className="table-row">
                      <td className="px-3 py-3 font-medium text-slate-700">{r.Name}</td>
                      <td className="px-3 py-3 text-slate-500">{r.Address || '-'}</td>
                      <td className="px-3 py-3 text-slate-500">{r.ContactNo || '-'}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" className="btn-ghost px-2 py-1" title="Edit pharmacy" onClick={() => setPharmacyEditing({ ...r })}><Pencil size={15} /></button>
                          <button type="button" className="btn-ghost px-2 py-1 text-red-500 hover:bg-red-50" title="Delete pharmacy" onClick={() => deletePharmacy(r)}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {tab === 'lab' && <LabDetailsTab show={show} />}
      {tab === 'validity' && <ValidityTab show={show} />}

      <Modal open={!!pharmacyEditing} onClose={() => setPharmacyEditing(null)} title="Edit Pharmacy">
        {pharmacyEditing && (
          <div className="space-y-4">
            <div>
              <label className="label">Pharmacy Name *</label>
              <input className="input" value={pharmacyEditing.Name || ''} onChange={(e) => setPharmacyEditing({ ...pharmacyEditing, Name: e.target.value })} />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={pharmacyEditing.Address || ''} onChange={(e) => setPharmacyEditing({ ...pharmacyEditing, Address: e.target.value })} />
            </div>
            <div>
              <label className="label">Contact No</label>
              <input type="tel" inputMode="numeric" className="input" value={pharmacyEditing.ContactNo || ''} onChange={(e) => setPharmacyEditing({ ...pharmacyEditing, ContactNo: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setPharmacyEditing(null)}>Cancel</button>
              <button className="btn-primary" onClick={savePharmacyEdit}><Save size={16} /> Save Changes</button>
            </div>
          </div>
        )}
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
