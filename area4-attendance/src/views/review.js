import { h, avatar, empty, toast, clear } from '../lib/dom.js';
import { setAppbar } from '../lib/ui.js';
import { getGroup, loadMembers } from '../lib/store.js';
import { getService, listServices } from '../api/attendance.js';
import { downloadCSV } from '../lib/csv.js';
import { todayKey, pct } from '../lib/format.js';
import { mapHref } from '../lib/contact.js';

export async function renderReview({ groupId }) {
  const g = await getGroup(groupId);
  setAppbar('Review attendance', { sub: g ? g.name : '', backHash: `#/g/${encodeURIComponent(groupId)}` });

  const members = await loadMembers(groupId);
  const byId = new Map(members.map((m) => [m.id, m]));

  const dateInput = h('input', { class: 'input', type: 'date', value: todayKey() });
  const summaryEl = h('div', {});
  const tabsEl = h('div', {});
  const listEl = h('div', { class: 'list mt' });
  let tab = 'present';
  let current = { present: [], absent: [] };
  let currentType = 'Sunday Service';

  async function load() {
    const svc = await getService(groupId, dateInput.value);
    currentType = svc.serviceType || 'Sunday Service';
    const presentIds = new Set(svc.present);
    const present = [], absent = [];
    members.forEach((m) => {
      if (presentIds.has(m.id)) present.push(m);
      else if (m.status !== 'Visitor') absent.push(m);
    });
    // present members no longer in the sheet (defensive)
    svc.present.forEach((id) => { if (!byId.has(id)) present.push({ id, name: '(unknown)', residence: '' }); });
    current = { present: sortByName(present), absent: sortByName(absent) };
    paintSummary();
    paintList();
  }

  function paintSummary() {
    const p = current.present.length, a = current.absent.length, total = p + a;
    const pPresent = pct(p, total);
    clear(summaryEl);
    summaryEl.append(
      h('div', { class: 'section-title', style: 'margin-top:2px' }, currentType),
      h('div', { class: 'stat-grid mb' }, [
        stat(p, 'Present', 'var(--green)'),
        stat(a, 'Absent', 'var(--red)'),
        stat(pPresent + '%', 'Present rate'),
        stat(total, 'Considered')
      ]),
      h('div', { class: 'progress mb' }, [
        h('div', { class: 'p-present', style: `width:${total ? (p / total) * 100 : 0}%` }),
        h('div', { class: 'p-absent', style: `width:${total ? (a / total) * 100 : 0}%` })
      ])
    );
  }

  function paintTabs() {
    clear(tabsEl);
    const seg = h('div', { class: 'seg' }, [
      segBtn('present', `Present · ${current.present.length}`),
      segBtn('absent', `Absent · ${current.absent.length}`)
    ]);
    tabsEl.append(seg);
  }
  function segBtn(key, label) {
    return h('button', { class: tab === key ? 'on' : '', onClick: () => { tab = key; paintTabs(); paintList(); } }, label);
  }

  function paintList() {
    paintTabs();
    const rows = current[tab];
    clear(listEl);
    if (!rows.length) { listEl.append(empty(tab === 'present' ? 'Nobody recorded present.' : 'No absentees 🎉')); return; }
    rows.forEach((m) => {
      const map = mapHref(m.location);
      listEl.append(h('div', { class: 'person' }, [
        avatar(m.name),
        h('div', { class: 'p-main' }, [
          h('div', { class: 'p-name' }, m.name),
          h('div', { class: 'p-sub' }, [m.residence, m.contact].filter(Boolean).join(' · ') || '—')
        ]),
        map ? h('a', {
          class: 'map-btn', href: map, target: '_blank', rel: 'noopener',
          title: 'Directions to ' + m.name, 'aria-label': 'Open location for ' + m.name
        }, '📍') : null
      ]));
    });
  }

  function exportDay() {
    const rows = [['Date', 'Service', 'Name', 'Contact', 'Residence', 'Member status', 'Attendance']];
    current.present.forEach((m) => rows.push([dateInput.value, currentType, m.name, m.contact || '', m.residence || '', m.status || '', 'Present']));
    current.absent.forEach((m) => rows.push([dateInput.value, currentType, m.name, m.contact || '', m.residence || '', m.status || '', 'Absent']));
    downloadCSV(`attendance_${g ? slug(g.name) : groupId}_${dateInput.value}.csv`, rows);
  }

  dateInput.addEventListener('change', load);

  const wrap = h('div', {}, [
    h('div', { class: 'card' }, [
      h('label', { class: 'field' }, [h('span', {}, 'Service date'), dateInput]),
      h('button', { class: 'btn soft block', onClick: exportDay }, '⬇  Export this date (CSV)')
    ]),
    summaryEl,
    tabsEl,
    listEl,
    rangeExport(groupId, g, members)
  ]);

  await load();
  return wrap;
}

/** Range export card: long-format present/absent CSV over a date range. */
function rangeExport(groupId, g, members) {
  const start = h('input', { class: 'input', type: 'date' });
  const end = h('input', { class: 'input', type: 'date', value: todayKey() });
  const btn = h('button', { class: 'btn ghost block' }, '⬇  Export date range (CSV)');

  btn.addEventListener('click', async () => {
    if (!start.value || !end.value) { toast('Pick a start and end date', 'err'); return; }
    btn.disabled = true; btn.textContent = 'Preparing…';
    try {
      const services = await listServices(groupId, start.value, end.value);
      if (!services.length) { toast('No records in that range', 'err'); return; }
      const rows = [['Date', 'Service', 'Name', 'Contact', 'Residence', 'Member status', 'Attendance']];
      services.forEach((svc) => {
        const type = svc.serviceType || 'Sunday Service';
        const presentIds = new Set(svc.present);
        members.forEach((m) => {
          if (presentIds.has(m.id)) rows.push([svc.date, type, m.name, m.contact || '', m.residence || '', m.status || '', 'Present']);
          else if (m.status !== 'Visitor') rows.push([svc.date, type, m.name, m.contact || '', m.residence || '', m.status || '', 'Absent']);
        });
      });
      downloadCSV(`attendance_${g ? slug(g.name) : groupId}_${start.value}_to_${end.value}.csv`, rows);
      toast(`Exported ${services.length} service days`, 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { btn.disabled = false; btn.textContent = '⬇  Export date range (CSV)'; }
  });

  return h('div', { class: 'card mt' }, [
    h('div', { class: 'section-title' }, 'Export a date range'),
    h('div', { class: 'row-2 mb' }, [
      h('label', { class: 'field' }, [h('span', {}, 'From'), start]),
      h('label', { class: 'field' }, [h('span', {}, 'To'), end])
    ]),
    btn
  ]);
}

const stat = (num, lbl, color) => h('div', { class: 'stat' }, [
  h('div', { class: 's-num', style: color ? `color:${color}` : '' }, String(num)),
  h('div', { class: 's-lbl' }, lbl)
]);
const sortByName = (a) => a.sort((x, y) => String(x.name).localeCompare(String(y.name)));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
