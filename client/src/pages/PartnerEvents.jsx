import React, { useState } from 'react';
import { useApi, postApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState, Empty } from '../components/States';
import { useI18n } from '../i18n';
import Modal from '../components/Modal';
import { useSearch, useKpi } from '../App';
import { eventPhoto } from '../services/media';
import KPICard from '../components/KPICard';
import {
  IcoTicket, IcoPin, IcoCalendar, IcoCheck, IcoPeople, IcoTarget, IcoUpload, IcoDollar,
} from '../components/icons';

/**
 * Partner-side Events & Exhibitions.
 *
 * The developer's view of the same calendar: what is open, what they are
 * already booked onto, and a short registration flow for stand space. Scoped
 * server-side — a partner sees roster counts but never another partner's row.
 */

const TYPE_TONE = { exhibition: 'accent', conference: 'teal', summit: 'sand', roadshow: 'info', awards: 'success' };

export default function PartnerEvents({ user }) {
  const { data, error, reload } = useApi('/events');
  const { t } = useI18n();
  const { q } = useSearch();
  const { openKpi } = useKpi();
  const [open, setOpen] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ booth_sqm: 36, staff_count: 4, documents_uploaded: 0 });
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label={t('Loading your events…')} />;

  const needle = q.toLowerCase();
  const all = data.events.filter((e) =>
    !q || e.title.toLowerCase().includes(needle) || e.venue.toLowerCase().includes(needle));

  const mine = all.filter((e) => e.my_participation);
  const openings = all.filter((e) => !e.my_participation && (e.status === 'confirmed' || e.status === 'planning'));
  const past = mine.filter((e) => e.status === 'completed');

  const startRegistration = (e) => {
    setOpen(e); setStep(0);
    setForm({ booth_sqm: e.type === 'exhibition' ? 36 : 0, staff_count: 4, documents_uploaded: 0 });
  };

  const submit = async () => {
    setBusy(true);
    try {
      await postApi(`/events/${open.event_id}/participate`, {
        developer_id: user.developer_id, ...form,
      });
      setStep(3);
      reload();
    } finally { setBusy(false); }
  };

  const totalLeads = mine.reduce((s, e) => s + (e.my_participation?.leads_captured || 0), 0);
  const totalCost = mine.reduce((s, e) => s + (+e.my_participation?.cost_aed || 0), 0);
  const totalBooth = mine.reduce((s, e) => s + (+e.my_participation?.booth_sqm || 0), 0);
  const totalMeetings = mine.reduce((s, e) => {
    const own = (e.participations || []).find((p) => p.participation_id === e.my_participation?.participation_id);
    return s + (+own?.meetings_held || 0);
  }, 0);

  return (
    <>
      {/* ── My standing in the events programme ── */}
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <KPICard kpiId="eventFootfall" onClick={() => openKpi('eventFootfall')}
          label={t('Events Joined')} value={mine.length} icon={<IcoTicket size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{openings.length}</strong> more open to you</>} />
        <KPICard kpiId="eventFootfall" onClick={() => openKpi('eventFootfall')}
          label={t('Confirmed')} value={mine.filter((e) => e.my_participation.status === 'confirmed').length} tone="teal"
          icon={<IcoCheck size={17} />} foot="Stand space secured" />
        <KPICard kpiId="leadsGenerated" onClick={() => openKpi('leadsGenerated')}
          label={t('Leads Captured')} value={fmt.int(totalLeads)} tone="teal" icon={<IcoTarget size={17} />}
          foot={`Across ${past.length} delivered events`} />
        <KPICard kpiId="openRequests" onClick={() => openKpi('openRequests')}
          label={t('Awaiting Decision')} value={mine.filter((e) => ['pending', 'invited'].includes(e.my_participation.status)).length}
          tone="sand" icon={<IcoPeople size={17} />} foot="With the DLD Events Office" />
        <KPICard kpiId="activeAgreements" onClick={() => openKpi('activeAgreements')}
          label={t('Stand Investment')} value={fmt.aed(totalCost)} tone="sand" icon={<IcoDollar size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{totalBooth}</strong> m² booked in total</>} />
        <KPICard kpiId="mediaRoi" onClick={() => openKpi('mediaRoi')}
          label={t('Meetings Held')} value={fmt.int(totalMeetings)} icon={<IcoPeople size={17} />}
          foot="Recorded at delivered exhibitions" />
      </div>

      {/* ── Open to you ── */}
      <div className="page-header-block" style={{ marginBottom: 14 }}>
        <div>
          <div className="page-title" style={{ fontSize: 16 }}>Open for registration</div>
          <div className="page-subtitle">Events with partner slots still available</div>
        </div>
      </div>

      {openings.length === 0 ? <Empty>No events are currently open for registration</Empty> : (
        <div className="opp-grid" style={{ marginBottom: 22 }}>
          {openings.map((e) => (
            <div key={e.event_id} className="opp-card">
              <div className="opp-banner" style={{
                background: `linear-gradient(135deg, var(--app-${TYPE_TONE[e.type] || 'accent'}), var(--app-accent-strong))`,
              }}>
                <img src={eventPhoto(e, 520)} alt="" loading="lazy" className="card-banner-img" />
                <span className="card-banner-scrim" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <span className="status-chip" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }}>
                    {e.type}
                  </span>
                </div>
                <div style={{ position: 'absolute', top: 12, insetInlineEnd: 14, color: 'rgba(255,255,255,0.9)', fontSize: 10.5, fontWeight: 650 }} className="ltr-num">
                  {e.days_until >= 0 ? `in ${e.days_until} days` : 'closed'}
                </div>
              </div>

              <div style={{ padding: '13px 15px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.3 }}>{e.title}</div>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginTop: 6, lineHeight: 1.5, flex: 1 }}>{e.description}</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '11px 0', fontSize: 10.5, color: 'var(--app-text-faint)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IcoPin size={12} /> {e.venue}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="ltr-num">
                    <IcoCalendar size={12} /> {fmt.date(e.start_date)} — {fmt.date(e.end_date)}
                  </span>
                </div>

                <div style={{ marginBottom: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--app-text-faint)', marginBottom: 4 }}>
                    <span>{e.partners_confirmed} of {e.target_partners} partner slots taken</span>
                    {e.slots_left <= 3 && e.slots_left > 0 && (
                      <span style={{ color: 'var(--app-warning)', fontWeight: 700 }}>{e.slots_left} left</span>
                    )}
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${Math.min(100, (e.partners_confirmed / Math.max(1, e.target_partners)) * 100)}%` }} />
                  </div>
                </div>

                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => startRegistration(e)}>
                  Register interest
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── My participations ── */}
      <div className="page-header-block" style={{ marginBottom: 14 }}>
        <div>
          <div className="page-title" style={{ fontSize: 16 }}>My participations</div>
          <div className="page-subtitle">Events you have registered for or delivered</div>
        </div>
      </div>

      {mine.length === 0 ? <Empty>You have not registered for any events yet</Empty> : (
        <div className="card" style={{ padding: '4px 0' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Event</th><th>Dates</th><th>Venue</th><th>Stand</th><th>Documents</th><th>Cost</th><th>Leads</th><th>Status</th></tr>
              </thead>
              <tbody>
                {mine.map((e) => {
                  const p = e.my_participation;
                  return (
                    <tr key={e.event_id}>
                      <td style={{ color: 'var(--app-text)', fontWeight: 600, whiteSpace: 'normal', minWidth: 190 }}>{e.title}</td>
                      <td className="ltr-num">{fmt.dateCompact(e.start_date)}</td>
                      <td>{e.venue}</td>
                      <td className="ltr-num">{p.booth_sqm ? `${p.stand_number || 'TBA'} · ${p.booth_sqm}m²` : '—'}</td>
                      <td className="ltr-num">{p.documents}</td>
                      <td className="ltr-num">{fmt.aed(p.cost_aed)}</td>
                      <td className="ltr-num">{p.leads_captured || '—'}</td>
                      <td>
                        <span className={statusChip(p.status === 'confirmed' ? 'approved' : p.status === 'declined' || p.status === 'withdrawn' ? 'rejected' : 'pending')}>
                          {statusLabel(p.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Registration flow ── */}
      <Modal open={!!open} onClose={() => setOpen(null)} width={620}
        title={open?.title}
        subtitle={step === 3 ? 'Registration submitted' : `Step ${step + 1} of 3 · ${open?.venue}`}
        footer={open && step < 3 && (
          <>
            <button className="btn btn-ghost" onClick={() => step ? setStep(step - 1) : setOpen(null)}>
              {step ? 'Back' : 'Cancel'}
            </button>
            {step < 2
              ? <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Continue</button>
              : <button className="btn btn-primary" disabled={busy} onClick={submit}>Submit registration</button>}
          </>
        )}>
        {open && step === 0 && (
          <>
            <div className="panel-title" style={{ marginBottom: 7 }}>Event brief</div>
            <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>{open.description}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <Mini label={t('Dates')} value={`${fmt.dateCompact(open.start_date)} — ${fmt.dateCompact(open.end_date)}`} />
              <Mini label={t('Venue')} value={open.venue} />
              <Mini label={t('Expected attendance')} value={fmt.int(open.capacity)} />
              <Mini label={t('Partner slots left')} value={open.slots_left} />
            </div>
          </>
        )}

        {open && step === 1 && (
          <>
            <div className="panel-title" style={{ marginBottom: 11 }}>Stand and staffing</div>
            {open.type === 'exhibition' ? (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <label className="field-label" style={{ marginBottom: 0 }}>Stand space</label>
                    <span className="ltr-num" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--app-text)' }}>{form.booth_sqm} m²</span>
                  </div>
                  <input className="twin-slider" type="range" min={9} max={216} step={9}
                    value={form.booth_sqm} onChange={(e) => setForm((f) => ({ ...f, booth_sqm: +e.target.value }))} />
                  <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 5 }} className="ltr-num">
                    Indicative cost {fmt.aedFull(form.booth_sqm * 1600)} at AED 1,600 per m²
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <label className="field-label" style={{ marginBottom: 0 }}>On-stand staff</label>
                    <span className="ltr-num" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--app-text)' }}>{form.staff_count}</span>
                  </div>
                  <input className="twin-slider" type="range" min={1} max={24}
                    value={form.staff_count} onChange={(e) => setForm((f) => ({ ...f, staff_count: +e.target.value }))} />
                </div>
              </>
            ) : (
              <div>
                <label className="field-label">Delegates attending</label>
                <input className="field-input" type="number" min={1} max={30} value={form.staff_count}
                  onChange={(e) => setForm((f) => ({ ...f, staff_count: +e.target.value }))} />
                <div style={{ fontSize: 11, color: 'var(--app-text-faint)', marginTop: 7 }}>
                  This format has no exhibition stand — delegate passes only.
                </div>
              </div>
            )}
          </>
        )}

        {open && step === 2 && (
          <>
            <div className="panel-title" style={{ marginBottom: 11 }}>Required documents</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Trade licence copy', 'Stand design and build plan', 'Public liability insurance', 'Brand asset pack'].map((doc, i) => {
                const uploaded = i < form.documents_uploaded;
                return (
                  <button key={doc} onClick={() => setForm((f) => ({ ...f, documents_uploaded: uploaded ? i : i + 1 }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
                      borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      border: `1px solid var(--app-${uploaded ? 'success-border' : 'border'})`,
                      background: uploaded ? 'var(--app-success-bg)' : 'var(--app-surface-soft)',
                    }}>
                    <span style={{ color: `var(--app-${uploaded ? 'success' : 'text-faint'})`, display: 'flex' }}>
                      {uploaded ? <IcoCheck size={15} /> : <IcoUpload size={15} />}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5, color: 'var(--app-text)' }}>{doc}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>{uploaded ? 'Attached' : 'Upload'}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--app-text-faint)', marginTop: 11, lineHeight: 1.5 }}>
              Uploads are simulated in this proof of concept. Submitting notifies the DLD
              Events Office, which is what opens the confirmation decision on their side.
            </div>
          </>
        )}

        {open && step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 99, margin: '0 auto 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--app-success-bg)', color: 'var(--app-success)',
            }}><IcoCheck size={26} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text)' }}>Registration submitted</div>
            <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginTop: 7, lineHeight: 1.6, maxWidth: 400, margin: '7px auto 0' }}>
              The Events Office has been notified and will confirm your stand allocation.
              You will receive a notification here when the decision is made.
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setOpen(null)}>Done</button>
          </div>
        )}
      </Modal>
    </>
  );
}

function Tile({ icon, label, value, foot, tone = 'accent' }) {
  return (
    <div className="card" style={{ padding: '13px 15px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `var(--app-${tone}-bg)`, color: `var(--app-${tone})`,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--app-text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 19, fontWeight: 750, color: 'var(--app-text)', lineHeight: 1.2, marginTop: 2 }} className="ltr-num">{value}</div>
        {foot && <div style={{ fontSize: 10, color: 'var(--app-text-faint)', marginTop: 2 }}>{foot}</div>}
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{ padding: '9px 11px', borderRadius: 9, background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--app-text-faint)' }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-text)', marginTop: 3 }} className="ltr-num">{value}</div>
    </div>
  );
}
