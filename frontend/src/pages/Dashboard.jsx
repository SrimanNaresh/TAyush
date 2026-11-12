import { Link } from 'react-router-dom';
import { LayoutDashboard, ArrowRight } from 'lucide-react';
import { CardHeader } from '../components/ui.jsx';
import { useMenu } from '../components/TopNav.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { MENU_TONE_OF, MENU_TONES } from '../config/tones.js';
import SuperDashboard from './SuperDashboard.jsx';

// Suite home: one card per module the signed-in login may use, listing its
// pages (filtered by Menu Access). Module dashboards (pharmacy figures, lab
// counts, clinic queue) are linked from here as they arrive in later phases.
function pagesOf(nodes, trail = []) {
  return nodes.flatMap((n) => (n.submenu ? pagesOf(n.submenu, [...trail, n.label]) : [{ ...n, trail }]));
}

export default function Dashboard() {
  const { user } = useAuth();
  const menu = useMenu().filter((g) => g.label !== 'Dashboard');

  // Admin / Super Admin: only the all-activity page (screens are in the menu).
  if (user?.role === 'Admin') return <SuperDashboard />;

  return (
    <div className="space-y-4">
      <div className="card">
        <CardHeader
          icon={LayoutDashboard}
          title={`Welcome${user?.fullName || user?.username ? `, ${user.fullName || user.username}` : ''}`}
          subtitle="Choose a module to start"
        />
        {menu.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-400">No screens are assigned to your login yet. Ask an Admin to grant access in Menu Access.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {menu.map((g) => {
          const tone = MENU_TONES[MENU_TONE_OF[g.label] || 'brand'];
          const Icon = g.icon;
          const pages = pagesOf(g.children);
          return (
            <div key={g.label} className="card flex flex-col">
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${tone.grad}`}>
                  {Icon && <Icon size={18} />}
                </div>
                <div>
                  <p className="text-15 font-bold text-ink-900">{g.label}</p>
                  <p className="text-12 text-ink-400">{pages.length} screen{pages.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              <ul className="space-y-0.5">
                {pages.slice(0, 8).map((p) => (
                  <li key={p.to}>
                    <Link to={p.to} className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-13 text-ink-600 hover:bg-ink-50">
                      <span className="truncate">{[...p.trail, p.label].join(' › ')}</span>
                      <ArrowRight size={13} className="shrink-0 text-ink-300 group-hover:text-ink-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
