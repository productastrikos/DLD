import React from 'react';
import { IcoExpand } from './icons';

/**
 * KPICard — stat tile (design standard: productastrikos/UserInterface).
 * `tone` picks the left rail colour: accent (primary blue), teal, or sand.
 *
 * Passing `kpiId` makes the tile openable: the shell then shows the explainer
 * dialog for that KPI. A tile that cannot explain itself is a number without
 * provenance, so most tiles carry one.
 */
export default function KPICard({
  label, value, unit, icon, trend, trendLabel, tone = 'accent', foot, onClick, kpiId,
}) {
  const hasTrend = trend !== null && trend !== undefined && !Number.isNaN(+trend);
  // A falling number is not automatically bad — approval time going down is a
  // win — so callers pass `trendGood` semantics via a negated trend value.
  const isPos = (+trend || 0) >= 0;
  const clickable = !!(onClick || kpiId);

  return (
    <div
      className={`kpi-card${tone !== 'accent' ? ` tone-${tone}` : ''}${clickable ? ' is-clickable' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      title={clickable ? `${label} — open explainer` : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `var(--app-${tone === 'accent' ? 'accent' : tone}-bg)`,
          color: `var(--app-${tone === 'accent' ? 'accent' : tone})`,
        }}>
          {icon}
        </div>
        <p style={{
          color: 'var(--app-text-muted)', fontSize: 11.5, fontWeight: 600, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
        }}>
          {label}
        </p>
        {hasTrend && (
          <span style={{
            fontSize: 10, fontWeight: 700, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '2px 6px', borderRadius: 5,
            color: isPos ? 'var(--app-success)' : 'var(--app-danger)',
            background: isPos ? 'var(--app-success-bg)' : 'var(--app-danger-bg)',
          }}>
            <span style={{ fontSize: 8 }}>{isPos ? '▲' : '▼'}</span>
            {Math.abs(+trend).toFixed(1)}%
          </span>
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
        <span style={{ color: 'var(--app-text)', fontSize: 'clamp(1.5rem, 2.2vw, 2rem)', fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ color: 'var(--app-text-faint)', fontSize: '0.8rem', fontWeight: 500 }}>{unit}</span>}
      </div>

      {/* marginTop:auto pins the footer so every card in a row aligns. */}
      <div style={{ marginTop: 'auto', paddingTop: 10, flexShrink: 0, paddingInlineEnd: clickable ? 48 : 0 }}>
        {foot ? (
          <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', lineHeight: 1.4 }}>{foot}</div>
        ) : trendLabel ? (
          <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>{trendLabel}</div>
        ) : null}
      </div>

      {clickable && (
        <span className="kpi-open-hint"><IcoExpand size={9} sw={2.4} />Details</span>
      )}
    </div>
  );
}
