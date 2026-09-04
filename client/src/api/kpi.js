/* Ported verbatim from the Express server (server/lib/) — pure logic over the
   in-memory dataset, with no Node dependency. Only the export syntax changed. */

import { anomalies } from './ai.js';

/**
 * KPI traceability — Section VII of the brief, mapped to the platform.
 *
 * The point of this module is auditability. For every KPI the Department named,
 * it states four things: the definition, the current measured value, the target,
 * and the exact screen and widget where an operator can see it. A KPI with no
 * `where` is a KPI the platform claims but does not actually surface, and the
 * coverage summary at the bottom counts those honestly rather than hiding them.
 */
const sum = (a, f) => a.reduce((s, x) => s + (f ? +f(x) || 0 : +x || 0), 0);
const avg = (a, f) => (a.length ? sum(a, f) / a.length : 0);
const r1 = (n) => Math.round(n * 10) / 10;
const r0 = (n) => Math.round(n);
const DAY = 86400000;
const daysBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / DAY;

/** direction: 'up' = higher is better, 'down' = lower is better. */
function statusOf(value, target, direction) {
  if (target === null || target === undefined) return 'tracked';
  const ok = direction === 'down' ? value <= target : value >= target;
  if (ok) return 'on_target';
  const margin = direction === 'down' ? value / target : target / value;
  return margin <= 1.15 ? 'near_target' : 'off_target';
}

function build(db, now) {
  const NOW = now || new Date();
  const m = db.engagement_monthly;
  const last = m[m.length - 1] || {};
  const first = m[0] || {};
  const yearAgo = m[Math.max(0, m.length - 13)] || first;

  const devs = db.developers;
  const active = devs.filter((d) => d.status === 'active');
  const reqs = db.participation_requests;
  const approved = reqs.filter((r) => r.status === 'approved');
  const open = reqs.filter((r) => r.status === 'pending' || r.status === 'under_review');
  const campaigns = db.campaigns;
  const doneCampaigns = campaigns.filter((c) => c.status === 'completed');
  const agreements = db.sponsorships;
  const activeAgr = agreements.filter((a) => a.status === 'active');
  const doneEvents = db.events.filter((e) => e.status === 'completed');

  const K = (o) => ({ ...o, status: statusOf(o.value, o.target, o.direction) });

  const groups = [
    {
      group: 'Adoption & Reach',
      brief: 'Section VII.1 — platform adoption across the developer ecosystem',
      kpis: [
        K({
          id: 'registered_partners', name: 'Registered developer partners',
          definition: 'Count of developer organisations onboarded onto the platform.',
          value: devs.length, unit: '', target: 25, direction: 'up',
          where: { screen: 'Executive Smart Dashboard', route: '/dld', widget: 'Registered Partners KPI tile' },
        }),
        K({
          id: 'active_rate', name: 'Active partner rate',
          definition: 'Share of registered partners with platform activity in the trailing period.',
          value: r1((active.length / Math.max(1, devs.length)) * 100), unit: '%', target: 80, direction: 'up',
          where: { screen: 'Executive Smart Dashboard', route: '/dld', widget: 'Registered Partners tile · Adoption by Tier chart' },
        }),
        K({
          id: 'partnership_growth', name: 'Partnership growth rate',
          definition: 'Year-on-year change in active partnerships.',
          value: r1(((+last.partnerships_active - +yearAgo.partnerships_active) / Math.max(1, +yearAgo.partnerships_active)) * 100),
          unit: '%', target: 20, direction: 'up',
          where: { screen: 'Executive Smart Dashboard', route: '/dld', widget: 'Ecosystem Growth trend chart' },
        }),
        K({
          id: 'geographic_coverage', name: 'Geographic coverage',
          definition: 'Districts of Dubai with at least one mapped partner project.',
          value: new Set(db.projects.map((p) => p.district)).size, unit: ' districts', target: 20, direction: 'up',
          where: { screen: 'Digital Twin', route: '/dld/twin', widget: 'District clustering · portfolio layer' },
        }),
      ],
    },
    {
      group: 'Operational Efficiency',
      brief: 'Section VII.2 — turnaround and digitalisation of partner transactions',
      kpis: [
        K({
          id: 'avg_approval_time', name: 'Average request approval time',
          definition: 'Mean elapsed days from participation request submission to decision.',
          value: r1(avg(approved.filter((r) => r.approval_days !== ''), (r) => +r.approval_days)),
          unit: ' days', target: 3, direction: 'down',
          where: { screen: 'Approval Queue', route: '/dld/requests', widget: 'SLA timers · Avg. Approval Time tile' },
        }),
        K({
          id: 'sla_compliance', name: 'SLA compliance rate',
          definition: 'Share of open requests still inside the 3-day service target.',
          value: open.length ? r1((open.filter((r) => daysBetween(r.submitted_date, NOW) <= 3).length / open.length) * 100) : 100,
          unit: '%', target: 90, direction: 'up',
          where: { screen: 'Approval Queue', route: '/dld/requests', widget: 'SLA banner and per-row timer' },
        }),
        K({
          id: 'digital_completion', name: 'Digitally completed transactions',
          definition: 'Share of partner transactions completed entirely on-platform rather than by email.',
          value: r1(reqs.length ? (reqs.filter((r) => r.channel === 'platform').length / reqs.length) * 100 : 0),
          unit: '%', target: 95, direction: 'up',
          where: { screen: 'Executive Smart Dashboard', route: '/dld', widget: 'Digital Completion trend chart' },
        }),
        K({
          id: 'open_backlog', name: 'Open request backlog',
          definition: 'Participation requests awaiting a decision right now.',
          value: open.length, unit: '', target: 20, direction: 'down',
          where: { screen: 'Approval Queue', route: '/dld/requests', widget: 'Queue counts by status' },
        }),
      ],
    },
    {
      group: 'Engagement & Participation',
      brief: 'Section VII.6 — developer engagement levels and programme participation',
      kpis: [
        K({
          id: 'mean_engagement', name: 'Mean developer engagement score',
          definition: 'Composite of login recency, participation volume and commitment delivery, 0–100.',
          value: r1(avg(devs, (d) => +d.engagement_score)), unit: '/100', target: 70, direction: 'up',
          where: { screen: 'Executive Smart Dashboard', route: '/dld', widget: 'Partner Leaderboard with tier badges' },
        }),
        K({
          id: 'participation_rate', name: 'Participation approval rate',
          definition: 'Share of participation requests that reach approved status.',
          value: r1(reqs.length ? (approved.length / reqs.length) * 100 : 0), unit: '%', target: 80, direction: 'up',
          where: { screen: 'Initiatives & Campaigns', route: '/dld/campaigns', widget: 'Per-campaign approved/pending counts' },
        }),
        K({
          id: 'avg_partners_per_campaign', name: 'Average partners per programme',
          definition: 'Mean approved participants across launched programmes.',
          value: r1(avg(campaigns.filter((c) => c.status !== 'draft'), (c) => approved.filter((r) => r.campaign_id === c.campaign_id).length)),
          unit: '', target: 6, direction: 'up',
          where: { screen: 'Initiatives & Campaigns', route: '/dld/campaigns', widget: 'Kanban card partner chips' },
        }),
        K({
          id: 'dormant_partners', name: 'Dormant partners',
          definition: 'Partners with no platform activity for 45 days or more.',
          value: devs.filter((d) => daysBetween(d.last_login, NOW) >= 45).length, unit: '', target: 6, direction: 'down',
          where: { screen: 'AI Partnership Copilot', route: '/dld/copilot', widget: 'Inactive-partner query' },
        }),
      ],
    },
    {
      group: 'Commercial Performance',
      brief: 'Section VII.4 — sponsorship value, return and commitment delivery',
      kpis: [
        K({
          id: 'contracted_value', name: 'Total contracted sponsorship value',
          definition: 'Aggregate value of all sponsorship agreements on the ledger.',
          value: sum(agreements, (a) => +a.value_aed), unit: 'AED', format: 'aed', target: null, direction: 'up',
          where: { screen: 'Sponsorships Ledger', route: '/dld/sponsorships', widget: 'Contracted value summary' },
        }),
        K({
          id: 'blended_roi', name: 'Blended sponsorship ROI',
          definition: 'Mean return across all sponsorship agreements.',
          value: r1(avg(agreements, (a) => +a.roi_percent)), unit: '%', target: 60, direction: 'up',
          where: { screen: 'Sponsorships Ledger', route: '/dld/sponsorships', widget: 'ROI by tier breakdown' },
        }),
        K({
          id: 'commitment_delivery', name: 'Commitment delivery rate',
          definition: 'Share of contracted commitments actually met on live agreements.',
          value: r1(sum(activeAgr, (a) => +a.commitments_total) ? (sum(activeAgr, (a) => +a.commitments_met) / sum(activeAgr, (a) => +a.commitments_total)) * 100 : 0),
          unit: '%', target: 75, direction: 'up',
          where: { screen: 'Sponsorships Ledger', route: '/dld/sponsorships', widget: 'Per-agreement commitment bars' },
        }),
        K({
          id: 'collection_rate', name: 'Invoice collection rate',
          definition: 'Invoiced value as a share of contracted value.',
          value: r1(sum(agreements, (a) => +a.value_aed) ? (sum(agreements, (a) => +a.invoiced_aed) / sum(agreements, (a) => +a.value_aed)) * 100 : 0),
          unit: '%', target: 70, direction: 'up',
          where: { screen: 'Sponsorships Ledger', route: '/dld/sponsorships', widget: 'Collected column' },
        }),
        K({
          id: 'agreements_at_risk', name: 'Agreements at risk',
          definition: 'Live agreements tripping at least one anomaly rule.',
          value: anomalies(db, NOW).length, unit: '', target: 8, direction: 'down',
          where: { screen: 'Sponsorships Ledger', route: '/dld/sponsorships', widget: 'AI anomaly detection panel' },
        }),
      ],
    },
    {
      group: 'Programme Impact',
      brief: 'Section VII.3 — reach, engagement and lead generation from joint programmes',
      kpis: [
        K({
          id: 'total_reach', name: 'Total programme reach',
          definition: 'Cumulative audience reached across all programmes.',
          value: sum(campaigns, (c) => +c.reach), unit: '', format: 'compact', target: null, direction: 'up',
          where: { screen: 'Executive Smart Dashboard', route: '/dld', widget: 'Total Campaign Reach tile · Programme Mix' },
        }),
        K({
          id: 'avg_engagement_rate', name: 'Average programme engagement rate',
          definition: 'Mean engagement rate across completed programmes.',
          value: r1(avg(doneCampaigns, (c) => +c.engagement_rate)), unit: '%', target: 5, direction: 'up',
          where: { screen: 'Executive Smart Dashboard', route: '/dld', widget: 'Programme Mix panel' },
        }),
        K({
          id: 'leads_generated', name: 'Leads generated for partners',
          definition: 'Cumulative qualified leads delivered to partners through programmes.',
          value: sum(reqs, (r) => +r.leads_generated), unit: '', format: 'compact', target: null, direction: 'up',
          where: { screen: 'Partner Activity', route: '/partner', widget: 'Personalised outcomes panel' },
        }),
        K({
          id: 'cost_per_1k_reach', name: 'Cost per thousand reached',
          definition: 'Programme budget divided by reach, in thousands — the format-efficiency comparable.',
          value: sum(doneCampaigns, (c) => +c.reach)
            ? r1(sum(doneCampaigns, (c) => +c.budget_aed) / (sum(doneCampaigns, (c) => +c.reach) / 1000)) : 0,
          unit: 'AED', target: 60, direction: 'down',
          where: { screen: 'What-If Simulator', route: '/dld/simulator', widget: 'Projection and sensitivity table' },
        }),
      ],
    },
    {
      group: 'Events & Exhibitions',
      brief: 'Section IV.3 — participation management and event impact reporting',
      kpis: [
        K({
          id: 'events_delivered', name: 'Events delivered',
          definition: 'Events completed on the platform calendar.',
          value: doneEvents.length, unit: '', target: 4, direction: 'up',
          where: { screen: 'Events & Exhibitions', route: '/dld/events', widget: 'Event pipeline board' },
        }),
        K({
          id: 'event_footfall', name: 'Total event footfall',
          definition: 'Aggregate attendance across completed events.',
          value: sum(doneEvents, (e) => +e.footfall), unit: '', format: 'compact', target: null, direction: 'up',
          where: { screen: 'Events & Exhibitions', route: '/dld/events', widget: 'Impact reporting panel' },
        }),
        K({
          id: 'event_media_roi', name: 'Event media ROI',
          definition: 'Earned media value against event budget, across completed events.',
          value: sum(doneEvents, (e) => +e.budget_aed)
            ? r1(((sum(doneEvents, (e) => +e.media_value_aed) - sum(doneEvents, (e) => +e.budget_aed)) / sum(doneEvents, (e) => +e.budget_aed)) * 100) : 0,
          unit: '%', target: 100, direction: 'up',
          where: { screen: 'Events & Exhibitions', route: '/dld/events', widget: 'Impact reporting panel' },
        }),
        K({
          id: 'event_partner_participation', name: 'Confirmed event participations',
          definition: 'Developer participations confirmed across all events.',
          value: db.event_participations.filter((p) => p.status === 'confirmed').length, unit: '', target: 40, direction: 'up',
          where: { screen: 'Events & Exhibitions', route: '/dld/events', widget: 'Participation roster' },
        }),
      ],
    },
    {
      group: 'Satisfaction & Service',
      brief: 'Section VII.5 — partner and internal stakeholder satisfaction',
      kpis: [
        K({
          id: 'partner_satisfaction', name: 'Partner satisfaction',
          definition: 'Rolling monthly partner survey score, out of 5.',
          value: +last.satisfaction_partner || 0, unit: '/5', target: 4.2, direction: 'up',
          where: { screen: 'Executive Smart Dashboard', route: '/dld', widget: 'Partner Satisfaction tile' },
        }),
        K({
          id: 'internal_satisfaction', name: 'Internal stakeholder satisfaction',
          definition: 'Rolling monthly internal survey score, out of 5.',
          value: +last.satisfaction_internal || 0, unit: '/5', target: 4.0, direction: 'up',
          where: { screen: 'Executive Smart Dashboard', route: '/dld', widget: 'Trend series (internal satisfaction)' },
        }),
        K({
          id: 'asset_utilisation', name: 'Digital asset utilisation',
          definition: 'Total downloads from the shared content and asset library.',
          value: sum(db.assets, (a) => +a.downloads), unit: '', format: 'compact', target: null, direction: 'up',
          where: { screen: 'Content & Assets Library', route: '/dld/assets', widget: 'Per-asset download counters' },
        }),
      ],
    },
  ];

  const all = groups.flatMap((g) => g.kpis);
  return {
    groups,
    coverage: {
      total: all.length,
      surfaced: all.filter((k) => k.where).length,
      on_target: all.filter((k) => k.status === 'on_target').length,
      near_target: all.filter((k) => k.status === 'near_target').length,
      off_target: all.filter((k) => k.status === 'off_target').length,
      tracked_no_target: all.filter((k) => k.status === 'tracked').length,
      screens: [...new Set(all.map((k) => k.where?.screen).filter(Boolean))].length,
    },
  };
}

export { build };
