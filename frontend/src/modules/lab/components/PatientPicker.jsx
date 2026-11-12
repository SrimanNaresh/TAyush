import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { patientApi } from '../api.js';
import { useDebounced } from './ui.jsx';

// Searchable patient picker (Patient ID, name, phone). Keyboard: ↑ ↓ Enter Esc.
export default function PatientPicker({ value, onChange, id = 'patient-picker', disabled }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [state, setState] = useState('idle');
  const [active, setActive] = useState(0);
  const box = useRef();

  useEffect(() => {
    if (!open) return;
    let live = true;
    setState('loading');
    patientApi.list(dq, 20)
      .then((r) => { if (live) { setItems(r); setActive(0); setState('done'); } })
      .catch(() => live && setState('error'));
    return () => { live = false; };
  }, [dq, open]);

  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const choose = (p) => { onChange(p); setOpen(false); setQ(''); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && items[active]) { e.preventDefault(); choose(items[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{value.full_name}</p>
          <p className="text-xs text-ink-600">{value.patient_code} · {value.gender}{value.age !== null && value.age !== undefined ? ` · ${value.age} y` : ''}{value.phone ? ` · ${value.phone}` : ''}</p>
        </div>
        {!disabled && <button type="button" className="btn-ghost min-h-0 px-2 py-1 text-xs" onClick={() => onChange(null)}><X size={14} /> Change</button>}
      </div>
    );
  }
  return (
    <div className="relative" ref={box}>
      <Search size={16} className="pointer-events-none absolute left-3 top-[19px] -translate-y-1/2 text-ink-400" />
      <input id={id} className="input pl-9" placeholder="Search patient by ID, name or phone…" value={q} disabled={disabled}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" autoComplete="off" />
      {open && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-ink-200 bg-white shadow-lg">
          {state === 'loading' && <li className="px-3 py-2 text-sm text-ink-500">Searching…</li>}
          {state === 'error' && <li className="px-3 py-2 text-sm text-red-600">Could not load patients</li>}
          {state === 'done' && !items.length && <li className="px-3 py-2 text-sm text-ink-500">No matching patients</li>}
          {state === 'done' && items.map((p, i) => (
            <li key={p.patient_id} role="option" aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-brand-50' : ''}`}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(p); }}>
              <p className="text-sm font-semibold text-ink-900">{p.full_name}</p>
              <p className="text-xs text-ink-500">{p.patient_code} · {p.gender}{p.phone ? ` · ${p.phone}` : ''}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
