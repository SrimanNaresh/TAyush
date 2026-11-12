import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { usePlan } from '../hooks/usePlan.js';

// Slim warning under the menu for every login when the plan is about to end
// (within its warning days) or has ended. Warn only: the app keeps working.
// Can be hidden for the rest of the browser session.
export default function PlanBanner() {
  const plan = usePlan();
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem('plan-banner-hidden') === '1'; } catch { return false; }
  });

  if (hidden || !plan || !['expiring', 'expired'].includes(plan.status)) return null;
  const expired = plan.status === 'expired';
  const until = plan.validUntil ? new Date(plan.validUntil).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const hide = () => {
    setHidden(true);
    try { sessionStorage.setItem('plan-banner-hidden', '1'); } catch { /* not stored */ }
  };

  return (
    <div role="alert" className={`no-print flex items-center gap-2 px-4 py-1.5 text-13 lg:px-6 ${expired ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-900'}`}>
      <AlertTriangle size={15} className="shrink-0" />
      <p className="min-w-0 flex-1">
        {expired
          ? <>Your plan <b>{plan.planName}</b> expired on <b>{until}</b>. Please renew to continue using the software.</>
          : <>Your plan <b>{plan.planName}</b> ends on <b>{until}</b> ({plan.daysLeft} day(s) left). Please renew in time.</>}
      </p>
      <button type="button" onClick={hide} aria-label="Hide" className="rounded p-0.5 opacity-80 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}
