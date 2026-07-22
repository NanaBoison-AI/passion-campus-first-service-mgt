import { h, empty, toast, clear, confirmAction } from '../lib/dom.js';
import { setAppbar } from '../lib/ui.js';
import { getGroup, loadMembers } from '../lib/store.js';
import { getService, saveService, deleteService } from '../api/attendance.js';
import { todayKey, prettyDate } from '../lib/format.js';

export async function renderRecord({ groupId }) {
  const g = await getGroup(groupId);
  setAppbar('Record attendance', { sub: g ? g.name : '', backHash: `#/g/${encodeURIComponent(groupId)}` });

  const members = (await loadMembers(groupId)).slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const present = new Set();
  const dateInput = h('input', { class: 'input', type: 'date', value: todayKey() });
  const search = h('input', { class: 'input', placeholder: '🔍  Filter…', onInput: () => paint() });
  const countEl = h('div', { class: 'badge green' }, '0');
  const rosterEl = h('div', { class: 'roster' });
  const wrap = h('div', {});

  async function loadDate() {
    const svc = await getService(groupId, dateInput.value);
    present.clear();
    svc.present.forEach((id) => present.add(id));
    paint();
  }

  function paint() {
    const q = search.value.trim().toLowerCase();
    clear(rosterEl);
    if (!members.length) { rosterEl.append(empty('No members. Add members first.')); }
    members
      .filter((m) => !q || [m.name, m.residence, m.contact].join(' ').toLowerCase().includes(q))
      .forEach((m) => rosterEl.append(rosterItem(m)));
    countEl.textContent = String(present.size);
  }

  function rosterItem(m) {
    const on = present.has(m.id);
    const cb = h('input', { type: 'checkbox', checked: on });
    const row = h('label', { class: 'roster-item' + (on ? ' present' : '') }, [
      cb,
      h('div', { class: 'p-main' }, [
        h('div', { class: 'p-name' }, m.name),
        h('div', { class: 'p-sub' }, m.residence || '—')
      ])
    ]);
    cb.addEventListener('change', () => {
      if (cb.checked) present.add(m.id); else present.delete(m.id);
      row.classList.toggle('present', cb.checked);
      countEl.textContent = String(present.size);
    });
    return row;
  }

  const markAll = (val) => {
    const q = search.value.trim().toLowerCase();
    members.forEach((m) => {
      if (!q || [m.name, m.residence, m.contact].join(' ').toLowerCase().includes(q)) {
        if (val) present.add(m.id); else present.delete(m.id);
      }
    });
    paint();
  };

  const saveBtn = h('button', { class: 'btn primary' }, '💾  Save');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      await saveService(groupId, dateInput.value, [...present]);
      toast(`Saved · ${present.size} present`, 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { saveBtn.disabled = false; }
  });

  const delBtn = h('button', { class: 'btn danger sm' }, '🗑  Delete record');
  delBtn.addEventListener('click', async () => {
    if (!confirmAction(`Delete attendance for ${prettyDate(dateInput.value)}?`)) return;
    try {
      await deleteService(groupId, dateInput.value);
      present.clear(); paint();
      toast('Record deleted', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  });

  dateInput.addEventListener('change', loadDate);

  clear(wrap);
  wrap.append(
    h('div', { class: 'card' }, [
      h('label', { class: 'field' }, [h('span', {}, 'Service date'), dateInput]),
      search
    ]),
    h('div', { class: 'controls mb' }, [
      h('button', { class: 'btn ghost sm', onClick: () => markAll(true) }, 'Select all'),
      h('button', { class: 'btn ghost sm', onClick: () => markAll(false) }, 'Clear all'),
      h('div', { class: 'spacer' }),
      h('div', {}, [countEl, h('span', { class: 'muted' }, ' present')])
    ]),
    rosterEl,
    h('div', { class: 'sticky-bar' }, [saveBtn]),
    h('div', { class: 'center mt' }, delBtn)
  );

  await loadDate();
  return wrap;
}
