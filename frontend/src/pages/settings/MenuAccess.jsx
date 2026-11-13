import { useEffect, useState, useCallback } from 'react';
import { Save, Search, ShieldCheck, User } from 'lucide-react';
import { Spinner, EmptyState, Toast, CardHeader } from '../../components/ui.jsx';
import { useToast } from '../../hooks/useToast.js';
import { userApi, menuAccessApi } from '../../api/client.js';
import { MENU_GROUPS, ALL_MENU_ITEMS, ACCESS_LEVELS } from '../../config/menuItems.js';
import { usePlan, planAllowsGroup } from '../../hooks/usePlan.js';

const emptyAccess = () => {
  const m = {};
  for (const it of ALL_MENU_ITEMS) m[it.key] = 'No Access';
  return m;
};

const levelStyle = {
  Full: 'peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-600',
  View: 'peer-checked:bg-brand-600 peer-checked:text-white peer-checked:border-brand-600',
  'No Access': 'peer-checked:bg-slate-500 peer-checked:text-white peer-checked:border-slate-500',
};

// Recursive: a node with `submenu` is a nested bordered box (one level
// darker background per depth would be overkill — depth is at most a
// couple of levels here, e.g. Clinic > Consultation > Medication), a true
// leaf renders as the Full/View/No Access row.
function AccessNode({ node, access, setLevel, depth = 0 }) {
  if (node.submenu) {
    return (
      <div className={depth === 0 ? 'rounded-lg border border-ink-100 bg-ink-50/40 px-2.5 py-2' : 'ml-2 border-l border-ink-200 pl-2'}>
        <p className="mb-1 text-10 font-semibold uppercase tracking-wide text-ink-400">{node.label}</p>
        <div className="space-y-1">
          {node.submenu.map((child) => (
            <AccessNode key={child.key || child.label} node={child} access={access} setLevel={setLevel} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }
  return <AccessRow item={node} access={access} setLevel={setLevel} />;
}

function AccessRow({ item, access, setLevel }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-ink-100 bg-white px-2.5 py-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 text-13 font-medium text-ink-700">{item.label}</span>
      <div className="flex shrink-0 flex-wrap gap-1">
        {ACCESS_LEVELS.map((lvl) => (
          <label key={lvl} className="cursor-pointer">
            <input
              type="radio"
              name={`acc-${item.key}`}
              className="peer sr-only"
              checked={access[item.key] === lvl}
              onChange={() => setLevel(item.key, lvl)}
            />
            <span className={`inline-block rounded border border-ink-200 px-2 py-0.5 text-11 font-medium text-ink-500 transition-colors ${levelStyle[lvl]}`}>
              {lvl}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function MenuAccess() {
  const plan = usePlan();
  const { toast, show } = useToast();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [access, setAccess] = useState(emptyAccess());
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(null);

  const groups = MENU_GROUPS.filter((g) => planAllowsGroup(plan, g.group));
  const activeGroup = groups.find((g) => g.group === tab) || groups[0];

  const loadUsers = useCallback(async (q = '') => {
    setLoadingUsers(true);
    try {
      setUsers(await userApi.list(q));
    } catch {
      show('Failed to load users', 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, [show]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => {
    const t = setTimeout(() => loadUsers(userSearch), 350);
    return () => clearTimeout(t);
  }, [userSearch, loadUsers]);

  const selectUser = async (u) => {
    setSelectedUser(u);
    setLoadingAccess(true);
    const base = emptyAccess();
    try {
      const saved = await menuAccessApi.get(u.UserId);
      for (const row of saved) {
        if (row.MenuKey in base) base[row.MenuKey] = row.AccessLevel;
      }
    } catch {
      show('Failed to load access', 'error');
    } finally {
      setAccess(base);
      setLoadingAccess(false);
    }
  };

  const setLevel = (key, level) => setAccess((a) => ({ ...a, [key]: level }));

  const setAllTo = (level) => {
    const next = {};
    for (const it of ALL_MENU_ITEMS) next[it.key] = level;
    setAccess(next);
  };

  const save = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const items = ALL_MENU_ITEMS.map((it) => ({ menuKey: it.key, accessLevel: access[it.key] }));
      await menuAccessApi.save(selectedUser.UserId, items);
      show('Menu access saved', 'success');
    } catch (err) {
      show(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* LEFT: Users */}
        <div className="card h-fit">
          <CardHeader icon={User} title="Users" subtitle="Select a user" />
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search user..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
          </div>
          {loadingUsers ? (
            <Spinner />
          ) : users.length === 0 ? (
            <EmptyState message="No users." />
          ) : (
            <div className="max-h-[60vh] space-y-0.5 overflow-y-auto">
              {users.map((u) => {
                const selected = selectedUser?.UserId === u.UserId;
                return (
                  <button
                    key={u.UserId}
                    onClick={() => selectUser(u)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-13 transition-colors ${
                      selected ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-600 hover:bg-ink-50'
                    }`}
                  >
                    <span className="min-w-0 truncate">{u.Username}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {!u.IsActive && <span className="rounded bg-slate-100 px-1.5 text-10 leading-4 text-slate-500">Inactive</span>}
                      {u.Role && (
                        <span className={`rounded px-1.5 text-10 font-medium leading-4 ${selected ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
                          {u.Role}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Menu access */}
        <div className="card min-w-0">
          <CardHeader
            icon={ShieldCheck}
            title="Menu Access"
            subtitle={selectedUser ? `Permissions for ${selectedUser.Username}` : 'Select a user to set permissions'}
            actions={
              selectedUser && (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => setAllTo('No Access')}>Clear all</button>
                  <button className="btn-secondary" onClick={() => setAllTo('Full')}>Grant all</button>
                  <button className="btn-primary" onClick={save} disabled={saving}>
                    <Save size={16} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )
            }
          />

          {!selectedUser ? (
            <EmptyState message={<><span className="lg:hidden">Choose a user above</span><span className="hidden lg:inline">Choose a user on the left</span> to configure menu access.</>} />
          ) : loadingAccess ? (
            <Spinner />
          ) : (
            <div>
              {/* One tab per main menu in the plan's Menu Rights (Configuration > Clinic Master > Validity) */}
              <div className="-mt-1 mb-3 flex flex-wrap gap-x-0.5 border-b border-ink-100" role="tablist">
                {groups.map((g) => {
                  const leaves = ALL_MENU_ITEMS.filter((it) => it.group === g.group);
                  const granted = leaves.filter((it) => access[it.key] !== 'No Access').length;
                  const active = g.group === activeGroup?.group;
                  return (
                    <button
                      key={g.group}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(g.group)}
                      className={`-mb-px flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-2 py-1.5 text-13 font-semibold transition-colors ${
                        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'
                      }`}
                    >
                      {g.group}
                      <span className={`rounded-full px-1.5 text-10 leading-4 ${granted ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
                        {granted}/{leaves.length}
                      </span>
                    </button>
                  );
                })}
              </div>
              {activeGroup && (
                <div className="space-y-1.5" role="tabpanel">
                  {activeGroup.items.map((it) => (
                    <AccessNode key={it.key || it.label} node={it} access={access} setLevel={setLevel} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
