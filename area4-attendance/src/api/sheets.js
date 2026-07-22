/**
 * Sheets JSON API client. All calls go to the same-origin /api/sheets endpoint
 * (a Cloudflare Pages Function in prod, the Vite proxy in dev), which forwards
 * to the Apps Script Web App.
 */

const ENDPOINT = '/api/sheets';

async function get(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${ENDPOINT}?${qs}`, { method: 'GET' });
  return unwrap(res);
}

async function post(action, payload = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request, no preflight
    body: JSON.stringify({ action, ...payload })
  });
  return unwrap(res);
}

async function unwrap(res) {
  let data;
  try { data = await res.json(); } catch { throw new Error(`Bad response from Sheets API (${res.status}).`); }
  if (!res.ok || (data && data.error)) throw new Error((data && data.error) || `Sheets API error ${res.status}`);
  return data;
}

// ---- Groups ----
export const getGroups = () => get('groups');

// ---- Members ----
export const getMembers = (groupId) => get('members', { groupId });
export const addMember = (member) => post('addMember', { member });
export const updateMember = (member) => post('updateMember', { member });
