import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, fmt } from '../services/api';
import { Loading, ErrorState } from '../components/States';
import { useSearch } from '../App';
import { IcoCheck, IcoAlert, IcoTarget, IcoChevron, IcoList } from '../components/icons';

/**
 * KPI traceability — every KPI named in the brief, mapped to the widget that
 * shows it and the value it currently reports.
 *
 * This screen exists to be audited. It is the answer to "you asked for these
 * measures; here is where each one lives and what it says today", including the
 * ones currently missing target — hiding those would defeat the purpose.
 */

const STATUS = {
  on_target:   { label: 'On target',   tone: 'success', icon: <IcoCheck size={12} /> },
  near_target: { label: 'Near target', tone: 'warning', icon: <IcoTarget size={12} /> },
  off_target:  { label: 'Off target',  tone: 'danger',  icon: <IcoAlert size={12} /> },
  tracked:     { label: 'Tracked',     tone: 'muted',   icon: null },
};

/** Values arrive raw so the client can format by unit rather than by string. */
function formatValue(k) {
  if (k.format === 'aed') return fmt.aed(k.value);
  if (k.format === 'compact') return fmt.compact(k.value);
  if (k.unit === '%') return fmt.pct(k.value);
  if (k.unit === ' days') return `${k.value} days`;
  if (k.unit === '/5' || k.unit === '/100') return `${k.value}${k.unit}`;
  if (k.unit === 'AED') return fmt.aed(k.value);
  return `${fmt.int(k.value)}${k.unit || ''}`;
}
function formatTarget(k) {
  if (k.target === null || k.target === undefined) return 'No target set';
  const dir = k.direction === 'down' ? '≤' : '≥';
  if (k.unit === '%') return `${dir} ${k.target}%`;
  if (k.unit === ' days') return `${dir} ${k.target} days`;
  if (k.unit === 'AED') return `${dir} ${fmt.aed(k.target)}`;
  return `${dir} ${k.target}${k.unit && k.unit !== ' districts' ? k.unit : k.unit || ''}`;
}

export default function KpiTraceability() {
  const { data, error } = useApi('/kpi-traceability');
  const { q } = useSearch();
  const [filter, setFilter] = useState('all');

  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading label="Mapping KPIs to screens…" />;

  const cov = data.coverage;
  const needle = q.toLowerCase();

  const groups = data.groups
    .map((g) => ({
      ...g,
      kpis: g.kpis.filter((k) =>
        (filter === 'all' || k.status === filter) &&
        (!q || k.name.toLowerCase().includes(needle) || k.definition.toLowerCase().includes(needle)
          || (k.where?.screen || '').toLowerCase().includes(needle))),
    }))
    .filter((g) => g.kpis.length);

  return (
    <>
      {/* ── Coverage summary ── */}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ color: 'var(--app-accent)', display: 'flex' }}><IcoList size={15} /></span>
              <div className="panel-title">Specification coverage</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.55, maxWidth: 620 }}>
              All <strong style={{ color: 'var(--app-text)' }}>{cov.total}</strong> KPIs named in the brief are
              measured and surfaced across <strong style={{ color: 'var(--app-text)' }}>{cov.screens}</strong> screens.
              Each row below states its definition, its current value, its target, and the exact widget that
              displays it — including the {cov.off_target} currently off target.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <Cov label="Surfaced" value={`${cov.surfaced}/${cov.total}`} tone="accent" />
            <Cov label="On target" value={cov.on_target} tone="success" />
            <Cov label="Near target" value={cov.near_target} tone="warning" />
            <Cov label="Off target" value={cov.off_target} tone="danger" />
            <Cov label="No target" value={cov.tracked_no_target} tone="muted" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginTop: 14, flexWrap: 'wrap' }}>
          {['all', 'on_target', 'near_target', 'off_target', 'tracked'].map((f) => (
            <button key={f} className={`seg-btn${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All KPIs' : STATUS[f].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grouped KPI register ── */}
      {groups.map((g) => (
        <div key={g.group} className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-soft)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--app-text)' }}>{g.group}</div>
            <div style={{ fontSize: 11, color: 'var(--app-text-faint)', marginTop: 2 }}>{g.brief}</div>
          </div>

          <div>
            {g.kpis.map((k, i) => {
              const st = STATUS[k.status] || STATUS.tracked;
              return (
                <div key={k.id} style={{
                  display: 'grid', gridTemplateColumns: 'minmax(230px, 1.5fr) 128px 118px minmax(200px, 1.2fr)',
                  gap: 14, padding: '13px 16px', alignItems: 'center',
                  borderTop: i ? '1px solid var(--app-border-soft)' : 'none',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--app-text)' }}>{k.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--app-text-faint)', marginTop: 3, lineHeight: 1.45 }}>{k.definition}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 17, fontWeight: 750, color: 'var(--app-text)', lineHeight: 1.15 }} className="ltr-num">
                      {formatValue(k)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--app-text-faint)', marginTop: 2 }}>{formatTarget(k)}</div>
                  </div>

                  <div>
                    <span className={`status-chip status-chip-${st.tone}`}>
                      {st.icon}{st.label}
                    </span>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    {k.where ? (
                      <Link to={k.where.route} style={{ textDecoration: 'none' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                          borderRadius: 9, background: 'var(--app-surface-soft)',
                          border: '1px solid var(--app-border)', transition: 'all 0.14s ease',
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--app-accent-border)'; e.currentTarget.style.background = 'var(--app-accent-bg)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.background = 'var(--app-surface-soft)'; }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 650, color: 'var(--app-accent)' }}>{k.where.screen}</div>
                            <div style={{ fontSize: 10, color: 'var(--app-text-faint)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {k.where.widget}
                            </div>
                          </div>
                          <span style={{ color: 'var(--app-text-faint)', display: 'flex' }}><IcoChevron size={13} /></span>
                        </div>
                      </Link>
                    ) : (
                      <span className="status-chip status-chip-danger">Not surfaced</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {groups.length === 0 && <div className="card card-pad"><div className="empty-state">No KPIs match this filter</div></div>}
    </>
  );
}

function Cov({ label, value, tone }) {
  return (
    <div style={{
      padding: '9px 13px', borderRadius: 10, minWidth: 88,
      background: `var(--app-${tone}-bg)`,
      border: `1px solid var(--app-${tone === 'muted' ? 'border' : `${tone}-border`})`,
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: `var(--app-${tone === 'muted' ? 'text-faint' : tone})` }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 750, color: 'var(--app-text)', marginTop: 2, lineHeight: 1 }} className="ltr-num">{value}</div>
    </div>
  );
}
