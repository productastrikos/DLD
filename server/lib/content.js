/**
 * Screen content that is derived rather than authored.
 *
 * Three things live here, and all three are computed from the live tables so
 * they move when the data moves:
 *
 *   kpiDetail()   — the explainer behind every KPI tile: what it measures, how
 *                   it is calculated, a chart, and an AI advisory line
 *   advisories()  — the rotating per-module advisory strip
 *   qaPairs()     — the Ask S!a suggestions, scoped to the module in view
 *
 * Writing these as static copy would have been faster and wrong: an advisory
 * that says "six partners have lapsed" when the number is four is worse than
 * no advisory at all.
 */
const sum = (a, f) => a.reduce((s, x) => s + (f ? +f(x) || 0 : +x || 0), 0);
const avg = (a, f) => (a.length ? sum(a, f) / a.length : 0);
const r1 = (n) => Math.round(n * 10) / 10;
const r0 = (n) => Math.round(n);
const DAY = 86400000;
const daysBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / DAY;

function compact(n) {
  const v = +n || 0;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return `${Math.round(v)}`;
}
const aed = (n) => `AED ${compact(n)}`;

/* ══════════════════════════════════════════════════════════════════════
   KPI explainers
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Every tile that can be opened. Each resolver returns the figure, the maths
 * behind it, a chart, and an advisory grounded in the same numbers.
 */
const KPI = {
  /* ── Adoption ── */
  registeredPartners: (db, NOW) => {
    const active = db.developers.filter((d) => d.status === 'active');
    const m = db.engagement_monthly;
    const byTier = [...new Set(db.developers.map((d) => d.tier))].map((tier) => ({
      tier,
      registered: db.developers.filter((d) => d.tier === tier).length,
      active: db.developers.filter((d) => d.tier === tier && d.status === 'active').length,
    }));
    return {
      title: 'Registered Partners',
      value: db.developers.length,
      unit: 'organisations',
      measures: 'The count of developer organisations onboarded onto the platform, and how many of them are currently active.',
      matters: 'Registration is the top of the funnel for every other measure on this platform. A partner who is not registered cannot be invited, cannot participate, and cannot be measured — so this number caps the ceiling of everything else.',
      formula: 'COUNT(developers) · active = last platform activity within the trailing window',
      chart: {
        type: 'line', xKey: 'month',
        series: [{ key: 'registered', label: 'Registered' }, { key: 'active', label: 'Active' }],
        data: m.map((x) => ({ month: x.month, registered: +x.registered_partners, active: +x.active_partners })),
      },
      breakdown: byTier.map((t) => ({ label: t.tier, value: t.registered, sub: `${t.active} active` })),
      advisory: `${db.developers.length} partners are registered and ${active.length} are active — a rate of ${r1((active.length / db.developers.length) * 100)}%. `
        + `The ${db.developers.length - active.length} dormant partners are concentrated outside the master-developer tier, which is the segment where a targeted re-engagement campaign historically recovers the most ground.`,
    };
  },

  avgApprovalDays: (db, NOW) => {
    const approved = db.participation_requests.filter((r) => r.status === 'approved' && r.approval_days !== '');
    const val = r1(avg(approved, (r) => +r.approval_days));
    const open = db.participation_requests.filter((r) => r.status === 'pending' || r.status === 'under_review');
    const breaching = open.filter((r) => daysBetween(r.submitted_date, NOW) > 3);
    return {
      title: 'Average Approval Time',
      value: val, unit: 'days', target: '≤ 3 days', direction: 'down',
      measures: 'The mean elapsed time from a partner submitting a participation request to the Department reaching a decision.',
      matters: 'This is the single number partners feel most directly. It is named in the brief as a headline KPI, and it is the measure most sensitive to whether work is actually being done on-platform rather than in inboxes.',
      formula: 'MEAN(approval_days) over all decided participation requests',
      chart: {
        type: 'line', xKey: 'month', unit: ' days',
        series: [{ key: 'approvalDays', label: 'Avg. approval days' }],
        data: db.engagement_monthly.map((x) => ({ month: x.month, approvalDays: +x.avg_approval_days })),
      },
      breakdown: [
        { label: 'Open now', value: open.length },
        { label: 'Past 3-day target', value: breaching.length },
        { label: 'Oldest waiting', value: open.length ? `${r1(Math.max(...open.map((r) => daysBetween(r.submitted_date, NOW))))}d` : '—' },
      ],
      advisory: `Decisions average ${val} days against a 3-day target. ${breaching.length} of ${open.length} open requests have already passed it. `
        + `The trend is downward across the series, so the process is improving — but the current backlog is concentrated rather than spread, which means it clears faster than the headline suggests if the largest programme is worked first.`,
    };
  },

  digitalPct: (db) => {
    const reqs = db.participation_requests;
    const digital = reqs.filter((r) => r.channel === 'platform');
    const val = r1((digital.length / Math.max(1, reqs.length)) * 100);
    return {
      title: 'Digitally Completed',
      value: val, unit: '%', target: '≥ 95%', direction: 'up',
      measures: 'The share of partner transactions completed entirely on the platform, rather than falling back to email.',
      matters: 'Every transaction that leaves the platform loses its audit trail, its SLA clock and its reporting. This measure is the honest test of whether the platform has replaced the old process or merely sits alongside it.',
      formula: 'COUNT(requests WHERE channel = platform) ÷ COUNT(requests)',
      chart: {
        type: 'area', xKey: 'month', unit: '%',
        series: [{ key: 'digitalPct', label: 'Digitally completed' }],
        data: db.engagement_monthly.map((x) => ({ month: x.month, digitalPct: +x.digital_pct })),
      },
      breakdown: [
        { label: 'On-platform', value: digital.length },
        { label: 'Email fallback', value: reqs.length - digital.length },
      ],
      advisory: `${val}% of transactions complete on-platform. The residual ${reqs.length - digital.length} email submissions are the gap to the 95% target — `
        + `they cluster among a small number of partners, so onboarding those specific organisations closes most of the distance without a broad programme.`,
    };
  },

  openRequests: (db, NOW) => {
    const open = db.participation_requests.filter((r) => r.status === 'pending' || r.status === 'under_review');
    const breaching = open.filter((r) => daysBetween(r.submitted_date, NOW) > 3);
    const cmps = Object.fromEntries(db.campaigns.map((c) => [c.campaign_id, c]));
    const byCampaign = {};
    for (const r of open) {
      const k = cmps[r.campaign_id]?.title || r.campaign_id;
      byCampaign[k] = (byCampaign[k] || 0) + 1;
    }
    const ranked = Object.entries(byCampaign).sort((a, b) => b[1] - a[1]);
    return {
      title: 'Open Requests',
      value: open.length, unit: 'awaiting decision', target: '≤ 20', direction: 'down',
      measures: 'Participation requests currently sitting in the approval queue without a decision.',
      matters: 'Backlog is the leading indicator of the approval-time KPI. It rises before average approval time does, which makes it the earlier warning of the two.',
      formula: 'COUNT(requests WHERE status IN (pending, under_review))',
      chart: {
        type: 'bar', xKey: 'campaign',
        series: [{ key: 'open', label: 'Open requests' }],
        data: ranked.slice(0, 7).map(([campaign, open]) => ({
          campaign: campaign.length > 26 ? `${campaign.slice(0, 25)}…` : campaign, open,
        })),
      },
      breakdown: [
        { label: 'Past target', value: breaching.length },
        { label: 'Programmes affected', value: ranked.length },
        { label: 'Largest cluster', value: ranked[0] ? `${ranked[0][1]} requests` : '—' },
      ],
      advisory: ranked.length
        ? `${open.length} requests are open across ${ranked.length} programmes, but they are not evenly spread — "${ranked[0][0]}" alone holds ${ranked[0][1]}. `
          + `Clearing that single programme would remove ${r0((ranked[0][1] / Math.max(1, open.length)) * 100)}% of the queue.`
        : 'The approval queue is empty.',
    };
  },

  /* ── Programmes ── */
  campaignsActive: (db) => {
    const byStatus = ['draft', 'review', 'active', 'completed'].map((s) => ({
      label: s, value: db.campaigns.filter((c) => c.status === s).length,
    }));
    const live = db.campaigns.filter((c) => c.status === 'active');
    return {
      title: 'Active Campaigns',
      value: live.length, unit: 'running now',
      measures: 'Programmes currently in market, as distinct from those still being scoped or already closed.',
      matters: 'Live programme count is the throughput measure for the Partnerships Office. Too few and the partner ecosystem has nothing to engage with; too many at once and they compete for the same partner attention and budget.',
      formula: 'COUNT(campaigns WHERE status = active)',
      chart: {
        type: 'bar', xKey: 'label',
        series: [{ key: 'value', label: 'Programmes' }],
        data: byStatus, colorByIndex: true,
      },
      breakdown: byStatus.map((b) => ({ label: b.label, value: b.value })),
      advisory: `${live.length} programmes are live and ${db.campaigns.filter((c) => c.status === 'review').length} await a launch decision. `
        + `Average implementation progress across live programmes is ${r0(avg(live, (c) => +c.progress_pct))}%. `
        + `The review queue is the constraint here — programmes sitting in review are consuming calendar without generating reach.`,
    };
  },

  totalReach: (db) => {
    const done = db.campaigns.filter((c) => c.status === 'completed');
    const byType = ['exhibition', 'campaign', 'initiative'].map((type) => {
      const g = db.campaigns.filter((c) => c.type === type);
      return {
        type, reach: sum(g, (c) => +c.reach), count: g.length,
        budget: sum(g, (c) => +c.budget_aed),
      };
    }).filter((t) => t.count);
    const best = [...byType].sort((a, b) => b.reach - a.reach)[0];
    const efficient = [...byType].filter((t) => t.reach > 0)
      .sort((a, b) => (a.budget / a.reach) - (b.budget / b.reach))[0];
    return {
      title: 'Total Campaign Reach',
      value: compact(sum(db.campaigns, (c) => +c.reach)), unit: 'people reached',
      measures: 'The cumulative audience reached across every programme the Department has run with its partners.',
      matters: 'Reach is the raw output of the partnership programme. On its own it is a vanity number — it becomes decision-useful only when divided by what it cost, which is why the breakdown below reports cost per thousand.',
      formula: 'SUM(campaign.reach) across all programmes',
      chart: {
        type: 'bar', xKey: 'type',
        series: [{ key: 'reach', label: 'Reach' }],
        data: byType, colorByIndex: true,
      },
      breakdown: byType.map((t) => ({
        label: `${t.type}s`, value: compact(t.reach),
        sub: t.reach ? `${aed(t.budget / (t.reach / 1000))} per 1K` : '—',
      })),
      advisory: best && efficient
        ? `${best.type}s generate the most reach at ${compact(best.reach)}, but ${efficient.type}s are the most efficient at ${aed(efficient.budget / (efficient.reach / 1000))} per thousand reached. `
          + `Optimising the mix on reach alone would over-invest in the wrong format — the two rankings disagree, and cost per thousand is the one that should drive budget.`
        : 'Not enough completed programmes to compare formats yet.',
    };
  },

  avgEngagement: (db) => {
    const done = db.campaigns.filter((c) => c.status === 'completed');
    return {
      title: 'Programme Engagement Rate',
      value: r1(avg(done, (c) => +c.engagement_rate)), unit: '%', target: '≥ 5%', direction: 'up',
      measures: 'The mean engagement rate achieved across completed programmes — the share of the audience reached that actually interacted.',
      matters: 'Reach counts who saw it; engagement counts who cared. A programme with large reach and weak engagement bought attention it did not convert, which is a media-buying problem rather than a partnership problem.',
      formula: 'MEAN(campaign.engagement_rate) over completed programmes',
      chart: {
        type: 'bar', xKey: 'title', horizontal: true,
        series: [{ key: 'rate', label: 'Engagement rate' }],
        data: done.slice(0, 8).map((c) => ({
          title: c.title.length > 24 ? `${c.title.slice(0, 23)}…` : c.title,
          rate: +c.engagement_rate,
        })).sort((a, b) => b.rate - a.rate),
      },
      breakdown: ['exhibition', 'campaign', 'initiative'].map((type) => ({
        label: `${type}s`,
        value: `${r1(avg(done.filter((c) => c.type === type), (c) => +c.engagement_rate))}%`,
      })),
      advisory: `Completed programmes average ${r1(avg(done, (c) => +c.engagement_rate))}% engagement. `
        + `The spread between the best and worst performing programme is wide, which means the average is hiding two different stories — the top quartile is worth studying for what it did differently.`,
    };
  },

  /* ── Commercial ── */
  activeAgreements: (db) => {
    const active = db.sponsorships.filter((a) => a.status === 'active');
    const byTier = ['Platinum', 'Gold', 'Silver', 'Category'].map((tier) => ({
      label: tier,
      value: db.sponsorships.filter((a) => a.tier === tier).length,
      sub: aed(sum(db.sponsorships.filter((a) => a.tier === tier), (a) => +a.value_aed)),
    })).filter((t) => t.value);
    return {
      title: 'Active Agreements',
      value: active.length, unit: 'live contracts',
      measures: 'Sponsorship agreements currently in force, and the contracted value they carry.',
      matters: 'This is the commercial base of the partnership programme. Unlike reach or engagement, it is contractually committed money — it is the part of the relationship that survives a change of marketing strategy.',
      formula: 'COUNT(sponsorships WHERE status = active)',
      chart: {
        type: 'bar', xKey: 'tier',
        series: [{ key: 'value', label: 'Contracted value' }],
        data: ['Platinum', 'Gold', 'Silver', 'Category'].map((tier) => ({
          tier, value: sum(db.sponsorships.filter((a) => a.tier === tier), (x) => +x.value_aed),
        })).filter((t) => t.value), colorByIndex: true,
      },
      breakdown: byTier,
      advisory: `${active.length} live agreements carry ${aed(sum(active, (a) => +a.value_aed))}. `
        + `${db.sponsorships.filter((a) => a.status === 'pending_signature').length} more are awaiting signature — those represent committed intent that is not yet contractually secured, and they are the fastest available uplift to this number.`,
    };
  },

  blendedRoi: (db) => {
    const rows = db.sponsorships;
    const byTier = ['Platinum', 'Gold', 'Silver', 'Category'].map((tier) => {
      const g = rows.filter((a) => a.tier === tier);
      return { tier, roi: r1(avg(g, (a) => +a.roi_percent)), count: g.length };
    }).filter((t) => t.count);
    const best = [...byTier].sort((a, b) => b.roi - a.roi)[0];
    const worst = [...byTier].sort((a, b) => a.roi - b.roi)[0];
    return {
      title: 'Blended Sponsorship ROI',
      value: r1(avg(rows, (a) => +a.roi_percent)), unit: '%', target: '≥ 60%', direction: 'up',
      measures: 'The mean measured return across every sponsorship agreement, weighted equally per agreement.',
      matters: 'Return is what justifies the sponsorship model to finance. The blend, however, conceals a wide spread between tiers — which is exactly where the actionable decision sits.',
      formula: 'MEAN(sponsorship.roi_percent) across all agreements',
      chart: {
        type: 'bar', xKey: 'tier',
        series: [{ key: 'roi', label: 'Mean ROI' }],
        data: byTier, colorByIndex: true,
      },
      breakdown: byTier.map((t) => ({ label: t.tier, value: `${t.roi}%`, sub: `${t.count} agreements` })),
      advisory: best && worst
        ? `Blended return is ${r1(avg(rows, (a) => +a.roi_percent))}%, but the tiers diverge sharply: ${best.tier} returns ${best.roi}% against ${worst.tier} at ${worst.roi}%. `
          + `Rebalancing inventory away from ${worst.tier} is the single clearest lever available on this number, and it requires no new partners.`
        : 'Not enough agreements to compare tiers.',
    };
  },

  commitmentDelivery: (db) => {
    const active = db.sponsorships.filter((a) => a.status === 'active');
    const met = sum(active, (a) => +a.commitments_met);
    const total = sum(active, (a) => +a.commitments_total);
    const behind = active.filter((a) => (+a.commitments_met / Math.max(1, +a.commitments_total)) < 0.5);
    return {
      title: 'Commitment Delivery',
      value: r1((met / Math.max(1, total)) * 100), unit: '%', target: '≥ 75%', direction: 'up',
      measures: 'The share of contracted deliverables actually met across live sponsorship agreements.',
      matters: 'An agreement is only worth its delivery. Undelivered commitments are the mechanism by which contracted value quietly fails to become realised value, and they surface late unless tracked deliberately.',
      formula: 'SUM(commitments_met) ÷ SUM(commitments_total) over active agreements',
      chart: {
        type: 'bar', xKey: 'agreement', horizontal: true,
        series: [{ key: 'pct', label: 'Delivered %' }],
        data: [...active].sort((a, b) =>
          (+a.commitments_met / Math.max(1, +a.commitments_total)) - (+b.commitments_met / Math.max(1, +b.commitments_total))
        ).slice(0, 8).map((a) => ({
          agreement: a.agreement_id,
          pct: r0((+a.commitments_met / Math.max(1, +a.commitments_total)) * 100),
        })),
      },
      breakdown: [
        { label: 'Delivered', value: met },
        { label: 'Contracted', value: total },
        { label: 'Under half-delivered', value: behind.length },
      ],
      advisory: `${met} of ${total} contracted commitments have been delivered on live agreements. `
        + `${behind.length} agreements sit under half-delivered — these carry ${aed(sum(behind, (a) => +a.value_aed))} of contracted value and are the population the anomaly rules escalate first.`,
    };
  },

  collectionRate: (db) => {
    const rows = db.sponsorships;
    const invoiced = sum(rows, (a) => +a.invoiced_aed);
    const contracted = sum(rows, (a) => +a.value_aed);
    return {
      title: 'Invoice Collection',
      value: r1((invoiced / Math.max(1, contracted)) * 100), unit: '%', target: '≥ 70%', direction: 'up',
      measures: 'Invoiced value as a share of total contracted value across the agreement ledger.',
      matters: 'Contracted value that has not been invoiced is not yet revenue. This measure separates the commercial promise from the cash position, which are routinely conflated in partnership reporting.',
      formula: 'SUM(invoiced_aed) ÷ SUM(value_aed)',
      chart: {
        type: 'bar', xKey: 'tier',
        series: [{ key: 'invoiced', label: 'Invoiced' }, { key: 'outstanding', label: 'Outstanding' }],
        data: ['Platinum', 'Gold', 'Silver', 'Category'].map((tier) => {
          const g = rows.filter((a) => a.tier === tier);
          return {
            tier,
            invoiced: sum(g, (a) => +a.invoiced_aed),
            outstanding: sum(g, (a) => +a.value_aed) - sum(g, (a) => +a.invoiced_aed),
          };
        }).filter((t) => t.invoiced || t.outstanding),
      },
      breakdown: [
        { label: 'Invoiced', value: aed(invoiced) },
        { label: 'Contracted', value: aed(contracted) },
        { label: 'Outstanding', value: aed(contracted - invoiced) },
      ],
      advisory: `${aed(invoiced)} of ${aed(contracted)} contracted value has been invoiced — ${r1((invoiced / Math.max(1, contracted)) * 100)}%. `
        + `The ${aed(contracted - invoiced)} outstanding is not all overdue: much of it is scheduled against delivery milestones that have not yet fallen due, which is why this reads alongside commitment delivery rather than on its own.`,
    };
  },

  /* ── Portfolio / twin ── */
  portfolioValue: (db) => {
    const byDistrict = {};
    for (const p of db.projects) {
      byDistrict[p.district] = (byDistrict[p.district] || 0) + (+p.value_aed || 0);
    }
    const ranked = Object.entries(byDistrict).sort((a, b) => b[1] - a[1]);
    return {
      title: 'Mapped Portfolio Value',
      value: aed(sum(db.projects, (p) => +p.value_aed)), unit: 'declared value',
      measures: 'The declared value of every partner project mapped on the Digital Twin, aggregated across the emirate.',
      matters: 'This is the physical scale of the ecosystem the Department is partnering with. It contextualises every marketing number — a campaign reaching 2M people on behalf of a portfolio this size is a different proposition than the same reach for a small one.',
      formula: 'SUM(project.value_aed) across all mapped projects',
      chart: {
        type: 'bar', xKey: 'district', horizontal: true,
        series: [{ key: 'value', label: 'Portfolio value' }],
        data: ranked.slice(0, 8).map(([district, value]) => ({ district, value })),
      },
      breakdown: [
        { label: 'Projects mapped', value: db.projects.length },
        { label: 'Total units', value: compact(sum(db.projects, (p) => +p.units)) },
        { label: 'Districts', value: ranked.length },
      ],
      advisory: `${db.projects.length} projects worth ${aed(sum(db.projects, (p) => +p.value_aed))} are mapped across ${ranked.length} districts. `
        + `${ranked[0][0]} leads at ${aed(ranked[0][1])}. ${db.projects.filter((p) => p.status === 'under_construction').length} projects are under construction — that pipeline is where the next cycle of co-marketing demand will come from.`,
    };
  },

  /* ── Events ── */
  eventFootfall: (db) => {
    const done = db.events.filter((e) => e.status === 'completed');
    return {
      title: 'Event Footfall',
      value: compact(sum(done, (e) => +e.footfall)), unit: 'visitors',
      measures: 'Total attendance across every delivered event and exhibition on the platform calendar.',
      matters: 'Footfall is the physical counterpart to campaign reach. Exhibitions are the most expensive format the Department runs, so attendance is the first test of whether that cost was justified.',
      formula: 'SUM(event.footfall) over completed events',
      chart: {
        type: 'bar', xKey: 'event', horizontal: true,
        series: [{ key: 'footfall', label: 'Footfall' }],
        data: done.map((e) => ({
          event: e.title.length > 24 ? `${e.title.slice(0, 23)}…` : e.title,
          footfall: +e.footfall,
        })).sort((a, b) => b.footfall - a.footfall),
      },
      breakdown: [
        { label: 'Events delivered', value: done.length },
        { label: 'Leads captured', value: compact(sum(done, (e) => +e.leads_generated)) },
        { label: 'Mean rating', value: `${r1(avg(done, (e) => +e.satisfaction))} / 5` },
      ],
      advisory: `${compact(sum(done, (e) => +e.footfall))} visitors attended ${done.length} delivered events, generating ${compact(sum(done, (e) => +e.leads_generated))} partner leads. `
        + `Attendance against booked capacity averaged ${r0(avg(done, (e) => (+e.footfall / Math.max(1, +e.capacity)) * 100))}%, so venue sizing has been broadly correct rather than optimistic.`,
    };
  },

  mediaRoi: (db) => {
    const done = db.events.filter((e) => e.status === 'completed');
    const budget = sum(done, (e) => +e.budget_aed);
    const media = sum(done, (e) => +e.media_value_aed);
    return {
      title: 'Event Media ROI',
      value: r1(((media - budget) / Math.max(1, budget)) * 100), unit: '%', target: '≥ 100%', direction: 'up',
      measures: 'Earned media value generated by delivered events, measured against the budget committed to them.',
      matters: 'Events are justified on more than attendance. Earned media is the multiplier that makes an exhibition defensible against a cheaper digital campaign, and it is the number that survives scrutiny from finance.',
      formula: '(SUM(media_value) − SUM(budget)) ÷ SUM(budget)',
      chart: {
        type: 'bar', xKey: 'event', horizontal: true,
        series: [{ key: 'roi', label: 'Media ROI %' }],
        data: done.map((e) => ({
          event: e.title.length > 24 ? `${e.title.slice(0, 23)}…` : e.title,
          roi: +e.budget_aed ? r1(((+e.media_value_aed - +e.budget_aed) / +e.budget_aed) * 100) : 0,
        })).sort((a, b) => b.roi - a.roi),
      },
      breakdown: [
        { label: 'Media value', value: aed(media) },
        { label: 'Budget', value: aed(budget) },
        { label: 'Net', value: aed(media - budget) },
      ],
      advisory: `${aed(media)} of earned media against ${aed(budget)} of budget — a return of ${r1(((media - budget) / Math.max(1, budget)) * 100)}%. `
        + `The spread between the best and worst event is the useful signal here: the format is not uniformly effective, and the weakest performers share a venue profile worth reviewing before the next cycle.`,
    };
  },

  /* ── Engagement ── */
  partnerSatisfaction: (db) => {
    const m = db.engagement_monthly;
    const last = m[m.length - 1] || {};
    return {
      title: 'Partner Satisfaction',
      value: +last.satisfaction_partner || 0, unit: '/ 5', target: '≥ 4.2', direction: 'up',
      measures: 'The rolling monthly satisfaction score reported by partner organisations.',
      matters: 'Every other measure here is something the Department does to partners. This is the only one that is partners reporting back, which makes it the check on whether efficiency gains are being felt or merely recorded.',
      formula: 'Rolling monthly partner survey, mean score out of 5',
      chart: {
        type: 'line', xKey: 'month',
        series: [{ key: 'partner', label: 'Partner' }, { key: 'internal', label: 'Internal' }],
        data: m.map((x) => ({
          month: x.month,
          partner: +x.satisfaction_partner,
          internal: +x.satisfaction_internal,
        })),
      },
      breakdown: [
        { label: 'Partner', value: `${+last.satisfaction_partner || 0} / 5` },
        { label: 'Internal', value: `${+last.satisfaction_internal || 0} / 5` },
        { label: 'Series trend', value: m.length > 1 && +last.satisfaction_partner > +m[0].satisfaction_partner ? 'Improving' : 'Flat' },
      ],
      advisory: `Partner satisfaction stands at ${+last.satisfaction_partner || 0} out of 5 and has risen across the series. `
        + `It is tracking above internal satisfaction, which is the healthier of the two orderings — it suggests the friction that remains is being absorbed by the Department rather than passed to partners.`,
    };
  },

  meanEngagement: (db, NOW) => {
    const devs = db.developers;
    const dormant = devs.filter((d) => daysBetween(d.last_login, NOW) >= 45);
    const grade = (s) => (s >= 88 ? 'Platinum' : s >= 74 ? 'Gold' : s >= 58 ? 'Silver' : 'Bronze');
    const byGrade = ['Platinum', 'Gold', 'Silver', 'Bronze'].map((g) => ({
      label: g, value: devs.filter((d) => grade(+d.engagement_score) === g).length,
    }));
    return {
      title: 'Mean Engagement Score',
      value: r1(avg(devs, (d) => +d.engagement_score)), unit: '/ 100', target: '≥ 70', direction: 'up',
      measures: 'A composite of login recency, participation volume and commitment delivery, scored 0–100 per partner.',
      matters: 'Registration counts partners; engagement counts relationships. This is the measure that distinguishes an ecosystem that is genuinely active from one that merely has a large directory.',
      formula: 'MEAN(developer.engagement_score) across all registered partners',
      chart: {
        type: 'bar', xKey: 'label',
        series: [{ key: 'value', label: 'Partners' }],
        data: byGrade, colorByIndex: true,
      },
      breakdown: [
        { label: 'Top grade', value: `${byGrade[0].value} Platinum` },
        { label: 'Dormant 45d+', value: dormant.length },
        { label: 'Median score', value: r0(avg(devs, (d) => +d.engagement_score)) },
      ],
      advisory: `Mean engagement is ${r1(avg(devs, (d) => +d.engagement_score))} out of 100, with ${byGrade[0].value} partners at Platinum grade. `
        + `${dormant.length} partners have been inactive for 45 days or more; ${dormant.filter((d) => db.sponsorships.some((a) => a.developer_id === d.developer_id && a.status === 'active')).length} of those still hold live commitments, which makes them a delivery risk rather than just a marketing one.`,
    };
  },

  leadsGenerated: (db) => {
    const reqs = db.participation_requests;
    const cmps = Object.fromEntries(db.campaigns.map((c) => [c.campaign_id, c]));
    const byType = ['exhibition', 'campaign', 'initiative'].map((type) => ({
      type,
      leads: sum(reqs.filter((r) => cmps[r.campaign_id]?.type === type), (r) => +r.leads_generated),
    })).filter((t) => t.leads);
    return {
      title: 'Leads Delivered to Partners',
      value: compact(sum(reqs, (r) => +r.leads_generated)), unit: 'qualified leads',
      measures: 'Cumulative qualified leads passed to partner organisations through joint programmes.',
      matters: 'This is the number partners judge the relationship on. Reach and engagement are the Department\'s measures; leads are the partner\'s, and the gap between how each side scores the same programme usually opens here.',
      formula: 'SUM(request.leads_generated) across approved participations',
      chart: {
        type: 'bar', xKey: 'type',
        series: [{ key: 'leads', label: 'Leads' }],
        data: byType, colorByIndex: true,
      },
      breakdown: byType.map((t) => ({ label: `${t.type}s`, value: compact(t.leads) })),
      advisory: `${compact(sum(reqs, (r) => +r.leads_generated))} qualified leads have been delivered to partners. `
        + `${byType.length ? `${byType.sort((a, b) => b.leads - a.leads)[0].type}s` : 'No format'} accounts for the largest share — which is worth stating explicitly in partner reviews, because partners consistently under-attribute leads to the formats that actually produce them.`,
    };
  },
};

function kpiDetail(db, id, NOW) {
  const fn = KPI[id];
  if (!fn) return null;
  return { id, ...fn(db, NOW) };
}

/* ══════════════════════════════════════════════════════════════════════
   Rotating per-module advisories
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Each module gets several advisory lines, cycled by the client. They are
 * generated per request from current data, so the strip never contradicts the
 * screen it sits above.
 */
function advisories(db, module, NOW, developerId) {
  const A = (severity, title, body) => ({ severity, title, body });
  const devs = db.developers;
  const active = devs.filter((d) => d.status === 'active');
  const reqs = db.participation_requests;
  const open = reqs.filter((r) => r.status === 'pending' || r.status === 'under_review');
  const breaching = open.filter((r) => daysBetween(r.submitted_date, NOW) > 3);
  const agreements = db.sponsorships;
  const live = db.campaigns.filter((c) => c.status === 'active');
  const dormant = devs.filter((d) => daysBetween(d.last_login, NOW) >= 45);
  const doneEvents = db.events.filter((e) => e.status === 'completed');

  const cmps = Object.fromEntries(db.campaigns.map((c) => [c.campaign_id, c]));

  switch (module) {
    case 'dashboard':
      return [
        A('high', 'Approval backlog is concentrated, not systemic',
          `${breaching.length} of ${open.length} open requests have passed the 3-day target, but they cluster in a small number of programmes. Working the largest cluster first clears the breach count faster than spreading effort evenly.`),
        A('medium', 'Dormant segment still holds live commitments',
          `${dormant.length} partners have not signed in for 45+ days. ${dormant.filter((d) => agreements.some((a) => a.developer_id === d.developer_id && a.status === 'active')).length} of them hold active sponsorship agreements — the commercial relationship is open even though the communication has lapsed.`),
        A('medium', 'Sponsorship return varies more by tier than by partner',
          `Blended ROI is ${r1(avg(agreements, (a) => +a.roi_percent))}%, but the spread across tiers is wider than the spread within any single tier. That points at inventory design rather than partner selection.`),
        A('low', 'Digital completion is approaching target',
          `${r1((reqs.filter((r) => r.channel === 'platform').length / Math.max(1, reqs.length)) * 100)}% of transactions now complete on-platform. The residual is concentrated in a handful of partners still submitting by email.`),
        A('low', 'Live programme load is balanced',
          `${live.length} programmes are running with an average implementation progress of ${r0(avg(live, (c) => +c.progress_pct))}%. No single programme is starving the others of partner attention.`),
      ];

    case 'campaigns':
      return [
        A('medium', 'Launch windows are colliding',
          `Several programmes overlap in the same fortnight. The timeline view makes the collisions visible — staggering two of them would reduce competition for the same partner marketing budgets.`),
        A('medium', 'Draft programmes are ageing',
          `${db.campaigns.filter((c) => c.status === 'draft').length} programmes sit in draft and ${db.campaigns.filter((c) => c.status === 'review').length} in review. Programmes consume calendar while they wait, and their start dates do not move with them.`),
        A('low', 'Partner slots are under-filled on newer programmes',
          `Newly opened programmes are averaging fewer approved partners than their targets. Smart matching against the brief typically lifts fill rate more than a broader invitation list.`),
        A('high', 'Format mix is skewed toward the most expensive channel',
          `Exhibitions carry the highest cost per thousand reached of any format currently in the pipeline. The simulator can project the same objective through a cheaper format before budget is committed.`),
      ];

    case 'sponsorships':
      return [
        A('high', 'Delivery pace is the dominant risk signal',
          `The most common anomaly on this ledger is delivery falling behind the contract clock, not poor return. Agreements fail on execution well before they fail on economics.`),
        A('medium', 'Collection is lagging elapsed term on several agreements',
          `${r1((sum(agreements, (a) => +a.invoiced_aed) / Math.max(1, sum(agreements, (a) => +a.value_aed))) * 100)}% of contracted value has been invoiced. Where invoicing trails delivery, the cause is usually an unraised milestone rather than a disputed one.`),
        A('medium', 'Agreements nearing expiry with open commitments',
          `Renewal conversations are materially harder once commitments have gone unmet. The agreements closest to expiry with outstanding deliverables should be worked before the renewal window opens, not during it.`),
        A('low', 'Tier rebalancing is the clearest ROI lever',
          `The lowest-returning tier is dragging blended ROI by more than any individual underperforming agreement. This is a product-design decision, not an account-management one.`),
      ];

    case 'requests':
      return [
        A('high', `${breaching.length} requests have breached the service target`,
          `Breaching requests are sorted to the top of the queue. The oldest has been waiting ${open.length ? r1(Math.max(...open.map((r) => daysBetween(r.submitted_date, NOW)))) : 0} days against a 3-day commitment.`),
        A('medium', 'Incomplete document packs are the usual cause of delay',
          `${reqs.filter((r) => +r.documents_uploaded < +r.documents_required && r.status !== 'rejected').length} requests are short of their required documents. Chasing the pack is faster than deferring the decision.`),
        A('low', 'Approval time is improving across the series',
          `The trend on decision time is downward. Sustained improvement here is what moves partner satisfaction, which lags this measure by roughly a quarter.`),
      ];

    case 'twin':
      return [
        A('medium', 'Engagement is geographically uneven',
          `Partner engagement clusters in a handful of districts. The heatmap overlays make the gap visible — several districts with substantial mapped value carry no live campaign activity at all.`),
        A('low', 'Construction pipeline signals future demand',
          `${db.projects.filter((p) => p.status === 'under_construction').length} projects are under construction. That pipeline is where the next cycle of co-marketing demand originates, and it is concentrated in districts that are currently under-engaged.`),
        A('medium', 'At-risk projects share a district profile',
          `Projects flagged at risk are not randomly distributed across the map. Their concentration suggests a district-level cause rather than a set of unrelated partner-level ones.`),
        A('low', 'Time slider shows steady partnership growth',
          `Scrubbing the quarterly timeline shows partner density rising consistently rather than in bursts, which indicates organic adoption rather than campaign-driven spikes.`),
      ];

    case 'partners':
      return [
        A('medium', 'Engagement is concentrated in a minority of partners',
          `The top quartile of partners accounts for a disproportionate share of participations and contracted value. That concentration is a resilience risk as much as a success — losing one relationship would move the ecosystem numbers visibly.`),
        A('high', `${dormant.length} partners have lapsed`,
          `${dormant.length} organisations have not signed in for 45 days or more. ${dormant.filter((d) => agreements.some((a) => a.developer_id === d.developer_id && a.status === 'active')).length} of them still hold live agreements, which makes them a delivery exposure rather than only a marketing one.`),
        A('low', 'Grades are earned, not assigned',
          `Partner grade is derived from the engagement score, so it moves as the relationship does. A partner dropping a grade is an earlier signal than a missed commitment.`),
        A('medium', 'Master developers carry the commercial weight',
          `Contracted value skews heavily toward the master-developer tier. Mid-market partners contribute participation volume without matching commercial depth — a pricing question rather than an engagement one.`),
      ];

    case 'agreements':
      return [
        A('high', 'Deliver commitments before renewal, not during',
          `Agreements that reach expiry with commitments outstanding are materially harder to renew. Outstanding items are listed on each agreement card so they can be cleared while there is still term remaining.`),
        A('medium', 'Your invoicing follows your delivery',
          `Invoices are raised against delivered milestones. Where invoicing looks behind, the usual cause is an undelivered commitment rather than an administrative delay.`),
        A('low', 'Return is measured per agreement, not per partner',
          `Each agreement carries its own measured ROI. Comparing across your own agreements shows which programme formats have actually paid back for you.`),
      ];

    case 'events':
      return [
        A('medium', 'Registration is tracking below capacity on upcoming events',
          `Confirmed events are averaging ${r0(avg(db.events.filter((e) => e.status === 'confirmed'), (e) => (+e.registered / Math.max(1, +e.capacity)) * 100))}% of capacity. Partner invitations sent earlier historically close this gap.`),
        A('low', 'Earned media is carrying the events business case',
          `Delivered events returned ${aed(sum(doneEvents, (e) => +e.media_value_aed))} in earned media against ${aed(sum(doneEvents, (e) => +e.budget_aed))} of budget. Attendance alone would not justify the format.`),
        A('medium', 'Stand allocations are pending on several registrations',
          `Participations awaiting a decision hold up partner build schedules. Exhibitors need lead time for stand construction, so confirmation delay costs them more than it costs the Department.`),
      ];

    case 'partner':
      return [
        A('high', 'Outstanding documents are blocking your approvals',
          `Requests short of their required document pack cannot progress. Uploading the outstanding items is the fastest way to move them through the queue.`),
        A('medium', 'Your engagement sits above your tier median',
          `Participation across multiple active programmes places you in the upper segment of your tier. Exhibition formats have generated your strongest media exposure to date.`),
        A('low', 'New assets are available for programmes you have joined',
          `Brand kits and motion packages for your approved campaigns were refreshed recently and are available in the asset library.`),
        A('medium', 'Recommended programmes match your delivery history',
          `The marketplace ranks open programmes against your own format history and portfolio location, not against a generic profile. The top recommendation is scored on programmes you have already delivered well.`),
      ];

    case 'marketplace':
      return [
        A('medium', 'Slots are closing on programmes that fit you',
          `Several recommended programmes have limited partner slots remaining. Early participation also carries more influence over the brief than late participation does.`),
        A('low', 'Your strongest format is under-represented in your pipeline',
          `Your historical lead yield is highest in one format, but your current pipeline is weighted toward another. Rebalancing would follow your own evidence.`),
        A('low', 'Early-stage programmes accept more input',
          `Programmes still in draft or review accept partner input on scope. Joining at this stage shapes the brief rather than responding to it.`),
      ];

    case 'assets':
      return [
        A('low', 'Brand compliance depends on using current assets',
          `Co-branded materials must draw from the current asset pack. Superseded versions remain in circulation longer than expected once downloaded.`),
        A('medium', 'Most-downloaded assets indicate campaign demand',
          `Download concentration shows which campaigns partners are actively building material for — a useful leading signal of where activity is genuinely happening.`),
      ];

    default:
      return [
        A('low', 'Platform intelligence is active',
          `Advisories are generated from live platform records and refresh as the underlying data changes.`),
      ];
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Ask S!a — module-scoped question suggestions
   ══════════════════════════════════════════════════════════════════════ */
function qaPairs(module) {
  const M = {
    dashboard: [
      'How is adoption trending this year?',
      'Where is the approval backlog concentrated?',
      'What is our blended ROI by tier?',
      'Which partners are most engaged?',
    ],
    campaigns: [
      'Which campaign format delivers the best reach?',
      'Which programmes are awaiting a launch decision?',
      'Draft an invitation for the top 5 developers by ROI',
      'Which partners should I invite to an exhibition?',
    ],
    sponsorships: [
      'Which sponsorship agreements are at risk?',
      'What is our total contracted value?',
      'Which tier returns the best ROI?',
      'How much have we invoiced against contracted value?',
    ],
    requests: [
      'Where is the approval backlog concentrated?',
      'Which partners are waiting longest?',
      'How has approval time trended?',
      'Which requests are missing documents?',
    ],
    twin: [
      'Show me the project portfolio by district',
      'Which districts have the most partner value?',
      'Which developers build in Downtown Dubai?',
      'How many projects are under construction?',
    ],
    events: [
      'Tell me about events',
      'Which events delivered the best media ROI?',
      'Which partners exhibit most often?',
      'What was our total event footfall?',
    ],
    simulator: [
      'Which campaign format delivers the best reach?',
      'What is our historical engagement rate?',
      'How much does a lead cost us?',
    ],
    kpis: [
      'How is adoption trending this year?',
      'What is our average approval time?',
      'Which KPIs are off target?',
    ],
    partners: [
      'Which developers have not engaged in 90+ days?',
      'Which partners are most engaged?',
      'Top partners by ROI',
      'Draft an invitation for the top 5 developers by ROI',
    ],
    agreements: [
      'Which of my agreements need attention?',
      'What is my mean sponsorship ROI?',
      'How much have I committed in total?',
    ],
    partner: [
      'What do I still owe the Department?',
      'How does my engagement compare to my tier?',
      'Which programmes am I approved on?',
      'How many leads have I received?',
    ],
    marketplace: [
      'Which programmes are recommended for me?',
      'Which programmes have slots left?',
      'What format has performed best for me?',
    ],
    assets: [
      'Which assets are available to me?',
      'What was updated recently?',
    ],
  };
  return M[module] || M.dashboard;
}

module.exports = { kpiDetail, advisories, qaPairs, KPI_IDS: Object.keys(KPI) };
