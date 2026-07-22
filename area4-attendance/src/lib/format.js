/** Date + small formatting helpers. Dates are handled as 'yyyy-MM-dd' keys. */

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const pad = (n) => String(n).padStart(2, '0');

export function dateKeyToDate(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthShort = (i) => MONTHS[i] || '';

export function prettyDate(key) {
  if (!key) return '';
  const d = dateKeyToDate(key);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]}, ${d.getDate()} ${monthShort(d.getMonth())} ${d.getFullYear()}`;
}

/** Inclusive check that a 'yyyy-MM-dd' key falls within [start, end] keys. */
export function inRange(key, start, end) {
  return (!start || key >= start) && (!end || key <= end);
}

export const pct = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : 0);
