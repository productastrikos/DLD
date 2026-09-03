import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState, Empty } from '../components/States';
import { useI18n } from '../i18n';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import { BarsChart, ChartPanel, ShareBars } from '../components/charts';
import { useSearch, useKpi } from '../App';
import {
  IcoPeople, IcoAward, IcoDollar, IcoAlert, IcoBuilding, IcoHandshake,
  IcoClock, IcoTarget, IcoGlobe, IcoChevron, IcoGrid, IcoList, IcoTicket,
} from '../components/icons';

/**
 * Partner Directory — the register of the developer ecosystem.
 *
 * The dashboard leaderboard shows the top eight and the twin shows whoever has
 * projects on screen; neither answers "who are our partners, and what is our
 * relationship with each one". This screen does, and it is the natural landing
 * point for the account managers who own those relationships.
 */

const GRADE_TONE = { Platinum: 'accent', Gold: 'sand', Silver: 'teal', Bronze: 'muted' };
const RISK_TONE = { high: 'danger', medium: 'warning', none: 'success' };

export default function PartnerDirectory() {
  const { data, error } = useApi('/dld/partners');
  const { t } = useI18n();
  const { q } = useSearch();
  const { openKpi } = useKpi();
  const navigate = useNavigate();

  const [view, setView] = useState('cards');
  const [tier, setTier] = useState('all');
  const [grade, setGrade] = useState('all');
  const [risk, setRisk] = useState('all');
  const [sort, setSort] = useState('engagement');
  const [detail, setDetail] = useState(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    const filtered = data.partners.filter((p) =>
      (tier === 'all' || p.tier === tier) &&
      (grade === 'all' || p.grade === grade) &&
      (risk === 'all' || (risk === 'flagged' ? p.risk !== 'none' : risk === 'dormant' ? p.days_since_login >= 45 : true)) &&
      (!term || p.name.toLowerCase().includes(term) || p.district.toLowerCase().includes(term)
        || p.contact_name.toLowerCase().includes(term) || p.tier.toLowerCase().includes(term)));

    const key = {
      engagement: (a, b) => b.engagement_score - a.engagement_score,
      value: (a, b) => b.contracted_aed - a.contracted_aed,
      roi: (a, b) => b.roi_percent - a.roi_percent,
      portfolio: (a, b) => b.portfolio_aed - a.portfolio_aed,
      idle: (a, b) => b.days_since_login - a.days_since_login,
      name: (a, b) => a.name.localeCompare(b.name),
    }[sort];
    return [...filtered].sort(key);
  }, [data, q, tier, grade, risk, sort]);

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label={t('Loading partner directory…')} />;

  const s = data.summary;
  const tiers = ['all', ...new Set(data.partners.map((p) => p.tier))];

  return (
    <>
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <KPICard kpiId="registeredPartners" onClick={() => openKpi('registeredPartners')}
          label={t('Registered Partners')} value={fmt.int(s.total)} icon={<IcoPeople size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{s.active}</strong> active organisations</>} />
        <KPICard kpiId="meanEngagement" onClick={() => openKpi('meanEngagement')}
          label={t('Mean Engagement')} value={s.meanEngagement} unit="/ 100" icon={<IcoAward size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{s.byGrade[0].count}</strong> at Platinum grade</>} />
        <KPICard kpiId="meanEngagement" onClick={() => openKpi('meanEngagement')}
          label={t('Dormant Partners')} value={fmt.int(s.dormant)} tone="sand" icon={<IcoClock size={17} />}
          foot="No platform activity for 45 days or more" />
        <KPICard kpiId="activeAgreements" onClick={() => openKpi('activeAgreements')}
          label={t('Contracted With Partners')} value={fmt.aed(s.contracted)} tone="sand" icon={<IcoDollar size={17} />}
          foot="Across every sponsorship agreement" />
        <KPICard kpiId="portfolioValue" onClick={() => openKpi('portfolioValue')}
          label={t('Combined Portfolio')} value={fmt.aed(s.portfolio)} tone="teal" icon={<IcoBuilding size={17} />}
          foot="Declared value of partner developments" />
        <KPICard kpiId="blendedRoi" onClick={() => openKpi('blendedRoi')}
          label={t('Partners Needing Attention')} value={fmt.int(s.atRisk)} tone="sand" icon={<IcoAlert size={17} />}
          foot="Tripping at least one commercial risk rule" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <ChartPanel title="Partner Grades" note="Grade is earned from the engagement score, not assigned">
          <BarsChart
            data={s.byGrade} xKey="grade" height={180} colorByIndex
            series={[{ key: 'count', label: 'Partners' }]} fmt={(v) => fmt.int(v)}
          />
        </ChartPanel>
        <ChartPanel title="Contracted Value by Tier" note="Where the commercial relationship is concentrated">
          <div style={{ paddingTop: 6 }}>
            <ShareBars
              rows={s.byTier.map((t) => ({
                label: t.tier, value: t.contracted,
                sub: `${t.count} partner${t.count === 1 ? '' : 's'}`,
              }))}
              fmt={(v) => fmt.aed(v)}
            />
          </div>
        </ChartPanel>
      </div>

      <div className="page-header-block">
        <div>
          <div className="page-title">Partner Register</div>
          <div className="page-subtitle">
            {rows.length} of {data.partners.length} organisations{q ? ` matching “${q}”` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="field-input" value={tier} onChange={(e) => setTier(e.target.value)}
            style={{ width: 'auto', height: 32, fontSize: 12, cursor: 'pointer' }}>
            {tiers.map((t) => <option key={t} value={t}>{t === 'all' ? 'All tiers' : t}</option>)}
          </select>
          <select className="field-input" value={grade} onChange={(e) => setGrade(e.target.value)}
            style={{ width: 'auto', height: 32, fontSize: 12, cursor: 'pointer' }}>
            {['all', 'Platinum', 'Gold', 'Silver', 'Bronze'].map((g) => (
              <option key={g} value={g}>{g === 'all' ? 'All grades' : g}</option>
            ))}
          </select>
          <select className="field-input" value={risk} onChange={(e) => setRisk(e.target.value)}
            style={{ width: 'auto', height: 32, fontSize: 12, cursor: 'pointer' }}>
            <option value="all">Everyone</option>
            <option value="flagged">Flagged only</option>
            <option value="dormant">Dormant only</option>
          </select>
          <select className="field-input" value={sort} onChange={(e) => setSort(e.target.value)}
            style={{ width: 'auto', height: 32, fontSize: 12, cursor: 'pointer' }}>
            <option value="engagement">Sort: engagement</option>
            <option value="value">Sort: contracted value</option>
            <option value="roi">Sort: ROI</option>
            <option value="portfolio">Sort: portfolio size</option>
            <option value="idle">Sort: longest inactive</option>
            <option value="name">Sort: name</option>
          </select>
          <div className="seg">
            <button className={`seg-btn${view === 'cards' ? ' is-active' : ''}`} onClick={() => setView('cards')}>
              <IcoGrid size={12} /> Cards
            </button>
            <button className={`seg-btn${view === 'table' ? ' is-active' : ''}`} onClick={() => setView('table')}>
              <IcoList size={12} /> Table
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? <div className="card card-pad"><Empty>No partners match these filters</Empty></div>
        : view === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {rows.map((p) => (
            <button key={p.developer_id} onClick={() => setDetail(p)} className="card"
              style={{ padding: '14px 15px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--app-panel-border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, var(--app-accent), var(--app-teal))',
                  color: '#fff', fontWeight: 750, fontSize: 13,
                }}>{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.3 }}>{p.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 2 }}>
                    {p.tier} · {p.district}
                  </div>
                </div>
                <span className={`status-chip status-chip-${GRADE_TONE[p.grade]}`}>
                  <IcoAward size={9} />{p.grade}
                </span>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--app-text-faint)', marginBottom: 4 }}>
                  <span>Engagement</span>
                  <span className="ltr-num" style={{ fontWeight: 700, color: 'var(--app-text)' }}>{p.engagement_score}/100</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${p.engagement_score}%` }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                <Mini label={t('Programmes')} value={p.participations} />
                <Mini label={t('Agreements')} value={p.agreements} />
                <Mini label={t('Projects')} value={p.projects} />
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap',
                paddingTop: 9, borderTop: '1px solid var(--app-border-soft)',
              }}>
                <span className={statusChip(p.status)}>{statusLabel(p.status)}</span>
                {p.risk !== 'none' && (
                  <span className={`status-chip status-chip-${RISK_TONE[p.risk]}`}>
                    <IcoAlert size={9} />{p.flags} flag{p.flags === 1 ? '' : 's'}
                  </span>
                )}
                {p.days_since_login >= 45 && (
                  <span className="status-chip status-chip-warning ltr-num">{p.days_since_login}d idle</span>
                )}
                <span className="ltr-num" style={{ marginInlineStart: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--app-text)' }}>
                  {fmt.aed(p.contracted_aed)}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: '62vh' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Partner</th><th>Tier</th><th>Grade</th><th>Engagement</th>
                  <th>Programmes</th><th>Agreements</th><th>Contracted</th><th>ROI</th>
                  <th>Projects</th><th>Last active</th><th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.developer_id} className="clickable" onClick={() => setDetail(p)}>
                    <td style={{ color: 'var(--app-text)', fontWeight: 600 }}>{p.name}</td>
                    <td>{p.tier}</td>
                    <td><span className={`status-chip status-chip-${GRADE_TONE[p.grade]}`}>{p.grade}</span></td>
                    <td className="ltr-num">{p.engagement_score}</td>
                    <td className="ltr-num">{p.participations}</td>
                    <td className="ltr-num">{p.agreements}</td>
                    <td className="ltr-num">{p.contracted_aed ? fmt.aed(p.contracted_aed) : '—'}</td>
                    <td className="ltr-num" style={{ fontWeight: 700, color: p.roi_percent >= 0 ? 'var(--app-success)' : 'var(--app-danger)' }}>
                      {p.agreements ? fmt.pct(p.roi_percent) : '—'}
                    </td>
                    <td className="ltr-num">{p.projects}</td>
                    <td className="ltr-num">{p.days_since_login}d ago</td>
                    <td>
                      {p.risk === 'none'
                        ? <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>—</span>
                        : <span className={`status-chip status-chip-${RISK_TONE[p.risk]}`}>{p.flags}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Partner 360 ── */}
      <Modal open={!!detail} onClose={() => setDetail(null)} width={700}
        title={detail?.name} subtitle={detail ? `${detail.tier} · ${detail.district} · partner since ${fmt.date(detail.registered_date)}` : ''}
        footer={detail && (
          <>
            <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
            <button className="btn btn-primary" onClick={() => { setDetail(null); navigate('/dld/twin'); }}>
              <IcoGlobe size={13} />View on the map
            </button>
          </>
        )}>
        {detail && (
          <>
            <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
              <span className={`status-chip status-chip-${GRADE_TONE[detail.grade]}`}><IcoAward size={9} />{detail.grade}</span>
              <span className={statusChip(detail.status)}>{statusLabel(detail.status)}</span>
              <span className="status-chip status-chip-muted" style={{ textTransform: 'none' }}>{detail.name_ar}</span>
              {detail.risk !== 'none' && (
                <span className={`status-chip status-chip-${RISK_TONE[detail.risk]}`}>
                  <IcoAlert size={9} />{detail.flags} risk flag{detail.flags === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                ['Engagement', `${detail.engagement_score} / 100`],
                ['Last active', `${detail.days_since_login} days ago`],
                ['Programmes joined', detail.participations],
                ['Pending requests', detail.pending || '—'],
                ['Agreements', `${detail.active_agreements} live of ${detail.agreements}`],
                ['Contracted value', detail.contracted_aed ? fmt.aedFull(detail.contracted_aed) : '—'],
                ['Mean ROI', detail.agreements ? fmt.pct(detail.roi_percent) : '—'],
                ['Leads received', fmt.int(detail.leads)],
                ['Events attended', detail.events],
                ['Mapped projects', `${detail.projects} · ${fmt.compact(detail.portfolio_units)} units`],
                ['Portfolio value', fmt.aed(detail.portfolio_aed)],
                ['Primary contact', detail.contact_name],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--app-surface-soft)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div className="ltr-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)', marginTop: 3, lineHeight: 1.35 }}>{value}</div>
                </div>
              ))}
            </div>

            {detail.live_programmes.length > 0 && (
              <>
                <div className="panel-title" style={{ marginBottom: 8 }}>Currently participating in</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {detail.live_programmes.map((t) => (
                    <span key={t} className="status-chip status-chip-teal" style={{ textTransform: 'none' }}>{t}</span>
                  ))}
                </div>
              </>
            )}

            <div style={{
              padding: '10px 13px', borderRadius: 10,
              background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)',
              fontSize: 11.5, color: 'var(--app-text-muted)', lineHeight: 1.55,
            }}>
              <strong style={{ color: 'var(--app-text)' }}>Contact:</strong> {detail.contact_name} ·{' '}
              <span className="ltr-num">{detail.contact_email}</span>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function Mini({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div className="ltr-num" style={{ fontSize: 14, fontWeight: 750, color: 'var(--app-text)' }}>{value}</div>
    </div>
  );
}
