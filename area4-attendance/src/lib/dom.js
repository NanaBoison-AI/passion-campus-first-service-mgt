/** Tiny hyperscript + DOM helpers (keeps the app framework-free). */

export function h(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') e.value = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  appendChildren(e, children);
  return e;
}

export function appendChildren(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const c of list.flat()) {
    if (c == null || c === false) continue;
    parent.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };

export function mount(node, content) {
  clear(node);
  appendChildren(node, content);
}

/** Non-blocking toast. kind: '', 'ok', 'err'. */
let toastTimer;
export function toast(msg, kind = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast ' + kind; }, 3200);
}

export const spinner = () => h('div', { class: 'loader' }, h('div', { class: 'spin' }));

export const empty = (msg) => h('div', { class: 'empty' }, msg);

export const avatar = (name) => h('div', { class: 'avatar' }, initials(name));

export function initials(name) {
  const p = String(name || '?').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}

/** Confirm helper (native, good enough for a minimalist tool). */
export const confirmAction = (msg) => window.confirm(msg);
