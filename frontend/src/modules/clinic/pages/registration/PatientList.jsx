import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Pencil, Trash2, Users, Plus } from 'lucide-react';
import { Spinner, EmptyState, Toast, CardHeader } from '../../../../components/ui.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { patientApi } from '../../api.js';

export default function PatientList() {
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      setRows(await patientApi.list({ search: q }));
    } catch {
      show('Failed to load patients', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  const remove = async (row) => {
    if (!confirm(`Delete "${row.Name}"?`)) return;
    try {
      await patientApi.remove(row.PatientId);
      show('Deleted', 'success');
      load(search);
    } catch {
      show('Delete failed', 'error');
    }
  };

  return (
    <div>
      <div className="card">
        <CardHeader
          icon={Users}
          title="Patient List"
          subtitle="Search, edit and delete patients"
          actions={
            <>
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input className="input pl-9" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={() => navigate('/clinic/registration/patient')}>
                <Plus size={16} /> Add
              </button>
            </>
          }
        />

        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState message="No patients found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-head">
                  <th className="rounded-l-lg px-3 py-3">#</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Mobile</th>
                  <th className="px-3 py-3">Age</th>
                  <th className="px-3 py-3">Address</th>
                  <th className="rounded-r-lg px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.PatientId} className="table-row">
                    <td className="px-3 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-3 font-medium text-slate-700">{r.Name}</td>
                    <td className="px-3 py-3 text-slate-500">{r.MobileNo || '-'}</td>
                    <td className="px-3 py-3 text-slate-500">{r.Age ?? '-'}</td>
                    <td className="px-3 py-3 text-slate-500">{r.Address || '-'}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost px-2 py-1" onClick={() => navigate('/clinic/registration/patient', { state: { editPatient: r } })}><Pencil size={15} /></button>
                        <button className="btn-ghost px-2 py-1 text-red-500 hover:bg-red-50" onClick={() => remove(r)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Toast toast={toast} />
    </div>
  );
}
