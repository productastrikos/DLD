/**
 * The API, as the UI sees it.
 *
 * `request()` has the shape a fetch wrapper has — takes a path, returns a
 * promise of parsed JSON, rejects on a non-2xx — so the calling code in
 * services/api.js reads the same as it did when there was a server on the other
 * end. What changed is underneath: the request is answered in this tab by the
 * same handlers that used to answer it over HTTP.
 *
 * The promise is real but never pending for long; handlers are synchronous.
 * Keeping the async signature means the screens' loading and error states stay
 * exercised, and means a real endpoint could be put back without touching a
 * single caller.
 */
import { createApp } from './router.js';
import { defineRoutes } from './routes.js';
import { loadDb } from './datasets.js';

/* Built once per tab, on first use rather than at module load, so a parsing
   failure surfaces as a rejected request the UI can display instead of a blank
   page from a module that threw while evaluating. */
let app = null;

function getApp() {
  if (!app) {
    app = createApp();
    defineRoutes(app, loadDb());
  }
  return app;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * @param {string} path   e.g. '/api/dld/dashboard?developer=DEV-004'
 * @param {object} [init] { method, body } — mirrors fetch's second argument.
 */
export async function request(path, init = {}) {
  const method = (init.method || 'GET').toUpperCase();
  const { status, body } = getApp().handle(method, path, init.body);

  if (status < 200 || status >= 300) {
    throw new ApiError(body?.error || `API ${path} → ${status}`, status);
  }
  return body;
}
