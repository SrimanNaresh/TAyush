import { useRef, useState } from 'react';
import { Download, Upload, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { Modal, useToast } from './ui.jsx';
import { errMsg } from '../api.js';

// Template / Import / Export buttons shared by Patients and Test Master.
//   onTemplate(), onExport('xlsx' | 'csv'), onImport(file) -> result shown by renderResult(result)
export default function SheetTools({ canImport, onTemplate, onExport, onImport, renderResult }) {
  const toast = useToast();
  const fileRef = useRef();
  const [busy, setBusy] = useState('');
  const [menu, setMenu] = useState(false);
  const [result, setResult] = useState(null);

  const run = async (what, fn) => {
    setBusy(what);
    try { await fn(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(''); }
  };
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await run('import', async () => setResult(await onImport(file)));
  };

  return (
    <>
      <button className="btn-secondary" onClick={() => run('template', onTemplate)} disabled={!!busy}><FileSpreadsheet size={16} /> {busy === 'template' ? 'Preparing…' : 'Template'}</button>
      {canImport && (
        <>
          <button className="btn-secondary" onClick={() => fileRef.current.click()} disabled={!!busy}><Upload size={16} /> {busy === 'import' ? 'Importing…' : 'Import'}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={pick} aria-label="Choose file to import" />
        </>
      )}
      <div className="relative">
        <button className="btn-secondary" onClick={() => setMenu(!menu)} disabled={!!busy} aria-haspopup="menu" aria-expanded={menu}>
          <Download size={16} /> {busy === 'export' ? 'Exporting…' : 'Export'} <ChevronDown size={14} />
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lg" onMouseLeave={() => setMenu(false)}>
            {[['xlsx', 'Excel (.xlsx)'], ['csv', 'CSV (.csv)']].map(([k, l]) => (
              <button key={k} role="menuitem" className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50" onClick={() => { setMenu(false); run('export', () => onExport(k)); }}>{l}</button>
            ))}
          </div>
        )}
      </div>
      <Modal open={!!result} onClose={() => setResult(null)} title="Import result" size="lg"
        footer={<button className="btn-primary" onClick={() => setResult(null)}>Done</button>}>
        {result && renderResult(result)}
      </Modal>
    </>
  );
}

export function IssueTable({ title, rows, tone = 'red' }) {
  if (!rows?.length) return null;
  return (
    <div className="mt-3">
      <h3 className={`mb-1 text-sm font-bold ${tone === 'red' ? 'text-red-700' : 'text-amber-700'}`}>{title} ({rows.length})</h3>
      <div className="max-h-64 overflow-auto rounded-lg border border-ink-200">
        <table className="table">
          <thead><tr><th>Row</th><th>Name</th><th>Reason</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.row}</td><td>{r.name || r.test_name}</td><td>{r.reason}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
