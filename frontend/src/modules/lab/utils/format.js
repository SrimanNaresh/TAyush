export const ymd = (v) => (v ? String(v).slice(0, 10) : '');

export function fmtDate(v) {
  const s = ymd(v);
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}-${m}-${y}`;
}

export const money = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ageFrom(dob) {
  if (!dob) return '';
  const [y, m, d] = dob.split('-').map(Number);
  const t = new Date();
  let a = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a -= 1;
  return a >= 0 ? a : '';
}
