/**
 * Sheets JSON API client. All calls go to the same-origin /api/sheets endpoint
 * (a Cloudflare Pages Function in prod, the Vite proxy in dev), which forwards
 * to the Apps Script Web App.
 */

import { idToken } from './auth.js';

const ENDPOINT = '/api/sheets';

// Same-origin call, so any header is fine (no CORS preflight). The proxy
// verifies this token before forwarding to Apps Script.
async function authHeader() {
  const t = await idToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

async function get(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${ENDPOINT}?${qs}`, { method: 'GET', headers: await authHeader() });
  return unwrap(res);
}

async function post(action, payload = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8', ...(await authHeader()) },
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
