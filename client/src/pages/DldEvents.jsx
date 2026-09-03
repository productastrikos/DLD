import React, { useState } from 'react';
import { useApi, postApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState } from '../components/States';
import { useI18n } from '../i18n';
import { BarsChart, ChartPanel } from '../components/charts';
import Modal from '../components/Modal';
import KPICard from '../components/KPICard';
import { useSearch, useKpi } from '../App';
import {
  IcoTicket, IcoPeople, IcoTarget, IcoDollar, IcoTrendUp, IcoPin,
  IcoCalendar, IcoCheck, IcoClose, IcoGrid, IcoList,
} from '../components/icons';

/**
 * Events & Exhibitions (Section IV.3) — participation management and impact
 * reporting. Structurally the sibling of the Campaigns Manager: a pipeline
 * board over the same invite → register → confirm workflow, with a delivered
 * events panel that reports what each one actually returned.
 */

const STAGES = [
  { id: 'planning', label: 'Planning', tone: 'muted' },
  { id: 'confirmed', label: 'Confirmed', tone: 'accent' },
  { id: 'live', label: 'Live', tone: 'success' },
  { id: 'completed', label: 'Delivered', tone: 'info' },
];

const TYPE_TONE = { exhibition: 'accent', conference: 'teal', summit: 'sand', roadshow: 'info', awards: 'success' };

export default function DldEvents() {
  const { data, error, reload } = useApi('/events');
  const { t } = useI18n();
  const { q } = useSearch();
  const { openKpi } = useKpi();
  const [view, setView] = useState('board');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label={t('Loading events calendar…')} />;

  const s = data.summary;
  const needle = q.toLowerCase();
  const events = data.events.filter((e) =>
    !q || e.title.toLowerCase().includes(needle) || e.venue.toLowerCase().includes(needle) || e.type.includes(needle));

  const move = async (e, status) => {
    setBusy(true);
    try { await postApi(`/events/${e.event_id}`, { status }, 'PATCH'); reload(); setOpen(null); }
    finally { setBusy(false); }
  };
  const decide = async (p, status) => {
    setBusy(true);
    try {
      await postApi(`/events/participations/${p.participation_id}`, { status }, 'PATCH');
      reload();
      setOpen((o) => o && ({
        ...o,
        participations: o.participations.map((x) => x.participation_id === p.participation_id ? { ...x, status } : x),
      }));
    } finally { setBusy(false); }
  };

  const delivered = data.events.filter((e) => e.status === 'completed');

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 14 }}>
        <KPICard kpiId="eventFootfall" onClick={() => openKpi('eventFootfall')}
          label={t('Events on calendar')} value={fmt.int(s.total)} icon={<IcoTicket size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{s.upcoming}</strong> confirmed ahead · {s.planning} planning</>} />
        <KPICard kpiId="eventFootfall" onClick={() => openKpi('eventFootfall')}
          label={t('Total footfall')} value={fmt.compact(s.footfall)} tone="teal" icon={<IcoPeople size={17} />}
          foot={`Across ${s.completed} delivered events`} />
        <KPICard kpiId="leadsGenerated" onClick={() => openKpi('leadsGenerated')}
          label={t('Leads generated')} value={fmt.compact(s.leads)} tone="teal" icon={<IcoTarget size={17} />}
          foot="Captured by participating partners" />
        <KPICard kpiId="mediaRoi" onClick={() => openKpi('mediaRoi')}
          label={t('Media value returned')} value={fmt.aed(s.mediaValue)} tone="sand" icon={<IcoDollar size={17} />}
          foot={<>Against <strong style={{ color: 'var(--app-text-muted)' }}>{fmt.aed(s.budget)}</strong> committed budget</>} />
        <KPICard kpiId="mediaRoi" onClick={() => openKpi('mediaRoi')}
          label={t('Media ROI')} value={fmt.pct(s.mediaRoi)} tone="sand" icon={<IcoTrendUp size={17} />}
          foot="Earned media against event spend" />
        <KPICard kpiId="registeredPartners" onClick={() => openKpi('registeredPartners')}
          label={t('Partner participations')} value={fmt.int(s.confirmedParticipations)} icon={<IcoCheck size={17} />}
          foot={`Avg. satisfaction ${s.avgSatisfaction} / 5`} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div className="seg">
          <button className={`seg-btn${view === 'board' ? ' is-active' : ''}`} onClick={() => setView('board')}>
            <IcoGrid size={12} /> Pipeline
          </button>
          <button className={`seg-btn${view === 'impact' ? ' is-active' : ''}`} onClick={() => setView('impact')}>
            <IcoList size={12} /> Impact reporting
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="kanban">
          {STAGES.map((st) => {
            const rows = events.filter((e) => e.status === st.id);
            return (
              <div key={st.id} className="kanban-col">
                <div className="kanban-head">
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--app-text)' }}>{st.label}</span>
                  <span className={`status-chip status-chip-${st.tone}`}>{rows.length}</span>
                </div>
                {rows.map((e) => (
                  <div key={e.event_id} className="kanban-card" onClick={() => setOpen(e)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <span className={`status-chip status-chip-${TYPE_TONE[e.type] || 'muted'}`}>{e.type}</span>
                      {e.status === 'confirmed' && e.days_until >= 0 && (
                        <span style={{ fontSize: 10, color: 'var(--app-text-faint)', fontWeight: 600 }} className="ltr-num">
                          in {e.days_until}d
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--app-text)', lineHeight: 1.3 }}>{e.title}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <IcoPin size={11} /> {e.venue}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 3 }} className="ltr-num">
                      {fmt.dateCompact(e.start_date)} — {fmt.dateCompact(e.end_date)}
                    </div>

                    <div style={{ marginTop: 9 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--app-text-faint)', marginBottom: 4 }}>
                        <span>{e.partners_confirmed} of {e.target_partners} partners</span>
                        <span className="ltr-num">{e.fill_pct}% capacity</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{
                          width: `${Math.min(100, (e.partners_confirmed / Math.max(1, e.target_partners)) * 100)}%`,
                          background: `var(--app-${st.tone === 'muted' ? 'text-faint' : st.tone})`,
                        }} />
                      </div>
                    </div>

                    {e.partners_pending > 0 && (
                      <div style={{ marginTop: 7 }}>
                        <span className="status-chip status-chip-warning">{e.partners_pending} awaiting decision</span>
                      </div>
                    )}
                  </div>
                ))}
                {rows.length === 0 && <div className="empty-state" style={{ padding: '22px 8px', fontSize: 11.5 }}>Nothing here</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <ChartPanel title="Delivered event impact" note="Footfall and leads captured, by event">
            <BarsChart
              data={delivered.map((e) => ({
                event: e.title.length > 26 ? `${e.title.slice(0, 25)}…` : e.title,
                footfall: e.footfall, leads: e.leads_generated,
              }))}
              xKey="event" height={Math.max(220, delivered.length * 44)} layout="horizontal" catWidth={190}
              series={[{ key: 'footfall', label: 'Footfall' }, { key: 'leads', label: 'Leads' }]}
              tickFmt={(v) => fmt.compact(v)} fmt={(v) => fmt.int(v)}
            />
          </ChartPanel>

          <div className="card" style={{ marginTop: 14, padding: '15px 16px 6px' }}>
            <div className="panel-title">Impact reporting</div>
            <div className="panel-sub" style={{ marginBottom: 10 }}>Return measured against committed budget, per delivered event</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th><th>Type</th><th>Partners</th><th>Footfall</th>
                    <th>Leads</th><th>Budget</th><th>Media value</th><th>Media ROI</th><th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {delivered.map((e) => (
                    <tr key={e.event_id} className="clickable" onClick={() => setOpen(e)}>
                      <td style={{ color: 'var(--app-text)', fontWeight: 600, whiteSpace: 'normal', minWidth: 190 }}>{e.title}</td>
                      <td style={{ textTransform: 'capitalize' }}>{e.type}</td>
                      <td className="ltr-num">{e.partners_confirmed}</td>
                      <td className="ltr-num">{fmt.int(e.footfall)}</td>
                      <td className="ltr-num">{fmt.int(e.leads_generated)}</td>
                      <td className="ltr-num">{fmt.aed(e.budget_aed)}</td>
                      <td className="ltr-num">{fmt.aed(e.media_value_aed)}</td>
                      <td className="ltr-num" style={{ fontWeight: 700, color: e.media_roi_pct >= 0 ? 'var(--app-success)' : 'var(--app-danger)' }}>
                        {fmt.pct(e.media_roi_pct)}
                      </td>
                      <td className="ltr-num">{e.satisfaction} / 5</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Event detail: pipeline control + participation roster ── */}
      <Modal open={!!open} onClose={() => setOpen(null)} width={860}
        title={open?.title} subtitle={open ? `${open.venue} · ${fmt.date(open.start_date)} — ${fmt.date(open.end_date)}` : ''}
        footer={open && (
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(null)}>Close</button>
            {STAGES.map((st) => st.id !== open.status && (
              <button key={st.id} className="btn btn-primary" disabled={busy} onClick={() => move(open, st.id)}>
                Move to {st.label}
              </button>
            ))}
          </>
        )}>
        {open && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
              {open.description}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10, marginBottom: 16 }}>
              <Mini label={t('Status')} value={<span className={statusChip(open.status === 'live' ? 'active' : open.status === 'confirmed' ? 'approved' : open.status)}>{statusLabel(open.status)}</span>} />
              <Mini label={t('Capacity')} value={`${fmt.int(open.registered)} / ${fmt.int(open.capacity)}`} />
              <Mini label={t('Budget')} value={fmt.aed(open.budget_aed)} />
              <Mini label={t('Partner slots')} value={`${open.partners_confirmed} / ${open.target_partners}`} />
              {open.status === 'completed' && <Mini label={t('Footfall')} value={fmt.int(open.footfall)} />}
              {open.status === 'completed' && <Mini label={t('Leads')} value={fmt.int(open.leads_generated)} />}
              {open.status === 'completed' && <Mini label={t('Media ROI')} value={fmt.pct(open.media_roi_pct)} />}
              {open.status === 'completed' && <Mini label={t('Rating')} value={`${open.satisfaction} / 5`} />}
            </div>

            <div className="panel-title" style={{ marginBottom: 8 }}>
              Participation roster — {open.participations.length} partner{open.participations.length === 1 ? '' : 's'}
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Partner</th><th>Tier</th><th>Stand</th><th>Docs</th><th>Cost</th><th>Leads</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {open.participations.map((p) => (
                    <tr key={p.participation_id}>
                      <td style={{ color: 'var(--app-text)', fontWeight: 600 }}>{p.developer_name}</td>
                      <td>{p.developer_tier}</td>
                      <td className="ltr-num">{p.booth_sqm ? `${p.stand_number || '—'} · ${p.booth_sqm}m²` : '—'}</td>
                      <td className="ltr-num">{p.documents_uploaded}/{p.documents_required}</td>
                      <td className="ltr-num">{fmt.aed(p.cost_aed)}</td>
                      <td className="ltr-num">{p.leads_captured || '—'}</td>
                      <td><span className={statusChip(p.status === 'confirmed' ? 'approved' : p.status === 'declined' || p.status === 'withdrawn' ? 'rejected' : 'pending')}>{statusLabel(p.status)}</span></td>
                      <td>
                        {(p.status === 'pending' || p.status === 'invited') && (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide(p, 'confirmed')}>
                              <IcoCheck size={11} />
                            </button>
                            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => decide(p, 'declined')}>
                              <IcoClose size={11} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {open.participations.length === 0 && (
                    <tr><td colSpan={8}><div className="empty-state">No partners registered yet</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{ padding: '9px 11px', borderRadius: 9, background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--app-text-faint)' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)', marginTop: 3 }} className="ltr-num">{value}</div>
    </div>
  );
}
