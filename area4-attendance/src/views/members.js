import { h, avatar, empty, toast, clear } from '../lib/dom.js';
import { setAppbar, openSheet } from '../lib/ui.js';
import { loadMembers, invalidateMembers, getGroup } from '../lib/store.js';
import { addMember, updateMember } from '../api/sheets.js';

const STATUSES = ['Active', 'Inactive', 'Visitor'];
const GENDERS = ['', 'Male', 'Female', 'Other'];

export async function renderMembers({ groupId }) {
  const g = await getGroup(groupId);
  setAppbar('Memberships', { sub: g ? g.name : '', backHash: `#/g/${encodeURIComponent(groupId)}` });

  let members = await loadMembers(groupId);
  const listEl = h('div', { class: 'list' });
  const search = h('input', {
    class: 'input mb', placeholder: '🔍  Search name / contact / residence…',
    onInput: () => paint(search.value)
  });

  function paint(q = '') {
    q = q.trim().toLowerCase();
    const rows = members
      .filter((m) => !q || [m.name, m.contact, m.residence].join(' ').toLowerCase().includes(q))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    clear(listEl);
    if (!rows.length) { listEl.append(empty('No members found. Tap “Add member”.')); return; }
    rows.forEach((m) => listEl.append(memberRow(m)));
  }

  function memberRow(m) {
    const sub = [m.residence, m.contact].filter(Boolean).join(' · ') || '—';
    return h('div', { class: 'person tap', onClick: () => openForm(m) }, [
      avatar(m.name),
      h('div', { class: 'p-main' }, [
        h('div', { class: 'p-name' }, m.name),
        h('div', { class: 'p-sub' }, sub)
      ]),
      statusChip(m.status)
    ]);
  }

  async function refresh() {
    invalidateMembers(groupId);
    members = await loadMembers(groupId, true);
    paint(search.value);
  }

  function openForm(existing) {
    const m = existing || { groupId, status: 'Active' };
    const f = {};
    const mk = (label, key, opts = {}) => {
      const el = opts.type === 'select'
        ? h('select', { class: 'input' }, opts.options.map((o) =>
            h('option', { value: o, selected: (m[key] || '') === o }, o || '—')))
        : h('input', { class: 'input', type: opts.type || 'text', value: m[key] || '', placeholder: opts.ph || '' });
      f[key] = el;
      return h('label', { class: 'field' }, [h('span', {}, label), el]);
    };

    const saveBtn = h('button', { class: 'btn primary' }, existing ? 'Save' : 'Add member');
    const close = openSheet({
      title: existing ? 'Edit member' : 'Add member',
      body: [
        mk('Name *', 'name', { ph: 'Full name' }),
        mk('Contact', 'contact', { ph: 'Phone number(s)', type: 'tel' }),
        mk('Residence', 'residence', { ph: 'Area / landmark' }),
        h('div', { class: 'row-2' }, [mk('Gender', 'gender', { type: 'select', options: GENDERS }),
          mk('Status', 'status', { type: 'select', options: STATUSES })]),
        mk('Notes', 'notes', { ph: 'Optional' })
      ],
      footer: [h('button', { class: 'btn ghost', onClick: () => close() }, 'Cancel'), saveBtn]
    });

    saveBtn.addEventListener('click', async () => {
      const payload = {
        id: m.id, groupId,
        name: f.name.value.trim(), contact: f.contact.value.trim(),
        residence: f.residence.value.trim(), gender: f.gender.value,
        status: f.status.value, notes: f.notes.value.trim()
      };
      if (!payload.name) { toast('Name is required', 'err'); return; }
      saveBtn.disabled = true;
      try {
        if (existing) await updateMember(payload); else await addMember(payload);
        close();
        toast(existing ? 'Member updated' : 'Member added', 'ok');
        await refresh();
      } catch (e) { saveBtn.disabled = false; toast(e.message, 'err'); }
    });
  }

  paint();
  return h('div', {}, [
    h('button', { class: 'btn primary block mb', onClick: () => openForm(null) }, '＋  Add member'),
    g && g.sheetUrl
      ? h('a', { class: 'link mb', href: g.sheetUrl, target: '_blank', rel: 'noopener', style: 'display:inline-block' }, 'Open group sheet ↗')
      : null,
    search,
    listEl
  ]);
}

function statusChip(s) {
  const cls = s === 'Active' ? 'active' : s === 'Visitor' ? 'visitor' : 'inactive';
  return h('span', { class: 'chip ' + cls }, s || '—');
}
