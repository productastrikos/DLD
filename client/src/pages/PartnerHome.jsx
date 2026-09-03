import React from 'react';
import { Link } from 'react-router-dom';
import { useApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState, Empty } from '../components/States';
import { useI18n } from '../i18n';
import KPICard from '../components/KPICard';
import Ring from '../components/Ring';
import { BarsChart, ChartPanel } from '../components/charts';
import { useKpi } from '../App';
import {
  IcoMegaphone, IcoClock, IcoTarget, IcoDollar, IcoUpload,
  IcoCheck, IcoHandshake, IcoTrendUp, IcoLayers, IcoAward, IcoShield, IcoBuilding,
} from '../components/icons';

const TASK_ICON = {
  upload: <IcoUpload size={15} />, awaiting: <IcoClock size={15} />,
  signature: <IcoHandshake size={15} />, commitment: <IcoCheck size={15} />,
};
const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'info' };

/**
 * Developer Screen 1 — Partner Activity & Home Dashboard.
 * Split layout: action items on the left, performance metrics on the right.
 */
export default function PartnerHome({ user }) {
  const { data, error } = useApi('/developer/home');
  const { t } = useI18n();
  const { openKpi } = useKpi();

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label={t('Loading your partner workspace…')} />;

  const { profile, kpis, tasks, outcomes, requests, completion } = data;
  const vsMedian = kpis.engagementScore - kpis.tierMedian;

  return (
    <>
      {/* ── Welcome banner ── */}
      <div className="card" style={{
        padding: '18px 20px', marginBottom: 16, display: 'flex',
        alignItems: 'center', gap: 16, flexWrap: 'wrap',
        background: 'linear-gradient(120deg, var(--app-accent) 0%, var(--app-teal) 100%)',
        border: 'none',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 17,
        }}>
          {profile.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}>
            Welcome back, {user?.name || profile.contact_name}
          </div>
          <div style={{ fontSize: 21, fontWeight: 750, color: '#fff', letterSpacing: '-0.02em', marginTop: 3 }}>
            {profile.name}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
            {profile.tier} · {profile.district} · {profile.projects_count} registered projects ·
            partner since <span className="ltr-num">{fmt.date(profile.registered_date)}</span>
          </div>
        </div>
        <Link to="/partner/marketplace" className="btn"
          style={{ background: 'rgba(255,255,255,0.94)', color: 'var(--app-accent)', height: 38, fontSize: 13 }}>
          <IcoLayers size={14} />Browse opportunities
        </Link>
      </div>

      {/* ── Split screen: action items left, performance right ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>

        {/* Left — obligations, then the task list that clears them */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

        {/* Completion ring: one figure for "how much of what I owe is done" */}
        {completion && (
          <div className="card" style={{ padding: '15px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
            <Ring value={completion.pct} size={104} stroke={9}
              label={completion.pct >= 100 ? 'Complete' : 'Done'} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="panel-title">Obligations complete</div>
              <div className="panel-sub" style={{ marginBottom: 9 }}>
                {completion.pct >= 100
                  ? 'Everything the Department expects from you is delivered.'
                  : 'Across documents, requests, agreements and commitments'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {completion.strands.map((s) => (
                  <div key={s.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--app-text-muted)' }}>{s.label}</span>
                      <span className="ltr-num" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--app-text)' }}>
                        {s.total ? `${s.done}/${s.total}` : '—'}
                      </span>
                    </div>
                    <div className="progress-track" style={{ height: 4 }}>
                      <div className="progress-fill" style={{
                        width: `${s.pct}%`,
                        background: s.pct >= 100 ? 'var(--app-success)' : s.pct >= 60 ? 'var(--app-accent)' : 'var(--app-warning)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: '15px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div className="panel-title">Action Required</div>
              <div className="panel-sub">Pending approvals and required uploads</div>
            </div>
            <span className={`status-chip status-chip-${tasks.length ? 'warning' : 'success'} ltr-num`}>{tasks.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {tasks.map((t) => (
              <div key={t.id} style={{
                display: 'flex', gap: 10, padding: '11px 12px', borderRadius: 11,
                background: 'var(--app-surface-soft)',
                borderInlineStart: `3px solid var(--app-${PRIORITY_TONE[t.priority]})`,
              }}>
                <div style={{
                  width: 27, height: 27, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `var(--app-${PRIORITY_TONE[t.priority]}-bg)`,
                  color: `var(--app-${PRIORITY_TONE[t.priority]})`,
                }}>{TASK_ICON[t.kind]}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--app-text)', lineHeight: 1.35 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginTop: 3, lineHeight: 1.4 }}>{t.context}</div>
                  <div className="ltr-num" style={{ fontSize: 10, color: 'var(--app-text-faint)', marginTop: 4 }}>{t.request_id}</div>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="empty-state" style={{ padding: '28px 12px' }}>
                <span style={{ color: 'var(--app-success)' }}><IcoCheck size={26} /></span>
                Nothing outstanding — you are fully up to date.
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Right — personalised analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="grid-kpi">
            <KPICard kpiId="campaignsActive" onClick={() => openKpi('campaignsActive')}
              label={t('Active Participations')} value={fmt.int(kpis.activeParticipations)} icon={<IcoMegaphone size={17} />}
              foot={<>{kpis.totalParticipations} approved all-time</>} />
            <KPICard kpiId="openRequests" onClick={() => openKpi('openRequests')}
              label={t('Requests In Flight')} value={fmt.int(kpis.pendingRequests)} tone="sand" icon={<IcoClock size={17} />}
              foot="Awaiting a DLD decision" />
            <KPICard kpiId="leadsGenerated" onClick={() => openKpi('leadsGenerated')}
              label={t('Leads Generated')} value={fmt.compact(kpis.leadsGenerated)} tone="teal" icon={<IcoTarget size={17} />}
              foot="Attributed to joint programmes" />
            <KPICard kpiId="totalReach" onClick={() => openKpi('totalReach')}
              label={t('Media Mentions')} value={fmt.int(kpis.mediaMentions)} tone="teal" icon={<IcoTrendUp size={17} />}
              foot="Earned coverage for your projects" />
            <KPICard kpiId="activeAgreements" onClick={() => openKpi('activeAgreements')}
              label={t('Active Sponsorships')} value={fmt.int(kpis.sponsorships)} tone="sand" icon={<IcoHandshake size={17} />}
              foot={<>{fmt.aed(kpis.sponsorshipValue)} contracted</>} />
            <KPICard kpiId="meanEngagement" onClick={() => openKpi('meanEngagement')}
              label={t('Engagement Score')} value={kpis.engagementScore} unit="/ 100"
              icon={<IcoAward size={17} />} trend={vsMedian}
              foot={<>{vsMedian >= 0 ? 'Above' : 'Below'} the {profile.tier} median of <span className="ltr-num">{kpis.tierMedian}</span></>}
            />
            <KPICard kpiId="commitmentDelivery" onClick={() => openKpi('commitmentDelivery')}
              label={t('Obligations Complete')} value={fmt.pct(completion?.pct || 0, 0)} tone="teal" icon={<IcoShield size={17} />}
              foot="Documents, requests, agreements and commitments" />
            <KPICard kpiId="portfolioValue" onClick={() => openKpi('portfolioValue')}
              label={t('Registered Projects')} value={fmt.int(profile.projects_count)} icon={<IcoBuilding size={17} />}
              foot={<>Based in <strong style={{ color: 'var(--app-text-muted)' }}>{profile.district}</strong></>} />
          </div>

          {outcomes.length > 0 && (
            <ChartPanel
              title="Participation Outcomes"
              note="Leads attributed to each programme you have joined">
              <BarsChart
                data={outcomes.map((o) => ({ name: o.title.length > 30 ? `${o.title.slice(0, 29)}…` : o.title, leads: o.leads }))}
                xKey="name" height={Math.max(170, outcomes.length * 40)} layout="horizontal" colorByIndex
                series={[{ key: 'leads', label: 'Leads generated' }]}
                fmt={(v) => fmt.int(v)} catWidth={185}
              />
            </ChartPanel>
          )}

          <div className="card" style={{ padding: '15px 16px 6px' }}>
            <div style={{ marginBottom: 10 }}>
              <div className="panel-title">My Participation Requests</div>
              <div className="panel-sub">Status of everything you have submitted</div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 300 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Request</th><th>Programme</th><th>Submitted</th><th>Documents</th><th>Commitment</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.request_id}>
                      <td className="ltr-num" style={{ fontWeight: 600 }}>{r.request_id}</td>
                      <td style={{ color: 'var(--app-text)', maxWidth: 260, whiteSpace: 'normal' }}>{r.campaign_title}</td>
                      <td className="ltr-num">{fmt.dateShort(r.submitted_date)}</td>
                      <td>
                        <span className={`status-chip status-chip-${r.documents_uploaded >= r.documents_required ? 'success' : 'warning'} ltr-num`}>
                          {r.documents_uploaded}/{r.documents_required}
                        </span>
                      </td>
                      <td className="ltr-num">{r.commitment_aed ? fmt.aed(r.commitment_aed) : '—'}</td>
                      <td><span className={statusChip(r.status)}>{statusLabel(r.status)}</span></td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr><td colSpan={6}><Empty>You have not submitted any requests yet</Empty></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
