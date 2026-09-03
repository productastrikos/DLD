import React, { useState, useMemo } from 'react';
import { useApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState, Empty } from '../components/States';
import { useI18n } from '../i18n';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import Ring from '../components/Ring';
import { useSearch, useKpi } from '../App';
import {
  IcoHandshake, IcoDollar, IcoShield, IcoAlert, IcoClock, IcoCheck,
  IcoTrendUp, IcoDoc, IcoCalendar,
} from '../components/icons';

/**
 * My Agreements — the partner's side of the sponsorship ledger.
 *
 * The Department has had a full ledger from the start; partners could only see
 * their agreements as task stubs on the home screen. A partner cannot manage a
 * commitment they cannot see, so this is the counterpart view: the same
 * records, scoped to them, and phrased as their obligations rather than as the
 * Department's risk register.
 */

const SEV_TONE = { high: 'danger', medium: 'warning', low: 'info' };

export default function PartnerAgreements({ user }) {
  const { data, error } = useApi('/developer/agreements');
  const { t } = useI18n();
  const { q } = useSearch();
  const { openKpi } = useKpi();
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.agreements.filter((a) =>
      (filter === 'all'
        || (filter === 'attention' ? !!a.attention
          : filter === 'expiring' ? a.status === 'active' && a.days_to_expiry > 0 && a.days_to_expiry <= 90
          : a.status === filter)) &&
      (!term || a.title.toLowerCase().includes(term) || a.campaign_title.toLowerCase().includes(term)));
  }, [data, q, filter]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label={t('Loading your agreements…')} />;

  const s = data.summary;

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <KPICard kpiId="activeAgreements" onClick={() => openKpi('activeAgreements')}
          label={t('Active Agreements')} value={fmt.int(s.active)} icon={<IcoHandshake size={17} />}
          foot={<>{s.total} total · {s.pendingSignature} awaiting your signature</>} />
        <KPICard kpiId="activeAgreements" onClick={() => openKpi('activeAgreements')}
          label={t('Committed Value')} value={fmt.aed(s.activeValue)} tone="sand" icon={<IcoDollar size={17} />}
          foot={<>{fmt.aed(s.contracted)} across every agreement</>} />
        <KPICard kpiId="commitmentDelivery" onClick={() => openKpi('commitmentDelivery')}
          label={t('Commitments Delivered')} value={fmt.pct(s.commitmentPct)} tone="teal" icon={<IcoShield size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{s.commitmentsOutstanding}</strong> deliverables still outstanding</>} />
        <KPICard kpiId="collectionRate" onClick={() => openKpi('collectionRate')}
          label={t('Invoiced To Date')} value={fmt.aed(s.invoiced)} tone="sand" icon={<IcoDoc size={17} />}
          foot="Against your contracted value" />
        <KPICard kpiId="blendedRoi" onClick={() => openKpi('blendedRoi')}
          label={t('Your Mean ROI')} value={fmt.pct(s.roi)} tone="teal" icon={<IcoTrendUp size={17} />}
          foot="Measured return across your agreements" />
        <KPICard kpiId="commitmentDelivery" onClick={() => openKpi('commitmentDelivery')}
          label={t('Needs Your Attention')} value={fmt.int(s.needsAttention)} tone="sand" icon={<IcoAlert size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{s.expiringSoon}</strong> expiring within 90 days</>} />
      </div>

      {/* Delivery standing — one figure the partner is judged on */}
      {s.active > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring value={s.commitmentPct} size={112} stroke={10} label={t('Delivered')} />
          <div style={{ minWidth: 240, flex: 1 }}>
            <div className="panel-title">Your delivery standing</div>
            <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', lineHeight: 1.6, marginTop: 6 }}>
              {s.commitmentsOutstanding === 0
                ? 'Every contracted deliverable on your live agreements has been met. Nothing is outstanding.'
                : <>You have <strong style={{ color: 'var(--app-text)' }}>{s.commitmentsOutstanding}</strong> contracted
                  deliverable{s.commitmentsOutstanding === 1 ? '' : 's'} still outstanding across {s.active} live
                  agreement{s.active === 1 ? '' : 's'}. Delivery is the measure the Department reviews at renewal —
                  agreements that reach expiry with commitments unmet are materially harder to renew.</>}
            </div>
            {s.expiringSoon > 0 && (
              <div style={{ marginTop: 9 }}>
                <span className="status-chip status-chip-warning">
                  <IcoClock size={9} />{s.expiringSoon} agreement{s.expiringSoon === 1 ? '' : 's'} expiring within 90 days
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="page-header-block">
        <div>
          <div className="page-title">My Agreements</div>
          <div className="page-subtitle">{rows.length} of {data.agreements.length} shown</div>
        </div>
        <div className="seg">
          {[['all', 'All'], ['active', 'Active'], ['attention', 'Needs attention'],
            ['expiring', 'Expiring'], ['pending_signature', 'Unsigned'], ['expired', 'Expired']].map(([id, label]) => (
            <button key={id} className={`seg-btn${filter === id ? ' is-active' : ''}`} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? <div className="card card-pad"><Empty>No agreements in this view</Empty></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
          {rows.map((a) => (
            <button key={a.agreement_id} onClick={() => setDetail(a)} className="card"
              style={{
                padding: '14px 16px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                border: `1px solid ${a.attention ? `var(--app-${SEV_TONE[a.attention.severity]}-border)` : 'var(--app-panel-border)'}`,
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="status-chip status-chip-accent">{a.tier}</span>
                <span className={statusChip(a.status)}>{statusLabel(a.status)}</span>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.35 }}>
                {a.campaign_title}
              </div>
              <div className="ltr-num" style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 3 }}>
                {a.agreement_id} · signed {fmt.dateCompact(a.signed_date)}
              </div>

              <div style={{ display: 'flex', gap: 14, margin: '11px 0 9px' }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Value</div>
                  <div className="ltr-num" style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--app-text)' }}>{fmt.aed(a.value_aed)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ROI</div>
                  <div className="ltr-num" style={{ fontSize: 13.5, fontWeight: 750, color: a.roi_percent >= 0 ? 'var(--app-success)' : 'var(--app-danger)' }}>
                    {fmt.pct(a.roi_percent)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expires</div>
                  <div className="ltr-num" style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--app-text)' }}>
                    {a.days_to_expiry > 0 ? `${a.days_to_expiry}d` : 'Expired'}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--app-text-faint)', marginBottom: 4 }}>
                  <span>Commitments delivered</span>
                  <span className="ltr-num">{a.commitments_met}/{a.commitments_total}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{
                    width: `${a.commitment_pct}%`,
                    background: a.commitment_pct >= 90 ? 'var(--app-success)'
                      : a.commitment_pct < 50 ? 'var(--app-danger)' : 'var(--app-accent)',
                  }} />
                </div>
              </div>

              {a.attention && (
                <div style={{
                  marginTop: 10, padding: '8px 10px', borderRadius: 9,
                  background: `var(--app-${SEV_TONE[a.attention.severity]}-bg)`,
                  border: `1px solid var(--app-${SEV_TONE[a.attention.severity]}-border)`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ color: `var(--app-${SEV_TONE[a.attention.severity]})`, display: 'flex' }}><IcoAlert size={11} /></span>
                    <span style={{ fontSize: 10, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.05em', color: `var(--app-${SEV_TONE[a.attention.severity]})` }}>
                      Action needed
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--app-text-muted)', lineHeight: 1.45 }}>
                    {a.attention.reasons[0]}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Agreement detail ── */}
      <Modal open={!!detail} onClose={() => setDetail(null)} width={620}
        title={detail?.title} subtitle={detail ? `${detail.agreement_id} · ${detail.campaign_title}` : ''}
        footer={<button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>}>
        {detail && (
          <>
            <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
              <span className="status-chip status-chip-accent">{detail.tier}</span>
              <span className={statusChip(detail.status)}>{statusLabel(detail.status)}</span>
              <span className="status-chip status-chip-muted ltr-num">
                <IcoCalendar size={10} />&nbsp;{fmt.date(detail.signed_date)} — {fmt.date(detail.expiry_date)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                ['Contract value', fmt.aedFull(detail.value_aed)],
                ['Invoiced', `${fmt.aedFull(detail.invoiced_aed)} (${detail.collected_pct}%)`],
                ['Measured ROI', fmt.pct(detail.roi_percent)],
                ['Commitments', `${detail.commitments_met} of ${detail.commitments_total}`],
                ['Outstanding', detail.outstanding || 'None'],
                ['Time remaining', detail.days_to_expiry > 0 ? `${detail.days_to_expiry} days` : 'Expired'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--app-surface-soft)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div className="ltr-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)', marginTop: 3 }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="panel-title" style={{ marginBottom: 8 }}>Delivery against schedule</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className="progress-track" style={{ flex: 1, height: 8 }}>
                <div className="progress-fill" style={{
                  width: `${detail.commitment_pct}%`,
                  background: detail.commitment_pct >= 90 ? 'var(--app-success)'
                    : detail.commitment_pct < 50 ? 'var(--app-danger)' : 'var(--app-accent)',
                }} />
              </div>
              <span className="ltr-num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text)' }}>
                {detail.commitment_pct}%
              </span>
            </div>

            {detail.attention ? (
              <div style={{
                padding: 12, borderRadius: 11, marginTop: 12,
                background: `var(--app-${SEV_TONE[detail.attention.severity]}-bg)`,
                border: `1px solid var(--app-${SEV_TONE[detail.attention.severity]}-border)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                  <span style={{ color: `var(--app-${SEV_TONE[detail.attention.severity]})`, display: 'flex' }}><IcoAlert size={14} /></span>
                  <span className="panel-title" style={{ color: `var(--app-${SEV_TONE[detail.attention.severity]})` }}>
                    What needs your attention
                  </span>
                </div>
                {detail.attention.reasons.map((r, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: 'var(--app-text-muted)', lineHeight: 1.55, marginTop: 3 }}>· {r}</div>
                ))}
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9, marginTop: 12,
                padding: 12, borderRadius: 11,
                background: 'var(--app-success-bg)', border: '1px solid var(--app-success-border)',
              }}>
                <span style={{ color: 'var(--app-success)', display: 'flex' }}><IcoCheck size={15} /></span>
                <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>
                  This agreement is on track. No action is required from you.
                </span>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
