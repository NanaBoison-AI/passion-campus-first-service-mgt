import { h } from '../lib/dom.js';
import { setAppbar } from '../lib/ui.js';
import { navigate } from '../lib/router.js';
import { getGroup } from '../lib/store.js';

const AREA = import.meta.env.VITE_AREA_LABEL || 'Area 4';

const ACTIONS = [
  { ic: '👥', name: 'Memberships', desc: 'Create & update members', to: 'members' },
  { ic: '✅', name: 'Record', desc: "Mark a service's attendance", to: 'record' },
  { ic: '📅', name: 'Review', desc: 'Present / absent · export', to: 'review' },
  { ic: '📈', name: 'Graphs', desc: 'Trends & averages', to: 'graphs' }
];

export async function renderDashboard({ groupId }) {
  const g = await getGroup(groupId);
  setAppbar(g ? g.name : 'Group', { sub: AREA, backHash: '#/' });

  return h('div', {}, [
    g && g.description ? h('div', { class: 'card muted' }, g.description) : null,
    h('div', { class: 'actions' }, ACTIONS.map((a) =>
      h('div', {
        class: 'action',
        onClick: () => navigate(`#/g/${encodeURIComponent(groupId)}/${a.to}`)
      }, [
        h('div', { class: 'a-ic' }, a.ic),
        h('div', { class: 'a-name' }, a.name),
        h('div', { class: 'a-desc' }, a.desc)
      ]))
    )
  ]);
}
