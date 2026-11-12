import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, X } from 'lucide-react';
import { ALL_MENU_ITEMS } from '../../../config/menuItems.js';

// Shared pieces of the Admin, Reception and Doctor dashboards, so all three
// look and behave the same: compact stat cards, a tab bar, the queue steps
// and the Quick Actions column (with search) on the right.

// Small stat cards: label, value and icon, a coloured bar on the left.
export function StatCards({ cards }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="relative overflow-hidden rounded-xl border border-ink-100 bg-white px-3 py-2.5 shadow-card">
          <span className={`absolute left-0 top-0 h-full w-1 ${c.bar}`} />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-11 font-medium leading-tight text-ink-500">{c.label}</p>
              <p className="mt-0.5 text-xl font-bold leading-tight text-ink-800">{c.value}</p>
            </div>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.ring}`}>
              <c.icon size={16} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Tab bar. tabs: [{ key, label, icon, badge? }]
export function DashTabs({ tabs, tab, onChange }) {
  return (
    <div className="-mt-1 mb-3 flex flex-wrap gap-1 border-b border-ink-100" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-13 font-semibold transition-colors ${
            tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <t.icon size={15} /> {t.label}
          {t.badge != null && <span className="rounded-full bg-ink-100 px-1.5 text-11 text-ink-600">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

// Where every confirmed patient stands: one small tile per status.
export function QueueSteps({ steps, counts }) {
  return (
    <>
      <p className="mb-2 text-12 text-ink-400">Where every confirmed patient stands right now</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {steps.map((s) => (
          <div key={s.key} className={`rounded-xl px-3 py-2.5 ${s.color}`}>
            <s.icon size={16} />
            <p className="mt-1 text-xl font-bold">{counts[s.key]}</p>
            <p className="text-xs font-medium opacity-80">{s.label}</p>
          </div>
        ))}
      </div>
    </>
  );
}

// Quick Actions column with a search box: filters the shortcuts and, while
// typing, lists up to 8 other menu pages that match.
export function QuickActionsPanel({ links }) {
  const [qSearch, setQSearch] = useState('');
  const q = qSearch.trim().toLowerCase();
  const shown = q ? links.filter((l) => `${l.label} ${l.desc}`.toLowerCase().includes(q)) : links;
  const others = q
    ? ALL_MENU_ITEMS.filter((m) => !links.some((l) => l.to === m.to) && `${m.group} ${m.label}`.toLowerCase().includes(q)).slice(0, 8)
    : [];

  return (
    <aside className="card shrink-0 lg:sticky lg:top-2 lg:w-64">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Quick Actions</p>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          className="input h-8 pl-8 pr-7 text-13"
          placeholder="Search actions or pages..."
          value={qSearch}
          onChange={(e) => setQSearch(e.target.value)}
          aria-label="Search quick actions"
        />
        {qSearch && (
          <button type="button" onClick={() => setQSearch('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            <X size={13} />
          </button>
        )}
      </div>
      {shown.length === 0 && others.length === 0 && (
        <p className="px-2 py-3 text-center text-12 text-ink-400">Nothing matches "{qSearch}".</p>
      )}
      <div className="flex flex-col gap-1">
        {shown.map((l) => (
          <Link key={l.to} to={l.to} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-ink-50">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${l.color} text-white shadow-sm`}>
              <l.icon size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-13 font-semibold text-ink-700">{l.label}</p>
              <p className="truncate text-11 text-ink-400">{l.desc}</p>
            </div>
            <ArrowRight size={14} className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
          </Link>
        ))}
      </div>
      {others.length > 0 && (
        <div className="mt-2 border-t border-ink-100 pt-2">
          <p className="mb-1 px-2 text-10 font-semibold uppercase tracking-wide text-ink-400">Other pages</p>
          {others.map((p) => (
            <Link key={p.to} to={p.to} className="group flex items-center gap-2 rounded-lg px-2 py-1 text-13 text-ink-600 transition-colors hover:bg-ink-50 hover:text-brand-700">
              <ArrowRight size={12} className="shrink-0 text-ink-300 group-hover:text-brand-500" />
              <span className="min-w-0 truncate"><span className="text-ink-400">{p.group} › </span>{p.label}</span>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
