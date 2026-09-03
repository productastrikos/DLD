import React from 'react';

/**
 * Ring — a single-value progress dial.
 *
 * Used for the executive Portfolio Health composite and for the partner's
 * obligation completion. Deliberately plain: a dial is only worth the space
 * when one number is genuinely the headline, and the caller supplies the
 * breakdown beside it.
 */
export default function Ring({
  value,            // 0–100
  size = 132,
  stroke = 11,
  label,
  sub,
  tone,             // explicit token name; otherwise banded by value
}) {
  const pct = Math.max(0, Math.min(100, +value || 0));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);

  // Banding matches the status vocabulary used everywhere else in the app.
  const auto = pct >= 80 ? 'success' : pct >= 65 ? 'accent' : pct >= 50 ? 'warning' : 'danger';
  const color = `var(--app-${tone || auto})`;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-fill" cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 1,
      }}>
        <span className="ltr-num" style={{
          fontSize: size * 0.27, fontWeight: 780, color: 'var(--app-text)',
          letterSpacing: '-0.02em', lineHeight: 1,
        }}>{Math.round(pct)}</span>
        {label && (
          <span style={{
            fontSize: size * 0.088, fontWeight: 700, color,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{label}</span>
        )}
        {sub && (
          <span style={{ fontSize: size * 0.075, color: 'var(--app-text-faint)' }}>{sub}</span>
        )}
      </div>
    </div>
  );
}
