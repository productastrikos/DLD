import React, { useMemo, useState } from 'react';
import { useApi, postApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState, Empty } from '../components/States';
import { useI18n } from '../i18n';
import Modal from '../components/Modal';
import { useSearch, useKpi } from '../App';
import { campaignPhoto } from '../services/media';
import KPICard from '../components/KPICard';
import { IcoTarget } from '../components/icons';
import {
  IcoCalendar, IcoPin, IcoPeople, IcoCheck, IcoUpload, IcoDoc, IcoClock, IcoLayers, IcoSpark,
} from '../components/icons';

const TYPE_TONE = { exhibition: 'sand', campaign: 'accent', initiative: 'teal' };
const BANNER = {
  exhibition: 'linear-gradient(120deg, #b08a4f, #8a6636)',
  campaign:   'linear-gradient(120deg, #0b5fa5, #084a82)',
  initiative: 'linear-gradient(120deg, #2e7d80, #1f5f62)',
};

/**
 * Developer Screen 2 — Opportunity Marketplace.
 * A visual gallery of upcoming campaigns, each with a one-click submission
 * that opens the participation wizard.
 */
export default function PartnerMarketplace({ user }) {
  const { data, error, reload } = useApi('/developer/marketplace');
  const { t } = useI18n();
  const { q } = useSearch();
  const { openKpi } = useKpi();
  const [typeFilter, setTypeFilter] = useState('all');
  const [wizard, setWizard] = useState(null);

  const items = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.opportunities.filter((o) =>
      (typeFilter === 'all' || o.type === typeFilter) &&
      (!term || o.title.toLowerCase().includes(term) ||
        o.description.toLowerCase().includes(term) || o.location.toLowerCase().includes(term)));
  }, [data, q, typeFilter]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label={t('Loading opportunities…')} />;

  const submitted = data.opportunities.filter((o) => o.my_status).length;

  /* Pipeline shape, so the partner sees their standing before the gallery. */
  const mkt = {
    open: data.opportunities.length,
    joined: submitted,
    inFlight: data.opportunities.filter((o) => o.my_status === 'pending' || o.my_status === 'under_review').length,
    approved: data.opportunities.filter((o) => o.my_status === 'approved').length,
    closing: data.opportunities.filter((o) => !o.my_status && o.slots_left > 0 && o.slots_left <= 3).length,
    delivered: data.history.length,
    historicLeads: data.history.reduce((s, h) => s + (+h.leads || 0), 0),
  };

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <KPICard kpiId="campaignsActive" onClick={() => openKpi('campaignsActive')}
          label={t('Open Opportunities')} value={fmt.int(mkt.open)} icon={<IcoLayers size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{mkt.open - mkt.joined}</strong> you have not yet joined</>} />
        <KPICard kpiId="openRequests" onClick={() => openKpi('openRequests')}
          label={t('Requests In Flight')} value={fmt.int(mkt.inFlight)} tone="sand" icon={<IcoClock size={17} />}
          foot="Submitted and awaiting a DLD decision" />
        <KPICard kpiId="avgEngagement" onClick={() => openKpi('avgEngagement')}
          label={t('Approved Participations')} value={fmt.int(mkt.approved)} tone="teal" icon={<IcoCheck size={17} />}
          foot="Live programmes you are confirmed on" />
        <KPICard kpiId="campaignsActive" onClick={() => openKpi('campaignsActive')}
          label={t('Closing Soon')} value={fmt.int(mkt.closing)} tone="sand" icon={<IcoClock size={17} />}
          foot="Open programmes with 3 or fewer slots left" />
        <KPICard kpiId="leadsGenerated" onClick={() => openKpi('leadsGenerated')}
          label={t('Leads From Past Programmes')} value={fmt.compact(mkt.historicLeads)} tone="teal" icon={<IcoPeople size={17} />}
          foot={<>Across <strong style={{ color: 'var(--app-text-muted)' }}>{mkt.delivered}</strong> completed programmes</>} />
        <KPICard kpiId="totalReach" onClick={() => openKpi('totalReach')}
          label={t('Best Match Score')} value={data.recommended?.[0]?.match_score ?? '—'} icon={<IcoTarget size={17} />}
          foot={data.recommended?.[0] ? data.recommended[0].title : 'No open recommendations'} />
      </div>

      {/* ── Recommended for you — the platform working on the partner's behalf,
             scored against their own participation history ── */}
      {data.recommended?.length > 0 && (
        <div className="card" style={{
          marginBottom: 18, overflow: 'hidden',
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
            <div>
              <div className="panel-title" style={{ color: 'var(--app-advisory)' }}>Recommended for you</div>
              <div className="panel-sub">Matched to your portfolio, format history and past lead yield</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(268px, 1fr))', gap: 1, background: 'var(--app-border-soft)' }}>
            {data.recommended.map((o) => (
              <button key={o.campaign_id} onClick={() => setWizard(o)}
                style={{
                  textAlign: 'left', fontFamily: 'inherit', border: 'none', cursor: 'pointer',
                  background: 'var(--app-panel)', padding: '13px 15px',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    minWidth: 32, height: 22, borderRadius: 6, padding: '0 7px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--app-advisory)', color: '#fff', fontSize: 11, fontWeight: 800,
                  }} className="ltr-num">{o.match_score}</span>
                  <span className="status-chip status-chip-muted">{o.type}</span>
                  {o.slots_left > 0 && o.slots_left <= 3 && (
                    <span className="status-chip status-chip-warning">{o.slots_left} slots left</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.35 }}>{o.title}</div>
                <div style={{ marginTop: 6 }}>
                  {o.match_reasons.slice(0, 3).map((r, i) => (
                    <div key={i} style={{ fontSize: 10.5, color: 'var(--app-text-muted)', lineHeight: 1.5, display: 'flex', gap: 6 }}>
                      <span style={{ color: 'var(--app-advisory)', flexShrink: 0 }}>·</span>{r}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="page-header-block">
        <div>
          <div className="page-title">Open Opportunities</div>
          <div className="page-subtitle">
            {items.length} open programme{items.length === 1 ? '' : 's'} · you have submitted to {submitted}
          </div>
        </div>
        <div className="seg">
          {[['all', 'All'], ['campaign', 'Campaigns'], ['initiative', 'Initiatives'], ['exhibition', 'Events']].map(([id, label]) => (
            <button key={id} className={`seg-btn${typeFilter === id ? ' is-active' : ''}`} onClick={() => setTypeFilter(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="opp-grid">
        {items.map((o) => (
          <article key={o.campaign_id} className="opp-card">
            <div className="opp-banner" style={{ background: BANNER[o.type] || BANNER.campaign }}>
              {/* Photography under a brand scrim; the gradient behind it is the
                  ground, so a blocked image degrades rather than breaks. */}
              <img src={campaignPhoto(o, 520)} alt="" loading="lazy" className="card-banner-img" />
              <span className="card-banner-scrim" />
              <div style={{ position: 'relative', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="status-chip" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', borderColor: 'rgba(255,255,255,0.34)' }}>
                  {o.type}
                </span>
                {o.slots_left > 0 && o.slots_left <= 4 && (
                  <span className="status-chip" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', borderColor: 'rgba(255,255,255,0.34)' }}>
                    {o.slots_left} slot{o.slots_left === 1 ? '' : 's'} left
                  </span>
                )}
              </div>
            </div>

            <div style={{ padding: '13px 15px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.35 }}>{o.title}</div>
              <p style={{ fontSize: 11.5, color: 'var(--app-text-muted)', lineHeight: 1.55, marginTop: 6, flex: 1 }}>
                {o.description}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 11, fontSize: 11, color: 'var(--app-text-faint)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IcoCalendar size={12} /><span className="ltr-num">{fmt.date(o.start_date)} — {fmt.date(o.end_date)}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IcoPin size={12} />{o.location}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IcoPeople size={12} /><span className="ltr-num">{o.slots_taken}/{o.target_partners}</span> partner slots ·
                  <span className="ltr-num">{o.documents_required} documents required</span>
                </span>
              </div>
            </div>

            <div style={{
              padding: '11px 15px', marginTop: 12, borderTop: '1px solid var(--app-border-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              {o.my_status ? (
                <>
                  <span className={statusChip(o.my_status)}>{statusLabel(o.my_status)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {o.my_documents && (
                      <span className="ltr-num" style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>
                        <IcoDoc size={10} style={{ display: 'inline', verticalAlign: -1 }} /> {o.my_documents}
                      </span>
                    )}
                    {o.my_status !== 'approved' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setWizard(o)}>Update submission</button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span className="status-chip status-chip-muted">Not submitted</span>
                  <button className="btn btn-primary btn-sm" onClick={() => setWizard(o)}>
                    <IcoUpload size={11} sw={2.2} />Submit Participation Request
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      {items.length === 0 && (
        <div className="card"><Empty>No open opportunities match your filters</Empty></div>
      )}

      {data.history.length > 0 && (
        <>
          <div className="page-header-block" style={{ marginTop: 26 }}>
            <div>
              <div className="page-title">Participation History</div>
              <div className="page-subtitle">Programmes you have already taken part in</div>
            </div>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Programme</th><th>Format</th><th>Concluded</th><th>Leads</th><th>Outcome</th></tr></thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.campaign_id}>
                      <td style={{ color: 'var(--app-text)', fontWeight: 600 }}>{h.title}</td>
                      <td><span className={`status-chip status-chip-${TYPE_TONE[h.type] || 'muted'}`}>{h.type}</span></td>
                      <td className="ltr-num">{fmt.date(h.end_date)}</td>
                      <td className="ltr-num">{fmt.int(h.leads)}</td>
                      <td><span className={statusChip(h.status)}>{statusLabel(h.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Wizard
        opportunity={wizard} user={user}
        onClose={() => setWizard(null)}
        onDone={() => { setWizard(null); reload(); }}
      />
    </>
  );
}

/* ── Participation wizard — details → documents → commitment → confirm ── */
function Wizard({ opportunity: o, user, onClose, onDone }) {
  const [step, setStep] = useState(0);
  const [docs, setDocs] = useState([]);
  const [commitment, setCommitment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  React.useEffect(() => { setStep(0); setDocs([]); setCommitment(''); setErr(null); }, [o?.campaign_id]);

  if (!o) return null;

  const REQUIRED = [
    'Company profile & trade licence',
    'Project fact sheet for featured developments',
    'Brand assets (logo suite, approved imagery)',
    'Signed participation undertaking',
  ].slice(0, o.documents_required);

  const STEPS = ['Review brief', 'Upload documents', 'Confirm commitment', 'Submit'];
  const canAdvance = step !== 1 || docs.length === REQUIRED.length;

  async function submit() {
    setBusy(true); setErr(null);
    try {
      await postApi('/developer/requests', {
        developer_id: user.developer_id,
        campaign_id: o.campaign_id,
        commitment_aed: +commitment || 0,
        documents_uploaded: docs.length,
      });
      onDone();
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open onClose={onClose} width={620}
      title={o.title}
      subtitle={`${o.type} · ${o.location}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {step > 0 && <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>Back</button>}
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          ) : (
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Submitting…' : 'Submit participation request'}
            </button>
          )}
        </>
      }
    >
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{
              height: 3, borderRadius: 3, marginBottom: 6,
              background: i <= step ? 'var(--app-accent)' : 'var(--app-surface-raised)',
              transition: 'background 0.2s ease',
            }} />
            <div style={{
              fontSize: 10, fontWeight: 650,
              color: i <= step ? 'var(--app-accent)' : 'var(--app-text-faint)',
            }}>{label}</div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--app-text-muted)', lineHeight: 1.65, marginBottom: 14 }}>{o.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[
              ['Window', `${fmt.date(o.start_date)} — ${fmt.date(o.end_date)}`],
              ['Owner', o.owner],
              ['Partner slots', `${o.slots_taken} of ${o.target_partners} taken`],
              ['Documents required', String(o.documents_required)],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--app-surface-soft)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--app-text)', marginTop: 3, lineHeight: 1.4 }}>{value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <p style={{ fontSize: 12, color: 'var(--app-text-muted)', marginBottom: 12, lineHeight: 1.55 }}>
            Attach the supporting pack. Each upload notifies the DLD Communications Center, keeping the
            approval workflow entirely on-platform.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REQUIRED.map((label, i) => {
              const on = docs.includes(i);
              return (
                <button key={label} type="button"
                  onClick={() => setDocs((v) => (on ? v.filter((x) => x !== i) : [...v, i]))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 11,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.14s ease',
                    background: on ? 'var(--app-success-bg)' : 'var(--app-surface-soft)',
                    border: `1px solid ${on ? 'var(--app-success-border)' : 'var(--app-border)'}`,
                  }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: on ? 'var(--app-success)' : 'var(--app-surface-raised)',
                    color: on ? '#fff' : 'var(--app-text-faint)',
                  }}>{on ? <IcoCheck size={15} sw={2.6} /> : <IcoUpload size={15} />}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 650, color: 'var(--app-text)' }}>{label}</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 2 }}>
                      {on ? 'Attached' : 'Click to attach (demo — no real file is uploaded)'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 11.5, color: docs.length === REQUIRED.length ? 'var(--app-success)' : 'var(--app-text-faint)', fontWeight: 600 }}>
            <span className="ltr-num">{docs.length}/{REQUIRED.length}</span> attached
            {docs.length < REQUIRED.length && ' — all documents are required before submitting'}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <label className="field-label">Financial commitment (AED)</label>
          <input className="field-input" type="number" value={commitment} onChange={(e) => setCommitment(e.target.value)}
            placeholder="e.g. 250000" />
          <p style={{ fontSize: 11.5, color: 'var(--app-text-muted)', marginTop: 10, lineHeight: 1.6 }}>
            Enter the value your organisation is committing to this programme. Leave at zero for
            participation-only formats with no financial contribution — the DLD reviewer will confirm
            the final terms.
          </p>
        </>
      )}

      {step === 3 && (
        <>
          <div style={{
            display: 'flex', gap: 12, padding: '14px 15px', borderRadius: 12, marginBottom: 14,
            background: 'var(--app-accent-bg)', border: '1px solid var(--app-accent-border)',
          }}>
            <span style={{ color: 'var(--app-accent)' }}><IcoLayers size={19} /></span>
            <div style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.6 }}>
              Submitting places your request in the DLD approval queue and pushes an alert to the
              Communications Center. You will be notified here as soon as a decision is made.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Programme', o.title],
              ['Format', o.type],
              ['Documents attached', `${docs.length} of ${REQUIRED.length}`],
              ['Financial commitment', commitment ? fmt.aedFull(commitment) : 'None'],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', gap: 12,
                padding: '9px 12px', borderRadius: 9, background: 'var(--app-surface-soft)',
              }}>
                <span style={{ fontSize: 11.5, color: 'var(--app-text-faint)', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 650, textAlign: 'end' }}>{value}</span>
              </div>
            ))}
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--app-danger)', fontWeight: 600, marginTop: 12 }}>{err}</div>}
        </>
      )}
    </Modal>
  );
}
