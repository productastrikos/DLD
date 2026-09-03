import React, { useMemo, useState } from 'react';
import { useApi, postApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState, Empty } from '../components/States';
import { useI18n } from '../i18n';
import Modal from '../components/Modal';
import KPICard from '../components/KPICard';
import { useSearch, useKpi } from '../App';
import {
  IcoPlus, IcoMegaphone, IcoTarget, IcoPeople, IcoCalendar, IcoPin, IcoCheck, IcoDollar,
  IcoSpark, IcoGrid, IcoList, IcoRefresh,
} from '../components/icons';

const STAGES = [
  { id: 'draft',     label: 'Draft',     hint: 'Being scoped' },
  { id: 'review',    label: 'Review',    hint: 'Awaiting sign-off' },
  { id: 'active',    label: 'Active',    hint: 'Running now' },
  { id: 'completed', label: 'Completed', hint: 'Closed & measured' },
];

const TYPE_TONE = { exhibition: 'sand', campaign: 'accent', initiative: 'teal' };

/**
 * Screen 2 — Joint Initiatives & Campaigns Manager.
 * A Kanban pipeline (Draft → Review → Active → Completed) with a table
 * alternative, plus the "Launch New Initiative" modal that creates a campaign
 * and invites target developers in one step.
 */
export default function DldCampaigns() {
  const { data, error, reload } = useApi('/dld/campaigns');
  const { t } = useI18n();
  const { q } = useSearch();
  const { openKpi } = useKpi();
  const [view, setView] = useState('board');   // 'board' | 'table'
  const [launchOpen, setLaunchOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const campaigns = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.campaigns.filter((c) =>
      !term || c.title.toLowerCase().includes(term) || c.type.includes(term) || c.owner.toLowerCase().includes(term));
  }, [data, q]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label={t('Loading campaign pipeline…')} />;

  const launched = data.campaigns.filter((c) => c.status !== 'draft');
  const approvedTotal = data.campaigns.reduce((s, c) => s + c.approved, 0);
  const slotTotal = launched.reduce((s, c) => s + (+c.target_partners || 0), 0);
  const totals = {
    active: data.campaigns.filter((c) => c.status === 'active').length,
    review: data.campaigns.filter((c) => c.status === 'review').length,
    pending: data.campaigns.reduce((s, c) => s + c.pending, 0),
    committed: data.campaigns.reduce((s, c) => s + c.committed_aed, 0),
    reach: data.campaigns.reduce((s, c) => s + (+c.reach || 0), 0),
    budget: data.campaigns.reduce((s, c) => s + (+c.budget_aed || 0), 0),
    approved: approvedTotal,
    targetSlots: slotTotal,
    // How much of the invited capacity actually converted into participation.
    fillRate: slotTotal ? (approvedTotal / slotTotal) * 100 : 0,
    avgProgress: launched.length
      ? Math.round(launched.reduce((s, c) => s + (+c.progress_pct || 0), 0) / launched.length) : 0,
  };

  async function advance(c, next) {
    await postApi(`/dld/campaigns/${c.campaign_id}`, { status: next }, 'PATCH');
    setDetail(null);
    reload();
  }

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <KPICard kpiId="campaignsActive" onClick={() => openKpi('campaignsActive')}
          label={t('Live Programmes')} value={totals.active} icon={<IcoMegaphone size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{totals.review}</strong> in review · {data.campaigns.length} in pipeline</>} />
        <KPICard kpiId="openRequests" onClick={() => openKpi('openRequests')}
          label={t('Pending Partner Requests')} value={totals.pending} tone="sand" icon={<IcoPeople size={17} />}
          foot="Awaiting review across all campaigns" />
        <KPICard kpiId="activeAgreements" onClick={() => openKpi('activeAgreements')}
          label={t('Committed Partner Value')} value={fmt.aed(totals.committed)} tone="teal" icon={<IcoDollar size={17} />}
          foot="From approved participation requests" />
        <KPICard kpiId="totalReach" onClick={() => openKpi('totalReach')}
          label={t('Cumulative Reach')} value={fmt.compact(totals.reach)} icon={<IcoTarget size={17} />}
          foot="Across active and completed programmes" />
        <KPICard kpiId="avgEngagement" onClick={() => openKpi('avgEngagement')}
          label={t('Partner Fill Rate')} value={fmt.pct(totals.fillRate, 0)} tone="teal" icon={<IcoCheck size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{totals.approved}</strong> approved of {totals.targetSlots} slots</>} />
        <KPICard kpiId="leadsGenerated" onClick={() => openKpi('leadsGenerated')}
          label={t('Programme Budget')} value={fmt.aed(totals.budget)} tone="sand" icon={<IcoDollar size={17} />}
          foot={<>Avg. implementation <strong style={{ color: 'var(--app-text-muted)' }}>{totals.avgProgress}%</strong></>} />
      </div>

      <div className="page-header-block">
        <div>
          <div className="page-title">Campaign Pipeline</div>
          <div className="page-subtitle">
            {campaigns.length} programme{campaigns.length === 1 ? '' : 's'}
            {q ? ` matching “${q}”` : ''} · move a card through the stages to track implementation
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="seg">
            {[['board', 'Board'], ['timeline', 'Timeline'], ['table', 'Table']].map(([id, label]) => (
              <button key={id} className={`seg-btn${view === id ? ' is-active' : ''}`} onClick={() => setView(id)}>{label}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setLaunchOpen(true)}>
            <IcoPlus size={14} />Launch New Initiative
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="kanban">
          {STAGES.map((stage) => {
            const cards = campaigns.filter((c) => c.status === stage.id);
            return (
              <div key={stage.id} className="kanban-col">
                <div className="kanban-head">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--app-text)' }}>{stage.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--app-text-faint)' }}>{stage.hint}</div>
                  </div>
                  <span className="status-chip status-chip-muted ltr-num">{cards.length}</span>
                </div>
                {cards.map((c) => (
                  <div key={c.campaign_id} className="kanban-card" onClick={() => setDetail(c)}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span className={`status-chip status-chip-${TYPE_TONE[c.type] || 'muted'}`}>{c.type}</span>
                      {c.pending > 0 && <span className="status-chip status-chip-warning">{c.pending} pending</span>}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.35 }}>{c.title}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <IcoCalendar size={11} /><span className="ltr-num">{fmt.dateCompact(c.start_date)} — {fmt.dateCompact(c.end_date)}</span>
                    </div>

                    {/* Implementation progress — the tracking column from the spec */}
                    {c.status !== 'draft' && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--app-text-faint)', marginBottom: 4 }}>
                          <span>Implementation</span><span className="ltr-num">{c.progress_pct}%</span>
                        </div>
                        <div className="progress-track"><div className="progress-fill" style={{ width: `${c.progress_pct}%` }} /></div>
                      </div>
                    )}

                    <div style={{
                      display: 'flex', gap: 12, marginTop: 11, paddingTop: 9,
                      borderTop: '1px solid var(--app-border-soft)', flexWrap: 'wrap',
                    }}>
                      <Metric label={t('Partners')} value={`${c.approved}/${c.target_partners}`} />
                      {c.reach > 0 && <Metric label={t('Reach')} value={fmt.compact(c.reach)} />}
                      {c.engagement_rate > 0 && <Metric label={t('Engagement')} value={fmt.pct(c.engagement_rate)} />}
                    </div>
                  </div>
                ))}
                {cards.length === 0 && <div style={{ fontSize: 11, color: 'var(--app-text-faint)', textAlign: 'center', padding: '18px 0' }}>Empty</div>}
              </div>
            );
          })}
        </div>
      ) : view === 'timeline' ? (
        <TimelineView campaigns={campaigns} onOpen={setDetail} />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: '62vh' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Programme</th><th>Type</th><th>Status</th><th>Owner</th>
                  <th>Window</th><th>Partners</th><th>Pending</th>
                  <th>Progress</th><th>Reach</th><th>Engagement</th><th>Committed</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.campaign_id} className="clickable" onClick={() => setDetail(c)}>
                    <td style={{ color: 'var(--app-text)', fontWeight: 600, maxWidth: 260, whiteSpace: 'normal' }}>{c.title}</td>
                    <td><span className={`status-chip status-chip-${TYPE_TONE[c.type] || 'muted'}`}>{c.type}</span></td>
                    <td><span className={statusChip(c.status)}>{statusLabel(c.status)}</span></td>
                    <td>{c.owner}</td>
                    <td className="ltr-num">{fmt.dateCompact(c.start_date)} — {fmt.dateCompact(c.end_date)}</td>
                    <td className="ltr-num">{c.approved}/{c.target_partners}</td>
                    <td className="ltr-num">{c.pending || '—'}</td>
                    <td style={{ minWidth: 96 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div className="progress-track" style={{ flex: 1, minWidth: 44 }}>
                          <div className="progress-fill" style={{ width: `${c.progress_pct}%` }} />
                        </div>
                        <span className="ltr-num" style={{ fontSize: 10.5 }}>{c.progress_pct}%</span>
                      </div>
                    </td>
                    <td className="ltr-num">{c.reach ? fmt.compact(c.reach) : '—'}</td>
                    <td className="ltr-num">{c.engagement_rate ? fmt.pct(c.engagement_rate) : '—'}</td>
                    <td className="ltr-num">{c.committed_aed ? fmt.aed(c.committed_aed) : '—'}</td>
                  </tr>
                ))}
                {campaigns.length === 0 && <tr><td colSpan={11}><Empty>No programmes match “{q}”</Empty></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LaunchModal
        open={launchOpen} onClose={() => setLaunchOpen(false)}
        developers={data.developers}
        onCreated={() => { setLaunchOpen(false); reload(); }}
      />
      <DetailModal campaign={detail} onClose={() => setDetail(null)} onAdvance={advance} />
    </>
  );
}

/**
 * Timeline view — the schedule the Kanban board cannot show.
 *
 * A board says what stage a programme is in; it cannot show that four
 * exhibitions collide in the same fortnight. Laying every window on one axis
 * makes launch-date collisions visible, which is the point of the "Q3 Launch
 * Window" coordination initiative in the first place.
 */
function TimelineView({ campaigns, onOpen }) {
  const rows = useMemo(
    () => [...campaigns].filter((c) => c.start_date && c.end_date)
      .sort((a, b) => (a.start_date < b.start_date ? -1 : 1)),
    [campaigns]
  );
  if (!rows.length) return <div className="card card-pad"><Empty>Nothing scheduled</Empty></div>;

  const times = rows.flatMap((c) => [new Date(c.start_date).getTime(), new Date(c.end_date).getTime()]);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(1, max - min);
  const pos = (d) => ((new Date(d).getTime() - min) / span) * 100;

  // Month gridlines give the bars something to be read against.
  const ticks = [];
  const cur = new Date(min);
  cur.setDate(1);
  while (cur.getTime() <= max) {
    ticks.push({ t: cur.getTime(), label: cur.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) });
    cur.setMonth(cur.getMonth() + 1);
  }
  const nowPct = pos(new Date());

  return (
    <div className="card" style={{ padding: '15px 18px 18px', overflowX: 'auto' }}>
      <div style={{ minWidth: 720 }}>
        {/* Axis */}
        <div className="timeline-row" style={{ borderBottom: '1px solid var(--app-border)', paddingBottom: 6 }}>
          <div className="panel-title">Programme</div>
          <div style={{ position: 'relative', height: 16 }}>
            {ticks.map((t) => {
              const left = ((t.t - min) / span) * 100;
              if (left < 0 || left > 100) return null;
              return (
                <span key={t.t} style={{
                  position: 'absolute', left: `${left}%`, transform: 'translateX(-50%)',
                  fontSize: 9.5, color: 'var(--app-text-faint)', fontWeight: 600, whiteSpace: 'nowrap',
                }}>{t.label}</span>
              );
            })}
          </div>
        </div>

        {rows.map((c) => {
          const left = pos(c.start_date);
          const width = Math.max(1.4, pos(c.end_date) - left);
          const tone = TYPE_TONE[c.type] || 'accent';
          return (
            <div key={c.campaign_id} className="timeline-row">
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 11.5, fontWeight: 650, color: 'var(--app-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={c.title}>{c.title}</div>
                <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)' }}>{c.owner}</div>
              </div>

              <div className="timeline-track">
                {/* month gridlines */}
                {ticks.map((t) => {
                  const l = ((t.t - min) / span) * 100;
                  if (l < 0 || l > 100) return null;
                  return <span key={t.t} style={{
                    position: 'absolute', left: `${l}%`, top: 0, bottom: 0,
                    width: 1, background: 'var(--app-border-soft)',
                  }} />;
                })}
                {nowPct >= 0 && nowPct <= 100 && <span className="timeline-today" style={{ left: `${nowPct}%` }} title="Today" />}

                <div className="timeline-bar"
                  onClick={() => onOpen(c)}
                  title={`${c.title}\n${fmt.date(c.start_date)} — ${fmt.date(c.end_date)}`}
                  style={{
                    left: `${left}%`, width: `${width}%`,
                    background: `var(--app-${tone})`,
                    opacity: c.status === 'completed' ? 0.5 : c.status === 'draft' ? 0.62 : 1,
                  }}>
                  {width > 9 && <span>{c.type}</span>}
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--app-border)', flexWrap: 'wrap' }}>
          {Object.entries(TYPE_TONE).map(([type, tone]) => (
            <span key={type} className="twin-legend-row" style={{ textTransform: 'capitalize' }}>
              <span className="twin-swatch" style={{ background: `var(--app-${tone})` }} />{type}
            </span>
          ))}
          <span className="twin-legend-row">
            <span style={{ width: 2, height: 12, background: 'var(--app-danger)' }} />Today
          </span>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div className="ltr-num" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--app-text)' }}>{value}</div>
    </div>
  );
}

/* ── Launch New Initiative — event details + target developer picker ── */
function LaunchModal({ open, onClose, developers, onCreated }) {
  const empty = {
    title: '', type: 'campaign', owner: 'Marketing & Communications',
    location: '', description: '', start_date: '', end_date: '', budget_aed: '',
  };
  const [form, setForm] = useState(empty);
  const [invited, setInvited] = useState([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [matches, setMatches] = useState(null);
  const [matching, setMatching] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (id) => setInvited((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const shown = developers.filter((d) => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));

  /* Smart matching: rank partners against this brief rather than making the
     officer pick from an alphabetical list of 28. */
  async function suggest() {
    setMatching(true); setErr(null);
    try {
      const r = await postApi('/ai/match', { type: form.type, location: form.location, limit: 8 });
      setMatches(r);
    } catch (e) { setErr(String(e.message || e)); }
    finally { setMatching(false); }
  }
  const applyMatches = () => {
    if (!matches) return;
    setInvited((v) => [...new Set([...v, ...matches.matches.map((m) => m.developer_id)])]);
  };

  async function submit() {
    if (!form.title.trim()) return setErr('A programme title is required');
    setBusy(true); setErr(null);
    try {
      await postApi('/dld/campaigns', { ...form, budget_aed: +form.budget_aed || 0, invited });
      setForm(empty); setInvited([]); setFilter('');
      onCreated();
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} width={780}
      title="Launch New Initiative"
      subtitle="Create the programme and invite target developers — invitations open a pending request on their side"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Creating…' : `Create & invite ${invited.length || 0}`}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Programme title</label>
          <input className="field-input" value={form.title} onChange={set('title')}
            placeholder="e.g. Dubai Real Estate Week 2027" />
        </div>

        <div>
          <label className="field-label">Format</label>
          <select className="field-input" value={form.type} onChange={set('type')} style={{ cursor: 'pointer' }}>
            <option value="campaign">Campaign</option>
            <option value="initiative">Initiative</option>
            <option value="exhibition">Event / Exhibition</option>
          </select>
        </div>
        <div>
          <label className="field-label">Owning department</label>
          <select className="field-input" value={form.owner} onChange={set('owner')} style={{ cursor: 'pointer' }}>
            {['Marketing & Communications', 'Partnerships Office', 'Events & Exhibitions', 'Investor Relations', 'Strategy & Innovation']
              .map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div><label className="field-label">Start date</label>
          <input className="field-input" type="date" value={form.start_date} onChange={set('start_date')} /></div>
        <div><label className="field-label">End date</label>
          <input className="field-input" type="date" value={form.end_date} onChange={set('end_date')} /></div>

        <div><label className="field-label">Location</label>
          <input className="field-input" value={form.location} onChange={set('location')} placeholder="e.g. Dubai World Trade Centre" /></div>
        <div><label className="field-label">Budget (AED)</label>
          <input className="field-input" type="number" value={form.budget_aed} onChange={set('budget_aed')} placeholder="0" /></div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Brief</label>
          <textarea className="field-input" rows={3} value={form.description} onChange={set('description')}
            placeholder="What the programme does and what partners are being asked to commit to." />
        </div>

        {/* ── Smart matching — ranked recommendations for this brief ── */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{
            border: '1px solid var(--app-advisory-border)', background: 'var(--app-advisory-bg)',
            borderRadius: 11, padding: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ color: 'var(--app-advisory)', display: 'flex' }}><IcoSpark size={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="panel-title" style={{ color: 'var(--app-advisory)' }}>Smart partner matching</div>
                <div className="panel-sub">
                  Ranks partners on format history, engagement, reliability and location fit
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={suggest} disabled={matching}>
                {matching ? 'Scoring…' : matches ? <><IcoRefresh size={12} />Re-score</> : 'Suggest partners'}
              </button>
              {matches && (
                <button type="button" className="btn btn-primary btn-sm" onClick={applyMatches}>
                  Select all {matches.matches.length}
                </button>
              )}
            </div>

            {matches && (
              <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 232, overflowY: 'auto' }}>
                {matches.matches.map((m, i) => {
                  const on = invited.includes(m.developer_id);
                  return (
                    <button key={m.developer_id} type="button" onClick={() => toggle(m.developer_id)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px',
                        borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        background: on ? 'var(--app-accent-bg)' : 'var(--app-panel)',
                        border: `1px solid ${on ? 'var(--app-accent-border)' : 'var(--app-border)'}`,
                      }}>
                      <span style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--app-advisory)', color: '#fff', lineHeight: 1,
                      }}>
                        <span className="ltr-num" style={{ fontSize: 12, fontWeight: 800 }}>{m.match_score}</span>
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--app-text)' }}>#{i + 1} {m.name}</span>
                          <span className="status-chip status-chip-muted">{m.tier}</span>
                          {on && <span className="status-chip status-chip-accent"><IcoCheck size={9} />Invited</span>}
                        </span>
                        <span style={{ display: 'block', fontSize: 10.5, color: 'var(--app-text-muted)', marginTop: 3, lineHeight: 1.45 }}>
                          {m.why.join(' · ')}
                        </span>
                      </span>
                    </button>
                  );
                })}
                <div style={{ fontSize: 10, color: 'var(--app-text-faint)', marginTop: 2, lineHeight: 1.5 }}>
                  Weights — {Object.entries(matches.weights).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}%`).join(', ')}.
                  Scored across {matches.considered} registered partners.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Target developer picker */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label className="field-label" style={{ marginBottom: 0 }}>Identify target developers</label>
            <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>{invited.length} selected</span>
          </div>
          <input className="field-input" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter partners…" style={{ marginBottom: 8 }} />
          <div style={{
            maxHeight: 190, overflowY: 'auto', border: '1px solid var(--app-border)',
            borderRadius: 10, padding: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
          }}>
            {shown.map((d) => {
              const on = invited.includes(d.developer_id);
              return (
                <button key={d.developer_id} type="button" onClick={() => toggle(d.developer_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.13s ease',
                    background: on ? 'var(--app-accent-bg)' : 'transparent',
                    border: `1px solid ${on ? 'var(--app-accent-border)' : 'transparent'}`,
                  }}>
                  <span style={{
                    width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: on ? 'var(--app-accent)' : 'transparent',
                    border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-border)'}`,
                    color: '#fff',
                  }}>{on && <IcoCheck size={10} sw={3} />}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--app-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--app-text-faint)' }}>{d.tier}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {err && <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--app-danger)', fontWeight: 600 }}>{err}</div>}
      </div>
    </Modal>
  );
}

/* ── Campaign detail — metrics plus the pipeline advance controls ── */
function DetailModal({ campaign: c, onClose, onAdvance }) {
  if (!c) return null;
  const idx = STAGES.findIndex((s) => s.id === c.status);
  const next = STAGES[idx + 1];

  return (
    <Modal
      open onClose={onClose} width={640}
      title={c.title}
      subtitle={`${c.owner} · ${c.location}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {idx > 0 && (
            <button className="btn btn-ghost" onClick={() => onAdvance(c, STAGES[idx - 1].id)}>
              Move back to {STAGES[idx - 1].label}
            </button>
          )}
          {next && (
            <button className="btn btn-primary" onClick={() => onAdvance(c, next.id)}>
              Advance to {next.label}
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        <span className={`status-chip status-chip-${TYPE_TONE[c.type] || 'muted'}`}>{c.type}</span>
        <span className={statusChip(c.status)}>{statusLabel(c.status)}</span>
        <span className="status-chip status-chip-muted ltr-num">
          <IcoCalendar size={10} />&nbsp;{fmt.date(c.start_date)} — {fmt.date(c.end_date)}
        </span>
      </div>

      {c.description && (
        <p style={{ fontSize: 12.5, color: 'var(--app-text-muted)', lineHeight: 1.6, marginBottom: 16 }}>{c.description}</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          ['Requests received', fmt.int(c.requests)],
          ['Approved partners', `${c.approved} / ${c.target_partners}`],
          ['Pending review', fmt.int(c.pending)],
          ['Committed value', c.committed_aed ? fmt.aed(c.committed_aed) : '—'],
          ['Budget', c.budget_aed ? fmt.aed(c.budget_aed) : '—'],
          ['Campaign reach', c.reach ? fmt.compact(c.reach) : '—'],
          ['Engagement rate', c.engagement_rate ? fmt.pct(c.engagement_rate) : '—'],
          ['Projects featured', fmt.int(c.projects_featured)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: 'var(--app-surface-soft)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div className="ltr-num" style={{ fontSize: 15, fontWeight: 750, color: 'var(--app-text)', marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>

      {c.partners?.length > 0 && (
        <>
          <div className="panel-title" style={{ marginBottom: 8 }}>Participating partners</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {c.partners.map((p) => <span key={p} className="status-chip status-chip-teal" style={{ textTransform: 'none' }}>{p}</span>)}
          </div>
        </>
      )}
    </Modal>
  );
}
