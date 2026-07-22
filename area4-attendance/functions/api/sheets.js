/**
 * Cloudflare Pages Function — same-origin proxy to the Google Apps Script
 * Web App that serves the Sheets JSON API. Runs server-side, so the browser
 * never makes a cross-origin request (no CORS) and SHEETS_API_URL stays out of
 * the client bundle.
 *
 * Frontend calls:  /api/sheets?action=groups
 *                  POST /api/sheets   (JSON body with { action, ... })
 *
 * Set SHEETS_API_URL in the Pages project (Settings → Environment variables).
 */
export async function onRequest(context) {
  const { request, env } = context;

  if (!env.SHEETS_API_URL) {
    return json({ error: 'SHEETS_API_URL is not configured for this deployment.' }, 500);
  }

  // Require a valid Firebase ID token when FIREBASE_API_KEY is configured.
  // (Set it in the Pages env to turn on protection — see README.)
  if (env.FIREBASE_API_KEY) {
    const authz = request.headers.get('Authorization') || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    if (!(await isValidToken(token, env.FIREBASE_API_KEY))) {
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  const incoming = new URL(request.url);
  const target = new URL(env.SHEETS_API_URL);
  // Forward query params (action, groupId, …).
  incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  const init = {
    method: request.method,
    // text/plain avoids a CORS preflight on the upstream and Apps Script parses
    // the raw body itself.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow'
  };
  if (request.method === 'POST' || request.method === 'PUT') {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(target.toString(), init);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  } catch (err) {
    return json({ error: 'Upstream request failed: ' + String(err) }, 502);
  }
}

/**
 * Validate a Firebase ID token by looking it up via the Identity Toolkit REST
 * API. Avoids hand-rolling JWT signature verification and is reliably correct;
 * an invalid/expired token returns no users.
 */
async function isValidToken(idToken, apiKey) {
  if (!idToken) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.users) && data.users.length > 0;
  } catch {
    return false;
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
