import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { assignmentApi } from '../api.js';
import { useAuth } from '../useLabAuth.js';
import { PageHeader, Spinner, ErrorState, EmptyState, StatusBadge, useLoad, useDebounced } from '../components/ui.jsx';
import { fmtDate, money } from '../utils/format.js';

const STATUSES = ['Pending', 'Sample Collected', 'In Progress', 'Completed'];

export default function Assignments() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const { data, loading, error, reload } = useLoad(() => assignmentApi.list({ search: q, status: status || undefined }), [q, status]);
  const list = data || [];

  return (
    <div>
      <PageHeader title="Patient Test Assignment" subtitle="Tests assigned to patients, with pricing and progress"
        actions={can('editAssignments') && <Link to="/lab/assignments/new" className="btn-primary"><Plus size={16} /> Assign tests</Link>} />
      <div className="card-flush">
        <div className="flex flex-col gap-2 border-b border-ink-100 p-3 sm:flex-row">
          <div className="relative flex-1 sm:max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search by assignment no, patient ID, name, phone…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search assignments" />
          </div>
          <select className="input sm:w-48" value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {loading && !data ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : !list.length ? (
          <EmptyState message={q || status ? 'No assignments match.' : 'No tests assigned yet.'} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead><tr><th>No.</th><th>Date</th><th>Patient</th><th>Tests</th><th className="text-right">Fee</th><th className="text-right">Discount</th><th className="text-right">Net (₹)</th><th>Status</th><th>Result</th></tr></thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.assignment_id}>
                      <td><Link className="font-mono text-xs font-semibold text-brand-700 underline-offset-2 hover:underline" to={`/lab/assignments/${a.assignment_id}`}>{a.assignment_no}</Link></td>
                      <td className="whitespace-nowrap">{fmtDate(a.assignment_date)}</td>
                      <td><p className="font-medium text-ink-900">{a.full_name}</p><p className="text-xs text-ink-500">{a.patient_code}</p></td>
                      <td className="max-w-xs"><span className="line-clamp-2">{a.test_names}</span></td>
                      <td className="text-right">{money(a.total_fee)}</td>
                      <td className="text-right">{money(a.total_discount)}</td>
                      <td className="text-right font-semibold">{money(a.net_amount)}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>{a.result_status === 'Completed'
                        ? <Link className="text-xs font-semibold text-brand-700 underline" to={`/lab/results/${a.assignment_id}/print`} target="_blank">Print</Link>
                        : <Link className="text-xs font-semibold text-brand-700 underline" to={`/lab/results?assignment=${a.assignment_id}&patient=${a.patient_id}`}>{a.result_status === 'Draft' ? 'Draft' : 'Enter'}</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-ink-100 md:hidden">
              {list.map((a) => (
                <li key={a.assignment_id}>
                  <Link to={`/lab/assignments/${a.assignment_id}`} className="block p-3 hover:bg-brand-50/40">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-ink-900">{a.full_name}</p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="text-xs text-ink-500">{a.assignment_no} · {fmtDate(a.assignment_date)} · {a.patient_code}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-600">{a.test_names}</p>
                    <p className="mt-1 text-sm font-semibold">₹ {money(a.net_amount)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
