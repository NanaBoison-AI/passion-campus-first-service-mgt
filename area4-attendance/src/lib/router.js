/** Minimal hash router. Routes: { path: '/g/:groupId/members', handler }. */

export function createRouter(routes, onRender) {
  function resolve() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const path = raw.split('?')[0];
    for (const r of routes) {
      const keys = [];
      const pattern = r.path.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; });
      const match = path.match(new RegExp('^' + pattern + '$'));
      if (match) {
        const params = {};
        keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]); });
        return { handler: r.handler, params };
      }
    }
    return { handler: routes[0].handler, params: {} };
  }

  function render() { onRender(resolve()); }

  window.addEventListener('hashchange', render);
  return { render };
}

export const navigate = (hash) => { location.hash = hash; };
export const back = () => history.back();
