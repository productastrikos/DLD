import React, { useState, useMemo, useEffect } from 'react';
import { useApi, fetchApi, fmt, statusChip, statusLabel } from '../services/api';
import { Loading, ErrorState } from '../components/States';
import TwinMap from '../components/TwinMap';
import { MAP_THEME, BASEMAPS, defaultBasemapFor } from '../geo/dubai';
import { useTheme } from '../theme';
import { useSearch, useKpi } from '../App';
import { useI18n } from '../i18n';
import KPICard from '../components/KPICard';
import {
  IcoClose, IcoLayers, IcoBuilding, IcoPin, IcoDollar, IcoAlert,
  IcoTarget, IcoCalendar, IcoChevron, IcoCrane, IcoMap, IcoCube,
  IcoPeople, IcoKey, IcoLeaf,
} from '../components/icons';

/**
 * Digital Twin — the geospatial view of the partner ecosystem.
 *
 * One component serves both twins. `mode="2d"` is the analytical map: clustered
 * projects, heatmap overlays and a quarter-by-quarter time slider. `mode="3d"`
 * pitches the same scene and extrudes each project to its real height, which
 * reads as a city model while remaining the same data underneath.
 */

/* Labels run through t() at render, so the control deck switches language with
   the rest of the interface. */
const COLOR_BY = [
  { id: 'status', label: 'Engagement status' },
  { id: 'engagement', label: 'Engagement score' },
  { id: 'roi', label: 'Sponsorship ROI' },
];

const LAYER_DEFS = [
  { id: 'districts', label: 'District outlines', note: 'Community boundaries and names' },
  { id: 'campaignHeat', label: 'Campaign heatmap', note: 'Density of live campaign activity' },
  { id: 'sponsorshipHeat', label: 'Sponsorship density', note: 'Weighted by committed value' },
  { id: 'events', label: 'Events & exhibitions', note: 'Venue locations on the calendar' },
];

export default function DigitalTwin() {
  const { data, error } = useApi('/twin');
  const { theme } = useTheme();
  const { q } = useSearch();
  const { openKpi } = useKpi();
  const { t } = useI18n();

  // Seeded from the app theme, then owned by the map: switching the app to dark
  // moves the map with it, but an explicit choice on the map is not overridden.
  const [basemap, setBasemap] = useState(() => defaultBasemapFor(theme));
  const [basemapPinned, setBasemapPinned] = useState(false);
  useEffect(() => {
    if (!basemapPinned) setBasemap(defaultBasemapFor(theme));
  }, [theme, basemapPinned]);

  const [colorBy, setColorBy] = useState('status');
  const [layers, setLayers] = useState({ districts: true, campaignHeat: false, sponsorshipHeat: false, events: false });
  const [quarterIdx, setQuarterIdx] = useState(null);   // null = all time
  const [selected, setSelected] = useState(null);        // clicked project
  const [detail, setDetail] = useState(null);            // developer drill-down
  const [detailLoading, setDetailLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Legend swatches must match what is actually painted on the map, which
  // follows the basemap rather than the application theme.
  const c = MAP_THEME[basemap] || MAP_THEME.light;

  /* Time slider playback — steps a quarter at a time, then stops at the end. */
  useEffect(() => {
    if (!playing || !data) return;
    const t = setInterval(() => {
      setQuarterIdx((i) => {
        const next = (i === null ? 0 : i + 1);
        if (next >= data.quarters.length) { setPlaying(false); return null; }
        return next;
      });
    }, 900);
    return () => clearInterval(t);
  }, [playing, data]);

  /* The quarter filter is applied to the data rather than as a map filter:
     clustering happens after filtering, so cluster counts stay truthful. */
  const visibleProjects = useMemo(() => {
    if (!data) return [];
    let rows = data.projects;
    if (quarterIdx !== null && data.quarters[quarterIdx]) {
      const engaged = new Set(data.quarters[quarterIdx].engaged);
      rows = rows.filter((p) => engaged.has(p.developer_id));
    }
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((p) =>
        p.name.toLowerCase().includes(needle) ||
        p.developer_name.toLowerCase().includes(needle) ||
        p.district.toLowerCase().includes(needle));
    }
    return rows;
  }, [data, quarterIdx, q]);

  /* Clicking a project loads the full developer record for the side panel. */
  const openDeveloper = async (developerId) => {
    setDetailLoading(true);
    try { setDetail(await fetchApi(`/twin/developer/${developerId}`)); }
    catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label="Building the digital twin…" />;

  const s = data.summary;
  const quarter = quarterIdx !== null ? data.quarters[quarterIdx] : null;
  const shown = visibleProjects.length;

  const toggle = (id) => setLayers((L) => ({ ...L, [id]: !L[id] }));

  const legend = colorBy === 'status'
    ? [
        { color: c.state.active, label: 'Actively engaged', count: s.active },
        { color: c.state.at_risk, label: 'At risk / flagged', count: s.at_risk },
        { color: c.state.inactive, label: 'No live engagement', count: s.inactive },
      ]
    : colorBy === 'engagement'
      ? c.ramp.map((col, i) => ({ color: col, label: `${i * 25}–${(i + 1) * 25}`, count: null }))
      : [
          { color: c.roi[0], label: 'Negative return', count: null },
          { color: c.roi[1], label: 'Below target', count: null },
          { color: c.roi[2], label: 'On target', count: null },
          { color: c.roi[3], label: 'Strong', count: null },
          { color: c.roi[4], label: 'Exceptional', count: null },
        ];

  return (
    <>
      {/* ── KPI tiles first, map below — each tile opens its own explainer ── */}
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <KPICard kpiId="portfolioValue" onClick={() => openKpi('portfolioValue')}
          label={t('Mapped Portfolio Value')} value={fmt.aed(s.value_aed)} icon={<IcoDollar size={17} />}
          foot={<><strong style={{ color: 'var(--app-text-muted)' }}>{fmt.compact(s.units)}</strong> units across {s.districts} districts</>} />
        <KPICard kpiId="portfolioValue" onClick={() => openKpi('portfolioValue')}
          label={t('Mapped Projects')} value={fmt.int(s.projects)} icon={<IcoBuilding size={17} />}
          foot={shown !== s.projects
            ? <><strong style={{ color: 'var(--app-text-muted)' }}>{fmt.int(shown)}</strong> shown under current filter</>
            : <>From <strong style={{ color: 'var(--app-text-muted)' }}>{s.developers}</strong> partner organisations</>} />
        <KPICard kpiId="meanEngagement" onClick={() => openKpi('meanEngagement')}
          label={t('Actively Engaged')} value={fmt.int(s.active)} tone="teal" icon={<IcoTarget size={17} />}
          foot={<>{fmt.pct((s.active / Math.max(1, s.projects)) * 100, 0)} of the mapped portfolio</>} />
        <KPICard kpiId="blendedRoi" onClick={() => openKpi('blendedRoi')}
          label={t('At Risk')} value={fmt.int(s.at_risk)} tone="sand" icon={<IcoAlert size={17} />}
          foot="Projects whose partner trips an anomaly rule" />
        <KPICard kpiId="portfolioValue" onClick={() => openKpi('portfolioValue')}
          label={t('Under Construction')} value={fmt.int(s.under_construction)} tone="teal" icon={<IcoCrane size={17} />}
          foot="Live delivery pipeline across the emirate" />
        <KPICard kpiId="registeredPartners" onClick={() => openKpi('registeredPartners')}
          label={t('Partners on the Map')} value={fmt.int(s.developers)} icon={<IcoPeople size={17} />}
          foot={<>Averaging <strong style={{ color: 'var(--app-text-muted)' }}>{Math.round(s.projects / Math.max(1, s.developers))}</strong> mapped projects each</>} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detail || selected ? '1fr 372px' : '1fr', gap: 12 }}>
        {/* ── Map ── */}
        <div className="twin-shell" style={{ height: 'calc(100vh - 258px)', minHeight: 460 }}>
          <TwinMap
            projects={visibleProjects}
            districts={data.districts}
            events={data.events}
            basemap={basemap}
            colorBy={colorBy}
            layers={layers}
            selectedId={selected?.project_id}
            onSelect={(p) => { setSelected(p); openDeveloper(p.developer_id); }}
          />

          {/* Basemap switcher — the map carries its own light/dark choice,
              seeded from the app theme but independent of it, because
              satellite has no light or dark equivalent. */}
          <div className="twin-panel" style={{ top: 12, insetInlineEnd: 12, padding: 5 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {Object.values(BASEMAPS).map((b) => (
                <button key={b.id} onClick={() => { setBasemap(b.id); setBasemapPinned(true); }}
                  className={`seg-btn${basemap === b.id ? ' is-active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px' }}>
                  <span style={{
                    width: 11, height: 11, borderRadius: 3, flexShrink: 0,
                    border: '1px solid rgba(128,128,128,0.5)',
                    background: b.id === 'light' ? '#e8e8e8'
                      : b.id === 'dark' ? '#3a3d42'
                      : 'linear-gradient(135deg,#5b7c4a,#8a7f5c)',
                  }} />
                  {t(b.label)}
                </button>
              ))}
            </div>
          </div>

          {/* Layer + colour controls */}
          <div className="twin-panel" style={{ top: 12, left: 12, width: 232, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
              <span style={{ color: 'var(--app-accent)', display: 'flex' }}><IcoLayers size={14} /></span>
              <span className="panel-title">{t('Layers')}</span>
            </div>

            <div className="field-label" style={{ marginBottom: 5 }}>{t('Colour projects by')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 11 }}>
              {COLOR_BY.map((o) => (
                <button key={o.id} onClick={() => setColorBy(o.id)}
                  className={`twin-toggle${colorBy === o.id ? ' is-on' : ''}`}>
                  <span style={{
                    width: 13, height: 13, borderRadius: 99, flexShrink: 0,
                    border: `2px solid ${colorBy === o.id ? 'var(--app-accent)' : 'var(--app-border)'}`,
                    background: colorBy === o.id ? 'var(--app-accent)' : 'transparent',
                    boxShadow: colorBy === o.id ? 'inset 0 0 0 2px var(--app-panel)' : 'none',
                  }} />
                  {t(o.label)}
                </button>
              ))}
            </div>

            <div className="field-label" style={{ marginBottom: 5 }}>{t('Overlays')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {LAYER_DEFS.map((l) => (
                <button key={l.id} title={l.note} onClick={() => toggle(l.id)}
                  className={`twin-toggle${layers[l.id] ? ' is-on' : ''}`}>
                  <span className="twin-switch" />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(l.label)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="twin-panel" style={{ bottom: 12, left: 12, padding: '10px 12px', minWidth: 178 }}>
            <div className="panel-title" style={{ marginBottom: 7 }}>
              {t(COLOR_BY.find((o) => o.id === colorBy).label)}
            </div>
            {legend.map((row) => (
              <div key={row.label} className="twin-legend-row">
                <span className="twin-swatch" style={{ background: row.color }} />
                <span style={{ flex: 1 }}>{t(row.label)}</span>
                {row.count !== null && (
                  <span className="ltr-num" style={{ fontWeight: 700, color: 'var(--app-text)' }}>{row.count}</span>
                )}
              </div>
            ))}
            {layers.events && (
              <div className="twin-legend-row" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--app-border)' }}>
                <span className="twin-swatch" style={{ background: c.event, borderRadius: 99 }} />
                <span style={{ flex: 1 }}>{t('Event venue')}</span>
              </div>
            )}
          </div>

          {/* Time slider */}
          <div className="twin-panel" style={{ bottom: 12, right: 12, width: 328, padding: '11px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
              <span className="panel-title">{t('Partnership timeline')}</span>
              <div style={{ display: 'flex', gap: 5 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPlaying((p) => !p)}>
                  {playing ? t('Pause') : t('Play')}
                </button>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => { setPlaying(false); setQuarterIdx(null); }}
                  disabled={quarterIdx === null}>{t('All time')}</button>
              </div>
            </div>
            <input
              className="twin-slider" type="range" min={0} max={data.quarters.length - 1}
              value={quarterIdx === null ? data.quarters.length - 1 : quarterIdx}
              onChange={(e) => { setPlaying(false); setQuarterIdx(+e.target.value); }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--app-text)' }}>
                {quarter ? quarter.label : t('All time')}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }} className="ltr-num">
                {quarter
                  ? `${quarter.partners} partners · ${quarter.campaigns} programmes · ${fmt.aed(quarter.value_aed)}`
                  : `${s.developers} partners · full portfolio`}
              </span>
            </div>
          </div>
        </div>

        {/* ── Drill-down panel ── */}
        {(selected || detail) && (
          <DetailPanel
            project={selected} detail={detail} loading={detailLoading}
            onClose={() => { setSelected(null); setDetail(null); }}
          />
        )}
      </div>
    </>
  );
}

/* ── Compact stat tile for the summary strip ── */
function Stat({ icon, label, value, foot, tone = 'accent' }) {
  return (
    <div className="card" style={{ padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 27, height: 27, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `var(--app-${tone}-bg)`, color: `var(--app-${tone})`,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--app-text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 750, color: 'var(--app-text)', lineHeight: 1.25, marginTop: 1 }} className="ltr-num">{value}</div>
        {foot && <div style={{ fontSize: 10, color: 'var(--app-text-faint)', marginTop: 1 }}>{foot}</div>}
      </div>
    </div>
  );
}

/* ── Side panel: the clicked project, then everything about its developer ── */
function DetailPanel({ project, detail, loading, onClose }) {
  const [tab, setTab] = useState('overview');
  const d = detail?.developer;

  return (
    <div className="card" style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 258px)', minHeight: 460, overflow: 'hidden',
    }}>
      <div style={{
        padding: '13px 15px', borderBottom: '1px solid var(--app-border)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--app-text)', lineHeight: 1.25 }}>
            {project?.name || d?.name || '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--app-text-faint)', marginTop: 2 }}>
            {project ? `${project.developer_name} · ${project.district}` : d?.district}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose}><IcoClose size={15} /></button>
      </div>

      {loading && <Loading label="Loading partner record…" />}

      {!loading && (
        <>
          {project && (
            <div style={{ padding: '12px 15px', borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-soft)' }}>
              <div className="panel-title" style={{ marginBottom: 8 }}>Project</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                <Field label="Status" value={<span className={statusChip(project.status === 'under_construction' ? 'review' : project.status === 'completed' ? 'completed' : project.status === 'handover' ? 'active' : 'draft')}>{statusLabel(project.status)}</span>} />
                <Field label="Type" value={project.type} />
                <Field label="Units" value={fmt.int(project.units)} />
                <Field label="Floors" value={`${project.floors} · ${project.height_m}m`} />
                <Field label="Value" value={fmt.aed(project.value_aed)} />
                <Field label="Sold" value={fmt.pct(project.sold_pct, 0)} />
                <Field label="Sustainability" value={project.sustainability} span />
              </div>
            </div>
          )}

          {d && (
            <>
              <div style={{ display: 'flex', gap: 4, padding: '9px 15px 0' }}>
                {['overview', 'campaigns', 'agreements', 'projects'].map((t) => (
                  <button key={t} className={`seg-btn${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}
                    style={{ textTransform: 'capitalize' }}>{t}</button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 15px 16px' }}>
                {tab === 'overview' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 12px', marginBottom: 14 }}>
                      <Field label="Tier" value={d.tier} />
                      <Field label="Status" value={<span className={statusChip(d.status)}>{statusLabel(d.status)}</span>} />
                      <Field label="Engagement" value={`${d.engagement_score} / 100`} />
                      <Field label="Last active" value={`${d.days_since_login}d ago`} />
                      <Field label="Mapped projects" value={d.mapped_projects} />
                      <Field label="Portfolio units" value={fmt.int(d.portfolio_units)} />
                      <Field label="Portfolio value" value={fmt.aed(d.portfolio_value_aed)} span />
                      <Field label="Primary contact" value={d.contact_name} span />
                    </div>

                    {detail.flags.length > 0 && (
                      <div style={{
                        border: '1px solid var(--app-danger-border)', background: 'var(--app-danger-bg)',
                        borderRadius: 11, padding: 12,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                          <span style={{ color: 'var(--app-danger)', display: 'flex' }}><IcoAlert size={14} /></span>
                          <span className="panel-title" style={{ color: 'var(--app-danger)' }}>
                            {detail.flags.length} risk flag{detail.flags.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {detail.flags.map((f) => (
                          <div key={f.agreement_id} style={{ marginTop: 7 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 650, color: 'var(--app-text)' }}>{f.agreement_id}</div>
                            {f.reasons.map((r, i) => (
                              <div key={i} style={{ fontSize: 11, color: 'var(--app-text-muted)', marginTop: 2, lineHeight: 1.45 }}>· {r}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {tab === 'campaigns' && (
                  <List rows={detail.campaigns} empty="No participations yet"
                    render={(r) => (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--app-text)' }}>{r.campaign_title}</span>
                          <span className={statusChip(r.status)}>{statusLabel(r.status)}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 3 }} className="ltr-num">
                          {r.campaign_type} · {r.leads} leads · {fmt.aed(r.commitment_aed)}
                        </div>
                      </>
                    )} />
                )}

                {tab === 'agreements' && (
                  <List rows={detail.agreements} empty="No sponsorship agreements"
                    render={(r) => (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--app-text)' }}>{r.tier}</span>
                          <span className={statusChip(r.status)}>{statusLabel(r.status)}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', margin: '3px 0 5px' }} className="ltr-num">
                          {fmt.aed(r.value_aed)} · ROI {fmt.pct(r.roi_percent)} · {r.commitments} commitments
                        </div>
                        <div className="progress-track"><div className="progress-fill" style={{ width: `${r.commitment_pct}%` }} /></div>
                      </>
                    )} />
                )}

                {tab === 'projects' && (
                  <List rows={detail.projects} empty="No mapped projects"
                    render={(r) => (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--app-text)' }}>{r.name}</span>
                          <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>{r.district}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 3 }} className="ltr-num">
                          {r.type} · {fmt.int(r.units)} units · {fmt.aed(r.value_aed)} · {r.sold_pct}% sold
                        </div>
                      </>
                    )} />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, value, span }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--app-text)', marginTop: 2, textTransform: label === 'Type' ? 'capitalize' : 'none' }}>{value}</div>
    </div>
  );
}

function List({ rows, render, empty }) {
  if (!rows?.length) return <div className="empty-state">{empty}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--app-border)', background: 'var(--app-surface-soft)',
        }}>{render(r)}</div>
      ))}
    </div>
  );
}
