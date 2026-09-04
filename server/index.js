/**
 * Real Estate Developer Connectivity Platform — API server.
 *
 * Serves screen-shaped JSON aggregated from the CSV datasets in /data (the
 * system-of-record for this POC). Every endpoint maps to one screen in the
 * spec; the two portals are separated by role, and developer-scoped endpoints
 * only ever return the signed-in developer's own rows.
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { loadTable } = require('./lib/csv');
const { generate, DATA_DIR, REFERENCE_DATE } = require('./generate/generate-data');
const ai = require('./lib/ai');
const kpi = require('./lib/kpi');
const content = require('./lib/content');

if (!fs.existsSync(path.join(DATA_DIR, 'developers.csv')) ||
    !fs.existsSync(path.join(DATA_DIR, 'projects.csv'))) {
  console.log('Datasets missing or out of date — generating...');
  generate();
}

const TABLES = [
  'developers', 'campaigns', 'participation_requests', 'sponsorships',
  'assets', 'notifications', 'engagement_monthly', 'advisories',
  'projects', 'events', 'event_participations',
];
const db = {};
for (const t of TABLES) db[t] = loadTable(DATA_DIR, t);
console.log(`Loaded ${TABLES.length} CSV tables from /data`);

/** The platform's reference clock. The datasets are generated relative to this
 *  instant, so every derived measure — SLA age, inactivity, time-to-expiry —
 *  must reason from it too. Reading the wall clock instead would make a freshly
 *  generated dataset appear months stale. */
const NOW = new Date(REFERENCE_DATE);
const DAY = 86400000;
const daysBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / DAY;

/* Mutations (new requests, approvals, launched campaigns) are applied in memory
   on top of the CSV baseline. The POC stays runnable without a database while
   still demonstrating a genuine end-to-end workflow. */
let seqRequest = db.participation_requests.length;
let seqCampaign = db.campaigns.length;
let seqNotif = db.notifications.length;
let seqEventPart = db.event_participations.length;

const app = express();
app.use(cors());
app.use(express.json());

/* Liveness probe — what a host's uptime monitor or container healthcheck hits. */
app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  uptime_s: Math.round(process.uptime()),
  tables: TABLES.length,
  reference_date: REFERENCE_DATE,
}));

/* ── helpers ───────────────────────────────────────────────────────── */
const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
const avg = (arr, f) => (arr.length ? sum(arr, f) / arr.length : 0);
const r1 = (n) => Math.round(n * 10) / 10;
const byId = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));

const devById = () => byId(db.developers, 'developer_id');
const cmpById = () => byId(db.campaigns, 'campaign_id');

/** Developer-portal scoping. The client sends ?developer=DEV-00x derived from
 *  the signed-in account; DLD roles send nothing and see everything. */
const scopeDev = (req) => req.query.developer || null;

function notify(audience, developerId, kind, title, body) {
  const row = {
    notif_id: `NTF-${String(++seqNotif).padStart(4, '0')}`,
    ts: new Date().toISOString(),
    audience, developer_id: developerId || '', kind, title, body, read: 'no',
  };
  db.notifications.unshift(row);
  return row;
}

/* ══════════════════════════════════════════════════════════════════════
   Auth — RBAC across the two portals
   ══════════════════════════════════════════════════════════════════════ */
const DLD_ACCOUNTS = {
  dld_executive: { name: 'H.E. Director, Marketing & Communications', role: 'dld_executive', portal: 'dld' },
  dld_manager:   { name: 'Campaign Manager, Partnerships Office',      role: 'dld_manager',   portal: 'dld' },
  dld_admin:     { name: 'Platform Administrator',                     role: 'dld_admin',     portal: 'dld' },
};

app.post('/api/auth/login', (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  if (DLD_ACCOUNTS[role]) {
    const acct = DLD_ACCOUNTS[role];
    // Demo credentials: password matches the username, or SSO.
    if (password !== username && password !== 'sso') return res.status(401).json({ error: 'Invalid credentials' });
    return res.json({ ...acct, username });
  }

  if (role === 'developer') {
    // A developer account is bound to one company record.
    const dev = db.developers.find((d) => d.developer_id === username) || db.developers[0];
    if (password !== username && password !== 'sso' && password !== 'developer') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.json({
      name: dev.contact_name, role: 'developer', portal: 'developer',
      username: dev.developer_id, developer_id: dev.developer_id, company: dev.name, tier: dev.tier,
    });
  }
  return res.status(401).json({ error: 'Unknown role' });
});

/** Developer accounts offered on the login screen. */
app.get('/api/auth/developers', (_req, res) => {
  res.json({
    developers: db.developers
      .filter((d) => d.status === 'active')
      .slice(0, 12)
      .map((d) => ({ developer_id: d.developer_id, name: d.name, tier: d.tier })),
  });
});

/* ══════════════════════════════════════════════════════════════════════
   DLD Screen 1 — Executive Smart Dashboard & Analytics
   ══════════════════════════════════════════════════════════════════════ */
app.get('/api/dld/dashboard', (_req, res) => {
  const devs = db.developers;
  const active = devs.filter((d) => d.status === 'active');
  const reqs = db.participation_requests;
  const approved = reqs.filter((r) => r.status === 'approved');
  const openReqs = reqs.filter((r) => r.status === 'pending' || r.status === 'under_review');
  const campaigns = db.campaigns;
  const live = campaigns.filter((c) => c.status === 'active');
  const done = campaigns.filter((c) => c.status === 'completed');
  const agreements = db.sponsorships;
  const activeAgr = agreements.filter((a) => a.status === 'active');
  const monthly = db.engagement_monthly;
  const last = monthly[monthly.length - 1] || {};
  const prev = monthly[monthly.length - 2] || last;
  const doneEvents = db.events.filter((e) => e.status === 'completed');

  const digitalPct = reqs.length ? (reqs.filter((r) => r.channel === 'platform').length / reqs.length) * 100 : 0;
  const approvalDays = avg(approved.filter((r) => r.approval_days !== ''), (r) => +r.approval_days);

  const delta = (a, b) => (b ? r1(((a - b) / b) * 100) : 0);

  res.json({
    // Composite hero score — one number an executive can quote, with its
    // components attached so it can be decomposed on the spot.
    health: ai.portfolioHealth(db, NOW),
    // Natural-language weekly summary, generated from measured deltas.
    digest: ai.digest(db, NOW),
    kpis: {
      // Adoption widget
      registeredPartners: devs.length,
      activePartners: active.length,
      activePct: r1((active.length / devs.length) * 100),
      adoptionTrend: delta(last.active_partners, prev.active_partners),
      // Efficiency tracker
      avgApprovalDays: r1(approvalDays),
      approvalTrend: delta(last.avg_approval_days, prev.avg_approval_days),
      digitalPct: r1(digitalPct),
      digitalTrend: delta(last.digital_pct, prev.digital_pct),
      openRequests: openReqs.length,
      // Programme volume
      campaignsActive: live.length,
      campaignsCompleted: done.length,
      totalReach: sum(campaigns, (c) => +c.reach || 0),
      avgEngagement: r1(avg(done, (c) => +c.engagement_rate || 0)),
      // Commercial
      activeAgreements: activeAgr.length,
      sponsorshipValue: sum(activeAgr, (a) => +a.value_aed || 0),
      blendedRoi: r1(avg(agreements, (a) => +a.roi_percent || 0)),
      partnerSatisfaction: last.satisfaction_partner || 0,

      /* ── Second row: delivery, portfolio and events ──
         Added because the first row reports what the Department *ran*, and
         says nothing about whether the commitments behind it were met, what
         physical portfolio sits behind the partnerships, or what the events
         programme returned. */
      commitmentDelivery: r1(sum(activeAgr, (a) => +a.commitments_total || 0)
        ? (sum(activeAgr, (a) => +a.commitments_met || 0) / sum(activeAgr, (a) => +a.commitments_total || 0)) * 100 : 0),
      collectionRate: r1(sum(agreements, (a) => +a.value_aed || 0)
        ? (sum(agreements, (a) => +a.invoiced_aed || 0) / sum(agreements, (a) => +a.value_aed || 0)) * 100 : 0),
      outstandingValue: sum(agreements, (a) => +a.value_aed || 0) - sum(agreements, (a) => +a.invoiced_aed || 0),
      flaggedAgreements: ai.anomalies(db, NOW).length,

      projectsMapped: db.projects.length,
      portfolioValue: sum(db.projects, (p) => +p.value_aed || 0),
      portfolioUnits: sum(db.projects, (p) => +p.units || 0),
      districts: new Set(db.projects.map((p) => p.district)).size,
      underConstruction: db.projects.filter((p) => p.status === 'under_construction').length,

      eventsDelivered: doneEvents.length,
      eventsUpcoming: db.events.filter((e) => e.status === 'confirmed').length,
      eventFootfall: sum(doneEvents, (e) => +e.footfall || 0),
      mediaValue: sum(doneEvents, (e) => +e.media_value_aed || 0),
      mediaRoi: sum(doneEvents, (e) => +e.budget_aed || 0)
        ? r1(((sum(doneEvents, (e) => +e.media_value_aed || 0) - sum(doneEvents, (e) => +e.budget_aed || 0))
            / sum(doneEvents, (e) => +e.budget_aed || 0)) * 100) : 0,

      meanEngagement: r1(avg(devs, (d) => +d.engagement_score || 0)),
      dormantPartners: devs.filter((d) => daysBetween(d.last_login, NOW) >= 45).length,
      leadsGenerated: sum(reqs, (r) => +r.leads_generated || 0),
      mediaMentions: sum(reqs, (r) => +r.media_mentions || 0),
      slaCompliance: openReqs.length
        ? Math.round((openReqs.filter((r) => daysBetween(r.submitted_date, NOW) <= 3).length / openReqs.length) * 100) : 100,
    },
    trend: monthly.map((m) => ({
      month: m.month,
      registered: m.registered_partners,
      active: m.active_partners,
      activePct: m.active_pct,
      approvalDays: m.avg_approval_days,
      digitalPct: m.digital_pct,
      partnerships: m.partnerships_active,
      submitted: m.requests_submitted,
      approved: m.requests_approved,
      satisfaction: m.satisfaction_partner,
    })),
    // Strategic impact: engagement distribution by developer tier.
    byTier: [...new Set(devs.map((d) => d.tier))].map((tier) => {
      const g = devs.filter((d) => d.tier === tier);
      const ids = new Set(g.map((d) => d.developer_id));
      return {
        tier,
        partners: g.length,
        active: g.filter((d) => d.status === 'active').length,
        avgEngagement: r1(avg(g, (d) => +d.engagement_score || 0)),
        requests: reqs.filter((r) => ids.has(r.developer_id)).length,
      };
    }).sort((a, b) => b.partners - a.partners),
    campaignMix: ['exhibition', 'campaign', 'initiative'].map((type) => ({
      type,
      count: campaigns.filter((c) => c.type === type).length,
      reach: sum(campaigns.filter((c) => c.type === type), (c) => +c.reach || 0),
    })),
    topPartners: [...devs]
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, 8)
      .map((d) => {
        const mine = reqs.filter((r) => r.developer_id === d.developer_id);
        return {
          developer_id: d.developer_id, name: d.name, tier: d.tier,
          engagement: d.engagement_score,
          participations: mine.filter((r) => r.status === 'approved').length,
          sponsorships: agreements.filter((a) => a.developer_id === d.developer_id).length,
          status: d.status,
        };
      }),
  });
});

/* ══════════════════════════════════════════════════════════════════════
   DLD Screen 2 — Joint Initiatives & Campaigns Manager
   ══════════════════════════════════════════════════════════════════════ */
app.get('/api/dld/campaigns', (_req, res) => {
  const reqs = db.participation_requests;
  const devs = devById();
  res.json({
    campaigns: db.campaigns.map((c) => {
      const mine = reqs.filter((r) => r.campaign_id === c.campaign_id);
      const approved = mine.filter((r) => r.status === 'approved');
      return {
        ...c,
        requests: mine.length,
        approved: approved.length,
        pending: mine.filter((r) => r.status === 'pending' || r.status === 'under_review').length,
        committed_aed: sum(approved, (r) => +r.commitment_aed || 0),
        partners: approved.slice(0, 6).map((r) => devs[r.developer_id]?.name).filter(Boolean),
      };
    }),
    // Feeds the "identify and invite target developers" picker in the modal.
    developers: db.developers.map((d) => ({
      developer_id: d.developer_id, name: d.name, tier: d.tier, status: d.status,
    })),
  });
});

/** Launch New Initiative — creates a campaign and invites target developers. */
app.post('/api/dld/campaigns', (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'Title is required' });

  const campaign = {
    campaign_id: `CMP-${String(++seqCampaign).padStart(3, '0')}`,
    title: b.title,
    type: b.type || 'campaign',
    status: 'draft',
    owner: b.owner || 'Marketing & Communications',
    location: b.location || 'Citywide',
    description: b.description || '',
    start_date: b.start_date || '',
    end_date: b.end_date || '',
    budget_aed: +b.budget_aed || 0,
    target_partners: (b.invited || []).length || +b.target_partners || 0,
    reach: 0, engagement_rate: 0, projects_featured: 0, progress_pct: 0,
  };
  db.campaigns.push(campaign);

  // Inviting a partner opens a pending request on their side — the same join
  // row a developer-initiated submission would create.
  for (const developerId of b.invited || []) {
    db.participation_requests.push({
      request_id: `REQ-${String(++seqRequest).padStart(4, '0')}`,
      campaign_id: campaign.campaign_id,
      developer_id: developerId,
      submitted_date: new Date().toISOString().slice(0, 10),
      status: 'pending', approval_days: '',
      documents_required: 4, documents_uploaded: 0,
      commitment_aed: 0, channel: 'platform',
      leads_generated: 0, media_mentions: 0,
    });
    notify('developer', developerId, 'info', `Invitation — ${campaign.title}`,
      `You have been invited to participate. Review the brief and submit a participation request.`);
  }
  res.status(201).json({ campaign });
});

/** Move a campaign along the pipeline (Draft → Review → Active → Completed). */
app.patch('/api/dld/campaigns/:id', (req, res) => {
  const c = db.campaigns.find((x) => x.campaign_id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Campaign not found' });
  const next = req.body?.status;
  if (!['draft', 'review', 'active', 'completed'].includes(next)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  c.status = next;
  if (next === 'active' && !c.progress_pct) c.progress_pct = 5;
  if (next === 'completed') c.progress_pct = 100;
  notify('all', '', 'info', `${c.title} moved to ${next}`, `Pipeline stage updated by the Partnerships Office.`);
  res.json({ campaign: c });
});

/* ══════════════════════════════════════════════════════════════════════
   DLD — Participation request queue (approval workflow)
   ══════════════════════════════════════════════════════════════════════ */
/** The service target a participation decision is measured against. This is the
 *  same 3 days the "Average request approval time" KPI reports on, so the queue
 *  and the dashboard cannot drift apart. */
const SLA_DAYS = 3;

/** Per-request SLA state: how long it has waited, and how that reads against
 *  the target. Only open requests have a running clock. */
function slaFor(r) {
  const open = r.status === 'pending' || r.status === 'under_review';
  const age = Math.max(0, daysBetween(r.submitted_date, NOW));
  if (!open) {
    return { open: false, age_days: +age.toFixed(1), state: 'closed', remaining_days: 0, pct: 100 };
  }
  const remaining = SLA_DAYS - age;
  return {
    open: true,
    age_days: +age.toFixed(1),
    remaining_days: +remaining.toFixed(1),
    // approaching gives the queue a warning band before it actually breaches.
    state: remaining < 0 ? 'breached' : remaining <= 1 ? 'approaching' : 'on_track',
    pct: Math.min(100, Math.round((age / SLA_DAYS) * 100)),
  };
}

app.get('/api/dld/requests', (req, res) => {
  const devs = devById();
  const cmps = cmpById();
  const status = req.query.status;
  let rows = db.participation_requests;
  if (status && status !== 'all') rows = rows.filter((r) => r.status === status);

  const mapped = rows.map((r) => ({
    ...r,
    developer_name: devs[r.developer_id]?.name || r.developer_id,
    developer_tier: devs[r.developer_id]?.tier || '',
    campaign_title: cmps[r.campaign_id]?.title || r.campaign_id,
    campaign_type: cmps[r.campaign_id]?.type || '',
    sla: slaFor(r),
  }));

  const all = db.participation_requests.map(slaFor).filter((s) => s.open);
  res.json({
    requests: mapped.sort((a, b) => {
      // Breaching work sorts to the top — the queue should read as a worklist,
      // not a chronological log.
      if (a.sla.open !== b.sla.open) return a.sla.open ? -1 : 1;
      if (a.sla.open) return b.sla.age_days - a.sla.age_days;
      return a.submitted_date < b.submitted_date ? 1 : -1;
    }),
    sla: {
      target_days: SLA_DAYS,
      open: all.length,
      breached: all.filter((s) => s.state === 'breached').length,
      approaching: all.filter((s) => s.state === 'approaching').length,
      on_track: all.filter((s) => s.state === 'on_track').length,
      compliance_pct: all.length
        ? Math.round((all.filter((s) => s.state !== 'breached').length / all.length) * 100) : 100,
      oldest_days: all.length ? +Math.max(...all.map((s) => s.age_days)).toFixed(1) : 0,
    },
  });
});

app.patch('/api/dld/requests/:id', (req, res) => {
  const r = db.participation_requests.find((x) => x.request_id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  const next = req.body?.status;
  if (!['approved', 'rejected', 'under_review'].includes(next)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  r.status = next;
  if (next === 'approved') {
    const submitted = new Date(r.submitted_date);
    r.approval_days = r1(Math.max(0.2, (Date.now() - submitted.getTime()) / 86400000));
  }
  const c = cmpById()[r.campaign_id];
  notify('developer', r.developer_id,
    next === 'approved' ? 'approval' : 'info',
    `Participation ${next} — ${c?.title || r.campaign_id}`,
    `Request ${r.request_id} is now ${next.replace('_', ' ')}.`);
  res.json({ request: r });
});

/* ══════════════════════════════════════════════════════════════════════
   DLD Screen 3 — Sponsorships & Agreements Ledger
   ══════════════════════════════════════════════════════════════════════ */
app.get('/api/dld/sponsorships', (_req, res) => {
  const devs = devById();
  const cmps = cmpById();
  // Anomaly findings are keyed by agreement so each ledger row can carry its
  // own flag rather than the risk living in a separate, ignorable panel.
  const flags = Object.fromEntries(ai.anomalies(db, NOW).map((a) => [a.agreement_id, a]));

  const rows = db.sponsorships.map((a) => ({
    ...a,
    developer_name: devs[a.developer_id]?.name || a.developer_id,
    developer_tier: devs[a.developer_id]?.tier || '',
    campaign_title: cmps[a.campaign_id]?.title || a.campaign_id,
    commitment_pct: a.commitments_total ? Math.round((a.commitments_met / a.commitments_total) * 100) : 0,
    collected_pct: a.value_aed ? Math.round((a.invoiced_aed / a.value_aed) * 100) : 0,
    days_to_expiry: Math.round(daysBetween(NOW, a.expiry_date)),
    anomaly: flags[a.agreement_id]
      ? { severity: flags[a.agreement_id].severity, reasons: flags[a.agreement_id].reasons }
      : null,
  }));
  const active = rows.filter((a) => a.status === 'active');
  res.json({
    agreements: rows.sort((a, b) => (a.signed_date < b.signed_date ? 1 : -1)),
    summary: {
      total: rows.length,
      active: active.length,
      expired: rows.filter((a) => a.status === 'expired').length,
      pending: rows.filter((a) => a.status === 'pending_signature').length,
      contractedValue: sum(rows, (a) => +a.value_aed || 0),
      activeValue: sum(active, (a) => +a.value_aed || 0),
      invoiced: sum(rows, (a) => +a.invoiced_aed || 0),
      blendedRoi: r1(avg(rows, (a) => +a.roi_percent || 0)),
      // Commitments at risk: live agreements under half-delivered.
      atRisk: active.filter((a) => a.commitment_pct < 50).length,
      flagged: Object.keys(flags).length,
      flaggedHigh: Object.values(flags).filter((f) => f.severity === 'high').length,
      // Delivery and collection, so the ledger reports what was honoured rather
      // than only what was signed.
      commitmentDelivery: r1(sum(active, (a) => +a.commitments_total || 0)
        ? (sum(active, (a) => +a.commitments_met || 0) / sum(active, (a) => +a.commitments_total || 0)) * 100 : 0),
      collectedPct: r1(sum(rows, (a) => +a.value_aed || 0)
        ? (sum(rows, (a) => +a.invoiced_aed || 0) / sum(rows, (a) => +a.value_aed || 0)) * 100 : 0),
    },
    anomalies: ai.anomalies(db, NOW),
    byTier: ['Platinum', 'Gold', 'Silver', 'Category'].map((tier) => {
      const g = rows.filter((a) => a.tier === tier);
      return {
        tier, count: g.length,
        value: sum(g, (a) => +a.value_aed || 0),
        roi: r1(avg(g, (a) => +a.roi_percent || 0)),
      };
    }),
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Developer Screen 1 — Partner Activity & Home Dashboard
   ══════════════════════════════════════════════════════════════════════ */
app.get('/api/developer/home', (req, res) => {
  const id = scopeDev(req);
  const dev = db.developers.find((d) => d.developer_id === id);
  if (!dev) return res.status(404).json({ error: 'Developer not found' });

  const cmps = cmpById();
  const mine = db.participation_requests.filter((r) => r.developer_id === id);
  const approved = mine.filter((r) => r.status === 'approved');
  const agreements = db.sponsorships.filter((a) => a.developer_id === id);

  // Task list: everything genuinely blocking the partner right now.
  const tasks = [];
  for (const r of mine) {
    const c = cmps[r.campaign_id];
    if (r.documents_uploaded < r.documents_required && r.status !== 'rejected') {
      tasks.push({
        id: `${r.request_id}-docs`, kind: 'upload', priority: r.status === 'pending' ? 'high' : 'medium',
        title: `Upload ${r.documents_required - r.documents_uploaded} outstanding document(s)`,
        context: c?.title || r.campaign_id, request_id: r.request_id,
      });
    }
    if (r.status === 'under_review') {
      tasks.push({
        id: `${r.request_id}-review`, kind: 'awaiting', priority: 'low',
        title: 'Awaiting DLD approval', context: c?.title || r.campaign_id, request_id: r.request_id,
      });
    }
  }
  for (const a of agreements) {
    if (a.status === 'pending_signature') {
      tasks.push({
        id: `${a.agreement_id}-sign`, kind: 'signature', priority: 'high',
        title: 'Sponsorship agreement awaiting signature', context: a.title, request_id: a.agreement_id,
      });
    } else if (a.status === 'active' && a.commitments_met < a.commitments_total) {
      tasks.push({
        id: `${a.agreement_id}-commit`, kind: 'commitment', priority: 'medium',
        title: `${a.commitments_total - a.commitments_met} sponsorship commitment(s) outstanding`,
        context: a.title, request_id: a.agreement_id,
      });
    }
  }
  const rank = { high: 0, medium: 1, low: 2 };
  tasks.sort((a, b) => rank[a.priority] - rank[b.priority]);

  // Peer benchmark — the partner's engagement against their own tier median.
  const peers = db.developers.filter((d) => d.tier === dev.tier);
  const tierMedian = r1(avg(peers, (d) => +d.engagement_score || 0));

  /* Obligation completion — the progress ring. Four strands, each a simple
     done/total, combined into one figure the partner can act on. A strand with
     nothing owed counts as complete rather than dragging the ring down. */
  const strand = (done, total, label) => ({
    label, done, total, pct: total ? Math.round((done / total) * 100) : 100,
  });
  const docsRequired = sum(mine, (r) => +r.documents_required || 0);
  const docsUploaded = sum(mine, (r) => Math.min(+r.documents_required || 0, +r.documents_uploaded || 0));
  const commitTotal = sum(agreements, (a) => +a.commitments_total || 0);
  const commitMet = sum(agreements, (a) => +a.commitments_met || 0);
  const decided = mine.filter((r) => r.status === 'approved' || r.status === 'rejected').length;
  const signed = agreements.filter((a) => a.status !== 'pending_signature').length;

  const strands = [
    strand(docsUploaded, docsRequired, 'Documents uploaded'),
    strand(decided, mine.length, 'Requests progressed'),
    strand(signed, agreements.length, 'Agreements signed'),
    strand(commitMet, commitTotal, 'Commitments delivered'),
  ];

  res.json({
    profile: {
      developer_id: dev.developer_id, name: dev.name, name_ar: dev.name_ar, tier: dev.tier,
      district: dev.district, contact_name: dev.contact_name, registered_date: dev.registered_date,
      projects_count: dev.projects_count, engagement_score: dev.engagement_score,
    },
    kpis: {
      activeParticipations: approved.filter((r) => cmps[r.campaign_id]?.status === 'active').length,
      totalParticipations: approved.length,
      pendingRequests: mine.filter((r) => r.status === 'pending' || r.status === 'under_review').length,
      openTasks: tasks.length,
      sponsorships: agreements.filter((a) => a.status === 'active').length,
      sponsorshipValue: sum(agreements.filter((a) => a.status === 'active'), (a) => +a.value_aed || 0),
      leadsGenerated: sum(mine, (r) => +r.leads_generated || 0),
      mediaMentions: sum(mine, (r) => +r.media_mentions || 0),
      engagementScore: dev.engagement_score,
      tierMedian,
    },
    completion: {
      pct: Math.round(avg(strands, (s) => s.pct)),
      strands,
    },
    tasks: tasks.slice(0, 8),
    // Personalised outcomes per campaign the partner actually joined.
    outcomes: approved
      .map((r) => {
        const c = cmps[r.campaign_id];
        return c && {
          campaign_id: c.campaign_id, title: c.title, type: c.type, status: c.status,
          reach: c.reach, engagement_rate: c.engagement_rate,
          leads: r.leads_generated, mentions: r.media_mentions,
          commitment_aed: r.commitment_aed,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 6),
    requests: mine.map((r) => ({
      ...r,
      campaign_title: cmps[r.campaign_id]?.title || r.campaign_id,
      campaign_status: cmps[r.campaign_id]?.status || '',
    })).sort((a, b) => (a.submitted_date < b.submitted_date ? 1 : -1)),
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Developer Screen 2 — Opportunity Marketplace
   ══════════════════════════════════════════════════════════════════════ */
/**
 * Scores an open programme for one specific partner — the mirror image of the
 * DLD-side matcher. Same evidence, opposite direction: there we rank partners
 * for a campaign, here we rank campaigns for a partner.
 */
function recommendFor(developerId, campaign, mine) {
  const dev = db.developers.find((d) => d.developer_id === developerId);
  if (!dev) return null;
  const cmps = cmpById();
  const approved = mine.filter((r) => r.status === 'approved');
  const sameFormat = approved.filter((r) => cmps[r.campaign_id]?.type === campaign.type);

  const reasons = [];
  let score = 40;

  if (sameFormat.length) {
    score += Math.min(24, sameFormat.length * 8);
    reasons.push(`You have delivered ${sameFormat.length} ${campaign.type}${sameFormat.length === 1 ? '' : 's'} before`);
  }
  const loc = String(campaign.location || '').toLowerCase();
  if (loc.includes(String(dev.district).toLowerCase())) {
    score += 18;
    reasons.push(`Runs in ${dev.district}, where your portfolio is concentrated`);
  } else if (loc.includes('citywide') || loc.includes('digital')) {
    score += 8;
    reasons.push('Citywide reach, open to your full portfolio');
  }
  // Scarcity is genuinely decision-relevant for a partner choosing what to join.
  const taken = db.participation_requests.filter((x) => x.campaign_id === campaign.campaign_id).length;
  const left = Math.max(0, +campaign.target_partners - taken);
  if (left > 0 && left <= 3) {
    score += 14;
    reasons.push(`Only ${left} partner slot${left === 1 ? '' : 's'} remaining`);
  }
  if (campaign.status === 'review' || campaign.status === 'draft') {
    score += 8;
    reasons.push('Early-stage — joining now shapes the brief');
  }
  const leadYield = sameFormat.length
    ? Math.round(approved.filter((r) => cmps[r.campaign_id]?.type === campaign.type)
        .reduce((s, r) => s + (+r.leads_generated || 0), 0) / sameFormat.length)
    : 0;
  if (leadYield > 0) {
    score += Math.min(12, leadYield / 60);
    reasons.push(`This format has averaged ${leadYield} leads for you`);
  }

  return { score: Math.min(99, Math.round(score)), reasons };
}

app.get('/api/developer/marketplace', (req, res) => {
  const id = scopeDev(req);
  const mine = db.participation_requests.filter((r) => r.developer_id === id);
  const joined = Object.fromEntries(mine.map((r) => [r.campaign_id, r]));

  // Open opportunities are anything not yet completed — draft included, since
  // DLD invites partners at draft stage.
  const opportunities = db.campaigns
    .filter((c) => c.status !== 'completed')
    .map((c) => {
      const r = joined[c.campaign_id];
      const totalRequests = db.participation_requests.filter((x) => x.campaign_id === c.campaign_id).length;
      const rec = id ? recommendFor(id, c, mine) : null;
      return {
        campaign_id: c.campaign_id, title: c.title, type: c.type, status: c.status,
        description: c.description, location: c.location, owner: c.owner,
        start_date: c.start_date, end_date: c.end_date,
        target_partners: c.target_partners,
        slots_taken: totalRequests,
        slots_left: Math.max(0, c.target_partners - totalRequests),
        documents_required: r?.documents_required || 4,
        my_status: r ? r.status : null,
        my_request_id: r ? r.request_id : null,
        my_documents: r ? `${r.documents_uploaded}/${r.documents_required}` : null,
        match_score: rec?.score || null,
        match_reasons: rec?.reasons || [],
      };
    })
    .sort((a, b) => (a.start_date > b.start_date ? 1 : -1));

  res.json({
    opportunities,
    // "Recommended for you" — unjoined programmes, best fit first.
    recommended: opportunities
      .filter((o) => !o.my_status && o.match_score)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 3),
    history: db.campaigns
      .filter((c) => c.status === 'completed' && joined[c.campaign_id])
      .map((c) => ({
        campaign_id: c.campaign_id, title: c.title, type: c.type,
        end_date: c.end_date, status: joined[c.campaign_id].status,
        leads: joined[c.campaign_id].leads_generated,
      })),
  });
});

/** Submit Participation Request — the wizard's final step. */
app.post('/api/developer/requests', (req, res) => {
  const { developer_id, campaign_id, commitment_aed, documents_uploaded } = req.body || {};
  if (!developer_id || !campaign_id) return res.status(400).json({ error: 'developer_id and campaign_id required' });

  const c = db.campaigns.find((x) => x.campaign_id === campaign_id);
  if (!c) return res.status(404).json({ error: 'Campaign not found' });
  const dev = db.developers.find((d) => d.developer_id === developer_id);

  // Re-submitting against an existing invitation updates it rather than
  // creating a duplicate join row.
  let r = db.participation_requests.find(
    (x) => x.developer_id === developer_id && x.campaign_id === campaign_id
  );
  if (r) {
    r.status = 'under_review';
    r.documents_uploaded = Math.min(r.documents_required, +documents_uploaded || r.documents_uploaded);
    r.commitment_aed = +commitment_aed || r.commitment_aed;
    r.submitted_date = new Date().toISOString().slice(0, 10);
  } else {
    r = {
      request_id: `REQ-${String(++seqRequest).padStart(4, '0')}`,
      campaign_id, developer_id,
      submitted_date: new Date().toISOString().slice(0, 10),
      status: 'under_review', approval_days: '',
      documents_required: 4, documents_uploaded: Math.min(4, +documents_uploaded || 0),
      commitment_aed: +commitment_aed || 0, channel: 'platform',
      leads_generated: 0, media_mentions: 0,
    };
    db.participation_requests.push(r);
  }

  // Digital workflow rule from the roadmap: an upload pings the DLD
  // Communications Center so approvals stay entirely on-platform.
  notify('dld', developer_id, 'upload', `${dev?.name || developer_id} submitted a participation request`,
    `"${c.title}" — ${r.documents_uploaded}/${r.documents_required} documents received. Awaiting review.`);

  res.status(201).json({ request: r });
});

/* ══════════════════════════════════════════════════════════════════════
   Screen 3 (shared) — Content and Digital Assets Library
   ══════════════════════════════════════════════════════════════════════ */
app.get('/api/assets', (req, res) => {
  const cmps = cmpById();
  const id = scopeDev(req);
  // Partners see everything open to all partners, plus assets for campaigns
  // they were actually approved on.
  const approvedCampaigns = id
    ? new Set(db.participation_requests
        .filter((r) => r.developer_id === id && r.status === 'approved')
        .map((r) => r.campaign_id))
    : null;

  const rows = db.assets
    .filter((a) => !id || a.access === 'all_partners' || approvedCampaigns.has(a.campaign_id))
    .map((a) => ({
      ...a,
      campaign_title: cmps[a.campaign_id]?.title || a.campaign_id,
      campaign_type: cmps[a.campaign_id]?.type || '',
    }));

  res.json({
    assets: rows.sort((a, b) => (a.uploaded_date < b.uploaded_date ? 1 : -1)),
    facets: {
      types: [...new Set(rows.map((a) => a.type))],
      fileTypes: [...new Set(rows.map((a) => a.file_type))],
      campaigns: [...new Set(rows.map((a) => a.campaign_title))],
    },
  });
});

/** Download counter — proves the library is live rather than static. */
app.post('/api/assets/:id/download', (req, res) => {
  const a = db.assets.find((x) => x.asset_id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Asset not found' });
  a.downloads = (+a.downloads || 0) + 1;
  res.json({ asset_id: a.asset_id, downloads: a.downloads });
});

/* ══════════════════════════════════════════════════════════════════════
   Communication & Notifications Center
   ══════════════════════════════════════════════════════════════════════ */
/** Where a notification should take you when clicked. The inbox is only useful
 *  if every row is a route into the record it is about. */
function linkFor(n, scoped) {
  const t = `${n.title} ${n.body}`.toLowerCase();
  if (scoped) {
    if (t.includes('event') || t.includes('stand')) return '/partner/events';
    if (n.kind === 'approval' || t.includes('participation')) return '/partner';
    if (t.includes('asset') || t.includes('brand kit')) return '/partner/assets';
    return '/partner/marketplace';
  }
  if (n.kind === 'upload') return '/dld/requests';
  if (t.includes('event')) return '/dld/events';
  if (t.includes('sponsor') || t.includes('agreement')) return '/dld/sponsorships';
  if (t.includes('campaign') || t.includes('invitation') || t.includes('pipeline')) return '/dld/campaigns';
  return '/dld';
}

/** Coarse bucket, so the inbox can be filtered the way a mail client is. */
const bucketFor = (n) =>
  n.kind === 'upload' ? 'action'
  : n.kind === 'approval' ? 'approvals'
  : n.kind === 'alert' ? 'alerts'
  : 'updates';

app.get('/api/notifications', (req, res) => {
  const id = scopeDev(req);
  const bucket = req.query.bucket;
  const unreadOnly = req.query.unread === 'true';

  let rows = db.notifications
    .filter((n) => (id
      ? (n.audience === 'all' || (n.audience === 'developer' && n.developer_id === id))
      : (n.audience === 'all' || n.audience === 'dld')))
    .map((n) => ({ ...n, link: linkFor(n, id), bucket: bucketFor(n) }));

  const counts = {
    all: rows.length,
    action: rows.filter((n) => n.bucket === 'action').length,
    approvals: rows.filter((n) => n.bucket === 'approvals').length,
    alerts: rows.filter((n) => n.bucket === 'alerts').length,
    updates: rows.filter((n) => n.bucket === 'updates').length,
  };
  const unread = rows.filter((n) => n.read === 'no').length;

  if (bucket && bucket !== 'all') rows = rows.filter((n) => n.bucket === bucket);
  if (unreadOnly) rows = rows.filter((n) => n.read === 'no');

  res.json({ notifications: rows.slice(0, 60), unread, counts });
});

app.post('/api/notifications/read', (req, res) => {
  for (const n of db.notifications) {
    if (!req.body?.id || n.notif_id === req.body.id) n.read = 'yes';
  }
  res.json({ ok: true });
});

/** Explicit unread, so the inbox behaves like an inbox rather than a log. */
app.post('/api/notifications/unread', (req, res) => {
  const n = db.notifications.find((x) => x.notif_id === req.body?.id);
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  n.read = 'no';
  res.json({ ok: true });
});

/** AI advisories — the purple advisory panel, scoped per portal. */
app.get('/api/advisories', (req, res) => {
  const portal = req.query.portal === 'developer' ? 'developer' : 'dld';
  res.json({ advisories: db.advisories.filter((a) => a.audience === portal) });
});

/** Per-module rotating advisory strip, generated from current data. */
app.get('/api/advisories/module', (req, res) => {
  const module = String(req.query.module || 'dashboard');
  res.json({ module, advisories: content.advisories(db, module, NOW, scopeDev(req)) });
});

/** KPI explainer behind a tile: definition, maths, chart and advisory. */
app.get('/api/kpi/:id', (req, res) => {
  const detail = content.kpiDetail(db, req.params.id, NOW);
  if (!detail) return res.status(404).json({ error: `No KPI registered as "${req.params.id}"` });
  res.json(detail);
});

/** Ask S!a — module-scoped question suggestions. */
app.get('/api/assistant/suggestions', (req, res) => {
  res.json({ module: req.query.module || 'dashboard', questions: content.qaPairs(String(req.query.module || 'dashboard')) });
});

/* ══════════════════════════════════════════════════════════════════════
   Live notification stream
   ══════════════════════════════════════════════════════════════════════
   The Communication Center is meant to feel like an operations desk rather
   than a static log, so the server keeps emitting plausible workflow events
   drawn from real rows — a partner uploading, a decision landing, a milestone
   falling due. The client polls; each event names actual records, so opening
   one still lands on something real. */
const LIVE_EVENTS = [
  (d, c) => ['upload', `${d.name} uploaded materials`,
    `Documents received for "${c.title}". Awaiting review by the Partnerships Office.`, 'dld'],
  (d, c) => ['upload', `${d.name} submitted a participation request`,
    `New request against "${c.title}". The 3-day service clock has started.`, 'dld'],
  (d, c) => ['info', `${d.name} viewed the brief for ${c.title}`,
    `Partner engagement recorded. No action required.`, 'dld'],
  (d, c) => ['alert', `Commitment milestone due — ${d.name}`,
    `A contracted deliverable on an active agreement falls due this week.`, 'dld'],
  (d, c) => ['approval', `Participation approved — ${c.title}`,
    `${d.name} has been confirmed onto the programme. Asset deadlines are now live.`, 'all'],
  (d, c) => ['info', `Asset pack refreshed — ${c.title}`,
    `Updated brand materials are available in the Content & Assets library.`, 'all'],
  (d, c) => ['alert', `Registration closing soon — ${c.title}`,
    `Partner slots for this programme close shortly. Remaining capacity is limited.`, 'all'],
];

function emitLiveNotification() {
  const devs = db.developers.filter((d) => d.status === 'active');
  const cmps = db.campaigns.filter((c) => c.status === 'active' || c.status === 'review');
  if (!devs.length || !cmps.length) return;

  const d = devs[Math.floor(Math.random() * devs.length)];
  const c = cmps[Math.floor(Math.random() * cmps.length)];
  const [kind, title, body, audience] = LIVE_EVENTS[Math.floor(Math.random() * LIVE_EVENTS.length)](d, c);

  notify(audience, audience === 'dld' ? d.developer_id : d.developer_id, kind, title, body);
  // The feed is a rolling window, not an archive — otherwise a long-running
  // demo session grows the payload without bound.
  if (db.notifications.length > 220) db.notifications.length = 220;
}
// Staggered rather than fixed so the badge does not tick like a metronome.
setInterval(emitLiveNotification, 18000 + Math.floor(Math.random() * 14000)).unref?.();

/* ══════════════════════════════════════════════════════════════════════
   Partner Directory — the registry behind every other DLD screen
   ══════════════════════════════════════════════════════════════════════
   The dashboard leaderboard shows the top eight and the twin shows whoever
   has projects on screen. Neither is a register: there was no screen that
   simply answered "who are our partners, and what is our relationship with
   each of them". This is that screen. */
app.get('/api/dld/partners', (_req, res) => {
  const cmps = cmpById();
  const flags = ai.anomalies(db, NOW);
  const grade = (s) => (s >= 88 ? 'Platinum' : s >= 74 ? 'Gold' : s >= 58 ? 'Silver' : 'Bronze');

  const partners = db.developers.map((d) => {
    const reqs = db.participation_requests.filter((r) => r.developer_id === d.developer_id);
    const approved = reqs.filter((r) => r.status === 'approved');
    const agreements = db.sponsorships.filter((a) => a.developer_id === d.developer_id);
    const activeAgr = agreements.filter((a) => a.status === 'active');
    const projects = db.projects.filter((p) => p.developer_id === d.developer_id);
    const events = db.event_participations.filter((p) => p.developer_id === d.developer_id && p.status === 'confirmed');
    const myFlags = flags.filter((f) => f.developer_id === d.developer_id);
    const idle = Math.round(daysBetween(d.last_login, NOW));

    return {
      developer_id: d.developer_id,
      name: d.name, name_ar: d.name_ar, tier: d.tier, district: d.district,
      contact_name: d.contact_name, contact_email: d.contact_email,
      status: d.status, registered_date: d.registered_date,
      engagement_score: +d.engagement_score,
      grade: grade(+d.engagement_score),
      days_since_login: idle,
      // Relationship depth, which is what the directory is actually for.
      participations: approved.length,
      pending: reqs.filter((r) => r.status === 'pending' || r.status === 'under_review').length,
      agreements: agreements.length,
      active_agreements: activeAgr.length,
      contracted_aed: sum(agreements, (a) => +a.value_aed || 0),
      committed_aed: sum(activeAgr, (a) => +a.value_aed || 0),
      roi_percent: agreements.length ? r1(avg(agreements, (a) => +a.roi_percent || 0)) : 0,
      leads: sum(reqs, (r) => +r.leads_generated || 0),
      events: events.length,
      projects: projects.length,
      portfolio_aed: sum(projects, (p) => +p.value_aed || 0),
      portfolio_units: sum(projects, (p) => +p.units || 0),
      flags: myFlags.length,
      risk: myFlags.some((f) => f.severity === 'high') ? 'high'
        : myFlags.length ? 'medium' : 'none',
      // The live programmes this partner is currently on.
      live_programmes: approved
        .filter((r) => cmps[r.campaign_id]?.status === 'active')
        .map((r) => cmps[r.campaign_id].title),
    };
  }).sort((a, b) => b.engagement_score - a.engagement_score);

  res.json({
    partners,
    summary: {
      total: partners.length,
      active: partners.filter((p) => p.status === 'active').length,
      dormant: partners.filter((p) => p.days_since_login >= 45).length,
      atRisk: partners.filter((p) => p.risk !== 'none').length,
      contracted: sum(partners, (p) => p.contracted_aed),
      portfolio: sum(partners, (p) => p.portfolio_aed),
      meanEngagement: r1(avg(partners, (p) => p.engagement_score)),
      byGrade: ['Platinum', 'Gold', 'Silver', 'Bronze'].map((g) => ({
        grade: g, count: partners.filter((p) => p.grade === g).length,
      })),
      byTier: [...new Set(partners.map((p) => p.tier))].map((tier) => ({
        tier, count: partners.filter((p) => p.tier === tier).length,
        contracted: sum(partners.filter((p) => p.tier === tier), (p) => p.contracted_aed),
      })),
    },
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Developer Screen — My Agreements
   ══════════════════════════════════════════════════════════════════════
   The DLD side has had a full ledger from the start; the partner side could
   only see agreements as task stubs on the home screen. A partner cannot
   manage a commitment they cannot see, so this is the counterpart view —
   scoped, as every developer endpoint is, to their own rows. */
app.get('/api/developer/agreements', (req, res) => {
  const id = scopeDev(req);
  if (!id) return res.status(400).json({ error: 'Developer scope required' });
  const cmps = cmpById();
  const flags = ai.anomalies(db, NOW).filter((f) => f.developer_id === id);

  const rows = db.sponsorships.filter((a) => a.developer_id === id).map((a) => {
    const flag = flags.find((f) => f.agreement_id === a.agreement_id);
    return {
      agreement_id: a.agreement_id, title: a.title, tier: a.tier, status: a.status,
      campaign_id: a.campaign_id,
      campaign_title: cmps[a.campaign_id]?.title || a.campaign_id,
      campaign_status: cmps[a.campaign_id]?.status || '',
      value_aed: +a.value_aed, invoiced_aed: +a.invoiced_aed,
      roi_percent: +a.roi_percent,
      signed_date: a.signed_date, expiry_date: a.expiry_date,
      commitments_total: +a.commitments_total, commitments_met: +a.commitments_met,
      commitment_pct: +a.commitments_total
        ? Math.round((+a.commitments_met / +a.commitments_total) * 100) : 0,
      collected_pct: +a.value_aed ? Math.round((+a.invoiced_aed / +a.value_aed) * 100) : 0,
      days_to_expiry: Math.round(daysBetween(NOW, a.expiry_date)),
      outstanding: Math.max(0, +a.commitments_total - +a.commitments_met),
      // Partners see the finding, phrased as their action rather than as a
      // Department-side risk note.
      attention: flag ? { severity: flag.severity, reasons: flag.reasons } : null,
    };
  }).sort((a, b) => (a.signed_date < b.signed_date ? 1 : -1));

  const active = rows.filter((a) => a.status === 'active');
  res.json({
    agreements: rows,
    summary: {
      total: rows.length,
      active: active.length,
      pendingSignature: rows.filter((a) => a.status === 'pending_signature').length,
      expired: rows.filter((a) => a.status === 'expired').length,
      contracted: sum(rows, (a) => a.value_aed),
      activeValue: sum(active, (a) => a.value_aed),
      invoiced: sum(rows, (a) => a.invoiced_aed),
      commitmentsOutstanding: sum(active, (a) => a.outstanding),
      commitmentPct: sum(active, (a) => a.commitments_total)
        ? r1((sum(active, (a) => a.commitments_met) / sum(active, (a) => a.commitments_total)) * 100) : 0,
      roi: rows.length ? r1(avg(rows, (a) => a.roi_percent)) : 0,
      needsAttention: rows.filter((a) => a.attention).length,
      expiringSoon: active.filter((a) => a.days_to_expiry > 0 && a.days_to_expiry <= 90).length,
    },
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Digital Twin — the geospatial layer
   ══════════════════════════════════════════════════════════════════════ */

/** Quarter key for a date, e.g. 2026-Q2. */
const quarterOf = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-Q${Math.floor(dt.getMonth() / 3) + 1}`;
};

/**
 * Per-developer engagement state, which is what the twin actually colours by.
 *   active   — holds an approved participation on a live programme
 *   at_risk  — holds a flagged agreement, or is behind on commitments
 *   inactive — registered, but nothing running
 */
function developerStates() {
  const flags = ai.anomalies(db, NOW);
  const flaggedDevs = new Set(flags.map((f) => f.developer_id));
  const cmps = cmpById();
  const out = {};

  for (const d of db.developers) {
    const reqs = db.participation_requests.filter((r) => r.developer_id === d.developer_id);
    const approved = reqs.filter((r) => r.status === 'approved');
    const liveApproved = approved.filter((r) => cmps[r.campaign_id]?.status === 'active');
    const agreements = db.sponsorships.filter((a) => a.developer_id === d.developer_id);
    const activeAgr = agreements.filter((a) => a.status === 'active');

    const state = flaggedDevs.has(d.developer_id) ? 'at_risk'
      : liveApproved.length || activeAgr.length ? 'active'
      : 'inactive';

    out[d.developer_id] = {
      state,
      engagement: +d.engagement_score,
      tier: d.tier,
      live_campaigns: liveApproved.length,
      total_participations: approved.length,
      agreements: agreements.length,
      active_agreements: activeAgr.length,
      committed_aed: sum(activeAgr, (a) => +a.value_aed || 0),
      roi_percent: agreements.length ? r1(avg(agreements, (a) => +a.roi_percent || 0)) : 0,
      flags: flags.filter((f) => f.developer_id === d.developer_id).length,
      days_since_login: Math.round(daysBetween(d.last_login, NOW)),
    };
  }
  return out;
}

app.get('/api/twin', (req, res) => {
  const scoped = scopeDev(req);
  const devs = devById();
  const states = developerStates();

  const projects = db.projects
    .filter((p) => !scoped || p.developer_id === scoped)
    .map((p) => {
      const d = devs[p.developer_id];
      const s = states[p.developer_id] || {};
      return {
        project_id: p.project_id, name: p.name, district: p.district,
        lng: +p.lng, lat: +p.lat,
        type: p.type, status: p.status,
        floors: +p.floors, height_m: +p.height_m, units: +p.units,
        value_aed: +p.value_aed, sold_pct: +p.sold_pct,
        sustainability: p.sustainability,
        launch_date: p.launch_date, completion_date: p.completion_date,
        developer_id: p.developer_id,
        developer_name: d?.name || p.developer_id,
        developer_tier: d?.tier || '',
        // The three attributes the layer toggles style on.
        engagement_state: s.state || 'inactive',
        engagement_score: s.engagement || 0,
        roi_percent: s.roi_percent || 0,
        committed_aed: s.committed_aed || 0,
        live_campaigns: s.live_campaigns || 0,
      };
    });

  // District rollup — powers cluster labels at low zoom and the heatmap weight.
  const byDistrict = {};
  for (const p of projects) {
    const g = (byDistrict[p.district] = byDistrict[p.district] || {
      district: p.district, lng: 0, lat: 0, projects: 0, units: 0,
      value_aed: 0, committed_aed: 0, developers: new Set(),
      active: 0, at_risk: 0, inactive: 0, engagement_sum: 0,
    });
    g.projects++; g.units += p.units; g.value_aed += p.value_aed;
    g.lng += p.lng; g.lat += p.lat;
    g.developers.add(p.developer_id);
    g.engagement_sum += p.engagement_score;
    g[p.engagement_state]++;
  }
  const districts = Object.values(byDistrict).map((g) => ({
    district: g.district,
    lng: +(g.lng / g.projects).toFixed(5),
    lat: +(g.lat / g.projects).toFixed(5),
    projects: g.projects, units: g.units, value_aed: g.value_aed,
    developers: g.developers.size,
    active: g.active, at_risk: g.at_risk, inactive: g.inactive,
    avg_engagement: r1(g.engagement_sum / g.projects),
  })).sort((a, b) => b.value_aed - a.value_aed);

  /* ── Time slider. For each quarter in the series, which partners were
     engaged at that point — so scrubbing shows partnership density growing
     rather than a static snapshot. */
  const cmps = cmpById();
  // Span the whole recorded history, not just the request log — campaigns and
  // agreements both start earlier, and the slider is meant to show the
  // partnership footprint growing from the beginning.
  const allDates = [
    ...db.campaigns.map((c) => c.start_date),
    ...db.sponsorships.map((a) => a.signed_date),
    ...db.participation_requests.map((r) => r.submitted_date),
  ].filter(Boolean).sort();
  const startQ = allDates.length ? quarterOf(allDates[0]) : quarterOf(NOW);
  const quarters = [];
  {
    const [sy, sq] = startQ.split('-Q').map(Number);
    let y = sy, q = sq;
    const endY = NOW.getFullYear(), endQ = Math.floor(NOW.getMonth() / 3) + 1;
    while (y < endY || (y === endY && q <= endQ)) {
      const start = new Date(Date.UTC(y, (q - 1) * 3, 1));
      const end = new Date(Date.UTC(y, q * 3, 0));
      const engaged = new Set();
      let value = 0;

      for (const r of db.participation_requests) {
        if (r.status !== 'approved') continue;
        const c = cmps[r.campaign_id];
        if (!c) continue;
        // Engaged in this quarter if their programme was running in it.
        if (new Date(c.start_date) <= end && new Date(c.end_date) >= start) {
          engaged.add(r.developer_id);
        }
      }
      for (const a of db.sponsorships) {
        if (new Date(a.signed_date) <= end && new Date(a.expiry_date) >= start) {
          engaged.add(a.developer_id);
          value += +a.value_aed || 0;
        }
      }
      quarters.push({
        key: `${y}-Q${q}`,
        label: `Q${q} ${y}`,
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
        engaged: [...engaged],
        partners: engaged.size,
        value_aed: value,
        campaigns: db.campaigns.filter((c) =>
          new Date(c.start_date) <= end && new Date(c.end_date) >= start).length,
      });
      q++; if (q > 4) { q = 1; y++; }
    }
  }

  res.json({
    projects,
    districts,
    quarters,
    // Events render as their own layer — venues, not developer assets.
    events: db.events.map((e) => ({
      event_id: e.event_id, title: e.title, type: e.type, venue: e.venue,
      lng: +e.lng, lat: +e.lat, status: e.status,
      start_date: e.start_date, end_date: e.end_date,
      registered: +e.registered, capacity: +e.capacity, footfall: +e.footfall,
    })),
    summary: {
      projects: projects.length,
      developers: new Set(projects.map((p) => p.developer_id)).size,
      districts: districts.length,
      units: sum(projects, (p) => p.units),
      value_aed: sum(projects, (p) => p.value_aed),
      active: projects.filter((p) => p.engagement_state === 'active').length,
      at_risk: projects.filter((p) => p.engagement_state === 'at_risk').length,
      inactive: projects.filter((p) => p.engagement_state === 'inactive').length,
      under_construction: projects.filter((p) => p.status === 'under_construction').length,
    },
  });
});

/** Drill-down for the twin's side panel: one developer, everything about them. */
app.get('/api/twin/developer/:id', (req, res) => {
  const scoped = scopeDev(req);
  if (scoped && scoped !== req.params.id) return res.status(403).json({ error: 'Out of scope' });

  const d = db.developers.find((x) => x.developer_id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Developer not found' });

  const cmps = cmpById();
  const reqs = db.participation_requests.filter((r) => r.developer_id === d.developer_id);
  const agreements = db.sponsorships.filter((a) => a.developer_id === d.developer_id);
  const projects = db.projects.filter((p) => p.developer_id === d.developer_id);
  const flags = ai.anomalies(db, NOW).filter((f) => f.developer_id === d.developer_id);

  res.json({
    developer: {
      ...d,
      days_since_login: Math.round(daysBetween(d.last_login, NOW)),
      mapped_projects: projects.length,
      portfolio_value_aed: sum(projects, (p) => +p.value_aed || 0),
      portfolio_units: sum(projects, (p) => +p.units || 0),
    },
    campaigns: reqs.map((r) => ({
      request_id: r.request_id, status: r.status,
      campaign_id: r.campaign_id,
      campaign_title: cmps[r.campaign_id]?.title || r.campaign_id,
      campaign_status: cmps[r.campaign_id]?.status || '',
      campaign_type: cmps[r.campaign_id]?.type || '',
      leads: +r.leads_generated || 0,
      commitment_aed: +r.commitment_aed || 0,
    })).sort((a, b) => (a.campaign_status === 'active' ? -1 : 1)),
    agreements: agreements.map((a) => ({
      agreement_id: a.agreement_id, title: a.title, tier: a.tier, status: a.status,
      value_aed: +a.value_aed, roi_percent: +a.roi_percent,
      commitments: `${a.commitments_met}/${a.commitments_total}`,
      commitment_pct: a.commitments_total ? Math.round((a.commitments_met / a.commitments_total) * 100) : 0,
      expiry_date: a.expiry_date,
    })),
    projects: projects.map((p) => ({
      project_id: p.project_id, name: p.name, district: p.district,
      type: p.type, status: p.status, units: +p.units, floors: +p.floors,
      value_aed: +p.value_aed, sold_pct: +p.sold_pct, sustainability: p.sustainability,
    })),
    flags,
    tasks: [],
  });
});

/* ══════════════════════════════════════════════════════════════════════
   AI services
   ══════════════════════════════════════════════════════════════════════ */

/** Partnership Copilot — natural-language query. */
app.post('/api/ai/copilot', (req, res) => {
  const q = String(req.body?.question || '').slice(0, 500);
  if (!q.trim()) return res.status(400).json({ error: 'A question is required' });
  try {
    res.json(ai.answer(db, q, NOW));
  } catch (e) {
    res.status(500).json({ error: `Copilot could not answer that: ${e.message}` });
  }
});

app.get('/api/ai/suggestions', (_req, res) => res.json({ suggestions: ai.SUGGESTIONS }));

/** What-If campaign simulator. */
app.post('/api/ai/simulate', (req, res) => {
  try {
    res.json(ai.simulate(db, req.body || {}, NOW));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Smart partner matching for a campaign brief. */
app.post('/api/ai/match', (req, res) => {
  try {
    res.json(ai.matchPartners(db, req.body || {}, NOW));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/ai/anomalies', (_req, res) => res.json({ anomalies: ai.anomalies(db, NOW) }));
app.get('/api/ai/digest', (_req, res) => res.json(ai.digest(db, NOW)));

/* ══════════════════════════════════════════════════════════════════════
   KPI traceability — every KPI in the brief, mapped to where it lives
   ══════════════════════════════════════════════════════════════════════ */
app.get('/api/kpi-traceability', (_req, res) => res.json(kpi.build(db, NOW)));

/* ══════════════════════════════════════════════════════════════════════
   Events & Exhibitions (Section IV.3)
   ══════════════════════════════════════════════════════════════════════ */
app.get('/api/events', (req, res) => {
  const scoped = scopeDev(req);
  const devs = devById();

  const events = db.events.map((e) => {
    const all = db.event_participations.filter((p) => p.event_id === e.event_id);
    const mine = scoped ? all.find((p) => p.developer_id === scoped) : null;
    // A partner sees the roster count but never another partner's row.
    const roster = scoped ? (mine ? [mine] : []) : all;

    return {
      ...e,
      lng: +e.lng, lat: +e.lat,
      capacity: +e.capacity, registered: +e.registered,
      footfall: +e.footfall, leads_generated: +e.leads_generated,
      media_value_aed: +e.media_value_aed, budget_aed: +e.budget_aed,
      satisfaction: +e.satisfaction,
      days_until: Math.round(daysBetween(NOW, e.start_date)),
      fill_pct: +e.capacity ? Math.round((+e.registered / +e.capacity) * 100) : 0,
      media_roi_pct: +e.budget_aed
        ? r1(((+e.media_value_aed - +e.budget_aed) / +e.budget_aed) * 100) : 0,
      partners_confirmed: all.filter((p) => p.status === 'confirmed').length,
      partners_pending: all.filter((p) => p.status === 'pending' || p.status === 'invited').length,
      slots_left: Math.max(0, +e.target_partners - all.filter((p) => p.status === 'confirmed').length),
      participations: roster.map((p) => ({
        ...p,
        developer_name: devs[p.developer_id]?.name || p.developer_id,
        developer_tier: devs[p.developer_id]?.tier || '',
        booth_sqm: +p.booth_sqm, cost_aed: +p.cost_aed,
        leads_captured: +p.leads_captured, meetings_held: +p.meetings_held,
      })),
      my_participation: mine ? {
        participation_id: mine.participation_id, status: mine.status,
        booth_sqm: +mine.booth_sqm, stand_number: mine.stand_number,
        documents: `${mine.documents_uploaded}/${mine.documents_required}`,
        cost_aed: +mine.cost_aed,
        leads_captured: +mine.leads_captured,
      } : null,
    };
  }).sort((a, b) => (a.start_date < b.start_date ? 1 : -1));

  const done = events.filter((e) => e.status === 'completed');
  res.json({
    events,
    summary: {
      total: events.length,
      completed: done.length,
      live: events.filter((e) => e.status === 'live').length,
      upcoming: events.filter((e) => e.status === 'confirmed').length,
      planning: events.filter((e) => e.status === 'planning').length,
      footfall: sum(done, (e) => e.footfall),
      leads: sum(done, (e) => e.leads_generated),
      budget: sum(events, (e) => e.budget_aed),
      mediaValue: sum(done, (e) => e.media_value_aed),
      mediaRoi: sum(done, (e) => e.budget_aed)
        ? r1(((sum(done, (e) => e.media_value_aed) - sum(done, (e) => e.budget_aed)) / sum(done, (e) => e.budget_aed)) * 100) : 0,
      avgSatisfaction: r1(avg(done, (e) => e.satisfaction)),
      confirmedParticipations: db.event_participations.filter((p) => p.status === 'confirmed').length,
    },
  });
});

/** A developer registering interest in an event — mirrors the campaign wizard. */
app.post('/api/events/:id/participate', (req, res) => {
  const e = db.events.find((x) => x.event_id === req.params.id);
  if (!e) return res.status(404).json({ error: 'Event not found' });

  const { developer_id, booth_sqm, staff_count, documents_uploaded } = req.body || {};
  if (!developer_id) return res.status(400).json({ error: 'developer_id required' });
  const dev = db.developers.find((d) => d.developer_id === developer_id);

  let p = db.event_participations.find(
    (x) => x.event_id === e.event_id && x.developer_id === developer_id
  );
  if (p) {
    p.status = 'pending';
    p.booth_sqm = +booth_sqm || p.booth_sqm;
    p.staff_count = +staff_count || p.staff_count;
    p.documents_uploaded = Math.min(+p.documents_required, +documents_uploaded || p.documents_uploaded);
  } else {
    p = {
      participation_id: `EVP-${String(++seqEventPart).padStart(4, '0')}`,
      event_id: e.event_id, developer_id,
      status: 'pending',
      booth_sqm: +booth_sqm || 0,
      stand_number: '',
      staff_count: +staff_count || 1,
      documents_required: 4,
      documents_uploaded: Math.min(4, +documents_uploaded || 0),
      cost_aed: (+booth_sqm || 0) * 1600,
      leads_captured: 0, meetings_held: 0,
    };
    db.event_participations.push(p);
  }

  notify('dld', developer_id, 'upload', `${dev?.name || developer_id} registered for ${e.title}`,
    `${p.booth_sqm ? `${p.booth_sqm} sqm stand requested. ` : ''}${p.documents_uploaded}/${p.documents_required} documents received.`);
  res.status(201).json({ participation: p });
});

/** DLD confirming or declining an event participation. */
app.patch('/api/events/participations/:id', (req, res) => {
  const p = db.event_participations.find((x) => x.participation_id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Participation not found' });
  const next = req.body?.status;
  if (!['confirmed', 'declined', 'pending'].includes(next)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  p.status = next;
  if (next === 'confirmed' && !p.stand_number && +p.booth_sqm) {
    p.stand_number = `${['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]}${10 + Math.floor(Math.random() * 80)}`;
  }
  const e = db.events.find((x) => x.event_id === p.event_id);
  notify('developer', p.developer_id, next === 'confirmed' ? 'approval' : 'info',
    `Event participation ${next} — ${e?.title || p.event_id}`,
    next === 'confirmed'
      ? `Confirmed${p.stand_number ? ` · stand ${p.stand_number}` : ''}. Logistics pack is in your asset library.`
      : `Your registration is now ${next}.`);
  res.json({ participation: p });
});

/** Move an event along its pipeline. */
app.patch('/api/events/:id', (req, res) => {
  const e = db.events.find((x) => x.event_id === req.params.id);
  if (!e) return res.status(404).json({ error: 'Event not found' });
  const next = req.body?.status;
  if (!['planning', 'confirmed', 'live', 'completed'].includes(next)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  e.status = next;
  notify('all', '', 'info', `${e.title} is now ${next}`, `Event pipeline updated by Events & Exhibitions.`);
  res.json({ event: e });
});

/* ══════════════════════════════════════════════════════════════════════
   Global search — one box across every entity the role can see
   ══════════════════════════════════════════════════════════════════════ */
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const scoped = scopeDev(req);
  if (q.length < 2) return res.json({ results: [], query: q });

  const hit = (...vals) => vals.some((v) => String(v || '').toLowerCase().includes(q));
  const devs = devById();
  const out = [];

  if (!scoped) {
    for (const d of db.developers) {
      if (hit(d.name, d.name_ar, d.tier, d.district, d.contact_name, d.developer_id)) {
        out.push({
          kind: 'developer', id: d.developer_id, title: d.name,
          sub: `${d.tier} · ${d.district} · engagement ${d.engagement_score}`,
          to: '/dld/twin', focus: d.developer_id,
        });
      }
    }
  }
  for (const c of db.campaigns) {
    if (hit(c.title, c.type, c.location, c.owner, c.campaign_id)) {
      out.push({
        kind: 'campaign', id: c.campaign_id, title: c.title,
        sub: `${c.type} · ${c.status} · ${c.location}`,
        to: scoped ? '/partner/marketplace' : '/dld/campaigns', focus: c.campaign_id,
      });
    }
  }
  for (const a of db.sponsorships) {
    if (scoped && a.developer_id !== scoped) continue;
    if (hit(a.title, a.tier, a.agreement_id, devs[a.developer_id]?.name)) {
      out.push({
        kind: 'agreement', id: a.agreement_id, title: a.title,
        sub: `${devs[a.developer_id]?.name || a.developer_id} · ${a.tier} · AED ${(+a.value_aed).toLocaleString('en-US')}`,
        to: scoped ? '/partner' : '/dld/sponsorships', focus: a.agreement_id,
      });
    }
  }
  for (const p of db.projects) {
    if (scoped && p.developer_id !== scoped) continue;
    if (hit(p.name, p.district, p.type, p.project_id)) {
      out.push({
        kind: 'project', id: p.project_id, title: p.name,
        sub: `${devs[p.developer_id]?.name || p.developer_id} · ${p.district} · ${p.units} units`,
        to: scoped ? '/partner/twin' : '/dld/twin', focus: p.project_id,
      });
    }
  }
  for (const e of db.events) {
    if (hit(e.title, e.type, e.venue, e.event_id)) {
      out.push({
        kind: 'event', id: e.event_id, title: e.title,
        sub: `${e.type} · ${e.venue} · ${e.start_date}`,
        to: scoped ? '/partner/events' : '/dld/events', focus: e.event_id,
      });
    }
  }
  for (const a of db.assets) {
    if (hit(a.title, a.type, a.file_type)) {
      out.push({
        kind: 'asset', id: a.asset_id, title: a.title,
        sub: `${a.type} · ${a.file_type} · ${a.downloads} downloads`,
        to: scoped ? '/partner/assets' : '/dld/assets', focus: a.asset_id,
      });
    }
  }

  // Exact-ish matches first, then by kind, so the list reads predictably.
  const KIND_ORDER = { developer: 0, campaign: 1, event: 2, agreement: 3, project: 4, asset: 5 };
  out.sort((a, b) => {
    const as = a.title.toLowerCase().startsWith(q) ? 0 : 1;
    const bs = b.title.toLowerCase().startsWith(q) ? 0 : 1;
    return as - bs || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title);
  });

  res.json({
    query: q,
    total: out.length,
    counts: Object.fromEntries(Object.keys(KIND_ORDER).map((k) => [k, out.filter((r) => r.kind === k).length])),
    results: out.slice(0, 40),
  });
});

/* ── static build + SPA fallback ────────────────────────────────── */
const DIST = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST)) {
  /* Vite fingerprints every filename it emits into dist/assets, so those may
     be cached forever. Files copied verbatim from client/public (the brand
     marks) keep their names and must not be. index.html least of all, or a
     redeploy stays invisible to anyone holding a warm cache. */
  const FINGERPRINTED = path.sep + 'assets' + path.sep;
  app.use(express.static(DIST, {
    setHeaders: (res, filePath) => {
      if (filePath.includes(FINGERPRINTED)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  console.warn('No /dist build found — run `npm run build` to serve the SPA from this process.');
}

/* Behind Hostinger's Passenger/Nginx front end the app sees a proxied request;
   trusting it keeps req.protocol and req.ip honest. PORT is what the platform
   injects, API_PORT is the local dev convention. */
app.set('trust proxy', true);
const PORT = process.env.PORT || process.env.API_PORT || 5061;

/* Passenger — the runtime behind hPanel's Node.js application — hands the
   process its own listening socket and patches listen() to use it. The
   single-argument form is the one it reliably intercepts; passing an explicit
   interface alongside it can leave the app bound somewhere Passenger is not
   proxying to, and the front end reports that as a 504. So only bind an
   interface when something actually asked for one: Docker and the PM2/systemd
   units set HOST=0.0.0.0 themselves, Hostinger does not. With HOST unset Node
   listens on every interface anyway, so nothing else loses reachability. */
const HOST = process.env.HOST;
const announce = () => console.log(`DLD platform → http://${HOST || 'localhost'}:${PORT}`);
const server = HOST ? app.listen(PORT, HOST, announce) : app.listen(PORT, announce);

/* A bind failure must say so. Left unhandled it is an unhelpful stack trace in
   a log nobody reads, and the only symptom anyone sees is the gateway timing
   out against a process that died on startup. */
server.on('error', (err) => {
  console.error(`Cannot listen on ${HOST ? HOST + ':' : 'port '}${PORT} — ${err.code}: ${err.message}`);
  process.exit(1);
});

module.exports = app;
