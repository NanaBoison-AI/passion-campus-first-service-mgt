/** App-bar + bottom-sheet helpers shared by views. */
import { h, clear, mount } from './dom.js';
import { navigate } from './router.js';

/** Render the top app bar. backHash '' hides the back button. */
export function setAppbar(title, { sub = '', backHash = '' } = {}) {
  const bar = document.getElementById('appbar');
  const back = backHash
    ? h('button', { class: 'ab-back', 'aria-label': 'Back', onClick: () => navigate(backHash) }, '‹')
    : null;
  mount(bar, [
    back,
    h('div', { class: 'ab-title' }, [
      h('div', {}, title),
      sub ? h('div', { class: 'ab-sub' }, sub) : null
    ])
  ]);
}

/** Open a bottom sheet. `body` and `footer` are DOM nodes/arrays. Returns close(). */
export function openSheet({ title, body, footer }) {
  const root = document.getElementById('sheet-root');
  const close = () => clear(root);

  const backdrop = h('div', {
    class: 'sheet-backdrop',
    onClick: (e) => { if (e.target === backdrop) close(); }
  }, h('div', { class: 'sheet' }, [
    h('div', { class: 'handle' }),
    h('div', { class: 'sheet-head' }, [
      h('h2', {}, title || ''),
      h('button', { class: 'icon-btn', onClick: close }, '✕')
    ]),
    h('div', { class: 'sheet-body' }, body),
    footer ? h('div', { class: 'sheet-foot' }, footer) : null
  ]));

  mount(root, backdrop);
  return close;
}
