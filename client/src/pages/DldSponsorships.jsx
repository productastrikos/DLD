import React, { useMemo, useState } from 'react';
import { useApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState, Empty } from '../components/States';
import { useI18n } from '../i18n';
import KPICard from '../components/KPICard';
import { BarsChart, ChartPanel, ShareBars } from '../components/charts';
import Modal from '../components/Modal';
import { useSearch, useKpi } from '../App';
import { IcoHandshake, IcoDollar, IcoAlert, IcoTrendUp, IcoSpark, IcoDoc, IcoShield } from '../components/icons';

const TIERS = ['all', 'Platinum', 'Gold', 'Silver', 'Category'];
const STATUSES = ['all', 'active', 'pending_signature', 'expired'];
const SEV_TONE = { high: 'danger', medium: 'warning', low: 'info' };

/**
 * AI anomaly detection over the ledger.
 *
 * Surfaced above the grid rather than inside it, because the point is to catch
 * drift a human scanning row-by-row would not: delivery pace against the
 * contract clock, return against the tier's own median, invoicing lag, and
 * runway left before expiry. Each finding states its reasoning.
 */
/**
 * Inline contract preview.
 *
 * Reinforces the single-source-of-truth pitch: the commercial terms and the
 * document that records them sit on the same screen, rather than the ledger
 * pointing at a file store somewhere else. The page rendering is generated from
 * the agreement's own fields — this POC has no document store, and the notice
 * at the foot says so rather than implying a real PDF is attached.
 */
function ContractPreview({ agreement: a }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 16, border: '1px solid var(--app-border)', borderRadius: 11, overflow: 'hidden' }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
        background: 'var(--app-surface-soft)', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{ color: 'var(--app-accent)', display: 'flex' }}><IcoDoc size={15} /></span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--app-text)' }}>
            {a.agreement_id}-sponsorship-agreement.pdf
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>
            Executed {fmt.date(a.signed_date)} · 4 pages
          </div>
        </div>
        <span className="btn btn-ghost btn-sm">{open ? 'Hide' : 'Preview'}</span>
      </button>

      {open && (
        <div style={{ padding: 16, background: 'var(--app-panel)', borderTop: '1px solid var(--app-border)' }}>
          {/* A stylised contract face — deliberately document-shaped */}
          <div style={{
            background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)',
            borderRadius: 8, padding: '20px 22px', fontSize: 11.5, lineHeight: 1.75, color: 'var(--app-text-muted)',
          }}>
            <div style={{ textAlign: 'center', paddingBottom: 13, borderBottom: '1px solid var(--app-border)', marginBottom: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--app-text-faint)', fontWeight: 700 }}>
                Dubai Land Department
              </div>
              <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--app-text)', marginTop: 5 }}>
                Sponsorship Agreement
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 3 }} className="ltr-num">
                Reference {a.agreement_id}
              </div>
            </div>

            <p><strong style={{ color: 'var(--app-text)' }}>1. Parties.</strong> This agreement is made between the
              Dubai Land Department, Marketing &amp; Communications ("the Department") and{' '}
              <strong style={{ color: 'var(--app-text)' }}>{a.developer_name}</strong> ("the Partner").</p>

            <p style={{ marginTop: 9 }}><strong style={{ color: 'var(--app-text)' }}>2. Programme.</strong> The Partner
              shall sponsor <strong style={{ color: 'var(--app-text)' }}>{a.campaign_title}</strong> at{' '}
              <strong style={{ color: 'var(--app-text)' }}>{a.tier}</strong> tier.</p>

            <p style={{ marginTop: 9 }}><strong style={{ color: 'var(--app-text)' }}>3. Consideration.</strong> The
              Partner shall pay <strong style={{ color: 'var(--app-text)' }} className="ltr-num">{fmt.aedFull(a.value_aed)}</strong>,
              invoiced in accordance with the delivery schedule. As at the date of this preview,{' '}
              <span className="ltr-num">{fmt.aedFull(a.invoiced_aed)}</span> ({a.collected_pct}%) has been invoiced.</p>

            <p style={{ marginTop: 9 }}><strong style={{ color: 'var(--app-text)' }}>4. Commitments.</strong> The Partner
              undertakes <strong style={{ color: 'var(--app-text)' }} className="ltr-num">{a.commitments_total}</strong> deliverables
              as scheduled in Annex A, of which <span className="ltr-num">{a.commitments_met}</span> have been
              recorded as met ({a.commitment_pct}%).</p>

            <p style={{ marginTop: 9 }}><strong style={{ color: 'var(--app-text)' }}>5. Term.</strong> This agreement
              takes effect on <span className="ltr-num">{fmt.date(a.signed_date)}</span> and expires on{' '}
              <span className="ltr-num">{fmt.date(a.expiry_date)}</span>
              {a.days_to_expiry > 0 ? ` (${a.days_to_expiry} days remaining)` : ' (expired)'}.</p>

            <div style={{ display: 'flex', gap: 30, marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--app-border)' }}>
              {['For the Department', `For ${a.developer_name}`].map((who) => (
                <div key={who} style={{ flex: 1 }}>
                  <div style={{ height: 26, borderBottom: '1px solid var(--app-text-faint)' }} />
                  <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', marginTop: 4 }}>{who}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
            <span style={{ color: 'var(--app-text-faint)', display: 'flex' }}><IcoShield size={12} /></span>
            <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)', lineHeight: 1.45 }}>
              Rendered from the ledger record. This proof of concept has no document store —
              a production build would show the executed PDF here.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function AnomalyPanel({ rows, onOpen }) {
  const [expanded, setExpanded] = useState(false);
  const high = rows.filter((a) => a.severity === 'high');
  const shown = expanded ? rows : rows.slice(0, 4);
  const totalValue = rows.reduce((s, a) => s + (+a.value_aed || 0), 0);

  return (
    <div className="card" style={{
      marginBottom: 16, overflow: 'hidden',
      border: '1px solid var(--app-advisory-border)',
    }}>
      <div style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--app-advisory-bg)', borderBottom: '1px solid var(--app-advisory-border)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--app-advisory)', color: '#fff',
        }}><IcoSpark size={15} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="panel-title" style={{ color: 'var(--app-advisory)' }}>Anomaly detection</div>
          <div className="panel-sub">
            {rows.length} agreement{rows.length === 1 ? '' : 's'} flagged · {high.length} high severity · {fmt.aed(totalValue)} of contracted value
          </div>
        </div>
        {rows.length > 4 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show top 4' : `Show all ${rows.length}`}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 1, background: 'var(--app-border-soft)' }}>
        {shown.map((a) => (
          <button key={a.agreement_id} onClick={() => onOpen(a.agreement_id)}
            style={{
              textAlign: 'left', fontFamily: 'inherit', border: 'none', cursor: 'pointer',
              background: 'var(--app-panel)', padding: '12px 15px',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span className={`status-chip status-chip-${SEV_TONE[a.severity]}`}>{a.severity}</span>
              <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--app-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.developer_name}
              </span>
              <span className="ltr-num" style={{ fontSize: 11, color: 'var(--app-text-faint)' }}>{fmt.aed(a.value_aed)}</span>
            </div>
            {a.reasons.map((r, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--app-text-muted)', lineHeight: 1.5, display: 'flex', gap: 6 }}>
                <span style={{ color: `var(--app-${SEV_TONE[a.severity]})`, flexShrink: 0 }}>·</span>{r}
              </div>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Screen 3 — Sponsorships & Agreements Ledger.
 * A filterable data grid over every agreement, with per-agreement commitment
 * tracking and ROI measurement, and a risk view for under-delivered contracts.
 */
export default function DldSponsorships() {
  const { data, error } = useApi('/dld/sponsorships');
  const { t } = useI18n();
  const { q } = useSearch();
  const { openKpi } = useKpi();
  const [tier, setTier] = useState('all');
  const [status, setStatus] = useState('all');
  const [riskOnly, setRiskOnly] = useState(false);
  const [sort, setSort] = useState({ key: 'signed_date', dir: 'desc' });
  const [detail, setDetail] = useState(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    let out = data.agreements.filter((a) =>
      (tier === 'all' || a.tier === tier) &&
      (status === 'all' || a.status === status) &&
      // "At risk" now means the anomaly engine flagged it, not just a single
      // under-delivery threshold — the ledger and the AI agree on one definition.
      (!riskOnly || !!a.anomaly) &&
      (!term || a.developer_name.toLowerCase().includes(term) ||
        a.campaign_title.toLowerCase().includes(term) ||
        a.agreement_id.toLowerCase().includes(term)));

    const { key, dir } = sort;
    out = [...out].sort((a, b) => {
      const va = a[key], vb = b[key];
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return dir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [data, q, tier, status, riskOnly, sort]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label={t('Loading agreements ledger…')} />;

  const s = data.summary;
  const th = (key, label, align) => (
    <th onClick={() => setSort((v) => ({ key, dir: v.key === key && v.dir === 'desc' ? 'asc' : 'desc' }))}
      style={{ cursor: 'pointer', userSelect: 'none', textAlign: align || 'left' }}>
      {label}{sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <KPICard kpiId="activeAgreements" onClick={() => openKpi('activeAgreements')}
          label={t('Active Agreements')} value={fmt.int(s.active)} icon={<IcoHandshake size={17} />}
          foot={<>{s.total} total · {s.pending} awaiting signature</>} />
        <KPICard kpiId="activeAgreements" onClick={() => openKpi('activeAgreements')}
          label={t('Contracted Value')} value={fmt.aed(s.activeValue)} tone="sand" icon={<IcoDollar size={17} />}
          foot={<>{fmt.aed(s.contractedValue)} across all agreements</>} />
        <KPICard kpiId="blendedRoi" onClick={() => openKpi('blendedRoi')}
          label={t('Blended ROI')} value={fmt.pct(s.blendedRoi)} tone="teal" icon={<IcoTrendUp size={17} />}
          foot="Mean return measured per agreement" />
        <KPICard kpiId="commitmentDelivery" onClick={() => openKpi('commitmentDelivery')}
          label={t('Commitment Delivery')} value={fmt.pct(s.commitmentDelivery)} tone="teal" icon={<IcoShield size={17} />}
          foot="Contracted deliverables actually met" />
        <KPICard kpiId="collectionRate" onClick={() => openKpi('collectionRate')}
          label={t('Invoice Collection')} value={fmt.pct(s.collectedPct)} tone="sand" icon={<IcoDollar size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{fmt.aed(s.contractedValue - s.invoiced)}</strong> outstanding</>} />
        <KPICard kpiId="blendedRoi" onClick={() => openKpi('blendedRoi')}
          label={t('Flagged By Anomaly Rules')} value={fmt.int(s.flagged)} tone="sand" icon={<IcoAlert size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{s.flaggedHigh}</strong> high severity · {s.atRisk} under half-delivered</>} />
      </div>

      {/* ── Anomaly detection: what a human reading row-by-row would miss ── */}
      {data.anomalies.length > 0 && <AnomalyPanel rows={data.anomalies} onOpen={(id) =>
        setDetail(data.agreements.find((a) => a.agreement_id === id))} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <ChartPanel title="Contracted Value by Tier" note="Where sponsorship revenue is concentrated">
          <BarsChart
            data={data.byTier} xKey="tier" height={190} layout="horizontal" colorByIndex
            series={[{ key: 'value', label: 'Contracted value' }]}
            fmt={(v) => fmt.aed(v)} tickFmt={(v) => fmt.compact(v)}
          />
        </ChartPanel>
        <ChartPanel title="Return on Investment by Tier" note="Mean measured ROI per sponsorship tier">
          <div style={{ paddingTop: 6 }}>
            <ShareBars
              rows={data.byTier.map((t) => ({
                label: t.tier, value: Math.max(0, t.roi),
                sub: `${t.count} agreement${t.count === 1 ? '' : 's'} · ${fmt.aed(t.value)}`,
              }))}
              fmt={(v) => fmt.pct(v)}
            />
          </div>
        </ChartPanel>
      </div>

      <div className="page-header-block">
        <div>
          <div className="page-title">Agreements Ledger</div>
          <div className="page-subtitle">{rows.length} of {data.agreements.length} agreements shown</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="field-input" value={tier} onChange={(e) => setTier(e.target.value)}
            style={{ width: 'auto', height: 32, fontSize: 12, cursor: 'pointer' }}>
            {TIERS.map((t) => <option key={t} value={t}>{t === 'all' ? 'All tiers' : t}</option>)}
          </select>
          <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}
            style={{ width: 'auto', height: 32, fontSize: 12, cursor: 'pointer' }}>
            {STATUSES.map((t) => <option key={t} value={t}>{t === 'all' ? 'All statuses' : statusLabel(t)}</option>)}
          </select>
          <button className={`btn btn-sm ${riskOnly ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRiskOnly((v) => !v)}>
            <IcoAlert size={12} />Flagged only
          </button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '58vh' }}>
          <table className="data-table">
            <thead>
              <tr>
                {th('agreement_id', 'ID')}
                {th('developer_name', 'Developer')}
                {th('tier', 'Tier')}
                {th('campaign_title', 'Programme')}
                {th('value_aed', 'Value')}
                {th('signed_date', 'Signed')}
                {th('expiry_date', 'Expires')}
                {th('commitment_pct', 'Commitments')}
                {th('collected_pct', 'Invoiced')}
                {th('roi_percent', 'ROI')}
                {th('status', 'Status')}
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const atRisk = a.status === 'active' && a.commitment_pct < 50;
                return (
                  <tr key={a.agreement_id} className="clickable" onClick={() => setDetail(a)}>
                    <td className="ltr-num" style={{ fontWeight: 600 }}>{a.agreement_id}</td>
                    <td style={{ color: 'var(--app-text)', fontWeight: 600 }}>{a.developer_name}</td>
                    <td><span className={`status-chip status-chip-${a.tier === 'Platinum' ? 'accent' : a.tier === 'Gold' ? 'sand' : 'muted'}`}>{a.tier}</span></td>
                    <td style={{ maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.campaign_title}</td>
                    <td className="ltr-num" style={{ fontWeight: 600, color: 'var(--app-text)' }}>{fmt.aed(a.value_aed)}</td>
                    <td className="ltr-num">{fmt.dateCompact(a.signed_date)}</td>
                    <td className="ltr-num">{fmt.dateCompact(a.expiry_date)}</td>
                    <td style={{ minWidth: 118 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div className="progress-track" style={{ flex: 1, minWidth: 48 }}>
                          <div className="progress-fill" style={{
                            width: `${a.commitment_pct}%`,
                            background: atRisk ? 'var(--app-danger)' : a.commitment_pct >= 90 ? 'var(--app-success)' : 'var(--app-accent)',
                          }} />
                        </div>
                        <span className="ltr-num" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>{a.commitments_met}/{a.commitments_total}</span>
                      </div>
                    </td>
                    <td className="ltr-num">{a.collected_pct}%</td>
                    <td className="ltr-num" style={{ fontWeight: 700, color: a.roi_percent >= 0 ? 'var(--app-success)' : 'var(--app-danger)' }}>
                      {a.roi_percent >= 0 ? '+' : ''}{a.roi_percent}%
                    </td>
                    <td><span className={statusChip(a.status)}>{statusLabel(a.status)}</span></td>
                    <td>
                      {a.anomaly ? (
                        <span className={`status-chip status-chip-${SEV_TONE[a.anomaly.severity]}`}
                          title={a.anomaly.reasons.join('\n')}>
                          <IcoAlert size={9} />{a.anomaly.severity}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={12}><Empty>No agreements match the current filters</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <Modal open onClose={() => setDetail(null)} width={600}
          title={detail.title} subtitle={`${detail.developer_name} · ${detail.agreement_id}`}
          footer={<button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className={statusChip(detail.status)}>{statusLabel(detail.status)}</span>
            <span className="status-chip status-chip-accent">{detail.tier}</span>
            <span className="status-chip status-chip-muted" style={{ textTransform: 'none' }}>{detail.developer_tier}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              ['Contract value', fmt.aedFull(detail.value_aed)],
              ['Invoiced to date', `${fmt.aedFull(detail.invoiced_aed)} (${detail.collected_pct}%)`],
              ['Measured ROI', `${detail.roi_percent >= 0 ? '+' : ''}${detail.roi_percent}%`],
              ['Signed', fmt.date(detail.signed_date)],
              ['Expires', fmt.date(detail.expiry_date)],
              ['Linked programme', detail.campaign_title],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--app-surface-soft)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-text)', marginTop: 3, lineHeight: 1.35 }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="panel-title" style={{ marginBottom: 8 }}>Commitment tracking</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div className="progress-track" style={{ flex: 1, height: 8 }}>
              <div className="progress-fill" style={{
                width: `${detail.commitment_pct}%`,
                background: detail.commitment_pct < 50 ? 'var(--app-danger)' : detail.commitment_pct >= 90 ? 'var(--app-success)' : 'var(--app-accent)',
              }} />
            </div>
            <span className="ltr-num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text)' }}>
              {detail.commitments_met} of {detail.commitments_total}
            </span>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--app-text-muted)', lineHeight: 1.55 }}>
            {detail.commitment_pct >= 90
              ? 'Delivery is on track — all material commitments have been met.'
              : detail.commitment_pct < 50 && detail.status === 'active'
                ? 'Under half of the contracted commitments have been delivered. This agreement is flagged at risk.'
                : 'Delivery is in progress against the contracted commitment schedule.'}
          </p>

          {detail.anomaly && (
            <div style={{
              marginTop: 14, padding: 12, borderRadius: 11,
              border: `1px solid var(--app-${SEV_TONE[detail.anomaly.severity]}-border)`,
              background: `var(--app-${SEV_TONE[detail.anomaly.severity]}-bg)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                <span style={{ color: `var(--app-${SEV_TONE[detail.anomaly.severity]})`, display: 'flex' }}><IcoAlert size={14} /></span>
                <span className="panel-title" style={{ color: `var(--app-${SEV_TONE[detail.anomaly.severity]})` }}>
                  Flagged — {detail.anomaly.severity} severity
                </span>
              </div>
              {detail.anomaly.reasons.map((r, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--app-text-muted)', lineHeight: 1.55, marginTop: 3 }}>· {r}</div>
              ))}
            </div>
          )}

          <ContractPreview agreement={detail} />
        </Modal>
      )}
    </>
  );
}
