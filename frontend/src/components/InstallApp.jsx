import { useState } from 'react';
import { Share, PlusSquare, Download, MonitorSmartphone } from 'lucide-react';
import { Modal } from './ui.jsx';
import { useInstall } from '../utils/pwa.js';

// Install the app on a phone or computer (PWA). Hidden when it is already
// installed or the browser can't install it. From the Lab app's InstallApp.

// iPhone / iPad: Safari has no install prompt, so explain the two taps.
export function IosInstallHelp({ open, onClose, appName = 'this app' }) {
  return (
    <Modal open={open} onClose={onClose} title={`Install ${appName}`}>
      <ol className="space-y-3 text-sm text-ink-700">
        <li className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Share size={16} /></span>
          In Safari, tap the <b>Share</b> button.
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><PlusSquare size={16} /></span>
          Choose <b>Add to Home Screen</b>, then <b>Add</b>.
        </li>
      </ol>
      <p className="mt-3 text-12 text-ink-400">{appName} then opens full screen from its home-screen icon.</p>
      <div className="mt-4 flex justify-end"><button type="button" className="btn-primary" onClick={onClose}>Got it</button></div>
    </Modal>
  );
}

// "Install App" pill for the sign-in page (on the coloured background).
export function InstallLink({ appName, className = '', light = false }) {
  const { canInstall, iosHint, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (!canInstall && !iosHint) return null;
  return (
    <>
      <button type="button" onClick={() => (canInstall ? install() : setHelp(true))}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-12 font-semibold transition-colors ${light ? 'border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100' : 'border border-white/25 bg-white/10 text-white hover:bg-white/20'} ${className}`}>
        <Download size={13} /> Install App
      </button>
      <IosInstallHelp open={help} onClose={() => setHelp(false)} appName={appName} />
    </>
  );
}

// "Install App" row for the signed-in user menu.
export function InstallMenuItem({ appName, onDone }) {
  const { canInstall, iosHint, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (!canInstall && !iosHint) return null;
  return (
    <>
      <button type="button"
        onClick={async () => { if (canInstall) { await install(); onDone?.(); } else setHelp(true); }}
        className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-ink-700 transition-colors hover:bg-ink-50">
        <MonitorSmartphone size={15} /> Install App
      </button>
      <IosInstallHelp open={help} onClose={() => { setHelp(false); onDone?.(); }} appName={appName} />
    </>
  );
}
