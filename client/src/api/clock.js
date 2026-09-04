/**
 * The platform's reference clock.
 *
 * Must match TODAY in server/generate/generate-data.js — the datasets are
 * generated relative to this instant, and every derived measure (SLA age,
 * inactivity, time-to-expiry) reasons from it. Reading the wall clock instead
 * would make a freshly generated dataset appear months stale.
 *
 * It lives alone in this module so the route handlers can import it without
 * pulling in the bundled datasets, which keeps routes.js loadable outside a
 * Vite build — that is what lets the equivalence harness run it under Node.
 */
/* A Date, not a string, matching what the Express server exported — /api/health
   reports it verbatim, so the type decides whether the response reads
   ...T08:00:00.000Z or ...T08:00:00Z. Keeping it identical means the ported API
   is byte-for-byte the same as the one it replaces. */
export const REFERENCE_DATE = new Date('2026-06-15T08:00:00Z');
