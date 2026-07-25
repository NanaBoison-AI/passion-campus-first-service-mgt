import './styles.css';
import { createRouter } from './lib/router.js';
import { mount, spinner, h } from './lib/dom.js';
import { onAuth } from './api/auth.js';
import { renderLogin } from './views/login.js';

import { renderGroups } from './views/groups.js';
import { renderOverview } from './views/overview.js';
import { renderDashboard } from './views/dashboard.js';
import { renderMembers } from './views/members.js';
import { renderRecord } from './views/record.js';
import { renderReview } from './views/review.js';
import { renderGraphs } from './views/graphs.js';

const appbarEl = document.getElementById('appbar');
const viewEl = document.getElementById('view');

const routes = [
  { path: '/', handler: renderGroups },
  { path: '/overview', handler: renderOverview },
  { path: '/g/:groupId', handler: renderDashboard },
  { path: '/g/:groupId/members', handler: renderMembers },
  { path: '/g/:groupId/record', handler: renderRecord },
  { path: '/g/:groupId/review', handler: renderReview },
  { path: '/g/:groupId/graphs', handler: renderGraphs }
];

async function onRender({ handler, params }) {
  mount(viewEl, spinner());
  try {
    const node = await handler(params);
    mount(viewEl, node);
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    mount(viewEl, h('div', { class: 'err-box' }, 'Something went wrong: ' + (err.message || err)));
  }
}

const router = createRouter(routes, onRender);

// ---- Auth gate ----
mount(viewEl, spinner()); // while the first auth state resolves

onAuth((user) => {
  if (user) {
    appbarEl.style.display = '';
    router.render();
  } else {
    appbarEl.style.display = 'none';
    mount(appbarEl, []);
    mount(viewEl, renderLogin());
  }
});
