/**
 * A minimal Express-shaped router, small enough to read in one sitting.
 *
 * Its only job is to let routes.js — which is the old server's code, verbatim —
 * keep declaring `app.get('/api/thing/:id', (req, res) => res.json(...))` while
 * running in a browser tab. Porting 37 handlers by hand would have been 37
 * chances to change behaviour silently; shimming the four Express features they
 * actually use is a much smaller thing to get right.
 *
 * The surface the handlers need, and nothing else:
 *   app.get / post / patch / use / set
 *   req.params, req.query, req.body
 *   res.status(n), res.json(body), res.setHeader(...)
 */

/** `/api/kpi/:id` → a matcher that also names its captures. Segments are
 *  compared one for one; no wildcards, because no route needs them. */
function compile(pattern) {
  const parts = pattern.split('/').filter(Boolean);
  const names = parts.filter((p) => p.startsWith(':')).map((p) => p.slice(1));
  return { parts, names };
}

function match(route, segments) {
  if (route.parts.length !== segments.length) return null;
  const params = {};
  for (let i = 0; i < route.parts.length; i++) {
    const p = route.parts[i];
    if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segments[i]);
    else if (p !== segments[i]) return null;
  }
  return params;
}

export function createApp() {
  const routes = [];
  const add = (method) => (pattern, handler) =>
    routes.push({ method, handler, ...compile(pattern) });

  const app = {
    get: add('GET'),
    post: add('POST'),
    patch: add('PATCH'),
    put: add('PUT'),
    delete: add('DELETE'),
    /* cors() and express.json() were about talking to a server across a
       network. There is no network here, so these are deliberately inert. */
    use: () => app,
    set: () => app,

    /** Run one request. Returns { status, body } — never throws for a 4xx, so
     *  the caller decides what an error status means, exactly as fetch does. */
    handle(method, url, body) {
      const [rawPath, rawQuery = ''] = url.split('?');
      const segments = rawPath.split('/').filter(Boolean);

      const query = {};
      for (const [k, v] of new URLSearchParams(rawQuery)) query[k] = v;

      for (const route of routes) {
        if (route.method !== method) continue;
        const params = match(route, segments);
        if (!params) continue;

        let status = 200;
        let payload;
        let sent = false;
        const res = {
          status(code) { status = code; return res; },
          json(value) { payload = value; sent = true; return res; },
          setHeader() { return res; },
        };

        route.handler({ params, query, body: body || {}, method, path: rawPath }, res);

        if (!sent) return { status: 500, body: { error: `${method} ${rawPath} produced no response` } };
        return { status, body: payload };
      }

      return { status: 404, body: { error: `Cannot ${method} ${rawPath}` } };
    },
  };

  return app;
}
