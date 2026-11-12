import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TestTube, Search, ExternalLink } from 'lucide-react';
import { CardHeader, Spinner, EmptyState, Toast } from '../../../../components/ui.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { linkApi } from '../../../../api/client.js';

// Clinic > Consultation > Lab > Test List: the tests from Lab > Masters >
// Test Master (with their components and fee). Read-only here: tests are
// added and edited in Lab. The Doctor's screen ticks tests from this list.
const money = (n) => (n == null ? '—' : `₹${Number(n).toFixed(2)}`);

export default function TestMaster() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await linkApi.labTests({ search }));
    } catch {
      show('Failed to load tests from Lab', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="card">
      <CardHeader
        icon={TestTube}
        title="Test List"
        subtitle="Tests from Lab › Masters › Test Master"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/lab/tests" className="btn-secondary"><ExternalLink size={15} /> Manage in Lab</Link>
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" placeholder="Search test ID or name..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        }
      />

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No tests yet. Add them in Lab › Masters › Test Master." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-head">
                <th className="rounded-l-lg px-3 py-3">#</th>
                <th className="px-3 py-3">Test ID</th>
                <th className="px-3 py-3">Test Name</th>
                <th className="px-3 py-3 text-right">Components</th>
                <th className="px-3 py-3 text-right">Fee</th>
                <th className="px-3 py-3 text-right">Discount</th>
                <th className="rounded-r-lg px-3 py-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.TestId} className="table-row">
                  <td className="px-3 py-2.5 text-ink-400">{i + 1}</td>
                  <td className="px-3 py-2.5 font-mono text-12 text-ink-600">{r.TestCode}</td>
                  <td className="px-3 py-2.5 font-medium text-ink-800">{r.TestName}</td>
                  <td className="px-3 py-2.5 text-right text-ink-600">{r.ComponentCount}</td>
                  <td className="px-3 py-2.5 text-right text-ink-600">{money(r.Fee)}</td>
                  <td className="px-3 py-2.5 text-right text-ink-600">{money(r.Discount)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-ink-800">{money(r.NetAmount)}</td>
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
