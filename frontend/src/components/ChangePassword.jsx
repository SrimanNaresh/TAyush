import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Modal, Toast } from './ui.jsx';
import { useToast } from '../hooks/useToast.js';
import { authApi } from '../api/client.js';

// Any login changes its own password (from Lab's ChangePassword).
export default function ChangePassword({ open, onClose }) {
  const { toast, show } = useToast();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setF({ current: '', next: '', confirm: '' }); }, [open]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (!f.current || !f.next) return show('Enter the current and the new password', 'error');
    if (f.next.length < 6) return show('New password must be at least 6 characters', 'error');
    if (f.next !== f.confirm) return show('The new passwords do not match', 'error');
    setSaving(true);
    try {
      await authApi.changePassword(f.current, f.next);
      show('Password changed', 'success');
      setTimeout(onClose, 800);
    } catch (err) {
      show(err.response?.data?.error || 'Could not change the password', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Change Password" size="sm">
        <form onSubmit={save} className="grid gap-3">
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={f.current} onChange={set('current')} autoComplete="current-password" />
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={f.next} onChange={set('next')} autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className="input" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
      <Toast toast={toast} />
    </>
  );
}
