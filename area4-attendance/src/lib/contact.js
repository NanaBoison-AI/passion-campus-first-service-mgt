/** Build tappable tel:/maps links from member fields (no Maps API needed). */

/** tel: link from a contact field that may hold multiple numbers. */
export function telHref(contact) {
  const first = String(contact || '').split(/[\/,;]+/)[0]; // dial the first number listed
  const cleaned = first.replace(/[^\d+]/g, '');
  return cleaned.replace(/[^\d]/g, '').length >= 6 ? 'tel:' + cleaned : '';
}

/**
 * Google Maps URL (no API / billing). Prefers a pasted Maps link; otherwise
 * builds a universal Maps URL from "lat,lng" coordinates. Both open the Maps
 * app on mobile / the browser on desktop.
 */
export function mapHref(mapLink, coords) {
  const link = String(mapLink || '').trim();
  if (/^https?:\/\//i.test(link)) return link;
  const query = String(coords || '').trim() || link;
  return query ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query) : '';
}
