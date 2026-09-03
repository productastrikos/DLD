# Real Estate Developer Connectivity Platform — POC

Dubai Land Department · Marketing & Communications

A single-page application implementing the platform described in
*Real Estate Developer Connectivity Platform* (see the English translations in
the parent folder). Full-stack but self-contained: an Express API reads CSV
datasets from `/data`, and a React SPA consumes it. No external database.

```bash
npm install
npm run dev        # API on :5061, client on :5174
```

Open <http://localhost:5174>.

## Sign in

Selecting an identity auto-fills its demo credentials; the password matches the
username, and the UAE PASS tab needs no password at all.

| Portal | Identity | Sees |
|---|---|---|
| DLD Internal | Executive — Marketing & Communications | Strategy, twins, intelligence, ledger — no operational queues |
| DLD Internal | Campaign Manager — Partnerships Office | Pipeline, approval queue, events, twins, intelligence — no ledger |
| DLD Internal | Platform Administrator | Everything in the DLD portal |
| Developer | Any of 12 developer organisations | That organisation's own data only |

## Screens

**DLD Command Center**

1. **Executive Smart Dashboard** — a **Portfolio Health** composite (adoption,
   efficiency, commercial, delivery) beside an **auto-generated weekly digest**
   that deep-links into whatever needs a decision. Then **six headline KPI
   tiles** — no more — trend charts, programme mix, and a partner leaderboard
   with earned grade badges. Depth lives in the analytics modules below.
2. **Partner Directory** — the developer register. The dashboard leaderboard
   shows the top eight and the twin shows whoever has projects on screen;
   neither answers *"who are our partners and what is our relationship with
   each"*. Card and table views, filterable by tier, earned grade, flagged or
   dormant, with a partner-360 dialog.
3. **Initiatives & Campaigns Manager** — Kanban pipeline
   (Draft → Review → Active → Completed) plus **timeline** and table views; the
   timeline exposes launch-date collisions a board cannot show. *Launch New
   Initiative* creates a programme and invites target developers in one step,
   with **AI smart matching** ranking partners against the brief.
4. **Sponsorships & Agreements Ledger** — sortable, filterable grid with
   commitment tracking, ROI, an **anomaly-detection panel**, per-row risk flags
   and an inline **contract preview**.
5. **Approval Queue** — SLA timers against the 3-day service target, a
   compliance banner, and breaching requests sorted to the top.
6. **Events & Exhibitions** — event pipeline board, participation roster with
   confirm/decline, and post-event impact reporting.

**Analytics** — where the detail the dashboard sheds now lives.

7. **Engagement Analytics** — adoption, efficiency, satisfaction and request
   throughput, each measure beside its own trend line.
8. **Commercial Performance** — contracted value, delivery, collection, agreement
   risk and event return, read together as one commercial story.

**Digital Twin** — one map (see below).

**Intelligence**

9. **AI Partnership Copilot** — ask the platform questions in plain language.
10. **What-If Campaign Simulator** — project a programme before committing budget.
11. **KPI Traceability Matrix** — every KPI in the brief, mapped to the widget
    that reports it, with its current value against target.

**Developer Partner Hub**

1. **Partner Activity** — an **obligations completion ring** over four strands
   (documents, requests, agreements, commitments), action items, and
   personalised performance metrics.
2. **Opportunity Marketplace** — **Recommended for you** (scored against the
   partner's own history) above the gallery, with a four-step participation
   wizard.
3. **My Agreements** — the partner's side of the ledger. The Department has had
   a full ledger from the start; partners could only see agreements as task
   stubs. A partner cannot manage a commitment they cannot see, so this is the
   counterpart view: same records, scoped to them, phrased as their obligations
   rather than as the Department's risk register.
4. **Events & Exhibitions** — register for stand space, track participations.
5. **My Portfolio Map** — the twin, scoped to that partner's own projects.
6. **Digital Assets Library** — masonry gallery with a filter sidebar and
   utilisation metrics.

## Digital Twin

**One map** (`/dld/twin`), built on **Leaflet**.

Leaflet paints tiles as plain `<img>` elements and markers as DOM nodes, so the
map does not depend on a WebGL context, a worker bundle, or an animation frame
ever firing. An earlier WebGL implementation rendered nothing on the target
machine; on a demo laptop, a projector, or a locked-down browser that difference
is the difference between a map and a blank rectangle. It also cut the Twin
bundle from 1,085 kB to 206 kB. The trade is 3D extrusion, which Leaflet cannot
do — so the 3D view was dropped rather than faked.

- Projects render as **teardrop map pins**, glyphed by what they are — tower,
  crane for under-construction, key for handover, warning for at-risk — and
  colourable by engagement status, engagement score or sponsorship ROI.
- Clusters carry the state mix inside them, so a cluster hiding at-risk stock
  does not read as healthy.
- Campaign and sponsorship-density overlays, district rings, event venues.
- A **quarter-by-quarter time slider** with playback across nine quarters.
- Clicking a project opens the full partner record.

Basemaps come from **Esri ArcGIS Online**, which serves them without an API key.
CARTO was the original choice and had to be replaced: it now stamps
*"API KEY REQUIRED"* diagonally across every tile served anonymously. Esri's
Canvas layers are open and genuinely neutral grey rather than blue-tinted, so
they sit under the DLD palette without competing with it.

Three basemaps are switchable **on the map itself** — Light, Dark and Satellite.
The choice is seeded from the application theme but then owned by the map, since
satellite has no light or dark equivalent. Esri splits its canvas maps into a
geometry layer and a label layer; both are drawn, and the Dubai labels are
bilingual Arabic/English. Attribution is rendered on the map as required.

## Cross-cutting behaviour

- **Every KPI tile opens an explainer** — definition, why it matters, the
  formula, a chart, and an AI advisory that resolves after a beat. A number on a
  dashboard without provenance is not much use, so every tile carries one.
- **AI output is shown being derived.** The engine answers in milliseconds,
  which is too fast to read as reasoning. `components/Thinking.jsx` walks the
  stages the engine actually performs — classify, select, aggregate, compose —
  so the reader arrives at the answer knowing where it came from.
- **The executive dashboard shows six numbers.** Everything else moved to
  Engagement Analytics and Commercial Performance, where each measure has room
  for its own trend line. A dashboard that shows everything shows nothing.
- **A rotating AI advisory strip** sits above every module, cycling every ~5s,
  pausing on hover, with steppable dots. Content is generated per request from
  current data, so it never contradicts the screen beneath it.
- **Ask S!a** is available on every screen (bottom-right). It shares the
  Copilot's engine, and its suggested questions re-scope to whichever module is
  in view.
- **Live notifications** — the server keeps emitting plausible workflow events
  naming real records; the shell polls every 9s and the bell shakes only when
  the unread count actually rises.
- **Bilingual EN / عربي**, translation-only: the words switch, the layout stays
  left-to-right. Covers navigation, page headers, KPI labels, panel titles and
  the AI chrome. Data from the CSVs (partner names, campaign titles) stays as
  recorded, which is how a bilingual government system actually behaves.
- **Co-branding** — the real Astrikos AI brand assets (`client/public/brand/`),
  locked up with the DLD mark behind a pipe divider on sign-in over Dubai
  skyline photography; "Powered by Astrikos AI" in the sidebar throughout.
- **Photography** on asset, opportunity and event cards, picked
  *deterministically* from each record's id (`services/media.js`) so a card
  shows the same image on every render. Every photo sits under a brand-gradient
  scrim, and the gradient is the ground — a blocked image degrades rather than
  leaving a blank box.

## AI layer

`server/lib/ai.js` is deliberately **model-free**. A hosted LLM would add
fluency but also a network dependency, an API key and non-determinism — none of
which a self-contained demo can rely on. Every answer is computed from the live
tables, so a figure quoted by the copilot can be checked on the screen it came
from. The contract (intent → structured answer) is the shape an LLM wrapper
would return, so swapping one in later changes the implementation, not the
interface.

- **Copilot** — classifies the question, runs the matching aggregation, returns
  prose *plus its evidence*: metrics, the rows counted, and for drafting
  requests a real recipient list with merge fields.
- **Simulator** — projects reach, leads and ROI from base rates measured on
  comparable completed programmes. Every multiplier is shown, and the lead value
  is *calibrated from history* so a programme matching the historical average
  reproduces the portfolio's own measured return. Budget is damped to the 0.75
  power, so the sensitivity table shows real diminishing returns.
- **Smart matching** — ranks partners on format history, engagement, recency,
  reliability, commercial record and location fit, each weighted and explained.
- **Anomaly detection** — six rules over the ledger (delivery pace vs the
  contract clock, ROI vs the tier's own median, invoicing lag, runway to expiry,
  counterparty gone quiet, unsigned too long).
- **Digest & Portfolio Health** — composed from measured deltas.

All current values flow through one `currentState()` helper, so the tiles, the
health score and the digest cannot report different numbers for the same metric.

## Architecture

```
data/                     CSV system-of-record (generated, reproducible)
server/
  generate/generate-data.js   seeded generator — `npm run generate`
  lib/csv.js                  CSV reader
  lib/ai.js                   copilot, simulator, matching, anomalies, digest
  lib/kpi.js                  KPI register + traceability mapping
  lib/content.js              KPI explainers, rotating advisories, Ask S!a pairs
  index.js                    Express API + live notification stream
client/src/
  App.jsx                     router + RBAC gate + search/KPI contexts
  theme.jsx                   light/dark tokens
  i18n.jsx                    EN/AR translation (layout stays LTR)
  geo/dubai.js                map style, palette, pin markers, data shaping
  components/                 Layout, KPICard, KpiDetailModal, AdvisoryStrip,
                              AskSia, Brand, Ring, charts, TwinMap, Panels, icons
  pages/                      the fourteen screens
  services/api.js             fetch helpers, developer scoping, formatters
  services/modules.js         route → module, for advisory and assistant scoping
  services/media.js           deterministic photography per record
app.js                    hosting entry point (Passenger / `npm start`)
Dockerfile, docker-compose.yml, ecosystem.config.cjs
deploy/                   nginx.conf, systemd unit
```

**Internet is required** for the twin's basemap tiles and the sign-in hero
image. Everything else — all data, all intelligence — runs locally.

The platform reasons from a **reference clock** (`REFERENCE_DATE`, exported by
the generator) rather than the wall clock. Every dataset is built relative to
that instant, so SLA ages, inactivity windows and time-to-expiry stay coherent —
reading `Date.now()` instead would make a freshly generated dataset look months
stale.

**Role-based access control** forks at three levels: the login screen picks a
portal, `ROLE_ROUTES` in `client/src/components/Layout.jsx` gates which routes
render, and the API scopes every developer-portal response to the signed-in
`developer_id`. A partner never receives another partner's rows.

**Relational model** — `participation_requests` is the many-to-many join
between `developers` and `campaigns`; `sponsorships` layers commercial terms on
top of the same pair.

**Digital workflow** — a partner submitting or uploading fires a notification
to the DLD Communications Center, and a DLD decision fires one back, so the
approval loop stays entirely on-platform.

## Data

`npm run generate` rewrites `/data` from a seeded RNG, so regeneration is
byte-identical. Mutations made while the app runs (new requests, approvals,
launched campaigns) are held in memory over the CSV baseline and reset on
restart.

| File | Rows | Contents |
|---|---|---|
| `developers.csv` | 28 | Partner organisations, tier, engagement |
| `campaigns.csv` | 22 | Programmes across the pipeline |
| `participation_requests.csv` | ~165 | The developer ↔ campaign join |
| `sponsorships.csv` | ~40 | Agreements, commitments, ROI |
| `assets.csv` | 22 | Digital asset catalogue |
| `notifications.csv` | ~34 | Communications Center feed |
| `engagement_monthly.csv` | 18 | Monthly rollup behind the trend charts |
| `advisories.csv` | 7 | AI advisory panel content |
| `projects.csv` | ~145 | Geo-located partner projects — the Digital Twin layer |
| `events.csv` | 14 | Events & exhibitions calendar |
| `event_participations.csv` | ~130 | The developer ↔ event join |

## Design system

Follows the conventions in
[productastrikos/UserInterface](https://github.com/productastrikos/UserInterface):
CSS custom properties for all theming (`--app-panel`, `--app-accent`,
`--app-advisory`), modular card layout, KPI tiles, slide-out advisory and alert
panels, line-art icon set.

Palette per the brief — Deep Cerulean Blue `#0b5fa5` primary, Stone Teal
`#2e7d80` and Sandstone `#b08a4f` secondary, pure white and light pearl grey
`#f4f6f9` grounds. Purple is reserved for AI advisory output and used nowhere
else.

**Dark mode is a neutral grey, not a navy.** An earlier build tinted every dark
surface blue (`#0a111e` and friends), which read as a second brand colour
competing with the Deep Cerulean primary — the accent stopped standing out
because the ground was already blue. The dark greys are now near-achromatic
(R≈G≈B, chroma 4–10), so the blue, teal and sand accents are the only chroma on
screen and carry all the meaning. The dark chart steps were lifted to match:
a grey ground is lighter than the old navy, so the series needed more luminance
separation to hold the same contrast.

Chart colours are a fixed three-hue categorical order, re-stepped separately
for dark mode and validated for lightness band, chroma floor, colour-vision
separation across all pairs, and contrast:

| | Blue | Amber | Green-teal |
|---|---|---|---|
| Light | `#0b5fa5` | `#c07818` | `#0f8f78` |
| Dark | `#3d8fd0` | `#c2871c` | `#17a56f` |

## Deployment

One Node process serves both the API and the built SPA on a single origin, so
production is `npm ci && npm run build && npm start` — no database, no second
service, no CORS to configure. The startup file is `app.js`; the port comes from
`PORT` (default `5061`) and the bind address from `HOST` (default `0.0.0.0`).
`GET /api/health` is the liveness probe.

Because the app needs a Node runtime, a static-only plan cannot run it.
**[DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md)** covers the routes that work —
VPS with Docker, VPS with PM2 + Nginx, and an hPanel Node.js application — plus
what breaks if you upload only the static build.

Note that mutations are held in memory on top of the CSV baseline, so a restart
returns the demo to its clean starting state.

## Scope

This is a proof of concept covering Phases One–Two of the roadmap (analysis,
design, and a working platform over a real data model). Authentication is
demo-grade, file uploads are simulated, and there is no persistence layer —
those belong to Phase Three.

Two things are deliberately *not* what they might appear:

- The **AI layer computes, it does not generate.** Answers are deterministic
  aggregations over the CSV tables, not language-model output. This is a
  feature for a demo — it works offline and returns the same answer twice — but
  it is not natural-language understanding, and unusual phrasings fall back to
  the weekly digest.
- The **contract preview is rendered from the ledger record**, not an executed
  PDF. There is no document store in this build; the preview says so on its face.
