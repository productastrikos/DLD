import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi, postApi, fmt } from '../services/api';
import { IcoClose, IcoSpark, IcoUpload, IcoCheck, IcoBell, IcoChevron } from './icons';

/* ── Communication Center — a real inbox, not a feed ──
   Grouped into buckets, filterable to unread, per-item read state, and every
   row deep-links into the record it is about. A notification you cannot act on
   from where it appears is just noise. */
const BUCKETS = [
  { id: 'all', label: 'All' },
  { id: 'action', label: 'Needs action' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'updates', label: 'Updates' },
];

export function NotificationPanel({ open, onClose, items, onRead, onRefresh }) {
  const [bucket, setBucket] = React.useState('all');
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const navigate = useNavigate();

  if (!open) return null;
  const KIND = {
    upload:   { icon: <IcoUpload size={15} />,  tone: 'accent' },
    approval: { icon: <IcoCheck size={15} />,   tone: 'success' },
    alert:    { icon: <IcoBell size={15} />,    tone: 'danger' },
    info:     { icon: <IcoBell size={15} />,    tone: 'teal' },
  };

  const counts = {
    all: items.length,
    action: items.filter((n) => n.bucket === 'action').length,
    approvals: items.filter((n) => n.bucket === 'approvals').length,
    updates: items.filter((n) => n.bucket === 'updates' || n.bucket === 'alerts').length,
  };
  const rows = items.filter((n) =>
    (bucket === 'all' || n.bucket === bucket || (bucket === 'updates' && n.bucket === 'alerts')) &&
    (!unreadOnly || n.read === 'no'));

  /* Opening a notification marks it read and navigates to the record. */
  const openItem = async (n) => {
    if (n.read === 'no') { await postApi('/notifications/read', { id: n.notif_id }).catch(() => {}); onRefresh?.(); }
    if (n.link) { onClose(); navigate(n.link); }
  };
  const toggleRead = async (e, n) => {
    e.stopPropagation();
    await postApi(n.read === 'no' ? '/notifications/read' : '/notifications/unread', { id: n.notif_id }).catch(() => {});
    onRefresh?.();
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,22,40,0.35)', zIndex: 1890 }} onClick={onClose} />
      <aside className="slideout animate-slide-in-right">
        <div className="slideout-head">
          <div>
            <div className="panel-title">Communication Center</div>
            <div className="panel-sub">{items.filter((n) => n.read === 'no').length} unread · live workflow alerts</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onRead}>Mark all read</button>
            <button className="icon-btn" onClick={onClose}><IcoClose size={16} /></button>
          </div>
        </div>

        <div style={{ padding: '10px 16px 0', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {BUCKETS.map((b) => (
            <button key={b.id} className={`seg-btn${bucket === b.id ? ' is-active' : ''}`} onClick={() => setBucket(b.id)}>
              {b.label}{counts[b.id] ? ` ${counts[b.id]}` : ''}
            </button>
          ))}
          <button className={`seg-btn${unreadOnly ? ' is-active' : ''}`} style={{ marginInlineStart: 'auto' }}
            onClick={() => setUnreadOnly((v) => !v)}>Unread</button>
        </div>

        <div className="slideout-body">
          {rows.length === 0 && <div className="empty-state">Nothing in this view</div>}
          {rows.map((n) => {
            const k = KIND[n.kind] || KIND.info;
            const unread = n.read === 'no';
            return (
              <div key={n.notif_id} onClick={() => openItem(n)} className="card"
                style={{
                  display: 'flex', gap: 11, padding: '12px 14px', cursor: 'pointer',
                  background: unread ? 'var(--app-surface-soft)' : 'var(--app-panel)',
                  borderInlineStart: `3px solid var(--app-${k.tone})`,
                }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `var(--app-${k.tone}-bg)`, color: `var(--app-${k.tone})`,
                }}>{k.icon}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <div style={{ fontSize: 12.5, fontWeight: unread ? 700 : 600, color: 'var(--app-text)', lineHeight: 1.35, flex: 1 }}>
                      {n.title}
                    </div>
                    {unread && <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--app-accent)', flexShrink: 0, marginTop: 4 }} />}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)', marginTop: 3, lineHeight: 1.45 }}>{n.body}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--app-text-faint)' }} className="ltr-num">{fmt.ago(n.ts)}</span>
                    <button onClick={(e) => toggleRead(e, n)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontSize: 10, color: 'var(--app-text-faint)' }}>
                      Mark {unread ? 'read' : 'unread'}
                    </button>
                    {n.link && (
                      <span style={{ fontSize: 10, color: 'var(--app-accent)', fontWeight: 650, marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                        Open <IcoChevron size={10} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

/* ── AI Advisory — purple, reserved for AI output only ── */
export function AdvisoryPanel({ open, onClose, portal }) {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    if (open) fetchApi(`/advisories?portal=${portal}`).then((d) => setItems(d.advisories)).catch(() => {});
  }, [open, portal]);

  if (!open) return null;
  const SEV = { high: 'danger', medium: 'warning', low: 'info' };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,22,40,0.35)', zIndex: 1890 }} onClick={onClose} />
      <aside className="slideout animate-slide-in-right">
        <div className="slideout-head" style={{ background: 'var(--app-advisory-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--app-advisory)', color: '#fff',
            }}><IcoSpark size={16} /></div>
            <div>
              <div className="panel-title" style={{ color: 'var(--app-advisory)' }}>AI Advisory</div>
              <div className="panel-sub">Generated from live platform data</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><IcoClose size={16} /></button>
        </div>
        <div className="slideout-body">
          {items.map((a) => (
            <div key={a.advisory_id} style={{
              border: '1px solid var(--app-advisory-border)', background: 'var(--app-advisory-bg)',
              borderRadius: 12, padding: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span className={`status-chip status-chip-${SEV[a.severity] || 'info'}`}>{a.severity}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.35 }}>{a.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)', marginTop: 6, lineHeight: 1.55 }}>{a.body}</div>
            </div>
          ))}
          {items.length === 0 && <div className="empty-state">No advisories</div>}
        </div>
      </aside>
    </>
  );
}

export const markAllRead = () => postApi('/notifications/read', {});
