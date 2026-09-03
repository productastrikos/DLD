import React from 'react';
import { Link } from 'react-router-dom';
import { useApi, fmt, statusChip, statusLabel } from '../services/api';
import KPICard from '../components/KPICard';
import Ring from '../components/Ring';
import { TrendChart, BarsChart, ChartPanel, ShareBars } from '../components/charts';
import { Loading, ErrorState } from '../components/States';
import { useSearch, useKpi } from '../App';
import { useI18n } from '../i18n';
import {
  IcoPeople, IcoClock, IcoCheck, IcoMegaphone, IcoHandshake, IcoTrendUp, IcoTarget, IcoDollar,
  IcoSpark, IcoChevron, IcoAward, IcoInbox, IcoActivity, IcoTicket, IcoShield, IcoBuilding, IcoCrane,
} from '../components/icons';

/** Groups the tile grid so a reader can navigate by question, not by scanning. */
function SectionLabel({ title, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '0 0 10px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, fontWeight: 750, color: 'var(--app-text)', letterSpacing: '-0.01em' }}>{title}</span>
      <span style={{ fontSize: 11, color: 'var(--app-text-faint)' }}>{note}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--app-border)', minWidth: 20 }} />
    </div>
  );
}

/** Partner tier badge — the gamified ranking that gives the leaderboard stakes. */
const TIER_BADGE = {
  Platinum: { tone: 'accent', min: 88 },
  Gold:     { tone: 'sand',   min: 74 },
  Silver:   { tone: 'teal',   min: 58 },
  Bronze:   { tone: 'muted',  min: 0 },
};
const badgeFor = (score) =>
  score >= 88 ? 'Platinum' : score >= 74 ? 'Gold' : score >= 58 ? 'Silver' : 'Bronze';

/**
 * Screen 1 — Executive Smart Dashboard & Analytics.
 * A row of high-level KPI summary cards, then the interactive charts that
 * support data-driven decision-making and ROI measurement.
 */
export default function DldDashboard() {
  const { data, error } = useApi('/dld/dashboard');
  const { q } = useSearch();
  const { openKpi } = useKpi();
  const { t } = useI18n();

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label="Loading executive analytics…" />;

  const k = data.kpis;
  const partners = data.topPartners.filter((p) =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.tier.toLowerCase().includes(q.toLowerCase()));

  const h = data.health;
  const dg = data.digest;

  return (
    <>
      {/* ── Hero: one composite number, plus this week in words ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '308px 1fr', gap: 14, marginBottom: 16 }}>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ alignSelf: 'stretch', marginBottom: 10 }}>
            <div className="panel-title">Portfolio Health</div>
            <div className="panel-sub">Composite of four equally weighted pillars</div>
          </div>
          <Ring value={h.score} label={h.band} size={138} />
          <div style={{ alignSelf: 'stretch', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {h.components.map((cmp) => (
              <div key={cmp.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--app-text-muted)', fontWeight: 600 }}>{cmp.label}</span>
                  <span className="ltr-num" style={{ fontSize: 11.5, fontWeight: 750, color: 'var(--app-text)' }}>{cmp.value}</span>
                </div>
                <div className="progress-track" style={{ height: 5 }}>
                  <div className="progress-fill" style={{
                    width: `${cmp.value}%`,
                    background: cmp.value >= 80 ? 'var(--app-success)'
                      : cmp.value >= 60 ? 'var(--app-accent)'
                      : cmp.value >= 45 ? 'var(--app-warning)' : 'var(--app-danger)',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--app-text-faint)', marginTop: 3 }}>{cmp.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI-generated executive digest — purple framing, the reserved AI colour */}
        <div className="card" style={{
          padding: '15px 17px', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--app-advisory-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--app-advisory)', color: '#fff',
            }}><IcoSpark size={15} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="panel-title" style={{ color: 'var(--app-advisory)' }}>This week, generated</div>
              <div className="panel-sub">{dg.headline}</div>
            </div>
            <Link to="/dld/copilot" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              Ask the copilot <IcoChevron size={12} />
            </Link>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', lineHeight: 1.65, flex: 1 }}>
            {dg.paragraphs.map((p, i) => <p key={i} style={{ marginBottom: 7 }}>{p}</p>)}
          </div>

          {dg.actions.length > 0 && (
            <div style={{ marginTop: 4, paddingTop: 11, borderTop: '1px solid var(--app-border)' }}>
              <div className="panel-title" style={{ marginBottom: 8 }}>Needs a decision</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {dg.actions.map((a) => (
                  <Link key={a.label} to={a.to} style={{ textDecoration: 'none' }}>
                    <span className={`status-chip status-chip-${a.tone}`} style={{ cursor: 'pointer', padding: '5px 11px', fontSize: 10.5 }}>
                      {a.label} <IcoChevron size={10} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Every tile opens its own explainer, so no figure on this screen is
             a number without provenance. Grouped: adoption and efficiency
             first, then programme impact, then commercial, then portfolio. ── */}
      {/* Six headline numbers only. Everything else has a module of its own. */}
      <div className="grid-kpi" style={{ marginBottom: 18 }}>
        <KPICard kpiId="registeredPartners" onClick={() => openKpi('registeredPartners')}
          label={t('Registered Partners')} value={fmt.int(k.registeredPartners)}
          icon={<IcoPeople size={17} />} trend={k.adoptionTrend}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{k.activePartners}</strong> {t('active')} · {fmt.pct(k.activePct)} {t('of ecosystem')}</>}
        />
        <KPICard kpiId="avgApprovalDays" onClick={() => openKpi('avgApprovalDays')}
          label={t('Avg. Approval Time')} value={k.avgApprovalDays} unit={t('days')} tone="teal"
          icon={<IcoClock size={17} />} trend={-k.approvalTrend}
          foot={<>{t('SLA compliance')} <strong style={{ color: 'var(--app-text-muted)' }}>{k.slaCompliance}%</strong></>}
        />
        <KPICard kpiId="campaignsActive" onClick={() => openKpi('campaignsActive')}
          label={t('Active Campaigns')} value={fmt.int(k.campaignsActive)}
          icon={<IcoMegaphone size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{k.campaignsCompleted}</strong> {t('completed to date')}</>}
        />
        <KPICard kpiId="totalReach" onClick={() => openKpi('totalReach')}
          label={t('Total Campaign Reach')} value={fmt.compact(k.totalReach)}
          icon={<IcoTarget size={17} />}
          foot={<>{t('Avg. engagement')} <strong style={{ color: 'var(--app-text-muted)' }}>{fmt.pct(k.avgEngagement)}</strong></>}
        />
        <KPICard kpiId="activeAgreements" onClick={() => openKpi('activeAgreements')}
          label={t('Active Agreements')} value={fmt.int(k.activeAgreements)} tone="sand"
          icon={<IcoHandshake size={17} />}
          foot={<>{t('Contracted')} <strong style={{ color: 'var(--app-text-muted)' }}>{fmt.aed(k.sponsorshipValue)}</strong></>}
        />
        <KPICard kpiId="blendedRoi" onClick={() => openKpi('blendedRoi')}
          label={t('Blended Sponsorship ROI')} value={fmt.pct(k.blendedRoi)} tone="sand"
          icon={<IcoDollar size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{k.flaggedAgreements}</strong> {t('agreements flagged by AI')}</>}
        />
      </div>

      {/* Detail lives in the analytics modules, linked from here — an executive
          dashboard that shows everything shows nothing. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        {[
          ['/dld/engagement', t('Engagement Analytics'), t('Adoption, efficiency, satisfaction and throughput')],
          ['/dld/commercial', t('Commercial Performance'), t('Delivery, collection, agreements and event return')],
          ['/dld/partners', t('Partner Directory'), t('The register behind every number on this page')],
        ].map(([to, label, note]) => (
          <Link key={to} to={to} className="card" style={{
            flex: '1 1 260px', padding: '13px 15px', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 11,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-accent)' }}>{label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 2 }}>{note}</div>
            </div>
            <span style={{ color: 'var(--app-text-faint)', display: 'flex' }}><IcoChevron size={14} /></span>
          </Link>
        ))}
      </div>

      {/* ── Strategic impact: growth over time ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 14, marginBottom: 14 }}>
        <ChartPanel
          title="Strategic Impact — Ecosystem Growth"
          note="Registered vs. active partners and live partnerships, month over month">
          <TrendChart
            data={data.trend} xKey="month" height={248} area
            series={[
              { key: 'registered', label: 'Registered partners' },
              { key: 'active', label: 'Active partners' },
              { key: 'partnerships', label: 'Active partnerships' },
            ]}
            fmt={(v) => fmt.int(v)}
          />
        </ChartPanel>

        <ChartPanel
          title="Adoption by Developer Tier"
          note="Where the ecosystem's engagement actually sits">
          <BarsChart
            data={data.byTier} xKey="tier" height={248} layout="horizontal"
            series={[
              { key: 'partners', label: 'Registered' },
              { key: 'active', label: 'Active' },
            ]}
            fmt={(v) => fmt.int(v)}
          />
        </ChartPanel>
      </div>

      {/* ── Efficiency tracker: two units → two charts, never a second axis ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 14 }}>
        <ChartPanel
          title="Efficiency — Approval Time"
          note="Average days from submission to decision (lower is better)">
          <TrendChart
            data={data.trend} xKey="month" height={190} unit=" days"
            series={[{ key: 'approvalDays', label: 'Avg. approval days' }]}
            fmt={(v) => v}
          />
        </ChartPanel>

        <ChartPanel
          title="Efficiency — Digital Completion"
          note="Share of partner transactions completed entirely on-platform">
          <TrendChart
            data={data.trend} xKey="month" height={190} unit="%" area
            series={[{ key: 'digitalPct', label: 'Digitally completed' }]}
            fmt={(v) => v}
          />
        </ChartPanel>

        <ChartPanel
          title="Request Throughput"
          note="Submitted vs. approved participation requests per month">
          <TrendChart
            data={data.trend} xKey="month" height={190}
            series={[
              { key: 'submitted', label: 'Submitted' },
              { key: 'approved', label: 'Approved' },
            ]}
            fmt={(v) => fmt.int(v)}
          />
        </ChartPanel>
      </div>

      {/* ── Programme mix + engagement leaderboard ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 14 }}>
        <ChartPanel title="Programme Mix" note="Reach generated by programme format">
          <div style={{ paddingTop: 4 }}>
            <ShareBars
              rows={data.campaignMix.map((m) => ({
                label: m.type.charAt(0).toUpperCase() + m.type.slice(1) + 's',
                value: m.reach,
                sub: `${m.count} programme${m.count === 1 ? '' : 's'}`,
              }))}
              fmt={(v) => fmt.compact(v)}
            />
          </div>
        </ChartPanel>

        <div className="card" style={{ padding: '15px 16px 6px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ marginBottom: 10 }}>
            <div className="panel-title">Partner Leaderboard</div>
            <div className="panel-sub">
              Ranked by engagement · partner grade is earned from the score, not assigned
            </div>
          </div>
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Developer</th><th>Grade</th><th>Engagement</th>
                  <th>Participations</th><th>Sponsorships</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p, i) => {
                  const grade = badgeFor(p.engagement);
                  return (
                  <tr key={p.developer_id}>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 21, height: 21, borderRadius: 99, fontSize: 10, fontWeight: 750,
                        background: i < 3 ? 'var(--app-sand-bg)' : 'var(--app-surface-raised)',
                        color: i < 3 ? 'var(--app-sand)' : 'var(--app-text-faint)',
                      }} className="ltr-num">{i + 1}</span>
                    </td>
                    <td style={{ color: 'var(--app-text)', fontWeight: 600 }}>{p.name}</td>
                    <td>
                      <span className={`status-chip status-chip-${TIER_BADGE[grade].tone}`} title={`${p.tier} · engagement ${p.engagement}`}>
                        <IcoAward size={10} />{grade}
                      </span>
                    </td>
                    <td style={{ minWidth: 128 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-track" style={{ flex: 1, minWidth: 56 }}>
                          <div className="progress-fill" style={{ width: `${p.engagement}%` }} />
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--app-text)', fontSize: 11 }} className="ltr-num">{p.engagement}</span>
                      </div>
                    </td>
                    <td className="ltr-num">{p.participations}</td>
                    <td className="ltr-num">{p.sponsorships}</td>
                    <td><span className={statusChip(p.status)}>{statusLabel(p.status)}</span></td>
                  </tr>
                  );
                })}
                {partners.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state">No partners match “{q}”</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
