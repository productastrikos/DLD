import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { useTheme } from '../theme';

/* ── Categorical palette ───────────────────────────────────────────────
   Fixed hue order, never cycled. Both modes were checked with the
   dataviz validator (lightness band, chroma floor, CVD separation across
   ALL pairs, normal-vision floor, contrast) and pass on every check.
     light  #0b5fa5 · #c07818 · #0f8f78   (surface #ffffff)
     dark   #4a9ad8 · #d2952a · #23b47e   (surface #1a1c1f)
   Dark is a deliberate re-step from the same hues, not a flipped light. The
   dark steps were lifted when the dark ground moved from navy to neutral grey:
   a grey surface is lighter than the old navy, so the series needed more
   luminance separation from it to keep the same contrast. */
const CAT = {
  light: ['#0b5fa5', '#c07818', '#0f8f78'],
  dark:  ['#4a9ad8', '#d2952a', '#23b47e'],
};

export function usePalette() {
  const { theme } = useTheme();
  const cat = CAT[theme] || CAT.light;
  return {
    cat,
    grid: theme === 'dark' ? 'rgba(225,228,232,0.10)' : 'rgba(15,45,80,0.10)',
    axis: theme === 'dark' ? '#82888f' : '#7d93a8',
    text: theme === 'dark' ? '#e9eaec' : '#10233a',
    muted: theme === 'dark' ? '#b2b7bd' : '#46617e',
    surface: theme === 'dark' ? '#1a1c1f' : '#ffffff',
    border: theme === 'dark' ? 'rgba(214,219,226,0.16)' : 'rgba(15,45,80,0.14)',
  };
}

/* Shared tooltip — values sit in text tokens; a colour swatch beside each row
   carries series identity, so identity is never colour-on-text. */
function ChartTooltip({ active, payload, label, unit, fmt }) {
  const p = usePalette();
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: p.surface, border: `1px solid ${p.border}`, borderRadius: 9,
      padding: '9px 11px', boxShadow: '0 6px 22px rgba(10,25,45,0.16)', minWidth: 130,
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: p.muted, marginBottom: 6, letterSpacing: '0.03em' }}>{label}</div>
      {payload.map((row) => (
        <div key={row.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: row.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: p.muted, flex: 1 }}>{row.name}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: p.text }}>
            {fmt ? fmt(row.value) : row.value}{unit || ''}
          </span>
        </div>
      ))}
    </div>
  );
}

const axisProps = (p) => ({
  stroke: p.axis,
  tick: { fill: p.axis, fontSize: 10.5 },
  tickLine: false,
  axisLine: { stroke: p.grid },
});

const legendProps = (p) => ({
  wrapperStyle: { fontSize: 11, color: p.muted, paddingTop: 6 },
  iconType: 'circle',
  iconSize: 8,
});

/**
 * TrendChart — multi-series line over time. Series must share one unit; two
 * different units go in two charts (never a second y-axis).
 */
export function TrendChart({ data, xKey, series, height = 220, unit, fmt: valFmt, tickFmt, area }) {
  const p = usePalette();
  const Chart = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -14 }}>
        {area && (
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={p.cat[i % p.cat.length]} stopOpacity={0.26} />
                <stop offset="100%" stopColor={p.cat[i % p.cat.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
        )}
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps(p)} minTickGap={18} />
        <YAxis {...axisProps(p)} {...(tickFmt ? { tickFormatter: tickFmt } : {})} width={tickFmt ? 56 : 44} />
        <Tooltip cursor={{ stroke: p.grid, strokeWidth: 1 }} content={<ChartTooltip unit={unit} fmt={valFmt} />} />
        {series.length > 1 && <Legend {...legendProps(p)} />}
        {series.map((s, i) => {
          const color = p.cat[i % p.cat.length];
          return area ? (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label}
              stroke={color} strokeWidth={2} fill={`url(#grad-${s.key})`}
              dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: p.surface }} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
              stroke={color} strokeWidth={2}
              dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: p.surface }} />
          );
        })}
      </Chart>
    </ResponsiveContainer>
  );
}

/** BarsChart — categorical magnitude. Horizontal when labels are long.
 *  `tickFmt` formats the value axis so large magnitudes never render raw. */
export function BarsChart({ data, xKey, series, height = 220, layout = 'vertical', unit, fmt: valFmt, tickFmt, colorByIndex, catWidth = 104 }) {
  const p = usePalette();
  const horiz = layout === 'horizontal';
  const valueAxis = { ...axisProps(p), ...(tickFmt ? { tickFormatter: tickFmt } : {}) };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horiz ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 16, bottom: 0, left: horiz ? 8 : -14 }}
        barGap={2} barCategoryGap={horiz ? '26%' : '30%'}>
        <CartesianGrid stroke={p.grid} vertical={horiz} horizontal={!horiz} />
        {horiz ? (
          <>
            <XAxis type="number" {...valueAxis} />
            <YAxis type="category" dataKey={xKey} {...axisProps(p)} width={catWidth} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axisProps(p)} />
            <YAxis {...valueAxis} width={tickFmt ? 56 : 44} />
          </>
        )}
        <Tooltip cursor={{ fill: p.grid }} content={<ChartTooltip unit={unit} fmt={valFmt} />} />
        {series.length > 1 && <Legend {...legendProps(p)} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label}
            fill={p.cat[i % p.cat.length]}
            radius={horiz ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={horiz ? 22 : 40}>
            {/* One series split by category gets a hue per row instead of per series. */}
            {colorByIndex && data.map((_, j) => <Cell key={j} fill={p.cat[j % p.cat.length]} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Panel — the standard chart container: title, optional note, then the plot. */
export function ChartPanel({ title, note, children, action, height }) {
  return (
    <div className="card" style={{ padding: '15px 16px 10px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="panel-title">{title}</div>
          {note && <div className="panel-sub">{note}</div>}
        </div>
        {action}
      </div>
      <div style={{ flex: 1, minWidth: 0, minHeight: height ? undefined : 0 }}>{children}</div>
    </div>
  );
}

/** Horizontal share bar — a compact alternative to a pie, one row per category. */
export function ShareBars({ rows, fmt: valFmt }) {
  const p = usePalette();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {rows.map((r, i) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--app-text-muted)', minWidth: 0 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: p.cat[i % p.cat.length], flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--app-text)', flexShrink: 0 }}>
              {valFmt ? valFmt(r.value) : r.value}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(r.value / max) * 100}%`, background: p.cat[i % p.cat.length] }} />
          </div>
          {r.sub && <div style={{ fontSize: 10, color: 'var(--app-text-faint)', marginTop: 4 }}>{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}
