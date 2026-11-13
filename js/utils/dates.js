// Due dates are stored as local calendar dates: 'YYYY-MM-DD'.
const pad = (n) => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isISODate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Whole calendar days from `base` to `iso` (negative = in the past). */
export function diffDays(iso, base = todayISO()) {
  const a = fromISO(iso);
  const b = fromISO(base);
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / 86400000);
}

/** Next given weekday (0 = Sunday … 6 = Saturday), always in the future. */
export function nextWeekday(target, base = todayISO()) {
  const cur = fromISO(base).getDay();
  let delta = (target - cur + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(base, delta);
}

export function startOfDayMs(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Monday 00:00 of the current week. */
export function startOfWeekMs(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function dueLabel(iso, today = todayISO()) {
  const diff = diffDays(iso, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < -1) return `${-diff} days overdue`;
  const d = fromISO(iso);
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  const sameYear = d.getFullYear() === fromISO(today).getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dueTone(iso, today = todayISO()) {
  const diff = diffDays(iso, today);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'soon';
  return 'later';
}

export function longDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
