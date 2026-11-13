import { useCallback, useEffect, useState } from 'react';
import { Pill, Search } from 'lucide-react';
import { CardHeader, Spinner, EmptyState, Toast } from '../../../../components/ui.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { linkApi } from '../../../../api/client.js';

// Clinic > Consultation > Pharmacy > Medication List: the medicines received in
// Pharmacy > Stock In (one row per item), with current stock, latest MRP and
// the nearest expiry among batches that still have stock. Read-only: medicines
// are added through Pharmacy (Item Master + Stock In). The Doctor's screen
// picks from this same list.
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');
const qty = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function MedicationList() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inStock, setInStock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await linkApi.medicines({ search, inStock: inStock ? '1' : undefined }));
    } catch {
      show('Failed to load medicines from Pharmacy', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, inStock, show]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="card">
      <CardHeader
        icon={Pill}
        title="Medication List"
        subtitle="Medicines received in Pharmacy › Stock In"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-13 text-ink-600">
              <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-600" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
              In stock only
            </label>
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" placeholder="Search medicine or generic..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        }
      />

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No medicines yet. Medicines appear here once they are received through Pharmacy › Stock In." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-13">
            <thead>
              <tr className="table-head">
                <th className="rounded-l-lg px-2.5 py-1.5">#</th>
                <th className="px-2.5 py-1.5">Medicine</th>
                <th className="px-2.5 py-1.5">Generic</th>
                <th className="px-2.5 py-1.5">Category</th>
                <th className="px-2.5 py-1.5">Potency</th>
                <th className="px-2.5 py-1.5">Pack / Unit</th>
                <th className="px-2.5 py-1.5 text-right">Stock</th>
                <th className="px-2.5 py-1.5 text-right">MRP</th>
                <th className="rounded-r-lg px-2.5 py-1.5">Nearest Expiry</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.ItemId} className="table-row">
                  <td className="px-2.5 py-1 text-ink-400">{i + 1}</td>
                  <td className="px-2.5 py-1 font-medium text-ink-800">{r.MedicineName}</td>
                  <td className="px-2.5 py-1 text-ink-600">{r.GenericName || '—'}</td>
                  <td className="px-2.5 py-1 text-ink-600">{r.Category || '—'}</td>
                  <td className="px-2.5 py-1 text-ink-600">{r.Potency || '—'}</td>
                  <td className="px-2.5 py-1 text-ink-600">{[r.Pack, r.Unit].filter(Boolean).join(' · ') || '—'}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${Number(r.Stock) > 0 ? 'text-emerald-700' : 'text-red-500'}`}>{qty(r.Stock)}</td>
                  <td className="px-2.5 py-1 text-right text-ink-700">{r.MRP != null ? `₹${Number(r.MRP).toFixed(2)}` : '—'}</td>
                  <td className="px-2.5 py-1 text-ink-600">{fmtDate(r.NearestExpiry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
}
