import React, { useMemo, useState } from 'react';
import { useApi, postApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState, Empty } from '../components/States';
import { useI18n } from '../i18n';
import KPICard from '../components/KPICard';
import { useSearch, useKpi } from '../App';
import { IcoInbox, IcoCheck, IcoClock, IcoUpload, IcoClose, IcoAlert, IcoShield } from '../components/icons';

/** SLA presentation. The tone vocabulary is the same one status chips use, so
 *  a breach reads as a breach wherever it appears. */
const SLA_TONE = { breached: 'danger', approaching: 'warning', on_track: 'success', closed: 'muted' };
const SLA_LABEL = { breached: 'Breached', approaching: 'Due soon', on_track: 'On track', closed: '' };

/** Per-row countdown: how long this request has been waiting against the target. */
function SlaCell({ sla }) {
  if (!sla?.open) {
    return <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>—</span>;
  }
  const tone = SLA_TONE[sla.state];
  return (
    <div style={{ minWidth: 104 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
        <span className={`status-chip status-chip-${tone}`}>
          {sla.state === 'breached' ? <IcoAlert size={9} /> : <IcoClock size={9} />}
          {SLA_LABEL[sla.state]}
        </span>
        <span className="ltr-num" style={{ fontSize: 10.5, fontWeight: 700, color: `var(--app-${tone})` }}>
          {sla.state === 'breached'
            ? `+${Math.abs(sla.remaining_days).toFixed(1)}d over`
            : `${sla.remaining_days.toFixed(1)}d left`}
        </span>
      </div>
      <div className="progress-track" style={{ height: 4 }}>
        <div className="progress-fill" style={{ width: `${sla.pct}%`, background: `var(--app-${tone})` }} />
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', marginTop: 2 }} className="ltr-num">
        waiting {sla.age_days}d
      </div>
    </div>
  );
}

const FILTERS = [
  ['pending', 'Pending'],
  ['under_review', 'Under review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['all', 'All'],
];

/**
 * Approval queue — the workflow behind the campaigns board. Everything a
 * developer submits lands here, and approving from this screen pushes a
 * notification straight back to the partner.
 */
export default function DldRequests() {
  const [filter, setFilter] = useState('pending');
  const { data, error, reload } = useApi(`/dld/requests?status=${filter}`);
  const { t } = useI18n();
  const { data: all } = useApi('/dld/requests?status=all');
  const { q } = useSearch();
  const { openKpi } = useKpi();
  const [busyId, setBusyId] = useState(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.requests.filter((r) =>
      !term || r.developer_name.toLowerCase().includes(term) ||
      r.campaign_title.toLowerCase().includes(term) || r.request_id.toLowerCase().includes(term));
  }, [data, q]);

  if (error) return <ErrorState error={error} />;

  const counts = all
    ? {
        pending: all.requests.filter((r) => r.status === 'pending').length,
        review: all.requests.filter((r) => r.status === 'under_review').length,
        approved: all.requests.filter((r) => r.status === 'approved').length,
        incomplete: all.requests.filter((r) => r.documents_uploaded < r.documents_required && r.status !== 'rejected').length,
        emailCount: all.requests.filter((r) => r.channel !== 'platform').length,
        digitalPct: all.requests.length
          ? (all.requests.filter((r) => r.channel === 'platform').length / all.requests.length) * 100 : 0,
        avgDays: (() => {
          const decided = all.requests.filter((r) => r.status === 'approved' && r.approval_days !== '');
          return decided.length
            ? Math.round((decided.reduce((s, r) => s + (+r.approval_days || 0), 0) / decided.length) * 10) / 10 : 0;
        })(),
      }
    : { pending: 0, review: 0, approved: 0, incomplete: 0, emailCount: 0, digitalPct: 0, avgDays: 0 };

  async function decide(r, status) {
    setBusyId(r.request_id);
    try { await postApi(`/dld/requests/${r.request_id}`, { status }, 'PATCH'); reload(); }
    finally { setBusyId(null); }
  }

  const sla = data?.sla || all?.sla;

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 14 }}>
        <KPICard kpiId="openRequests" onClick={() => openKpi('openRequests')}
          label={t('Awaiting First Review')} value={fmt.int(counts.pending)} icon={<IcoInbox size={17} />}
          foot="Submitted but not yet picked up" />
        <KPICard kpiId="openRequests" onClick={() => openKpi('openRequests')}
          label={t('Under Review')} value={fmt.int(counts.review)} tone="sand" icon={<IcoClock size={17} />}
          foot="With a reviewer now" />
        <KPICard kpiId="avgApprovalDays" onClick={() => openKpi('avgApprovalDays')}
          label={t('Avg. Decision Time')} value={sla ? `${counts.avgDays}` : '—'} unit="days" tone="teal" icon={<IcoClock size={17} />}
          foot={<>SLA compliance <strong style={{ color: 'var(--app-text-muted)' }}>{sla ? `${sla.compliance_pct}%` : '—'}</strong></>} />
        <KPICard kpiId="avgApprovalDays" onClick={() => openKpi('avgApprovalDays')}
          label={t('Approved To Date')} value={fmt.int(counts.approved)} tone="teal" icon={<IcoCheck size={17} />}
          foot="Across every programme" />
        <KPICard kpiId="digitalPct" onClick={() => openKpi('digitalPct')}
          label={t('Incomplete Document Packs')} value={fmt.int(counts.incomplete)} icon={<IcoUpload size={17} />}
          foot="Partners still owe required uploads" />
        <KPICard kpiId="digitalPct" onClick={() => openKpi('digitalPct')}
          label={t('Submitted On-Platform')} value={fmt.pct(counts.digitalPct, 0)} icon={<IcoShield size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{counts.emailCount}</strong> arrived by email instead</>} />
      </div>

      {/* ── Service-level banner. This is the operational face of the
             "Average request approval time" KPI in the brief. ── */}
      {sla && (
        <div className="card" style={{
          padding: '13px 16px', marginBottom: 14,
          borderColor: sla.breached > 0 ? 'var(--app-danger-border)' : 'var(--app-border)',
          background: sla.breached > 0 ? 'var(--app-danger-bg)' : 'var(--app-panel)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 210, flex: 1 }}>
              <span style={{ color: `var(--app-${sla.breached ? 'danger' : 'success'})`, display: 'flex' }}>
                <IcoShield size={18} />
              </span>
              <div>
                <div className="panel-title">{sla.target_days}-day service target</div>
                <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)', marginTop: 2 }}>
                  {sla.breached > 0
                    ? <>Compliance at <strong style={{ color: 'var(--app-danger)' }}>{sla.compliance_pct}%</strong> — oldest request has waited {sla.oldest_days} days</>
                    : <>All {sla.open} open requests are inside target</>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <SlaStat label={t('Breached')} value={sla.breached} tone="danger" />
              <SlaStat label={t('Due soon')} value={sla.approaching} tone="warning" />
              <SlaStat label={t('On track')} value={sla.on_track} tone="success" />
              <SlaStat label={t('Compliance')} value={`${sla.compliance_pct}%`} tone="accent" />
            </div>
          </div>

          {/* Composition of the open queue, as one bar */}
          <div style={{ display: 'flex', height: 6, borderRadius: 4, overflow: 'hidden', marginTop: 12, background: 'var(--app-surface-raised)' }}>
            {[['danger', sla.breached], ['warning', sla.approaching], ['success', sla.on_track]].map(([tone, n]) => (
              n > 0 && <div key={tone} style={{ width: `${(n / Math.max(1, sla.open)) * 100}%`, background: `var(--app-${tone})` }} />
            ))}
          </div>
        </div>
      )}

      <div className="page-header-block">
        <div>
          <div className="page-title">Participation Requests</div>
          <div className="page-subtitle">{rows.length} request{rows.length === 1 ? '' : 's'} in this view</div>
        </div>
        <div className="seg">
          {FILTERS.map(([id, label]) => (
            <button key={id} className={`seg-btn${filter === id ? ' is-active' : ''}`} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>

      {!data ? <Loading label={t('Loading approval queue…')} /> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: '62vh' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request</th><th>Developer</th><th>Programme</th><th>SLA</th><th>Submitted</th>
                  <th>Documents</th><th>Commitment</th><th>Channel</th><th>Status</th><th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const complete = r.documents_uploaded >= r.documents_required;
                  const open = r.status === 'pending' || r.status === 'under_review';
                  return (
                    <tr key={r.request_id} style={r.sla?.state === 'breached'
                      ? { background: 'var(--app-danger-bg)' } : undefined}>
                      <td className="ltr-num" style={{ fontWeight: 600 }}>{r.request_id}</td>
                      <td style={{ color: 'var(--app-text)', fontWeight: 600 }}>
                        {r.developer_name}
                        <div style={{ fontSize: 10, color: 'var(--app-text-faint)', fontWeight: 400 }}>{r.developer_tier}</div>
                      </td>
                      <td style={{ maxWidth: 250, whiteSpace: 'normal' }}>{r.campaign_title}</td>
                      <td><SlaCell sla={r.sla} /></td>
                      <td className="ltr-num">{fmt.dateShort(r.submitted_date)}</td>
                      <td>
                        <span className={`status-chip status-chip-${complete ? 'success' : 'warning'} ltr-num`}>
                          {r.documents_uploaded}/{r.documents_required}
                        </span>
                      </td>
                      <td className="ltr-num">{r.commitment_aed ? fmt.aed(r.commitment_aed) : '—'}</td>
                      <td><span className={`status-chip status-chip-${r.channel === 'platform' ? 'teal' : 'muted'}`}>{r.channel}</span></td>
                      <td><span className={statusChip(r.status)}>{statusLabel(r.status)}</span></td>
                      <td>
                        {open ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm" disabled={busyId === r.request_id}
                              onClick={() => decide(r, 'approved')} title={complete ? 'Approve' : 'Document pack is incomplete'}>
                              <IcoCheck size={11} sw={2.4} />Approve
                            </button>
                            <button className="btn btn-ghost btn-sm" disabled={busyId === r.request_id}
                              onClick={() => decide(r, 'rejected')}>
                              <IcoClose size={11} sw={2.4} />Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--app-text-faint)' }} className="ltr-num">
                            {r.approval_days !== '' ? `${r.approval_days} days` : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={10}><Empty>Nothing in this queue</Empty></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function SlaStat({ label, value, tone }) {
  return (
    <div style={{
      padding: '6px 12px', borderRadius: 9, minWidth: 76,
      background: 'var(--app-panel)', border: `1px solid var(--app-${tone}-border)`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: `var(--app-${tone})` }}>{label}</div>
      <div className="ltr-num" style={{ fontSize: 16, fontWeight: 750, color: 'var(--app-text)', lineHeight: 1.15 }}>{value}</div>
    </div>
  );
}
