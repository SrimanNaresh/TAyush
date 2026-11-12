import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Inbox, AlertTriangle, CheckCircle2, AlertCircle, Info, RefreshCw, ClipboardList } from 'lucide-react';
import { sectionOf } from '../../../config/tones.js';
import { GROUP_ICONS } from '../../../components/TopNav.jsx';

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((message, type = 'success') => {
    clearTimeout(timer.current);
    setToast({ message, type, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), type === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {/* Drops in at the top on phones (clear of the Menu button), bottom-right on wider screens. */}
      <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-3 top-14 z-[70] flex justify-center sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto">
        {toast && (() => {
          const st = {
            success: { box: 'border-emerald-200', icon: 'bg-emerald-500', Icon: CheckCircle2 },
            error: { box: 'border-red-200', icon: 'bg-red-500', Icon: AlertCircle },
            info: { box: 'border-ink-200', icon: 'bg-ink-700', Icon: Info },
          }[toast.type] || { box: 'border-ink-200', icon: 'bg-ink-700', Icon: Info };
          return (
            <div key={toast.key} role={toast.type === 'error' ? 'alert' : 'status'}
              className={`toast-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border bg-white py-2 pl-2 pr-2 text-sm font-medium text-ink-800 shadow-elevated ${st.box}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${st.icon}`}><st.Icon size={16} /></span>
              <span className="flex-1">{toast.message}</span>
              <button className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700" onClick={() => setToast(null)} aria-label="Dismiss"><X size={15} /></button>
            </div>
          );
        })()}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    setTimeout(() => ref.current?.querySelector('input,select,textarea,button:not([data-close])')?.focus(), 0);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }[size];
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 backdrop-blur-sm sm:items-start sm:overflow-y-auto sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={`flex max-h-[94vh] w-full animate-fade-in flex-col overflow-hidden rounded-t-2xl bg-white shadow-elevated sm:mt-8 sm:max-h-[88vh] sm:rounded-2xl ${w}`}>
        <div className="flex items-center justify-between border-b border-ink-100 bg-gradient-to-r from-ink-50 to-white px-5 py-3.5">
          <h2 className="text-base font-bold tracking-tight text-ink-800 sm:text-lg">{title}</h2>
          <button data-close className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Confirm ---------- */
const ConfirmCtx = createContext(null);
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (v) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title || 'Please confirm'} size="sm"
        footer={<>
          <button className="btn-secondary" onClick={() => close(false)}>Cancel</button>
          <button className={state?.danger === false ? 'btn-primary' : 'btn-danger'} onClick={() => close(true)}>{state?.confirmText || 'Delete'}</button>
        </>}>
        <div className="flex gap-3">
          <AlertTriangle className="shrink-0 text-amber-500" size={22} />
          <p className="text-sm text-ink-700">{state?.message}</p>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

/* ---------- States ---------- */
export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-ink-400" role="status">
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full border-[3px] border-brand-100" />
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-r-teal-400 border-t-brand-500" />
      </div>
      <span className="text-13 font-medium">{label}</span>
    </div>
  );
}
export function EmptyState({ message = 'No records found.', action }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-50 to-ink-100 text-ink-400 ring-1 ring-ink-100">
        <Inbox size={22} />
      </span>
      <p className="max-w-xs text-sm text-ink-500">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center" role="alert">
      <span className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
        <AlertCircle size={22} />
      </span>
      <p className="max-w-sm text-sm text-red-700">{message}</p>
      {onRetry && <button className="btn-secondary mt-3" onClick={onRetry}><RefreshCw size={15} /> Try again</button>}
    </div>
  );
}

// Section header in the colour of the page's main menu: gradient icon tile, the
// menu path above the title (wider screens), title + subtitle, actions on the
// right (wrapping under the title on phones) and a coloured accent stroke.
export function CardHeader({ icon, title, subtitle, actions, className = '' }) {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const { tone } = section;
  const Icon = icon || GROUP_ICONS[section.group] || ClipboardList;
  const path = [section.group, ...section.trail].filter((p, i, a) => p && a.indexOf(p) === i && p !== title);
  return (
    <div className={`no-print relative mb-3 flex flex-col flex-wrap gap-2 border-b border-ink-100 pb-2 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <span className={`pointer-events-none absolute -bottom-px left-0 h-0.5 w-14 rounded-full ${tone.bar}`} />
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ring-4 ${tone.grad} ${tone.ring}`}>
          <Icon size={15} />
        </div>
        <div className="min-w-0">
          {path.length > 0 && <p className={`hidden text-10 font-bold uppercase leading-tight tracking-[0.12em] sm:block ${tone.text}`}>{path.join(' › ')}</p>}
          <h1 className="text-15 font-bold leading-tight tracking-tight text-ink-900">{title}</h1>
          {subtitle && <div className="text-12 leading-snug text-ink-400">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}
export const PageHeader = CardHeader;

const STATUS_STYLE = {
  Pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  'Sample Collected': 'bg-sky-50 text-sky-800 ring-sky-200',
  'In Progress': 'bg-violet-50 text-violet-800 ring-violet-200',
  Completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Draft: 'bg-ink-100 text-ink-700 ring-ink-200',
};
export function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`badge whitespace-nowrap ring-1 ring-inset ${STATUS_STYLE[status] || STATUS_STYLE.Draft}`}>{status}</span>;
}

export function Field({ label, htmlFor, error, required, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">{label}{required && <span className="text-red-600"> *</span>}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

// Hook for list screens: load(), plus loading / error / data.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const seq = useRef(0);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await fn();
      if (n === seq.current) setState({ loading: false, error: '', data });
    } catch (e) {
      if (n === seq.current) setState((s) => ({ ...s, loading: false, error: e?.response?.data?.error || e.message || 'Could not load data' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
