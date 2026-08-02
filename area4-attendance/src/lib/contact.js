/** Build tappable tel:/maps links from member fields (no Maps API needed). */

/** tel: link from a contact field that may hold multiple numbers. */
export function telHref(contact) {
  const first = String(contact || '').split(/[\/,;]+/)[0]; // dial the first number listed
  const cleaned = first.replace(/[^\d+]/g, '');
  return cleaned.replace(/[^\d]/g, '').length >= 6 ? 'tel:' + cleaned : '';
}

/**
 * Google Maps URL from a stored location (no API / billing):
 *  - a pasted Maps link (http/https) → opened as-is
 *  - "lat,lng" or an address → universal Maps URL that deep-links the app
 */
export function mapHref(location) {
  const v = String(location || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v);
}
