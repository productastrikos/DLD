import React from 'react';

/**
 * Brand marks.
 *
 * Both logos are drawn as inline SVG rather than linked as image files: the
 * platform has no asset pipeline, and inline marks stay crisp at any size and
 * recolour themselves with the theme.
 */

/* The real Astrikos AI brand assets, served from client/public/brand. The mark
   is a metallic gradient that no hand-drawn substitute would reproduce
   faithfully, so it is used as artwork rather than redrawn as SVG.

   The company is "Astrikos AI" — the full name is used wherever the company is
   named in text. The supplied wordmark artwork reads "ASTRIKOS", so where the
   logo image appears the "AI" is set alongside it rather than duplicated. */
const ASTRIKOS_MARK = '/brand/astrikos-mark.png';
const ASTRIKOS_HORIZONTAL = '/brand/astrikos-horizontal.png';

/** The company name, in one place so it cannot drift between screens. */
export const COMPANY = 'Astrikos AI';

/** Astrikos mark, on its own. */
export function AstrikosMark({ size = 30, mono = false }) {
  return (
    <img
      src={ASTRIKOS_MARK}
      alt={COMPANY}
      width={size}
      height={size}
      style={{
        width: size, height: size, flexShrink: 0, objectFit: 'contain',
        // On a saturated header the metallic mark loses contrast; flattening it
        // to white keeps the silhouette legible.
        filter: mono ? 'brightness(0) invert(1)' : undefined,
      }}
    />
  );
}

/** Full Astrikos lockup — the horizontal mark plus wordmark artwork. */
export function AstrikosLogo({ height = 30, light = false }) {
  return (
    <img
      src={ASTRIKOS_HORIZONTAL}
      alt={COMPANY}
      style={{
        height, width: 'auto', flexShrink: 0, objectFit: 'contain',
        // The supplied artwork is a light metallic gradient, which disappears on
        // white; a subtle drop shadow holds its edge on pale grounds.
        filter: light ? undefined : 'drop-shadow(0 1px 1px rgba(16,35,58,0.28))',
      }}
    />
  );
}

/** Dubai Land Department mark. */
export function DldMark({ size = 34 }) {
  return (
    <svg viewBox="0 0 40 40" style={{ width: size, height: size, flexShrink: 0 }} aria-label="Dubai Land Department">
      <defs>
        <linearGradient id={`dld-g-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0b5fa5" />
          <stop offset="100%" stopColor="#2e7d80" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill={`url(#dld-g-${size})`} />
      {/* Land parcel + tower motif */}
      <g fill="#fff">
        <path d="M8 28.5h24v2.6H8z" opacity="0.92" />
        <path d="M12 17.5h5.4v10.2H12z" opacity="0.78" />
        <path d="M19.2 12h5.4v15.7h-5.4z" />
        <path d="M26.4 20.4h4.2v7.3h-4.2z" opacity="0.66" />
      </g>
    </svg>
  );
}

/**
 * Co-branded lockup — client mark, pipe divider, delivery-partner mark.
 * Used on the sign-in screen where both parties need equal billing.
 */
export function CoBrandLockup({ light = false }) {
  const ink = light ? '#fff' : 'var(--app-text)';
  const faint = light ? 'rgba(255,255,255,0.66)' : 'var(--app-text-faint)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <DldMark size={46} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 750, color: ink, lineHeight: 1.25 }}>
            Dubai Land Department
          </div>
          <div style={{ fontSize: 10.5, color: faint, marginTop: 2 }}>
            دائرة الأراضي والأملاك
          </div>
        </div>
      </div>

      {/* The pipe divider */}
      <div style={{ width: 1, height: 42, background: light ? 'rgba(255,255,255,0.30)' : 'var(--app-border)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <AstrikosLogo height={30} light={light} />
          {/* The wordmark artwork reads "ASTRIKOS"; the "AI" completes the
              company name without duplicating what the logo already says. */}
          <span style={{ fontSize: 19, fontWeight: 800, color: ink, letterSpacing: '-0.01em' }}>AI</span>
        </div>
        <div style={{ fontSize: 9.5, color: faint, letterSpacing: '0.14em', paddingInlineStart: 2 }}>
          S!aP PLATFORM
        </div>
      </div>
    </div>
  );
}

/** Sidebar footer credit shown throughout the signed-in application. */
export function PoweredByAstrikos({ collapsed }) {
  if (collapsed) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }} title={`Powered by ${COMPANY}`}>
        <AstrikosMark size={24} />
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '11px 10px 5px', borderTop: '1px solid var(--app-border)',
    }}>
      <AstrikosMark size={26} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 8.5, color: 'var(--app-text-faint)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
          Powered by
        </div>
        <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--app-text)', lineHeight: 1.2 }}>
          {COMPANY}
        </div>
      </div>
    </div>
  );
}
