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
  const totalsEl = h('div', { class: 'mb' });
  const listEl = h('div', { class: 'list' });
  const search = h('input', {
    class: 'input mb', placeholder: '🔍  Search name / contact / residence…',
    onInput: () => paint(search.value)
  });

  function paintTotals() {
    const total = members.length;
    const by = (s) => members.filter((m) => (m.status || 'Active') === s).length;
    clear(totalsEl);
    totalsEl.append(h('div', { class: 'stat-grid' }, [
      stat(total, 'Total'),
      stat(by('Active'), 'Active', 'var(--green)'),
      stat(by('Inactive'), 'Inactive', 'var(--red)')
    ]));
  }

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
    const tel = telHref(m.contact);
    const map = mapHref(m.location);
    return h('div', { class: 'person tap', onClick: () => openForm(m) }, [
      avatar(m.name),
      h('div', { class: 'p-main' }, [
        h('div', { class: 'p-name' }, m.name),
        h('div', { class: 'p-sub' }, sub)
      ]),
      statusChip(m.status),
      map
        ? h('a', {
            class: 'map-btn', href: map, target: '_blank', rel: 'noopener',
            title: 'Directions to ' + m.name, 'aria-label': 'Open location for ' + m.name,
            onClick: (e) => e.stopPropagation()
          }, '📍')
        : null,
      tel
        ? h('a', {
            class: 'call-btn', href: tel, title: 'Call ' + m.name, 'aria-label': 'Call ' + m.name,
            onClick: (e) => e.stopPropagation()
          }, '📞')
        : null
    ]);
  }

  async function refresh() {
    invalidateMembers(groupId);
    members = await loadMembers(groupId, true);
    paintTotals();
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
        mk('Location (Google Maps link or lat,lng)', 'location', { ph: 'Paste a Maps link or 5.6037,-0.1870' }),
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
        residence: f.residence.value.trim(), location: f.location.value.trim(),
        gender: f.gender.value, status: f.status.value, notes: f.notes.value.trim()
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

  paintTotals();
  paint();
  return h('div', {}, [
    totalsEl,
    h('button', { class: 'btn primary block mb', onClick: () => openForm(null) }, '＋  Add member'),
    g && g.sheetUrl
      ? h('a', { class: 'link mb', href: g.sheetUrl, target: '_blank', rel: 'noopener', style: 'display:inline-block' }, 'Open ministry sheet ↗')
      : null,
    search,
    listEl
  ]);
}

function statusChip(s) {
  const cls = s === 'Active' ? 'active' : s === 'Visitor' ? 'visitor' : 'inactive';
  return h('span', { class: 'chip ' + cls }, s || '—');
}

const stat = (num, lbl, color) => h('div', { class: 'stat' }, [
  h('div', { class: 's-num', style: color ? `color:${color}` : '' }, String(num)),
  h('div', { class: 's-lbl' }, lbl)
]);

/** Build a tel: link from a contact field that may hold multiple numbers. */
function telHref(contact) {
  const first = String(contact || '').split(/[\/,;]+/)[0]; // dial the first number listed
  const cleaned = first.replace(/[^\d+]/g, '');
  return cleaned.replace(/[^\d]/g, '').length >= 6 ? 'tel:' + cleaned : '';
}

/**
 * Turn a stored location into a Google Maps URL (no API / billing needed).
 *  - a pasted Maps link (http/https, incl. maps.app.goo.gl) → opened as-is
 *  - "lat,lng" coordinates → universal Maps URL that deep-links the app
 *  - any other text (an address) → treated as a Maps search query
 * On mobile these open the Google Maps app; otherwise the browser.
 */
function mapHref(location) {
  const v = String(location || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v);
}
