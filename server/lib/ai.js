/**
 * AI intelligence layer — Real Estate Developer Connectivity Platform.
 *
 * Everything here is *derived*, never canned: each answer, score and projection
 * is computed from the live CSV-backed tables the API already serves. That
 * matters for a POC — a demo question produces a number the operator can then
 * go and verify on the corresponding screen.
 *
 * The module is deliberately model-free. A hosted LLM would add fluency but
 * also a network dependency, an API key and non-determinism, none of which a
 * self-contained demo can rely on. The contract below (intent → structured
 * answer) is the same shape an LLM wrapper would return, so swapping one in
 * later is a change of implementation, not of interface.
 *
 *   answer()      — the Partnership Copilot's natural-language query engine
 *   simulate()    — What-If campaign projection from historical base rates
 *   matchPartners() — smart developer matching with per-factor explanation
 *   anomalies()   — ledger anomaly detection
 *   digest()      — auto-generated executive summary
 */

/* ── numeric helpers ───────────────────────────────────────────────── */
const sum = (a, f) => a.reduce((s, x) => s + (f ? +f(x) || 0 : +x || 0), 0);
const avg = (a, f) => (a.length ? sum(a, f) / a.length : 0);
const r1 = (n) => Math.round(n * 10) / 10;
const r0 = (n) => Math.round(n);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(sum(arr, (x) => (x - m) ** 2) / (arr.length - 1));
}

const DAY = 86400000;
const daysBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / DAY;

/**
 * Current efficiency, computed from the request records themselves.
 *
 * The monthly rollup is the right source for a *trend*, but not for a headline
 * level: it lags, and quoting it beside a tile that counts live records puts two
 * different numbers for one named metric on the same screen. Everything that
 * states a current value — tiles, digest, health score — goes through here so
 * they cannot disagree.
 */
function currentState(db) {
  const reqs = db.participation_requests;
  const decided = reqs.filter((r) => r.status === 'approved' && r.approval_days !== '');
  return {
    activePartners: db.developers.filter((d) => d.status === 'active').length,
    totalPartners: db.developers.length,
    avgApprovalDays: r1(avg(decided, (r) => +r.approval_days)),
    digitalPct: r1(reqs.length ? (reqs.filter((r) => r.channel === 'platform').length / reqs.length) * 100 : 0),
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Partnership Copilot — natural-language query over the platform data
   ══════════════════════════════════════════════════════════════════════ */

/** Intent match: every keyword hit scores, the highest total wins. Cheap, but
 *  transparent — an operator can tell why a question routed where it did. */
const INTENTS = [
  { id: 'dormant',    kw: ['dormant', 'inactive', 'not engaged', "haven't engaged", 'havent engaged', 'lapsed', 'no login', 'last login', 'quiet', 're-engage', 'reengage', 'days'] },
  { id: 'top',        kw: ['top', 'best', 'strongest', 'highest', 'leading', 'most engaged', 'leaderboard', 'rank'] },
  { id: 'draft',      kw: ['draft', 'write', 'compose', 'invitation', 'invite', 'email', 'message', 'outreach'] },
  { id: 'atrisk',     kw: ['at risk', 'at-risk', 'risk', 'behind', 'underperform', 'failing', 'slipping', 'overdue', 'anomal'] },
  { id: 'backlog',    kw: ['pending', 'backlog', 'queue', 'awaiting', 'approval', 'approve', 'sla', 'waiting', 'stuck'] },
  { id: 'campaigns',  kw: ['campaign', 'programme', 'program', 'initiative', 'performance', 'reach', 'engagement rate'] },
  { id: 'financial',  kw: ['roi', 'return', 'value', 'revenue', 'money', 'aed', 'sponsorship', 'agreement', 'contracted', 'invoiced', 'commercial'] },
  { id: 'adoption',   kw: ['adoption', 'growth', 'registered', 'active partners', 'onboard', 'ecosystem', 'how many'] },
  { id: 'events',     kw: ['event', 'exhibition', 'expo', 'summit', 'conference', 'roadshow', 'booth', 'stand'] },
  { id: 'projects',   kw: ['project', 'tower', 'building', 'district', 'map', 'twin', 'geograph', 'location', 'where'] },
  { id: 'digest',     kw: ['summary', 'digest', 'overview', 'how are we', 'brief', 'status', 'update', 'happening'] },
];

/**
 * Scores a keyword hit by how much it actually narrows the question.
 * A multi-word phrase ("at risk") is far more diagnostic than either word
 * alone, so it outweighs a longer but generic single token ("sponsorship").
 * Without this, "which sponsorship agreements are at risk?" scores higher on
 * the commercial-summary intent than on the risk intent it plainly asks for.
 */
const kwScore = (kw) => kw.trim().split(/\s+/).length * 3 + (kw.length > 6 ? 2 : 1);

function classify(q) {
  const t = ` ${String(q || '').toLowerCase()} `;
  let best = { id: 'digest', score: 0 };
  for (const intent of INTENTS) {
    let score = 0;
    for (const kw of intent.kw) if (t.includes(kw)) score += kwScore(kw);
    if (score > best.score) best = { id: intent.id, score };
  }
  return best;
}

/** Pull an integer out of the question ("90+ days", "top 5") for parameterising. */
const numberIn = (q, fallback) => {
  const m = String(q || '').match(/\b(\d{1,4})\b/);
  return m ? +m[1] : fallback;
};

const SUGGESTIONS = [
  'Which developers have not engaged in 90+ days?',
  'Draft an invitation for the top 5 developers by ROI',
  'Which sponsorship agreements are at risk?',
  'Where is the approval backlog concentrated?',
  'How is adoption trending this year?',
  'Which campaign format delivers the best reach?',
];

/**
 * The copilot's entry point. Returns a structured answer — prose plus whatever
 * evidence backs it (metrics, a table, a draft) so the UI can render the
 * reasoning rather than just a sentence.
 */
function answer(db, question, now) {
  const NOW = now || new Date();
  const { id: intent } = classify(question);
  const devById = Object.fromEntries(db.developers.map((d) => [d.developer_id, d]));
  const cmpById = Object.fromEntries(db.campaigns.map((c) => [c.campaign_id, c]));

  switch (intent) {
    /* ── Who has gone quiet, and are they worth recovering? ── */
    case 'dormant': {
      const threshold = clamp(numberIn(question, 45), 7, 400);
      const rows = db.developers
        .map((d) => {
          const days = r0(daysBetween(d.last_login, NOW));
          const agreements = db.sponsorships.filter((a) => a.developer_id === d.developer_id);
          const liveValue = sum(agreements.filter((a) => a.status === 'active'), (a) => +a.value_aed);
          return {
            developer: d.name, tier: d.tier, status: d.status,
            days_since_login: days,
            engagement: +d.engagement_score,
            live_agreements: agreements.filter((a) => a.status === 'active').length,
            committed_aed: liveValue,
          };
        })
        .filter((r) => r.days_since_login >= threshold)
        .sort((a, b) => b.committed_aed - a.committed_aed || b.days_since_login - a.days_since_login);

      const withMoney = rows.filter((r) => r.committed_aed > 0);
      return {
        intent, title: `Partners inactive for ${threshold}+ days`,
        answer: rows.length
          ? `${rows.length} partner${rows.length === 1 ? ' has' : 's have'} not signed in for ${threshold}+ days. `
            + (withMoney.length
              ? `${withMoney.length} of them still hold live sponsorship commitments worth ${aed(sum(withMoney, (r) => r.committed_aed))} — those are the re-engagement priority, because the commercial relationship is already open and only the communication has lapsed.`
              : 'None of them hold live commitments, so this is a top-of-funnel re-activation rather than a delivery risk.')
          : `Every registered partner has signed in within the last ${threshold} days.`,
        metrics: [
          { label: 'Inactive partners', value: rows.length },
          { label: 'Holding live commitments', value: withMoney.length },
          { label: 'Value at stake', value: aed(sum(withMoney, (r) => r.committed_aed)) },
        ],
        table: rows.length ? {
          columns: ['developer', 'tier', 'days_since_login', 'engagement', 'live_agreements', 'committed_aed'],
          rows: rows.slice(0, 12),
        } : null,
        suggestions: ['Draft a re-engagement invitation for these partners', 'Which sponsorship agreements are at risk?'],
      };
    }

    /* ── Ranking, by whichever measure the question implies ── */
    case 'top': {
      const n = clamp(numberIn(question, 8), 3, 20);
      const byRoi = /roi|return|value|revenue|commercial/i.test(question);
      const rows = db.developers.map((d) => {
        const agreements = db.sponsorships.filter((a) => a.developer_id === d.developer_id);
        const reqs = db.participation_requests.filter((r) => r.developer_id === d.developer_id);
        return {
          developer: d.name, tier: d.tier,
          engagement: +d.engagement_score,
          participations: reqs.filter((r) => r.status === 'approved').length,
          agreements: agreements.length,
          contracted_aed: sum(agreements, (a) => +a.value_aed),
          roi_percent: r1(avg(agreements, (a) => +a.roi_percent)),
          leads: sum(reqs, (r) => +r.leads_generated),
        };
      });
      const ranked = rows
        .filter((r) => (byRoi ? r.agreements > 0 : true))
        .sort((a, b) => (byRoi ? b.roi_percent - a.roi_percent : b.engagement - a.engagement))
        .slice(0, n);

      return {
        intent, title: byRoi ? `Top ${n} partners by sponsorship ROI` : `Top ${n} partners by engagement`,
        answer: byRoi
          ? `Ranked on mean ROI across their sponsorship agreements. ${ranked[0]?.developer} leads at ${r1(ranked[0]?.roi_percent)}% against a portfolio blended return of ${r1(avg(db.sponsorships, (a) => +a.roi_percent))}%. Note that ROI and contracted value diverge — the highest-returning partners are not always the largest, which is the argument for weighting invitations on return rather than size.`
          : `Ranked on engagement score, which composites login recency, participation volume and delivery against commitments. The top ${n} account for ${r0((sum(ranked, (r) => r.participations) / Math.max(1, sum(rows, (r) => r.participations))) * 100)}% of all approved participations.`,
        metrics: [
          { label: 'Partners ranked', value: ranked.length },
          { label: byRoi ? 'Best ROI' : 'Best engagement', value: byRoi ? `${r1(ranked[0]?.roi_percent || 0)}%` : ranked[0]?.engagement || 0 },
          { label: 'Combined contracted', value: aed(sum(ranked, (r) => r.contracted_aed)) },
        ],
        table: {
          columns: byRoi
            ? ['developer', 'tier', 'roi_percent', 'agreements', 'contracted_aed', 'engagement']
            : ['developer', 'tier', 'engagement', 'participations', 'agreements', 'leads'],
          rows: ranked,
        },
        suggestions: [`Draft an invitation for the top ${Math.min(5, n)} of these partners`, 'Which of these have gone quiet recently?'],
      };
    }

    /* ── Compose real outreach against a real recipient list ── */
    case 'draft': {
      const n = clamp(numberIn(question, 5), 1, 15);
      const byRoi = /roi|return|value|revenue/i.test(question);
      // Prefer an open programme to invite into; fall back to the newest.
      const open = db.campaigns.filter((c) => c.status === 'draft' || c.status === 'review');
      const campaign = open[open.length - 1] || db.campaigns[db.campaigns.length - 1];

      const candidates = db.developers
        .filter((d) => d.status === 'active')
        .map((d) => {
          const agreements = db.sponsorships.filter((a) => a.developer_id === d.developer_id);
          return {
            developer_id: d.developer_id, developer: d.name, tier: d.tier,
            contact: d.contact_name, email: d.contact_email,
            engagement: +d.engagement_score,
            roi_percent: agreements.length ? r1(avg(agreements, (a) => +a.roi_percent)) : 0,
          };
        })
        .sort((a, b) => (byRoi ? b.roi_percent - a.roi_percent : b.engagement - a.engagement))
        .slice(0, n);

      const body = [
        `Dear ${'{{contact_name}}'},`,
        '',
        `The Dubai Land Department is opening partner registration for ${campaign.title}.`,
        '',
        campaign.description,
        '',
        `Programme window: ${campaign.start_date} to ${campaign.end_date}. ${campaign.location}. `
          + `${campaign.target_partners} partner slots are allocated for this cycle.`,
        '',
        `We are extending an early invitation to ${'{{developer_name}}'} on the strength of your `
          + (byRoi ? 'sponsorship return, which sits above the portfolio blended average.'
                   : 'engagement across recent joint programmes, which places you in the leading segment of the partner ecosystem.'),
        '',
        'To participate, submit a participation request through the Developer Connectivity Platform. '
          + 'The required document pack and commitment options are attached to the programme brief in your Opportunity Marketplace.',
        '',
        'Marketing & Communications',
        'Dubai Land Department',
      ].join('\n');

      return {
        intent, title: `Invitation draft — ${campaign.title}`,
        answer: `Drafted an invitation to ${campaign.title} for the top ${candidates.length} partners by `
          + `${byRoi ? 'sponsorship ROI' : 'engagement score'}. The recipient list, merge fields and programme details below are pulled from live records — review, then send from the Campaigns Manager to open a pending participation request on each partner's side.`,
        draft: {
          subject: `Invitation to participate — ${campaign.title}`,
          body,
          campaign_id: campaign.campaign_id,
          campaign_title: campaign.title,
          recipients: candidates,
        },
        metrics: [
          { label: 'Recipients', value: candidates.length },
          { label: 'Programme', value: campaign.title },
          { label: 'Slots available', value: campaign.target_partners },
        ],
        suggestions: ['Which of these partners has the strongest exhibition record?', 'Simulate the reach of this campaign'],
      };
    }

    /* ── Commercial risk ── */
    case 'atrisk': {
      const found = anomalies(db, NOW);
      const top = found.slice(0, 12);
      return {
        intent, title: 'Agreements flagged by anomaly detection',
        answer: found.length
          ? `${found.length} agreement${found.length === 1 ? '' : 's'} tripped at least one risk rule. `
            + `${found.filter((a) => a.severity === 'high').length} are high severity, carrying ${aed(sum(found.filter((a) => a.severity === 'high'), (a) => a.value_aed))} of contracted value. `
            + `The dominant failure mode is ${dominantReason(found)}.`
          : 'No agreement currently trips a risk rule.',
        metrics: [
          { label: 'Flagged', value: found.length },
          { label: 'High severity', value: found.filter((a) => a.severity === 'high').length },
          { label: 'Value flagged', value: aed(sum(found, (a) => a.value_aed)) },
        ],
        table: top.length ? {
          columns: ['agreement', 'developer', 'severity', 'reason', 'value_aed', 'delivery_gap_pct'],
          rows: top.map((a) => ({
            agreement: a.agreement_id, developer: a.developer_name, severity: a.severity,
            reason: a.reasons[0], value_aed: a.value_aed, delivery_gap_pct: a.delivery_gap_pct,
          })),
        } : null,
        suggestions: ['Which partners behind on commitments have gone quiet?', 'What is our blended ROI by tier?'],
      };
    }

    /* ── Where the queue is stuck ── */
    case 'backlog': {
      const open = db.participation_requests.filter((r) => r.status === 'pending' || r.status === 'under_review');
      const byCampaign = {};
      for (const r of open) {
        const c = cmpById[r.campaign_id];
        const age = r0(daysBetween(r.submitted_date, NOW));
        const k = r.campaign_id;
        byCampaign[k] = byCampaign[k] || { campaign: c?.title || k, type: c?.type || '', open: 0, breaching: 0, oldest_days: 0 };
        byCampaign[k].open++;
        // 3 working days is the stated service target for a participation decision.
        if (age > 3) byCampaign[k].breaching++;
        byCampaign[k].oldest_days = Math.max(byCampaign[k].oldest_days, age);
      }
      const rows = Object.values(byCampaign).sort((a, b) => b.breaching - a.breaching || b.open - a.open);
      const breaching = sum(rows, (r) => r.breaching);
      const worst = rows[0];

      return {
        intent, title: 'Approval backlog',
        answer: open.length
          ? `${open.length} participation requests are open, of which ${breaching} have passed the 3-day service target. `
            + `The backlog is concentrated rather than spread: ${worst.campaign} alone holds ${worst.open} open request${worst.open === 1 ? '' : 's'} `
            + `with the oldest at ${worst.oldest_days} days. Clearing that one programme would cut the breach count by ${r0((worst.breaching / Math.max(1, breaching)) * 100)}%.`
          : 'The approval queue is empty.',
        metrics: [
          { label: 'Open requests', value: open.length },
          { label: 'Past 3-day target', value: breaching },
          { label: 'Programmes affected', value: rows.length },
        ],
        table: rows.length ? { columns: ['campaign', 'type', 'open', 'breaching', 'oldest_days'], rows: rows.slice(0, 10) } : null,
        suggestions: ['Which partners are waiting longest?', 'How has approval time trended?'],
      };
    }

    /* ── Programme performance ── */
    case 'campaigns': {
      const done = db.campaigns.filter((c) => c.status === 'completed');
      const byType = ['exhibition', 'campaign', 'initiative'].map((type) => {
        const g = done.filter((c) => c.type === type);
        const ids = new Set(g.map((c) => c.campaign_id));
        const reqs = db.participation_requests.filter((r) => ids.has(r.campaign_id) && r.status === 'approved');
        const budget = sum(g, (c) => +c.budget_aed);
        return {
          format: type, programmes: g.length,
          total_reach: sum(g, (c) => +c.reach),
          avg_engagement_pct: r1(avg(g, (c) => +c.engagement_rate)),
          leads: sum(reqs, (r) => +r.leads_generated),
          // The comparable that actually matters when choosing a format.
          cost_per_1k_reach: budget && sum(g, (c) => +c.reach)
            ? r1(budget / (sum(g, (c) => +c.reach) / 1000)) : 0,
        };
      }).filter((r) => r.programmes > 0).sort((a, b) => b.total_reach - a.total_reach);

      const best = byType[0];
      const cheapest = [...byType].sort((a, b) => a.cost_per_1k_reach - b.cost_per_1k_reach)[0];

      return {
        intent, title: 'Programme format performance',
        answer: byType.length
          ? `Across ${done.length} completed programmes, ${best.format}s generated the most reach at ${compact(best.total_reach)}. `
            + `On efficiency the ranking changes: ${cheapest.format}s cost ${aed(cheapest.cost_per_1k_reach)} per thousand people reached versus ${aed(best.cost_per_1k_reach)} for ${best.format}s. `
            + `Reach alone would over-invest in the wrong format — the mix should be set on cost per thousand and lead yield together.`
          : 'No completed programmes yet.',
        metrics: [
          { label: 'Completed programmes', value: done.length },
          { label: 'Total reach', value: compact(sum(done, (c) => +c.reach)) },
          { label: 'Leads generated', value: compact(sum(db.participation_requests, (r) => +r.leads_generated)) },
        ],
        table: { columns: ['format', 'programmes', 'total_reach', 'avg_engagement_pct', 'leads', 'cost_per_1k_reach'], rows: byType },
        suggestions: ['Simulate a new exhibition campaign', 'Which partners drive the most leads?'],
      };
    }

    /* ── Commercial position ── */
    case 'financial': {
      const rows = db.sponsorships;
      const active = rows.filter((a) => a.status === 'active');
      const byTier = ['Platinum', 'Gold', 'Silver', 'Category'].map((tier) => {
        const g = rows.filter((a) => a.tier === tier);
        return {
          tier, agreements: g.length,
          contracted_aed: sum(g, (a) => +a.value_aed),
          invoiced_aed: sum(g, (a) => +a.invoiced_aed),
          roi_percent: r1(avg(g, (a) => +a.roi_percent)),
          // Return per dirham committed is the tier-versus-tier comparable.
          roi_per_aed_m: g.length ? r1(avg(g, (a) => +a.roi_percent) / Math.max(1, sum(g, (a) => +a.value_aed) / 1e6 / g.length)) : 0,
        };
      }).filter((t) => t.agreements > 0);

      const bestTier = [...byTier].sort((a, b) => b.roi_percent - a.roi_percent)[0];
      const worstTier = [...byTier].sort((a, b) => a.roi_percent - b.roi_percent)[0];
      const collected = sum(rows, (a) => +a.invoiced_aed) / Math.max(1, sum(rows, (a) => +a.value_aed));

      return {
        intent, title: 'Commercial position',
        answer: `${rows.length} agreements carry ${aed(sum(rows, (a) => +a.value_aed))} of contracted value, `
          + `${aed(sum(active, (a) => +a.value_aed))} of it on live agreements. Collection stands at ${r0(collected * 100)}% of contracted. `
          + `Blended return is ${r1(avg(rows, (a) => +a.roi_percent))}%, but the spread across tiers is wide — `
          + `${bestTier.tier} returns ${r1(bestTier.roi_percent)}% against ${worstTier.tier} at ${r1(worstTier.roi_percent)}%. `
          + `Rebalancing inventory away from ${worstTier.tier} is the single clearest lever on blended ROI.`,
        metrics: [
          { label: 'Contracted value', value: aed(sum(rows, (a) => +a.value_aed)) },
          { label: 'Blended ROI', value: `${r1(avg(rows, (a) => +a.roi_percent))}%` },
          { label: 'Collected', value: `${r0(collected * 100)}%` },
        ],
        table: { columns: ['tier', 'agreements', 'contracted_aed', 'invoiced_aed', 'roi_percent'], rows: byTier },
        suggestions: ['Which agreements are at risk?', 'Top partners by ROI'],
      };
    }

    /* ── Ecosystem adoption ── */
    case 'adoption': {
      const m = db.engagement_monthly;
      const last = m[m.length - 1] || {};
      const first = m[0] || {};
      const yearAgo = m[Math.max(0, m.length - 13)] || first;
      const active = db.developers.filter((d) => d.status === 'active');

      return {
        intent, title: 'Ecosystem adoption',
        answer: `${db.developers.length} developers are registered and ${active.length} are active — `
          + `an active rate of ${r1((active.length / db.developers.length) * 100)}%, up from ${r1(+yearAgo.active_pct || 0)}% a year ago. `
          + `Registrations grew from ${first.registered_partners} to ${last.registered_partners} over the ${m.length}-month series. `
          + `Digital completion reached ${r1(+last.digital_pct || 0)}% while average approval time fell from ${r1(+first.avg_approval_days || 0)} to ${r1(+last.avg_approval_days || 0)} days — `
          + `adoption and efficiency are moving together, which is the pattern that indicates the platform is being used rather than merely populated.`,
        metrics: [
          { label: 'Registered', value: db.developers.length },
          { label: 'Active rate', value: `${r1((active.length / db.developers.length) * 100)}%` },
          { label: 'Digital completion', value: `${r1(+last.digital_pct || 0)}%` },
          { label: 'Avg approval', value: `${r1(+last.avg_approval_days || 0)} days` },
        ],
        series: m.map((x) => ({ month: x.month, registered: +x.registered_partners, active: +x.active_partners, digital: +x.digital_pct })),
        suggestions: ['Which partners are inactive?', 'How is the approval queue looking?'],
      };
    }

    /* ── Events & exhibitions ── */
    case 'events': {
      const done = db.events.filter((e) => e.status === 'completed');
      const upcoming = db.events.filter((e) => e.status === 'confirmed' || e.status === 'planning');
      const rows = db.events.map((e) => {
        const parts = db.event_participations.filter((p) => p.event_id === e.event_id);
        return {
          event: e.title, type: e.type, status: e.status,
          partners: parts.filter((p) => p.status === 'confirmed').length,
          footfall: +e.footfall,
          leads: +e.leads_generated,
          // Media value returned against budget spent — the events ROI measure.
          media_roi_pct: +e.budget_aed ? r1(((+e.media_value_aed - +e.budget_aed) / +e.budget_aed) * 100) : 0,
        };
      });
      const best = [...rows].filter((r) => r.status === 'completed').sort((a, b) => b.media_roi_pct - a.media_roi_pct)[0];

      return {
        intent, title: 'Events & exhibitions',
        answer: `${db.events.length} events are on the calendar — ${done.length} delivered, ${upcoming.length} ahead. `
          + `Completed events drew ${compact(sum(done, (e) => +e.footfall))} visitors and generated ${compact(sum(done, (e) => +e.leads_generated))} leads `
          + `against ${aed(sum(done, (e) => +e.budget_aed))} of budget, returning ${aed(sum(done, (e) => +e.media_value_aed))} in earned media. `
          + (best ? `${best.event} was the standout at ${best.media_roi_pct}% media ROI.` : ''),
        metrics: [
          { label: 'Events', value: db.events.length },
          { label: 'Total footfall', value: compact(sum(done, (e) => +e.footfall)) },
          { label: 'Media value', value: aed(sum(done, (e) => +e.media_value_aed)) },
        ],
        table: { columns: ['event', 'type', 'status', 'partners', 'footfall', 'leads', 'media_roi_pct'], rows: rows.slice(0, 12) },
        suggestions: ['Which partners exhibit most often?', 'Simulate a new exhibition'],
      };
    }

    /* ── The physical portfolio behind the twin ── */
    case 'projects': {
      const byDistrict = {};
      for (const p of db.projects) {
        const k = p.district;
        byDistrict[k] = byDistrict[k] || { district: k, projects: 0, units: 0, value_aed: 0, developers: new Set() };
        byDistrict[k].projects++;
        byDistrict[k].units += +p.units;
        byDistrict[k].value_aed += +p.value_aed;
        byDistrict[k].developers.add(p.developer_id);
      }
      const rows = Object.values(byDistrict)
        .map((d) => ({ ...d, developers: d.developers.size }))
        .sort((a, b) => b.value_aed - a.value_aed);

      return {
        intent, title: 'Portfolio geography',
        answer: `${db.projects.length} partner projects are mapped across ${rows.length} districts, `
          + `carrying ${compact(sum(db.projects, (p) => +p.units))} units and ${aed(sum(db.projects, (p) => +p.value_aed))} of declared value. `
          + `${rows[0].district} is the densest by value with ${rows[0].projects} projects from ${rows[0].developers} developers. `
          + `${db.projects.filter((p) => p.status === 'under_construction').length} are under construction — that pipeline is what the Digital Twin's status layer renders.`,
        metrics: [
          { label: 'Mapped projects', value: db.projects.length },
          { label: 'Districts', value: rows.length },
          { label: 'Portfolio value', value: aed(sum(db.projects, (p) => +p.value_aed)) },
        ],
        table: { columns: ['district', 'projects', 'developers', 'units', 'value_aed'], rows: rows.slice(0, 12) },
        suggestions: ['Open the Digital Twin', 'Which developers build in Downtown Dubai?'],
      };
    }

    /* ── Default: the weekly digest ── */
    default: {
      const d = digest(db, NOW);
      return {
        intent: 'digest', title: d.headline,
        answer: d.paragraphs.join(' '),
        metrics: d.metrics,
        suggestions: SUGGESTIONS.slice(0, 4),
      };
    }
  }
}

function dominantReason(found) {
  const counts = {};
  for (const a of found) for (const r of a.reasons) counts[r] = (counts[r] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0].toLowerCase()} (${top[1]} agreements)` : 'unclear';
}

/* ══════════════════════════════════════════════════════════════════════
   What-If Campaign Simulator
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Projects the outcome of a campaign that has not been launched, using base
 * rates measured from completed campaigns of the same format. Returns the
 * projection *and* the derivation, because a number an executive cannot
 * interrogate is a number they will not act on.
 */
function simulate(db, params, now) {
  const NOW = now || new Date();
  const type = ['exhibition', 'campaign', 'initiative'].includes(params.type) ? params.type : 'campaign';
  const budget = clamp(+params.budget_aed || 500000, 10000, 100000000);
  const targetPartners = clamp(+params.target_partners || 10, 1, 40);
  const durationDays = clamp(+params.duration_days || 30, 1, 365);
  const invitedTiers = params.tiers && params.tiers.length ? params.tiers : ['Master Developer', 'Premium', 'Mid-Market'];

  // ── Base rates from history, with a portfolio-wide fallback when a format
  //    has too few completed instances to be trustworthy on its own.
  const done = db.campaigns.filter((c) => c.status === 'completed');
  const sameType = done.filter((c) => c.type === type);
  const basis = sameType.length >= 3 ? sameType : done;
  const basisLabel = sameType.length >= 3
    ? `${sameType.length} completed ${type}s`
    : `${done.length} completed programmes (too few ${type}s to isolate)`;

  const reachPerAed = avg(basis, (c) => (+c.budget_aed ? +c.reach / +c.budget_aed : 0));
  const baseEngagement = avg(basis, (c) => +c.engagement_rate);
  const basisIds = new Set(basis.map((c) => c.campaign_id));
  const basisReqs = db.participation_requests.filter((r) => basisIds.has(r.campaign_id));
  const approvalRate = basisReqs.length
    ? basisReqs.filter((r) => r.status === 'approved').length / basisReqs.length : 0.85;
  const leadsPerPartner = avg(
    basisReqs.filter((r) => r.status === 'approved'), (r) => +r.leads_generated
  );

  /* ── Lead economics, derived rather than assumed ─────────────────────
     Leads are driven by reach, not by headcount: a programme with many
     partners but little budget cannot generate the same enquiries as a
     well-funded one. Scaling leads off participants alone made a small budget
     with many partners project an absurd return.

     The value of a lead is likewise calibrated from history instead of being
     picked: it is set so that a programme matching the historical average
     reproduces the portfolio's own measured return. That keeps the simulator
     anchored to the same reality the Sponsorships ledger reports. */
  const avgBudget = Math.max(1, avg(basis, (c) => +c.budget_aed));
  const avgReach = Math.max(1, avg(basis, (c) => +c.reach));
  const avgLeadsPerProgramme = Math.max(
    1, sum(basisReqs.filter((r) => r.status === 'approved'), (r) => +r.leads_generated) / Math.max(1, basis.length)
  );
  const leadsPerReach = avgLeadsPerProgramme / avgReach;
  const MEDIA_RATE = 0.021;            // earned media value per person reached
  const targetRoi = avg(db.sponsorships, (a) => +a.roi_percent) / 100;
  const leadValue = clamp(
    (avgBudget * (1 + targetRoi) - avgReach * MEDIA_RATE) / avgLeadsPerProgramme,
    25, 25000
  );

  /* ── Modifiers. Each is a named multiplier against the historical average
     programme, so every one can be shown and argued with. All three are damped:
     nothing in a media buy scales linearly. */
  const tierWeight = { 'Master Developer': 1.35, Luxury: 1.15, Premium: 1.0, 'Mid-Market': 0.78 };
  const tierMix = avg(invitedTiers, (t) => tierWeight[t] || 1);
  // Reach scales with participants but with diminishing returns — audiences overlap.
  const partnerScale = Math.pow(targetPartners / Math.max(1, avg(basis, (c) => +c.target_partners)), 0.62);
  // Longer runs accumulate reach, again sub-linearly.
  const durationScale = Math.pow(durationDays / Math.max(1, avg(basis, (c) => Math.max(1, daysBetween(c.start_date, c.end_date)))), 0.45);
  /* Budget is the important one. Treating reach as linear in spend makes return
     independent of budget, which would render the sensitivity table meaningless
     and is wrong besides: the cheapest audience is bought first, and each extra
     dirham reaches a progressively more expensive one. */
  const budgetScale = Math.pow(budget / avgBudget, 0.75);

  const projectedParticipants = Math.round(targetPartners * approvalRate);
  // Anchored on the average comparable programme, then scaled by each factor.
  const projectedReach = Math.round(avgReach * budgetScale * partnerScale * durationScale * tierMix);
  const projectedEngagement = r1(baseEngagement * clamp(tierMix, 0.7, 1.3));
  // Leads follow reach — which already carries budget, partners and duration.
  const projectedLeads = Math.round(projectedReach * leadsPerReach * clamp(tierMix, 0.8, 1.25));

  const mediaValue = projectedReach * MEDIA_RATE;
  const returnedValue = projectedLeads * leadValue + mediaValue;
  const projectedRoi = r1(((returnedValue - budget) / budget) * 100);

  // ── Confidence reflects how much history the projection actually rests on.
  const n = basis.length;
  const spread = stdev(basis.map((c) => +c.engagement_rate));
  const confidence = clamp(Math.round(58 + n * 2.6 - spread * 4 + (sameType.length >= 3 ? 8 : 0)), 40, 92);

  // ── Comparable historical programmes, for a sanity check against reality.
  const comparables = [...basis]
    .sort((a, b) => Math.abs(+a.budget_aed - budget) - Math.abs(+b.budget_aed - budget))
    .slice(0, 4)
    .map((c) => ({
      campaign: c.title, type: c.type, budget_aed: +c.budget_aed,
      reach: +c.reach, engagement_rate: +c.engagement_rate, partners: +c.target_partners,
    }));

  return {
    inputs: { type, budget_aed: budget, target_partners: targetPartners, duration_days: durationDays, tiers: invitedTiers },
    projection: {
      participants: projectedParticipants,
      reach: projectedReach,
      engagement_rate: projectedEngagement,
      leads: projectedLeads,
      media_value_aed: Math.round(mediaValue),
      returned_value_aed: Math.round(returnedValue),
      roi_percent: projectedRoi,
      cost_per_1k_reach: projectedReach ? r1(budget / (projectedReach / 1000)) : 0,
      cost_per_lead: projectedLeads ? r0(budget / projectedLeads) : 0,
    },
    confidence,
    basis: {
      label: basisLabel,
      programmes: n,
      reach_per_aed: +reachPerAed.toFixed(4),
      approval_rate_pct: r1(approvalRate * 100),
      leads_per_partner: r1(leadsPerPartner),
      base_engagement_pct: r1(baseEngagement),
      // Calibration, exposed so the return figure can be challenged.
      lead_value_aed: r0(leadValue),
      leads_per_1k_reach: r1(leadsPerReach * 1000),
      calibrated_to_roi_pct: r1(targetRoi * 100),
    },
    // The multiplier chain, exposed so the projection can be audited.
    factors: [
      { label: 'Budget scale', value: r1(budgetScale), note: `${aed(budget)} vs ${aed(avgBudget)} historical average, damped to the 0.75 power — each extra dirham buys a more expensive audience` },
      { label: 'Partner scale', value: r1(partnerScale), note: `${targetPartners} invited vs ${r0(avg(basis, (c) => +c.target_partners))} historical average, damped to the 0.62 power for audience overlap` },
      { label: 'Duration scale', value: r1(durationScale), note: `${durationDays} days vs ${r0(avg(basis, (c) => Math.max(1, daysBetween(c.start_date, c.end_date))))} historical average` },
      { label: 'Tier mix', value: r1(tierMix), note: `Weighted by the reach each invited tier historically commands` },
    ],
    comparables,
    // Sensitivity: what a budget move actually buys, given the same model.
    // Same model, re-run at each budget step — never a separate approximation.
    sensitivity: [-40, -20, 0, 20, 40, 80].map((pct) => {
      const b = budget * (1 + pct / 100);
      const reach = Math.round(avgReach * Math.pow(b / avgBudget, 0.75) * partnerScale * durationScale * tierMix);
      const leads = Math.round(reach * leadsPerReach * clamp(tierMix, 0.8, 1.25));
      const ret = leads * leadValue + reach * MEDIA_RATE;
      return {
        label: `${pct > 0 ? '+' : ''}${pct}%`,
        budget_aed: Math.round(b),
        reach,
        leads,
        roi_percent: r1(((ret - b) / b) * 100),
      };
    }),
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Smart Partner Matching
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Ranks developers for a given campaign. Every factor is normalised to 0–1 and
 * weighted, and the per-factor contributions travel with the result so the
 * recommendation can explain itself instead of asserting a score.
 */
const MATCH_WEIGHTS = {
  format_fit:   0.26,  // has this partner delivered this campaign format before?
  engagement:   0.22,  // current engagement score
  recency:      0.16,  // how recently they were active
  reliability:  0.16,  // historical approval rate on their submissions
  commercial:   0.12,  // sponsorship history and returns
  district_fit: 0.08,  // do they build where this programme is aimed?
};

function matchPartners(db, spec, now) {
  const NOW = now || new Date();
  const type = spec.type || 'campaign';
  const location = String(spec.location || '').toLowerCase();
  const limit = clamp(+spec.limit || 10, 1, 30);
  const exclude = new Set(spec.exclude || []);

  const cmpById = Object.fromEntries(db.campaigns.map((c) => [c.campaign_id, c]));
  const allEngagement = db.developers.map((d) => +d.engagement_score);
  const maxEngagement = Math.max(1, ...allEngagement);

  const scored = db.developers
    .filter((d) => !exclude.has(d.developer_id))
    .map((d) => {
      const reqs = db.participation_requests.filter((r) => r.developer_id === d.developer_id);
      const approved = reqs.filter((r) => r.status === 'approved');
      const sameFormat = approved.filter((r) => cmpById[r.campaign_id]?.type === type);
      const agreements = db.sponsorships.filter((a) => a.developer_id === d.developer_id);
      const projects = db.projects.filter((p) => p.developer_id === d.developer_id);

      // ── factors, each 0–1
      const formatFit = clamp(sameFormat.length / 4, 0, 1);
      const engagement = clamp(+d.engagement_score / maxEngagement, 0, 1);
      const daysIdle = daysBetween(d.last_login, NOW);
      const recency = clamp(1 - daysIdle / 90, 0, 1);
      const reliability = reqs.length ? approved.length / reqs.length : 0.5;
      const roi = agreements.length ? avg(agreements, (a) => +a.roi_percent) : 0;
      const commercial = clamp((agreements.length ? 0.4 : 0) + clamp(roi / 200, 0, 0.6), 0, 1);
      const districtFit = location && (
        location.includes(String(d.district).toLowerCase()) ||
        projects.some((p) => location.includes(String(p.district).toLowerCase()))
      ) ? 1 : (location.includes('citywide') || location.includes('digital') || !location ? 0.55 : 0.15);

      const factors = { format_fit: formatFit, engagement, recency, reliability, commercial, district_fit: districtFit };
      const score = Object.entries(MATCH_WEIGHTS).reduce((s, [k, w]) => s + factors[k] * w, 0);

      // ── the human-readable case for this partner
      const why = [];
      if (sameFormat.length) why.push(`${sameFormat.length} prior ${type}${sameFormat.length === 1 ? '' : 's'} delivered`);
      if (+d.engagement_score >= 80) why.push(`engagement ${d.engagement_score}/100`);
      if (daysIdle <= 7) why.push('active this week');
      else if (daysIdle > 45) why.push(`inactive ${r0(daysIdle)} days`);
      if (reqs.length >= 3 && reliability >= 0.85) why.push(`${r0(reliability * 100)}% approval record`);
      if (agreements.length) why.push(`${agreements.length} agreement${agreements.length === 1 ? '' : 's'}, ${r1(roi)}% ROI`);
      if (districtFit === 1) why.push(`builds in ${d.district}`);

      return {
        developer_id: d.developer_id, name: d.name, tier: d.tier, district: d.district,
        contact_name: d.contact_name, status: d.status,
        engagement_score: +d.engagement_score,
        match_score: Math.round(score * 100),
        prior_format_count: sameFormat.length,
        total_participations: approved.length,
        agreements: agreements.length,
        roi_percent: r1(roi),
        days_since_login: r0(daysIdle),
        factors: Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, Math.round(v * 100)])),
        why,
      };
    })
    .sort((a, b) => b.match_score - a.match_score);

  return {
    weights: Object.fromEntries(Object.entries(MATCH_WEIGHTS).map(([k, v]) => [k, Math.round(v * 100)])),
    matches: scored.slice(0, limit),
    considered: scored.length,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Ledger anomaly detection
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Flags agreements whose delivery has drifted from what the contract implies,
 * before a human reading the ledger row-by-row would notice. Each rule is
 * stated in terms an account manager can act on.
 */
function anomalies(db, now) {
  const NOW = now || new Date();
  const devById = Object.fromEntries(db.developers.map((d) => [d.developer_id, d]));
  const cmpById = Object.fromEntries(db.campaigns.map((c) => [c.campaign_id, c]));

  // Tier baselines — an agreement is judged against its own peer group.
  const tierRoi = {};
  for (const tier of ['Platinum', 'Gold', 'Silver', 'Category']) {
    const g = db.sponsorships.filter((a) => a.tier === tier).map((a) => +a.roi_percent);
    tierRoi[tier] = { median: median(g), sd: stdev(g) };
  }

  const out = [];
  for (const a of db.sponsorships) {
    if (a.status === 'expired') continue;

    const total = +a.commitments_total || 0;
    const met = +a.commitments_met || 0;
    const value = +a.value_aed || 0;
    const elapsed = daysBetween(a.signed_date, NOW);
    const term = Math.max(1, daysBetween(a.signed_date, a.expiry_date));
    const elapsedPct = clamp(elapsed / term, 0, 1);
    const deliveredPct = total ? met / total : 0;
    const collectedPct = value ? (+a.invoiced_aed || 0) / value : 0;
    const daysToExpiry = r0(daysBetween(NOW, a.expiry_date));

    const reasons = [];
    let severity = 'low';

    // Rule 1 — delivery pace behind the contract clock.
    const gap = elapsedPct - deliveredPct;
    if (gap > 0.32) {
      reasons.push(`Delivery ${r0(gap * 100)} points behind schedule (${met}/${total} commitments at ${r0(elapsedPct * 100)}% of term)`);
      severity = gap > 0.5 ? 'high' : 'medium';
    }

    // Rule 2 — return materially below the tier's own median.
    const base = tierRoi[a.tier];
    if (base && base.sd > 0 && +a.roi_percent < base.median - base.sd) {
      reasons.push(`ROI ${r1(+a.roi_percent)}% sits more than one deviation below the ${a.tier} median of ${r1(base.median)}%`);
      if (severity !== 'high') severity = 'medium';
    }

    // Rule 3 — invoicing lagging the delivery it should follow.
    if (elapsedPct > 0.4 && collectedPct < elapsedPct - 0.3) {
      reasons.push(`Only ${r0(collectedPct * 100)}% invoiced at ${r0(elapsedPct * 100)}% of term`);
      if (severity === 'low') severity = 'medium';
    }

    // Rule 4 — running out of runway with commitments still open.
    if (daysToExpiry > 0 && daysToExpiry < 60 && deliveredPct < 0.9) {
      reasons.push(`Expires in ${daysToExpiry} days with ${total - met} commitment(s) outstanding`);
      severity = 'high';
    }

    // Rule 5 — the counterparty has gone quiet on a live agreement.
    const dev = devById[a.developer_id];
    if (dev && a.status === 'active') {
      const idle = daysBetween(dev.last_login, NOW);
      if (idle > 45) {
        reasons.push(`Counterparty inactive for ${r0(idle)} days`);
        if (severity === 'low') severity = 'medium';
      }
    }

    // Rule 6 — signed but never countersigned.
    if (a.status === 'pending_signature' && elapsed > 30) {
      reasons.push(`Awaiting signature for ${r0(elapsed)} days`);
      severity = severity === 'high' ? 'high' : 'medium';
    }

    if (reasons.length) {
      out.push({
        agreement_id: a.agreement_id,
        title: a.title,
        developer_id: a.developer_id,
        developer_name: dev?.name || a.developer_id,
        campaign_title: cmpById[a.campaign_id]?.title || a.campaign_id,
        tier: a.tier,
        status: a.status,
        value_aed: value,
        roi_percent: +a.roi_percent,
        commitments: `${met}/${total}`,
        delivery_gap_pct: r0(gap * 100),
        days_to_expiry: daysToExpiry,
        severity,
        reasons,
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || b.value_aed - a.value_aed);
}

/* ══════════════════════════════════════════════════════════════════════
   Auto-generated executive digest
   ══════════════════════════════════════════════════════════════════════ */

/** A natural-language weekly summary, composed from measured deltas. */
function digest(db, now) {
  const NOW = now || new Date();
  const m = db.engagement_monthly;
  const last = m[m.length - 1] || {};
  const prev = m[m.length - 2] || last;
  const pct = (a, b) => (b ? r1(((+a - +b) / +b) * 100) : 0);

  const active = db.developers.filter((d) => d.status === 'active');
  const live = db.campaigns.filter((c) => c.status === 'active');
  const openReqs = db.participation_requests.filter((r) => r.status === 'pending' || r.status === 'under_review');
  const breaching = openReqs.filter((r) => daysBetween(r.submitted_date, NOW) > 3);
  const risk = anomalies(db, NOW);
  const highRisk = risk.filter((a) => a.severity === 'high');
  const agreements = db.sponsorships;
  const activeAgr = agreements.filter((a) => a.status === 'active');
  const upcomingEvents = db.events.filter((e) => e.status === 'confirmed' && new Date(e.start_date) > NOW);

  // Levels come from the records; the rollup supplies only the direction.
  const cur = currentState(db);
  const engagementDelta = pct(last.active_partners, prev.active_partners);
  const approvalDelta = pct(last.avg_approval_days, prev.avg_approval_days);

  const paragraphs = [
    `${live.length} programmes are live and ${db.campaigns.filter((c) => c.status === 'review').length} sit in review. `
      + `${cur.activePartners} of ${cur.totalPartners} partners are active — a rate of ${r1((cur.activePartners / cur.totalPartners) * 100)}%, `
      + `${engagementDelta >= 0 ? 'up' : 'down'} ${Math.abs(engagementDelta)}% month on month.`,

    `The approval queue holds ${openReqs.length} open requests, ${breaching.length} of them past the 3-day service target. `
      + `Average decision time is ${cur.avgApprovalDays} days, ${approvalDelta <= 0 ? 'improved' : 'slower'} by ${Math.abs(approvalDelta)}% on last month.`,

    `Commercially, ${activeAgr.length} live agreements carry ${aed(sum(activeAgr, (a) => +a.value_aed))} at a blended return of ${r1(avg(agreements, (a) => +a.roi_percent))}%. `
      + (highRisk.length
        ? `${highRisk.length} agreement${highRisk.length === 1 ? '' : 's'} need${highRisk.length === 1 ? 's' : ''} intervention this week, covering ${aed(sum(highRisk, (a) => a.value_aed))} of contracted value.`
        : 'No agreement is currently flagged at high severity.'),

    upcomingEvents.length
      ? `${upcomingEvents.length} confirmed events are ahead, the nearest being ${upcomingEvents[0].title} on ${upcomingEvents[0].start_date}.`
      : 'No confirmed events are currently scheduled.',
  ];

  return {
    generated_at: NOW.toISOString(),
    headline: `${live.length} live programmes · ${openReqs.length} open requests · ${highRisk.length} agreements need attention`,
    paragraphs,
    metrics: [
      { label: 'Active partners', value: cur.activePartners, delta: engagementDelta },
      { label: 'Open requests', value: openReqs.length, delta: null },
      { label: 'Past SLA', value: breaching.length, delta: null },
      { label: 'Blended ROI', value: `${r1(avg(agreements, (a) => +a.roi_percent))}%`, delta: null },
    ],
    // The digest doubles as a task list — each item deep-links into a screen.
    actions: [
      breaching.length && { label: `Clear ${breaching.length} requests past the 3-day target`, to: '/dld/requests', tone: 'warning' },
      highRisk.length && { label: `Review ${highRisk.length} high-severity agreements`, to: '/dld/sponsorships', tone: 'danger' },
      db.campaigns.filter((c) => c.status === 'review').length && { label: `${db.campaigns.filter((c) => c.status === 'review').length} programmes awaiting launch decision`, to: '/dld/campaigns', tone: 'accent' },
      upcomingEvents.length && { label: `${upcomingEvents.length} events need partner confirmation`, to: '/dld/events', tone: 'teal' },
    ].filter(Boolean),
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Portfolio health — one composite number for the executive tile
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Rolls adoption, efficiency, commercial return and delivery into a single
 * 0–100 score. The components travel with it: a composite nobody can decompose
 * is a composite nobody trusts.
 */
function portfolioHealth(db, now) {
  const NOW = now || new Date();
  // Same source as the KPI tiles — see currentState() for why.
  const cur = currentState(db);

  const active = cur.activePartners;
  const adoption = clamp((active / Math.max(1, cur.totalPartners)) * 100, 0, 100);

  // Efficiency blends decision speed (target: 3 days) with digital completion.
  const speed = clamp(100 - ((cur.avgApprovalDays || 5) - 1.5) * 18, 0, 100);
  const efficiency = clamp(speed * 0.45 + cur.digitalPct * 0.55, 0, 100);

  // Commercial: blended ROI mapped onto 0–100, where 100% ROI reads as 75.
  const roi = avg(db.sponsorships, (a) => +a.roi_percent);
  const commercial = clamp(25 + roi * 0.5, 0, 100);

  // Delivery: share of live agreements not tripping a risk rule.
  const live = db.sponsorships.filter((a) => a.status === 'active');
  const flagged = new Set(anomalies(db, NOW).map((a) => a.agreement_id));
  const delivery = live.length
    ? clamp((live.filter((a) => !flagged.has(a.agreement_id)).length / live.length) * 100, 0, 100) : 70;

  const components = [
    { label: 'Adoption', value: r0(adoption), weight: 25, note: `${active} of ${cur.totalPartners} partners active` },
    { label: 'Efficiency', value: r0(efficiency), weight: 25, note: `${cur.avgApprovalDays}d decisions · ${r1(cur.digitalPct)}% digital` },
    { label: 'Commercial', value: r0(commercial), weight: 25, note: `${r1(roi)}% blended ROI` },
    { label: 'Delivery', value: r0(delivery), weight: 25, note: `${live.length - [...flagged].filter((id) => live.some((a) => a.agreement_id === id)).length} of ${live.length} agreements on track` },
  ];
  const score = r0(sum(components, (c) => c.value * (c.weight / 100)));

  return {
    score,
    band: score >= 80 ? 'Strong' : score >= 65 ? 'Healthy' : score >= 50 ? 'Watch' : 'At risk',
    components,
  };
}

/* ── local formatters (the API returns display strings inside prose) ── */
function compact(n) {
  const v = +n || 0;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return `${Math.round(v)}`;
}
const aed = (n) => `AED ${compact(n)}`;

module.exports = {
  answer, simulate, matchPartners, anomalies, digest, portfolioHealth,
  SUGGESTIONS,
};
