import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { MAP_THEME, BASEMAPS, DUBAI_CENTER, pinHtml, eventPinHtml } from '../geo/dubai';

/**
 * TwinMap — the Digital Twin's map.
 *
 * Built on Leaflet rather than a WebGL renderer. Leaflet paints tiles as plain
 * <img> elements and markers as DOM nodes, which means the map does not depend
 * on a WebGL context, a worker bundle, or an animation frame ever firing. On a
 * demo machine, a projector, or a locked-down browser, that difference is the
 * difference between a map and a blank rectangle.
 *
 * Basemaps come from Esri ArcGIS Online, which serves them without an API key —
 * CARTO, the original choice, now watermarks anonymous tiles with "API KEY
 * REQUIRED". Light, dark and satellite are switchable on the map itself.
 */

/** Weighted density overlay, standing in for a raster heatmap. */
function densityLayer(projects, weightOf, color, max) {
  const group = L.layerGroup();
  for (const p of projects) {
    const w = weightOf(p);
    if (!w) continue;
    const t = Math.min(1, w / max);
    L.circleMarker([p.lat, p.lng], {
      radius: 14 + t * 30,
      stroke: false,
      fillColor: color,
      fillOpacity: 0.10 + t * 0.28,
      interactive: false,
      className: 'twin-density',
    }).addTo(group);
  }
  return group;
}

export default function TwinMap({
  projects = [],
  districts = [],
  events = [],
  colorBy = 'status',
  layers = {},
  onSelect,
  selectedId,
  focusDeveloper,
  basemap = 'light',
}) {
  // The palette the map is painted with — chosen on the map itself, so it can
  // differ from the application theme (satellite has no light/dark equivalent).
  const paint = MAP_THEME[basemap] || MAP_THEME.light;
  // Leaflet's cluster icon factory is registered once at map creation, so it
  // has to read the palette through a ref or it keeps painting the first one.
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const holder = useRef(null);
  const map = useRef(null);
  const tileLayer = useRef(null);
  const refLayer = useRef(null);
  const cluster = useRef(null);
  const districtLayer = useRef(null);
  const eventLayer = useRef(null);
  const campaignHeat = useRef(null);
  const sponsorHeat = useRef(null);
  const markerById = useRef(new Map());

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  /* ── Create the map once ── */
  useEffect(() => {
    if (map.current || !holder.current) return;
    const bm = BASEMAPS[basemap] || BASEMAPS.light;

    const m = L.map(holder.current, {
      center: DUBAI_CENTER,
      zoom: 10,
      minZoom: 8,
      maxZoom: 17,
      zoomControl: false,
      preferCanvas: false,
      worldCopyJump: false,
    });
    map.current = m;
    holder.current._twinMap = m;

    L.control.zoom({ position: 'bottomright' }).addTo(m);
    L.control.scale({ position: 'bottomleft', imperial: false, metric: true }).addTo(m);
    m.attributionControl.setPrefix('');

    // Base geometry, then labels on top — Esri serves the two separately.
    tileLayer.current = L.tileLayer(bm.base, {
      attribution: bm.attribution,
      maxZoom: 19,
      maxNativeZoom: bm.maxZoom,
    }).addTo(m);
    refLayer.current = L.tileLayer(bm.reference, {
      maxZoom: 19,
      maxNativeZoom: bm.maxZoom,
      pane: 'shadowPane',   // above tiles, below markers
    }).addTo(m);

    // Cluster bubbles are coloured by the mix of states inside them, so a
    // cluster hiding a cluster of at-risk projects does not read as healthy.
    cluster.current = L.markerClusterGroup({
      maxClusterRadius: 52,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 14,
      iconCreateFunction(c2) {
        const kids = c2.getAllChildMarkers();
        const risk = kids.filter((k) => k.options.state === 'at_risk').length;
        const active = kids.filter((k) => k.options.state === 'active').length;
        const p = paintRef.current;
        const tone = risk > kids.length / 3 ? p.state.at_risk : active ? p.state.active : p.state.inactive;
        const n = kids.length;
        const size = n < 10 ? 38 : n < 40 ? 46 : 54;
        return L.divIcon({
          className: 'twin-cluster',
          iconSize: [size, size],
          html: `<div class="twin-cluster-inner" style="--c:${tone};width:${size}px;height:${size}px">
                   <span>${n}</span></div>`,
        });
      },
    });
    m.addLayer(cluster.current);

    districtLayer.current = L.layerGroup().addTo(m);
    eventLayer.current = L.layerGroup();

    // Leaflet needs a nudge when its container was sized after construction.
    setTimeout(() => m.invalidateSize(), 60);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(holder.current);

    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      markerById.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Basemap swap ──
     The tile layers are replaced rather than re-pointed: each basemap carries
     its own attribution and native zoom ceiling, and mutating those in place
     leaves Leaflet's attribution control holding the previous provider's
     credit, which would be wrong on screen. */
  useEffect(() => {
    const m = map.current;
    if (!m || !tileLayer.current) return;
    const bm = BASEMAPS[basemap] || BASEMAPS.light;

    m.removeLayer(tileLayer.current);
    if (refLayer.current) m.removeLayer(refLayer.current);

    tileLayer.current = L.tileLayer(bm.base, {
      attribution: bm.attribution, maxZoom: 19, maxNativeZoom: bm.maxZoom,
    }).addTo(m);
    refLayer.current = L.tileLayer(bm.reference, {
      maxZoom: 19, maxNativeZoom: bm.maxZoom, pane: 'shadowPane',
    }).addTo(m);

    // Cluster icons bake in the palette, so they are rebuilt on a swap.
    cluster.current?.refreshClusters();
  }, [basemap]);

  /* ── Project markers ── */
  const renderProjects = useCallback(() => {
    const m = map.current;
    if (!m || !cluster.current) return;
    const c = paint;

    cluster.current.clearLayers();
    markerById.current.clear();

    const markers = projects.map((p) => {
      const marker = L.marker([p.lat, p.lng], {
        state: p.engagement_state,
        icon: L.divIcon({
          className: 'twin-pin-wrap',
          iconSize: [30, 40],
          iconAnchor: [15, 40],
          popupAnchor: [0, -36],
          html: pinHtml(p, colorBy, c, p.project_id === selectedId),
        }),
        title: `${p.name} — ${p.developer_name}`,
        riseOnHover: true,
      });
      marker.on('click', () => onSelectRef.current?.(p));
      markerById.current.set(p.project_id, marker);
      return marker;
    });

    cluster.current.addLayers(markers);
  }, [projects, colorBy, paint, selectedId]);

  useEffect(() => { renderProjects(); }, [renderProjects]);

  /* ── District rings and name plates ── */
  useEffect(() => {
    const m = map.current;
    if (!m || !districtLayer.current) return;
    const c = paint;
    districtLayer.current.clearLayers();
    if (layers.districts === false) return;

    for (const d of districts) {
      L.circle([d.lat, d.lng], {
        radius: 900 + Math.min(2600, (d.projects || 1) * 220),
        color: c.districtLine,
        weight: 1.2,
        dashArray: '4 3',
        fillColor: c.districtFill,
        fillOpacity: 1,
        interactive: false,
      }).addTo(districtLayer.current);

      L.marker([d.lat, d.lng], {
        interactive: false,
        icon: L.divIcon({
          className: 'twin-district-wrap',
          iconSize: [140, 30],
          iconAnchor: [70, 15],
          html: `<div class="twin-district-label" style="color:${c.label};text-shadow:0 1px 3px ${c.halo},0 0 4px ${c.halo},0 0 8px ${c.halo}">
                   <span class="twin-district-name">${d.district}</span>
                   <span class="twin-district-meta">${d.projects} projects</span>
                 </div>`,
        }),
      }).addTo(districtLayer.current);
    }
  }, [districts, layers.districts, paint]);

  /* ── Event venues ── */
  useEffect(() => {
    const m = map.current;
    if (!m || !eventLayer.current) return;
    const c = paint;
    eventLayer.current.clearLayers();

    for (const e of events) {
      L.marker([e.lat, e.lng], {
        icon: L.divIcon({
          className: 'twin-pin-wrap',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          html: eventPinHtml(c),
        }),
        title: `${e.title} — ${e.venue}`,
      })
        .bindTooltip(
          `<strong>${e.title}</strong><br>${e.venue}<br>${e.start_date}`,
          { direction: 'top', offset: [0, -14], className: 'twin-tip' }
        )
        .addTo(eventLayer.current);
    }

    if (layers.events) eventLayer.current.addTo(m);
    else m.removeLayer(eventLayer.current);
  }, [events, layers.events, paint]);

  /* ── Density overlays ── */
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const c = paint;

    if (campaignHeat.current) { m.removeLayer(campaignHeat.current); campaignHeat.current = null; }
    if (layers.campaignHeat) {
      campaignHeat.current = densityLayer(projects, (p) => p.live_campaigns, c.ramp[3], 4);
      campaignHeat.current.addTo(m);
      campaignHeat.current.bringToBack?.();
    }

    if (sponsorHeat.current) { m.removeLayer(sponsorHeat.current); sponsorHeat.current = null; }
    if (layers.sponsorshipHeat) {
      sponsorHeat.current = densityLayer(projects, (p) => p.committed_aed, '#b08a4f', 8000000);
      sponsorHeat.current.addTo(m);
      sponsorHeat.current.bringToBack?.();
    }
  }, [projects, layers.campaignHeat, layers.sponsorshipHeat, paint]);

  /* ── Fly to a developer's portfolio ── */
  useEffect(() => {
    const m = map.current;
    if (!m || !focusDeveloper) return;
    const own = projects.filter((p) => p.developer_id === focusDeveloper);
    if (!own.length) return;
    m.fitBounds(L.latLngBounds(own.map((p) => [p.lat, p.lng])).pad(0.35), { maxZoom: 14 });
  }, [focusDeveloper, projects]);

  return <div ref={holder} className="twin-map" />;
}
