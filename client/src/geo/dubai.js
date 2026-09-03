/**
 * Map palette and marker artwork for the Digital Twin.
 *
 * The basemap is CARTO's Positron / Dark Matter pair, built on OpenStreetMap:
 * real Dubai geography, deliberately low-chroma so it sits *under* the data
 * rather than competing with it, and shipped as a matched light/dark pair so
 * the twin can follow the application theme.
 *
 * Markers are HTML, not sprite images. Leaflet renders them as DOM nodes, which
 * means they inherit the app's font, scale crisply, and can be restyled without
 * regenerating an atlas.
 */

/* Leaflet takes [lat, lng] — the opposite order to GeoJSON. */
export const DUBAI_CENTER = [25.13, 55.24];

/**
 * Basemaps — Esri ArcGIS Online, which serves these tiles without an API key.
 *
 * CARTO was the original choice and had to be replaced: it now stamps
 * "API KEY REQUIRED" across every tile it serves anonymously, which rendered
 * the twin unusable. Esri's Canvas layers are open, and they are genuinely
 * neutral grey rather than blue-tinted, so they sit under the DLD palette
 * without fighting it.
 *
 * Esri splits its canvas maps in two: a Base layer carrying geometry, and a
 * Reference layer carrying labels. Both are drawn, with the labels on top of
 * the data-free part of the stack. The Dubai reference tiles are bilingual
 * Arabic/English, which suits this platform particularly well.
 *
 * Note the axis order: Esri's REST tile endpoint is {z}/{y}/{x}, not the
 * {z}/{x}/{y} that slippy-map services use.
 */
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export const BASEMAPS = {
  light: {
    id: 'light',
    label: 'Light',
    base: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    reference: `${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    maxZoom: 16,
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    base: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    reference: `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    maxZoom: 16,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    base: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    // Imagery carries no labels of its own, so the dark reference set is
    // borrowed — it is legible over aerial photography where the light one
    // would disappear.
    reference: `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Imagery &copy; Esri — Earthstar Geographics, Maxar',
    maxZoom: 18,
  },
};

/** The basemap a theme defaults to, before the user overrides it on the map. */
export const defaultBasemapFor = (theme) => (theme === 'dark' ? 'dark' : 'light');

/* ── Palette ──────────────────────────────────────────────────────────
   Engagement state reuses the application's status vocabulary, so
   green/amber/grey mean the same thing on the map as on every other screen. */
export const MAP_THEME = {
  light: {
    state: { active: '#1d7a45', at_risk: '#a86a10', inactive: '#64798d' },
    ramp: ['#cfe0ee', '#93bcdc', '#4f90c4', '#1f6fab', '#0b5fa5'],
    roi: ['#b3302c', '#c07818', '#8fa3b5', '#3f9a6a', '#0f8f78'],
    event: '#7c3aed',
    districtFill: 'rgba(11,95,165,0.055)',
    districtLine: 'rgba(11,95,165,0.32)',
    label: '#10233a',
    halo: '#ffffff',
    pinStroke: '#ffffff',
  },
  dark: {
    state: { active: '#4ade80', at_risk: '#fbbf24', inactive: '#8a949e' },
    ramp: ['#2a2e33', '#3c4b5a', '#4f6b86', '#6f9dc4', '#9dc8ea'],
    roi: ['#f87171', '#fbbf24', '#8a949e', '#5fb3b6', '#4ade80'],
    event: '#a78bfa',
    districtFill: 'rgba(160,170,180,0.09)',
    districtLine: 'rgba(180,190,200,0.34)',
    label: '#e8eaec',
    halo: '#15171a',
    pinStroke: '#1a1d21',
  },
};

/* Over aerial photography the greys vanish and every stroke needs more weight,
   so satellite gets its own high-contrast variant rather than reusing dark. */
MAP_THEME.satellite = {
  ...MAP_THEME.dark,
  state: { active: '#22c55e', at_risk: '#f59e0b', inactive: '#cbd5e1' },
  districtFill: 'rgba(255,255,255,0.06)',
  districtLine: 'rgba(255,255,255,0.44)',
  label: '#ffffff',
  halo: 'rgba(0,0,0,0.85)',
  pinStroke: '#ffffff',
};

/** Interpolates a value across a five-stop ramp. */
function rampColor(stops, value, min, max) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  return stops[t >= 1 ? stops.length - 1 : i + (t * (stops.length - 1) - i > 0.5 ? 1 : 0)];
}

/** The colour a project takes under the current "colour by" dimension. */
export function projectColor(p, colorBy, c) {
  if (colorBy === 'engagement') return rampColor(c.ramp, p.engagement_score, 0, 100);
  if (colorBy === 'roi') return rampColor(c.roi, p.roi_percent, -20, 200);
  return c.state[p.engagement_state] || c.state.inactive;
}

/* ── Marker glyphs ────────────────────────────────────────────────────
   A pin says "something is here"; the glyph says what. Construction, handover
   and at-risk stock read differently at a glance, which is the whole reason
   for using pins rather than dots. */
const GLYPHS = {
  tower: '<path d="M8.7 10.2h3.6v7.6H8.7zM13.1 7.9h4.1v9.9h-4.1z" fill="#fff"/>'
    + '<rect x="7.4" y="17.4" width="11.2" height="1.5" rx="0.4" fill="#fff"/>',
  crane: '<path d="M8.6 18.6V7.7h1.5v10.9zM9.35 7.7h8.2v1.4h-8.2z" fill="#fff"/>'
    + '<path d="M16.2 9.1v2.3h1.3V9.1z" fill="#fff"/>'
    + '<rect x="15.1" y="11.4" width="3.4" height="2.3" rx="0.4" fill="#fff"/>',
  key: '<circle cx="10.6" cy="14.6" r="2.7" fill="none" stroke="#fff" stroke-width="1.5"/>'
    + '<path d="M12.6 12.7L17.9 7.4M16.1 9.2l1.7 1.7M14.4 10.9l1.7 1.7" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
  alert: '<path d="M13 6.6l5.6 10.6H7.4z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>'
    + '<path d="M13 10.6v2.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'
    + '<circle cx="13" cy="15.3" r="0.85" fill="#fff"/>',
};

function glyphFor(p) {
  if (p.engagement_state === 'at_risk') return GLYPHS.alert;
  if (p.status === 'under_construction') return GLYPHS.crane;
  if (p.status === 'completed' || p.status === 'handover') return GLYPHS.key;
  return GLYPHS.tower;
}

/** A teardrop pin as inline SVG, ready for a Leaflet divIcon. */
export function pinHtml(p, colorBy, c, selected) {
  const fill = projectColor(p, colorBy, c);
  return `<div class="twin-pin${selected ? ' is-selected' : ''}">
    <svg width="30" height="40" viewBox="0 0 26 36" aria-hidden="true">
      <path d="M13 1.3C7.3 1.3 2.7 5.85 2.7 11.45c0 7.4 8.75 16.2 9.68 17.15a0.86 0.86 0 0 0 1.24 0c0.93-0.95 9.68-9.75 9.68-17.15C23.3 5.85 18.7 1.3 13 1.3z"
        fill="${fill}" stroke="${c.pinStroke}" stroke-width="1.9"/>
      ${glyphFor(p)}
    </svg>
  </div>`;
}

/** Event venues get a circular badge so they never read as a project. */
export function eventPinHtml(c) {
  return `<div class="twin-pin twin-pin-event">
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="11.4" fill="${c.event}" stroke="${c.pinStroke}" stroke-width="2.3"/>
      <path d="M16 9.2l2.05 4.35 4.65.62-3.4 3.25.87 4.65L16 19.86l-4.17 2.21.87-4.65-3.4-3.25 4.65-.62z" fill="#fff"/>
    </svg>
  </div>`;
}
