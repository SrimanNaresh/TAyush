import { useCallback, useEffect, useState } from 'react';
import { useAuth as useCoreAuth } from '../../context/AuthContext.jsx';
import { menuAccessApi } from '../../api/client.js';

// Lab's role permissions (source: T_Lab AuthContext PERMS) mapped onto Menu
// Access. The server checks the same rules (backend/src/lab/routes).
// Admin-only stays Admin-only; Attendant / Assistant work = Full on the page.
const PERMS = {
  manageSettings: 'admin',
  editTests: 'admin',
  editFees: 'admin',
  deletePatients: 'admin',
  deleteAssignments: 'admin',
  // Lab has no Patients page of its own: patients are registered in Clinic.
  editPatients: ['clinic.registration.patient'],
  editAssignments: ['lab.assignment-new'],
  enterResults: ['lab.results'],
};

// One Menu Access read per login, shared by every lab page.
let cache = { userId: null, map: null, promise: null };

export function useAuth() {
  const auth = useCoreAuth();
  const { user } = auth;
  const [access, setAccess] = useState(() => (cache.userId === user?.userId ? cache.map : null));

  useEffect(() => {
    if (!user?.userId || user.role === 'Admin') return undefined;
    if (cache.userId !== user.userId || !cache.promise) {
      cache = {
        userId: user.userId,
        map: null,
        promise: menuAccessApi.get(user.userId).then((rows) => new Map(rows.map((r) => [r.MenuKey, r.AccessLevel]))),
      };
    }
    let alive = true;
    cache.promise
      .then((m) => { cache.map = m; if (alive) setAccess(m); })
      .catch(() => { if (alive) setAccess(new Map()); });
    return () => { alive = false; };
  }, [user?.userId, user?.role]);

  const can = useCallback((perm) => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    const rule = PERMS[perm];
    if (!rule || rule === 'admin') return false;
    return rule.some((k) => access?.get(k) === 'Full');
  }, [user, access]);

  return { ...auth, can };
}
