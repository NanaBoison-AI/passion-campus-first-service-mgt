import { h, avatar, empty } from '../lib/dom.js';
import { setAppbar } from '../lib/ui.js';
import { navigate } from '../lib/router.js';
import { loadGroups } from '../lib/store.js';
import { signOutUser } from '../api/auth.js';

const AREA = import.meta.env.VITE_AREA_LABEL || 'Area 4';

export async function renderGroups() {
  setAppbar(AREA, { sub: 'Select a group', action: { label: 'Sign out', onClick: () => signOutUser() } });
  const groups = await loadGroups();
  if (!groups.length) {
    return empty('No groups yet. Add rows to the GROUPS tab of your Google Sheet.');
  }
  return h('div', {}, [
    h('div', { class: 'section-title' }, `${groups.length} group${groups.length > 1 ? 's' : ''}`),
    h('div', { class: 'list' }, groups.map(groupRow))
  ]);
}

function groupRow(g) {
  const sub = [g.leader, g.meetingDay].filter(Boolean).join(' · ') || g.description || '—';
  return h('div', {
    class: 'card card-tap',
    onClick: () => navigate(`#/g/${encodeURIComponent(g.id)}`)
  }, h('div', { class: 'group-row' }, [
    avatar(g.name),
    h('div', { class: 'g-main' }, [
      h('div', { class: 'g-name' }, g.name),
      h('div', { class: 'g-sub' }, sub)
    ]),
    h('div', { class: 'g-arrow' }, '›')
  ]));
}
