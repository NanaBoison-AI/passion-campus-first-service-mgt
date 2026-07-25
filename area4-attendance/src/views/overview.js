import { h, avatar, spinner, mount, clear } from '../lib/dom.js';
import { setAppbar } from '../lib/ui.js';
import { navigate } from '../lib/router.js';
import { loadGroups, loadMembers } from '../lib/store.js';
import { getService } from '../api/attendance.js';
import { todayKey } from '../lib/format.js';

const AREA = import.meta.env.VITE_AREA_LABEL || 'Area 4';

/** Cross-group dashboard: attendance across every group for one date. */
export async function renderOverview() {
  setAppbar('Area dashboard', { sub: AREA, backHash: '#/' });

  const groups = await loadGroups();
  const dateInput = h('input', { class: 'input', type: 'date', value: todayKey() });
  const summaryEl = h('div', {});
  const listEl = h('div', { class: 'list' });

  dateInput.addEventListener('change', load);

  async function load() {
    mount(summaryEl, spinner());
    clear(listEl);
    const date = dateInput.value;
    const results = await Promise.all(groups.map(async (g) => {
      const [members, svc] = await Promise.all([
        loadMembers(g.id).catch(() => []),
        getService(g.id, date).catch(() => ({ present: [], exists: false }))
      ]);
      return summarize(g, members, svc);
    }));
    paint(results);
  }

  function summarize(g, members, svc) {
    const known = new Set(members.map((m) => m.id));
    const presentIds = new Set(svc.present || []);
    let present = 0, absent = 0;
    members.forEach((m) => {
      if (presentIds.has(m.id)) present++;
      else if (m.status !== 'Visitor') absent++;
    });
    (svc.present || []).forEach((id) => { if (!known.has(id)) present++; }); // present but not in sheet
    const considered = present + absent;
    return { g, present, considered, exists: !!svc.exists, rate: considered ? present / considered : 0 };
  }

  function paint(results) {
    const totalPresent = results.reduce((s, r) => s + r.present, 0);
    const totalConsidered = results.reduce((s, r) => s + r.considered, 0);
    const recorded = results.filter((r) => r.exists).length;
    const rate = totalConsidered ? Math.round((totalPresent / totalConsidered) * 1000) / 10 : 0;

    mount(summaryEl, h('div', { class: 'stat-grid mb' }, [
      stat(totalPresent, 'Present', 'var(--green)'),
      stat(totalConsidered, 'Considered'),
      stat(rate + '%', 'Present rate'),
      stat(`${recorded}/${results.length}`, 'Groups recorded')
    ]));

    // Recorded groups first (by present desc), then the ones still outstanding.
    results.sort((a, b) =>
      (b.exists - a.exists) || (b.present - a.present) || String(a.g.name).localeCompare(String(b.g.name)));

    clear(listEl);
    results.forEach((r) => listEl.append(groupRow(r)));
  }

  function groupRow(r) {
    const absentW = r.considered ? ((r.considered - r.present) / r.considered) * 100 : 0;
    return h('div', {
      class: 'card card-tap',
      onClick: () => navigate(`#/g/${encodeURIComponent(r.g.id)}`)
    }, [
      h('div', { class: 'group-row' }, [
        avatar(r.g.name),
        h('div', { class: 'g-main' }, [
          h('div', { class: 'g-name' }, r.g.name),
          h('div', { class: 'g-sub' }, r.exists
            ? `${r.present} present · ${Math.round(r.rate * 100)}%`
            : 'Not recorded')
        ]),
        r.exists
          ? h('span', { class: 'badge green' }, String(r.present))
          : h('span', { class: 'chip' }, 'Pending')
      ]),
      r.exists ? h('div', { class: 'progress', style: 'margin-top:10px' }, [
        h('div', { class: 'p-present', style: `width:${100 - absentW}%` }),
        h('div', { class: 'p-absent', style: `width:${absentW}%` })
      ]) : null
    ]);
  }

  await load();
  return h('div', {}, [
    h('div', { class: 'card' }, h('label', { class: 'field' }, [h('span', {}, 'Date'), dateInput])),
    summaryEl,
    h('div', { class: 'section-title' }, 'By group'),
    listEl
  ]);
}

const stat = (num, lbl, color) => h('div', { class: 'stat' }, [
  h('div', { class: 's-num', style: color ? `color:${color}` : '' }, String(num)),
  h('div', { class: 's-lbl' }, lbl)
]);
