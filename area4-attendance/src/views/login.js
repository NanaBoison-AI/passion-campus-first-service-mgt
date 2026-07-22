import { h } from '../lib/dom.js';
import { signIn, authErrorMessage } from '../api/auth.js';

const AREA = import.meta.env.VITE_AREA_LABEL || 'Area 4';

/** Full-screen login gate. Resolves via onAuth in main.js after sign-in. */
export function renderLogin() {
  const username = h('input', {
    class: 'input', type: 'text', autocomplete: 'username',
    placeholder: 'Username', autocapitalize: 'none', autocorrect: 'off'
  });
  const password = h('input', {
    class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Password'
  });
  const errEl = h('div', { class: 'err-box', style: 'display:none' });
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Sign in');

  const form = h('form', {
    class: 'login-card',
    onSubmit: async (e) => {
      e.preventDefault();
      errEl.style.display = 'none';
      const u = username.value.trim();
      if (!u || !password.value) { showErr('Enter your username and password.'); return; }
      btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        await signIn(u, password.value);
        // onAuth (main.js) will render the app.
      } catch (err) {
        showErr(authErrorMessage(err));
        btn.disabled = false; btn.textContent = 'Sign in';
      }
    }
  }, [
    h('div', { class: 'login-logo' }, '4'),
    h('h1', { class: 'login-title' }, AREA),
    h('div', { class: 'muted login-sub' }, 'Membership & attendance'),
    errEl,
    h('label', { class: 'field' }, [h('span', {}, 'Username'), username]),
    h('label', { class: 'field' }, [h('span', {}, 'Password'), password]),
    btn
  ]);

  function showErr(msg) { errEl.textContent = msg; errEl.style.display = 'block'; }

  return h('div', { class: 'login-wrap' }, form);
}
