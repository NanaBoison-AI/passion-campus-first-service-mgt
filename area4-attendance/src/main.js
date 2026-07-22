import './styles.css';
import { createRouter } from './lib/router.js';
import { mount, spinner, h } from './lib/dom.js';

import { renderGroups } from './views/groups.js';
import { renderDashboard } from './views/dashboard.js';
import { renderMembers } from './views/members.js';
import { renderRecord } from './views/record.js';
import { renderReview } from './views/review.js';
import { renderGraphs } from './views/graphs.js';

const viewEl = document.getElementById('view');

const routes = [
  { path: '/', handler: renderGroups },
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
router.start();
