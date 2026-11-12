import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, Search } from 'lucide-react';
import { feeApi, errMsg } from '../api.js';
import { useAuth } from '../useLabAuth.js';
import { PageHeader, Spinner, ErrorState, EmptyState, useLoad, useToast } from '../components/ui.jsx';
import { money, ymd, fmtDate } from '../utils/format.js';
import { PhoneFooter } from '../../../components/PhoneLayout.jsx';

function rowError(r) {
  const fee = Number(r.fee_amount), disc = Number(r.discount_amount);
  if (r.fee_amount === '' || !Number.isFinite(fee) || fee < 0) return 'Fee must be 0 or more';
  if (r.discount_amount === '' || !Number.isFinite(disc) || disc < 0) return 'Discount must be 0 or more';
  if (disc > fee) return 'Discount cannot exceed the fee';
  if (!r.effective_date) return 'Effective date is required';
  return '';
}

export default function Fees() {
  const { can } = useAuth();
  const toast = useToast();
  const editable = can('editFees');
  const { data, loading, error, reload } = useLoad(() => feeApi.list());
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (data) setRows(data.map((r) => ({ ...r, fee_amount: String(Number(r.fee_amount)), discount_amount: String(Number(r.discount_amount)), effective_date: ymd(r.effective_date), orig: r })));
  }, [data]);

  const dirty = (r) => r.missing || Number(r.fee_amount) !== Number(r.orig.fee_amount) || Number(r.discount_amount) !== Number(r.orig.discount_amount) || r.effective_date !== ymd(r.orig.effective_date);
  const changed = rows.filter(dirty);
  const invalid = changed.filter(rowError);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? rows.filter((r) => r.test_name.toLowerCase().includes(s) || r.test_code.toLowerCase().includes(s)) : rows;
  }, [rows, search]);

  const set = (id, k, v) => setRows((rs) => rs.map((r) => (r.test_id === id ? { ...r, [k]: v } : r)));

  const save = async () => {
    if (invalid.length) return toast(`Fix ${invalid.length} row(s) first: ${rowError(invalid[0])} (${invalid[0].test_name})`, 'error');
    setBusy('save');
    try {
      const r = await feeApi.save(changed.map(({ test_id, fee_amount, discount_amount, effective_date }) => ({ test_id, fee_amount, discount_amount, effective_date })));
      toast(`${r.saved} fee(s) saved`);
      reload();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(''); }
  };
  const sync = async () => {
    setBusy('sync');
    try {
      const r = await feeApi.sync();
      toast(r.added ? `${r.added} new test(s) added to the fee list` : 'Fee list is already in sync with Test Master');
      reload();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(''); }
  };

  return (
    <div>
      <PageHeader title="Test Fee Master" subtitle="Net amount = Fee − Discount"
        actions={editable && <>
          <button className="btn-secondary" onClick={sync} disabled={!!busy}><RefreshCw size={16} className={busy === 'sync' ? 'animate-spin' : ''} /> Sync tests</button>
          <button className="btn-primary max-md:hidden" onClick={save} disabled={!!busy || !changed.length}><Save size={16} /> {busy === 'save' ? 'Saving…' : `Save changes${changed.length ? ` (${changed.length})` : ''}`}</button>
        </>} />
      {editable && changed.length > 0 && (
        <PhoneFooter>
          <button className="btn-primary" onClick={save} disabled={!!busy}><Save size={15} /> {busy === 'save' ? 'Saving…' : `Save changes (${changed.length})`}</button>
        </PhoneFooter>
      )}
      <div className="card-flush">
        <div className="border-b border-ink-100 p-3">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Filter tests…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Filter tests" />
          </div>
        </div>
        {loading && !data ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : !shown.length ? (
          <EmptyState message={rows.length ? 'No tests match the filter.' : 'No tests in Test Master yet.'} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead><tr><th>Test ID</th><th>Test name</th><th className="w-32 text-right">Fee (₹)</th><th className="w-32 text-right">Discount (₹)</th><th className="w-28 text-right">Net (₹)</th><th className="w-40">Effective date</th></tr></thead>
                <tbody>
                  {shown.map((r) => {
                    const err = dirty(r) && rowError(r);
                    return (
                      <tr key={r.test_id} className={dirty(r) ? 'bg-amber-50/50' : ''}>
                        <td className="font-mono text-xs font-semibold">{r.test_code}</td>
                        <td className="font-medium text-ink-900">{r.test_name}{err && <p className="field-error">{err}</p>}</td>
                        {editable ? <>
                          <td><input type="number" min="0" step="0.01" className="input-sm text-right" value={r.fee_amount} onChange={(e) => set(r.test_id, 'fee_amount', e.target.value)} aria-label={`Fee for ${r.test_name}`} /></td>
                          <td><input type="number" min="0" step="0.01" className="input-sm text-right" value={r.discount_amount} onChange={(e) => set(r.test_id, 'discount_amount', e.target.value)} aria-label={`Discount for ${r.test_name}`} /></td>
                        </> : <><td className="text-right">{money(r.fee_amount)}</td><td className="text-right">{money(r.discount_amount)}</td></>}
                        <td className="text-right font-semibold">{money(Number(r.fee_amount) - Number(r.discount_amount))}</td>
                        <td>{editable ? <input type="date" className="input-sm" value={r.effective_date} onChange={(e) => set(r.test_id, 'effective_date', e.target.value)} aria-label={`Effective date for ${r.test_name}`} /> : fmtDate(r.effective_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-ink-100 md:hidden">
              {shown.map((r) => {
                const err = dirty(r) && rowError(r);
                return (
                  <li key={r.test_id} className={`p-3 ${dirty(r) ? 'bg-amber-50/50' : ''}`}>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-ink-900">{r.test_name} <span className="text-xs font-normal text-ink-500">{r.test_code}</span></p>
                      <p className="whitespace-nowrap text-sm font-bold">₹ {money(Number(r.fee_amount) - Number(r.discount_amount))}</p>
                    </div>
                    {editable ? (
                      <div className="grid grid-cols-3 gap-2">
                        <label className="text-xs text-ink-500">Fee<input type="number" min="0" step="0.01" className="input-sm mt-0.5" value={r.fee_amount} onChange={(e) => set(r.test_id, 'fee_amount', e.target.value)} /></label>
                        <label className="text-xs text-ink-500">Discount<input type="number" min="0" step="0.01" className="input-sm mt-0.5" value={r.discount_amount} onChange={(e) => set(r.test_id, 'discount_amount', e.target.value)} /></label>
                        <label className="text-xs text-ink-500">Effective<input type="date" className="input-sm mt-0.5 px-1" value={r.effective_date} onChange={(e) => set(r.test_id, 'effective_date', e.target.value)} /></label>
                      </div>
                    ) : <p className="text-xs text-ink-500">Fee ₹ {money(r.fee_amount)} · Discount ₹ {money(r.discount_amount)} · from {fmtDate(r.effective_date)}</p>}
                    {err && <p className="field-error">{err}</p>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
