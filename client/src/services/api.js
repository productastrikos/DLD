import { useEffect, useState, useCallback } from 'react';
import { request } from '../api/index.js';

export const AUTH_KEY = 'dld_auth';

export const getUser = () => {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
  catch { return null; }
};

/** Developer-portal scoping. A partner account only ever sees its own rows, so
 *  its developer_id is appended to every request; DLD roles send nothing. */
export function withScope(path) {
  const u = getUser();
  if (!u || u.portal !== 'developer' || !u.developer_id) return path;
  return path + (path.includes('?') ? '&' : '?') + `developer=${encodeURIComponent(u.developer_id)}`;
}

/* Both of these used to be fetch() calls to an Express server. The platform is
   a static SPA now and answers its own requests in-tab — see ../api/. The
   signatures are unchanged, so every caller and every loading state still
   works the way it did. */
export async function fetchApi(path) {
  return request(`/api${withScope(path)}`);
}

export async function postApi(path, body, method = 'POST') {
  return request(`/api${path}`, { method, body: body || {} });
}

/** Fetch-on-mount hook with loading/error state and a manual refetch. */
export function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setError(null);
    fetchApi(path).then((d) => live && setData(d)).catch((e) => live && setError(e));
    return () => { live = false; };
  }, [path, nonce]);

  return { data, error, loading: !data && !error, reload };
}

/* ── formatting ────────────────────────────────────────────── */
export const fmt = {
  int: (n) => (+n || 0).toLocaleString('en-US'),
  pct: (n, d = 1) => `${(+n || 0).toFixed(d)}%`,
  compact: (n) => {
    const v = +n || 0;
    if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return `${v}`;
  },
  aed: (n) => `AED ${fmt.compact(n)}`,
  aedFull: (n) => `AED ${(+n || 0).toLocaleString('en-US')}`,
  date: (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'),
  dateShort: (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'),
  // Keeps the year visible where a range can straddle one (Kanban cards, tables).
  dateCompact: (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'),
  month: (s) => {
    if (!s) return '';
    const [y, m] = s.split('-');
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  },
  ago: (ts) => {
    const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  },
};

/** Shared status → chip-class map so a status looks the same on every screen. */
export const STATUS_TONE = {
  active: 'success', approved: 'success', completed: 'info',
  review: 'warning', under_review: 'warning', pending: 'warning', pending_signature: 'warning',
  draft: 'muted', dormant: 'muted', expired: 'muted',
  rejected: 'danger',
};
export const statusChip = (s) => `status-chip status-chip-${STATUS_TONE[s] || 'muted'}`;
export const statusLabel = (s) => String(s || '').replace(/_/g, ' ');
