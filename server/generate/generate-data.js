/**
 * Dataset generator — Real Estate Developer Connectivity Platform (DLD).
 *
 * Writes the CSV system-of-record into /data. Everything the API serves is
 * derived from these files, so the POC is a genuine full-stack app with no
 * external database. Generation is seeded and therefore reproducible: re-running
 * `npm run generate` yields byte-identical files.
 *
 * Relational shape (per the roadmap's Phase Two note):
 *   developers  ──┐
 *                 ├── participation_requests (many-to-many join) ── campaigns
 *   campaigns   ──┘
 *   sponsorships links a developer to a campaign with commercial terms.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

/* ── seeded RNG (mulberry32) so datasets are reproducible ───────────── */
let _seed = 0x5eed1e;
function rnd() {
  _seed |= 0; _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const rf = (a, b, d = 1) => +(a + rnd() * (b - a)).toFixed(d);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;

/* ── reference date: the platform's "today" ────────────────────────── */
const TODAY = new Date('2026-06-15T08:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

/* ── CSV writer ────────────────────────────────────────────────────── */
function esc(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(name, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(',')).join('\n');
  fs.writeFileSync(path.join(DATA_DIR, `${name}.csv`), `${headers.join(',')}\n${body}\n`, 'utf8');
  console.log(`  ${name}.csv — ${rows.length} rows`);
}

/* ══════════════════════════════════════════════════════════════════════
   Reference vocabularies
   ══════════════════════════════════════════════════════════════════════ */
const DEVELOPERS = [
  ['Emaar Properties', 'إعمار العقارية', 'Master Developer', 'Downtown Dubai'],
  ['Nakheel', 'نخيل', 'Master Developer', 'Palm Jumeirah'],
  ['DAMAC Properties', 'داماك العقارية', 'Master Developer', 'Business Bay'],
  ['Dubai Properties', 'دبي للعقارات', 'Master Developer', 'JBR'],
  ['Meraas', 'ميراس', 'Master Developer', 'City Walk'],
  ['Sobha Realty', 'صبحا العقارية', 'Premium', 'Sobha Hartland'],
  ['Select Group', 'مجموعة سيلكت', 'Premium', 'Dubai Marina'],
  ['Azizi Developments', 'عزيزي للتطوير', 'Premium', 'Al Furjan'],
  ['Danube Properties', 'دانوب العقارية', 'Mid-Market', 'Al Warsan'],
  ['Ellington Properties', 'إلينغتون العقارية', 'Premium', 'Jumeirah Village'],
  ['MAG Lifestyle', 'ماج لايف ستايل', 'Mid-Market', 'MBR City'],
  ['Deyaar Development', 'ديار للتطوير', 'Mid-Market', 'Al Barsha'],
  ['Union Properties', 'الاتحاد العقارية', 'Mid-Market', 'Motor City'],
  ['Wasl Properties', 'وصل العقارية', 'Master Developer', 'Al Wasl'],
  ['Omniyat', 'أومنيات', 'Luxury', 'Palm Jumeirah'],
  ['Binghatti Developers', 'بن غاطي للتطوير', 'Mid-Market', 'JVC'],
  ['Samana Developers', 'سمانا للتطوير', 'Mid-Market', 'Arjan'],
  ['Tiger Group', 'مجموعة تايجر', 'Mid-Market', 'Al Nahda'],
  ['Aldar Properties', 'الدار العقارية', 'Master Developer', 'Dubai South'],
  ['Shapoorji Pallonji', 'شابورجي بالونجي', 'Premium', 'Dubai Hills'],
  ['Arada Developments', 'أرادة للتطوير', 'Premium', 'Nad Al Sheba'],
  ['Object 1', 'أوبجكت وان', 'Mid-Market', 'JVT'],
  ['Nshama', 'نشامة', 'Mid-Market', 'Town Square'],
  ['Reportage Properties', 'ريبورتاج العقارية', 'Mid-Market', 'Dubailand'],
  ['Imtiaz Developments', 'امتياز للتطوير', 'Mid-Market', 'Meydan'],
  ['LEOS Developments', 'ليوس للتطوير', 'Premium', 'Al Barari'],
  ['Prestige One', 'برستيج وان', 'Premium', 'Dubai Sports City'],
  ['Meteora Developers', 'ميتيورا للتطوير', 'Mid-Market', 'Studio City'],
];

const CONTACTS = [
  'Fatima Al Marzooqi', 'Khalid Al Suwaidi', 'Noura Al Hammadi', 'Omar Al Rashidi',
  'Layla Al Mansoori', 'Saeed Al Nuaimi', 'Hessa Al Falasi', 'Rashid Al Ketbi',
  'Maryam Al Shamsi', 'Yousef Al Balushi', 'Aisha Al Dhaheri', 'Tariq Al Zaabi',
  'Shaikha Al Qassimi', 'Majid Al Ali', 'Amna Al Muhairi', 'Hamdan Al Awadhi',
];

const CAMPAIGN_SEEDS = [
  ['Dubai Property Festival 2026', 'exhibition', 'Global exhibition showcasing Dubai off-plan inventory to international investors.', 'Dubai World Trade Centre'],
  ['Golden Visa Investor Roadshow', 'initiative', 'Joint roadshow promoting the property-linked Golden Visa across three GCC capitals.', 'Riyadh · Doha · Kuwait City'],
  ['Smart & Sustainable Homes Campaign', 'campaign', 'Co-branded campaign spotlighting energy-efficient developments and green certification.', 'Digital · Citywide'],
  ['Cityscape Global — Dubai Pavilion', 'exhibition', 'Unified DLD pavilion hosting participating developers under one national identity.', 'Dubai Exhibition Centre'],
  ['First-Time Buyer Enablement Programme', 'initiative', 'Partnership programme easing entry for UAE-resident first-time property buyers.', 'Citywide'],
  ['Ramadan Real Estate Offers', 'campaign', 'Seasonal joint promotion aggregating verified developer offers on one channel.', 'Digital'],
  ['MIPIM Cannes — Dubai Delegation', 'exhibition', 'Dubai delegation to MIPIM targeting European institutional capital.', 'Cannes, France'],
  ['Off-Plan Transparency Initiative', 'initiative', 'Standardised disclosure pack for off-plan launches across participating developers.', 'Citywide'],
  ['Dubai Real Estate Week', 'exhibition', 'Week-long programme of launches, panels and investor briefings.', 'Madinat Jumeirah'],
  ['Branded Residences Showcase', 'campaign', 'Campaign positioning Dubai as the global capital of branded residences.', 'Digital · International'],
  ['PropTech Innovation Challenge', 'initiative', 'Developer-backed challenge sourcing proptech solutions for the emirate.', 'Area 2071'],
  ['Sustainable Communities Awards', 'initiative', 'Annual recognition programme for low-carbon master communities.', 'Museum of the Future'],
  ['IPS London — Dubai Stand', 'exhibition', 'International Property Show presence targeting UK and European buyers.', 'ExCeL London'],
  ['Rental Yield Awareness Drive', 'campaign', 'Data-led campaign communicating verified rental yield benchmarks.', 'Digital'],
  ['Family Communities Promotion', 'campaign', 'Joint promotion of school-adjacent family master communities.', 'Digital · Citywide'],
  ['Investor Confidence Summit', 'initiative', 'Summit convening developers, lenders and regulators on market stability.', 'Atlantis The Royal'],
  ['Digital Escrow Rollout', 'initiative', 'Phased rollout of digital escrow reconciliation with participating developers.', 'Platform'],
  ['Real Estate Media Partnership', 'campaign', 'Coordinated media buy amplifying developer launches under a DLD masthead.', 'Regional Media'],
  ['Dubai South Growth Corridor', 'campaign', 'Campaign spotlighting the logistics-and-aviation growth corridor.', 'Dubai South'],
  ['Heritage District Revival', 'initiative', 'Partnership restoring and marketing heritage-adjacent residential stock.', 'Al Shindagha'],
  ['Q3 Off-Plan Launch Window', 'campaign', 'Synchronised Q3 launch window reducing developer launch-date collisions.', 'Citywide'],
  ['Green Building Retrofit Alliance', 'initiative', 'Alliance funding retrofits across ageing residential towers.', 'Citywide'],
];

const DLD_OWNERS = [
  'Marketing & Communications', 'Partnerships Office', 'Events & Exhibitions',
  'Investor Relations', 'Strategy & Innovation',
];

/* ── Geography ────────────────────────────────────────────────────────
   District centroids (WGS84) for every district used by DEVELOPERS above.
   Projects are scattered around these points, which is what gives the
   Digital Twin its real Dubai shape without needing an external GIS. */
const DISTRICT_GEO = {
  'Downtown Dubai':     [55.2744, 25.1972],
  'Palm Jumeirah':      [55.1390, 25.1124],
  'Business Bay':       [55.2645, 25.1857],
  'JBR':                [55.1340, 25.0785],
  'City Walk':          [55.2610, 25.2110],
  'Sobha Hartland':     [55.3010, 25.1750],
  'Dubai Marina':       [55.1403, 25.0805],
  'Al Furjan':          [55.1450, 25.0270],
  'Al Warsan':          [55.4030, 25.1660],
  'Jumeirah Village':   [55.2090, 25.0560],
  'MBR City':           [55.3010, 25.1690],
  'Al Barsha':          [55.1980, 25.1090],
  'Motor City':         [55.2410, 25.0480],
  'Al Wasl':            [55.2530, 25.2010],
  'JVC':                [55.2090, 25.0560],
  'Arjan':              [55.2400, 25.0650],
  'Al Nahda':           [55.3700, 25.2900],
  'Dubai South':        [55.1560, 24.8960],
  'Dubai Hills':        [55.2480, 25.1010],
  'Nad Al Sheba':       [55.3200, 25.1560],
  'JVT':                [55.1900, 25.0470],
  'Town Square':        [55.2600, 25.0000],
  'Dubailand':          [55.3200, 25.0500],
  'Meydan':             [55.3000, 25.1600],
  'Al Barari':          [55.3200, 25.0850],
  'Dubai Sports City':  [55.2200, 25.0400],
  'Studio City':        [55.2450, 25.0330],
  'Al Shindagha':       [55.2900, 25.2680],
};

/* Venue coordinates for the Events & Exhibitions module. */
const VENUE_GEO = {
  'Dubai World Trade Centre': [55.2870, 25.2255],
  'Dubai Exhibition Centre':  [55.1490, 24.9600],
  'Madinat Jumeirah':         [55.1855, 25.1330],
  'Museum of the Future':     [55.2820, 25.2190],
  'Atlantis The Royal':       [55.1170, 25.1310],
  'Area 2071':                [55.2820, 25.2200],
  'Coca-Cola Arena':          [55.2960, 25.1880],
  'Dubai Opera':              [55.2740, 25.1940],
};

/* Project-name morphology — a prefix + typology reads like the real
   off-plan register without borrowing any single real project's name. */
const PROJECT_PREFIX = [
  'Azure', 'Marasi', 'Sereno', 'Vantage', 'Aurelia', 'Lumina', 'Solara',
  'Verdana', 'Cielo', 'Amara', 'Noor', 'Sahara', 'Meridian', 'Vista',
  'Corniche', 'Elara', 'Rixos', 'Aster', 'Zenith', 'Oasis', 'Cascade',
  'Palma', 'Riviera', 'Sapphire', 'Onyx', 'Terra', 'Halo', 'Aurora',
];
const PROJECT_SUFFIX = [
  'Residences', 'Heights', 'Towers', 'Gardens', 'Villas', 'Plaza',
  'Terraces', 'Boulevard', 'Park', 'Quarter', 'Bay', 'Grove', 'Court',
];
const PROJECT_TYPES = ['residential', 'mixed-use', 'commercial', 'hospitality', 'retail'];

const EVENT_SEEDS = [
  ['Dubai Property Festival 2026', 'exhibition', 'Dubai World Trade Centre', 'Flagship three-day exhibition connecting Dubai inventory with global investors.'],
  ['Cityscape Global — Dubai Pavilion', 'exhibition', 'Dubai Exhibition Centre', 'Unified national pavilion hosting participating developers under one identity.'],
  ['Investor Confidence Summit', 'summit', 'Atlantis The Royal', 'Closed-door summit convening developers, lenders and regulators.'],
  ['Sustainable Communities Awards', 'awards', 'Museum of the Future', 'Annual recognition programme for low-carbon master communities.'],
  ['Dubai Real Estate Week', 'exhibition', 'Madinat Jumeirah', 'Week-long programme of launches, panels and investor briefings.'],
  ['PropTech Innovation Challenge', 'conference', 'Area 2071', 'Developer-backed challenge sourcing proptech for the emirate.'],
  ['Golden Visa Investor Roadshow', 'roadshow', 'Dubai World Trade Centre', 'Roadshow promoting property-linked residency across GCC capitals.'],
  ['Branded Residences Forum', 'conference', 'Dubai Opera', 'Forum positioning Dubai as the capital of branded residences.'],
  ['Off-Plan Transparency Briefing', 'conference', 'Dubai World Trade Centre', 'Regulator briefing on the standardised off-plan disclosure pack.'],
  ['Family Communities Expo', 'exhibition', 'Coca-Cola Arena', 'Consumer expo for school-adjacent family master communities.'],
  ['Q3 Launch Window Coordination', 'summit', 'Area 2071', 'Working session synchronising Q3 launch dates across developers.'],
  ['Heritage District Showcase', 'exhibition', 'Madinat Jumeirah', 'Showcase of restored heritage-adjacent residential stock.'],
  ['Green Retrofit Alliance Assembly', 'summit', 'Museum of the Future', 'Assembly funding retrofits across ageing residential towers.'],
  ['Real Estate Media Partners Day', 'conference', 'Dubai Opera', 'Coordination day for the DLD-masthead media partnership.'],
];

const ASSET_SEEDS = [
  ['Dubai Property Festival — Brand Kit', 'brand-kit', 'ZIP'],
  ['Golden Visa Explainer — Bilingual', 'document', 'PDF'],
  ['DLD Partner Logo Suite', 'brand-kit', 'ZIP'],
  ['Sustainability Campaign — Key Visuals', 'image', 'PNG'],
  ['Investor Roadshow Deck (EN/AR)', 'document', 'PPTX'],
  ['Cityscape Pavilion — Stand Guidelines', 'document', 'PDF'],
  ['Dubai Skyline — Licensed Photography', 'image', 'JPG'],
  ['Off-Plan Disclosure Template', 'document', 'DOCX'],
  ['Real Estate Week — Motion Package', 'video', 'MP4'],
  ['Branded Residences — Social Cutdowns', 'video', 'MP4'],
  ['Market Performance Report Q1 2026', 'report', 'PDF'],
  ['Partner Co-Branding Guidelines', 'document', 'PDF'],
  ['Rental Yield Infographic Set', 'image', 'SVG'],
  ['MIPIM Delegation — Press Pack', 'document', 'PDF'],
  ['Family Communities — Lifestyle Reel', 'video', 'MP4'],
  ['Dubai South Corridor — Map Assets', 'image', 'PNG'],
  ['Escrow Rollout — Technical Spec', 'document', 'PDF'],
  ['Annual Partnership Review 2025', 'report', 'PDF'],
  ['Arabic Typography Pack', 'brand-kit', 'ZIP'],
  ['Heritage District — Archive Imagery', 'image', 'JPG'],
  ['Investor Summit — Speaker Templates', 'document', 'PPTX'],
  ['Q3 Launch Window — Campaign Toolkit', 'brand-kit', 'ZIP'],
];

/* ══════════════════════════════════════════════════════════════════════
   Builders
   ══════════════════════════════════════════════════════════════════════ */

function buildDevelopers() {
  return DEVELOPERS.map(([name, nameAr, tier, district], i) => {
    const id = `DEV-${String(i + 1).padStart(3, '0')}`;
    // Master developers registered earliest; the long tail onboarded later.
    const daysAgo = tier === 'Master Developer' ? ri(520, 900) : ri(60, 620);
    const registered = addDays(TODAY, -daysAgo);
    // Activity decays for a minority — that produces a realistic active-rate KPI
    // and, more usefully, a dormant segment with enough depth to actually run a
    // re-engagement play against.
    const active = chance(tier === 'Master Developer' ? 0.94 : 0.70);
    return {
      developer_id: id,
      name,
      name_ar: nameAr,
      tier,
      district,
      contact_name: pick(CONTACTS),
      contact_email: `partners@${name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14)}.ae`,
      registered_date: iso(registered),
      status: active ? 'active' : 'dormant',
      projects_count: tier === 'Master Developer' ? ri(14, 42) : tier === 'Luxury' ? ri(3, 9) : ri(4, 18),
      // A lapsed partner has genuinely gone quiet for months, not weeks — that
      // is what makes the 90-day inactivity query return a real worklist.
      last_login: iso(addDays(TODAY, active ? -ri(0, 12) : -ri(62, 240))),
      engagement_score: active ? ri(58, 97) : ri(11, 44),
    };
  });
}

function buildCampaigns() {
  const rows = [];
  CAMPAIGN_SEEDS.forEach(([title, type, description, location], i) => {
    const id = `CMP-${String(i + 1).padStart(3, '0')}`;
    // Spread across the pipeline: older seeds completed, newest still drafting.
    let status, start;
    const r = i / CAMPAIGN_SEEDS.length;
    // Completed programmes reach well back so the Digital Twin's time slider
    // has a real history to scrub through rather than a couple of quarters.
    if (r < 0.34) { status = 'completed'; start = addDays(TODAY, -ri(120, 780)); }
    else if (r < 0.68) { status = 'active'; start = addDays(TODAY, -ri(8, 70)); }
    else if (r < 0.86) { status = 'review'; start = addDays(TODAY, ri(14, 55)); }
    else { status = 'draft'; start = addDays(TODAY, ri(50, 130)); }

    const durationDays = type === 'exhibition' ? ri(3, 8) : ri(30, 96);
    const end = addDays(start, durationDays);
    const done = status === 'completed';
    const live = status === 'active';

    rows.push({
      campaign_id: id,
      title,
      type,
      status,
      owner: pick(DLD_OWNERS),
      location,
      description,
      start_date: iso(start),
      end_date: iso(end),
      budget_aed: ri(6, 92) * 50000,
      target_partners: ri(6, 22),
      // Reach and engagement only exist once something has actually run.
      reach: done ? ri(180, 2400) * 1000 : live ? ri(40, 900) * 1000 : 0,
      engagement_rate: done ? rf(2.4, 9.8, 1) : live ? rf(1.6, 8.2, 1) : 0,
      projects_featured: done ? ri(9, 74) : live ? ri(4, 48) : 0,
      progress_pct: done ? 100 : live ? ri(18, 88) : status === 'review' ? ri(5, 25) : 0,
    });
  });
  return rows;
}

function buildRequests(developers, campaigns) {
  const rows = [];
  let n = 1;
  for (const c of campaigns) {
    if (c.status === 'draft') continue; // nothing to join yet
    // Never invite past the slot count — approved must stay within target.
    const invited = ri(Math.max(4, c.target_partners - 6), c.target_partners);
    // Sample without replacement so a developer joins a campaign at most once.
    const pool = [...developers];
    for (let k = 0; k < invited && pool.length; k++) {
      const dev = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      if (dev.status === 'dormant' && chance(0.72)) continue;

      const submitted = addDays(new Date(c.start_date), -ri(6, 44));
      if (submitted > TODAY) continue;

      // The document pack is capped at what the campaign actually asks for —
      // a partner can be short, never over.
      const docsRequired = ri(2, 6);

      let status, approvalDays;
      if (c.status === 'completed') {
        status = chance(0.88) ? 'approved' : 'rejected';
        approvalDays = rf(0.6, 6.5, 1);
      } else if (c.status === 'active') {
        status = chance(0.8) ? 'approved' : chance(0.5) ? 'under_review' : 'pending';
        approvalDays = status === 'approved' ? rf(0.5, 5.4, 1) : '';
      } else {
        status = chance(0.45) ? 'under_review' : 'pending';
        approvalDays = '';
      }

      /* An open request is a live queue item, so it must have been submitted
         recently — otherwise the SLA panel reports a months-old backlog that no
         real operation would carry. Decided requests keep their historical date;
         open ones are pulled into the current review window, spread either side
         of the 3-day target so the queue shows a genuine mix of states. */
      const open = status === 'pending' || status === 'under_review';
      const submittedDate = open ? addDays(TODAY, -rf(0.2, 6.5, 1)) : submitted;

      rows.push({
        request_id: `REQ-${String(n++).padStart(4, '0')}`,
        campaign_id: c.campaign_id,
        developer_id: dev.developer_id,
        submitted_date: open ? submittedDate.toISOString() : iso(submittedDate),
        status,
        approval_days: approvalDays,
        documents_required: docsRequired,
        documents_uploaded: status === 'pending'
          ? Math.min(docsRequired, ri(0, 2))
          : ri(Math.max(1, docsRequired - 2), docsRequired),
        commitment_aed: ri(2, 60) * 25000,
        channel: chance(0.87) ? 'platform' : 'email',
        // Outcome metrics — only meaningful once the campaign has run.
        leads_generated: c.status === 'completed' && status === 'approved' ? ri(40, 1400) : 0,
        media_mentions: c.status === 'completed' && status === 'approved' ? ri(2, 46) : 0,
      });
    }
  }
  return rows;
}

function buildSponsorships(developers, campaigns) {
  const rows = [];
  const eligible = campaigns.filter((c) => c.status !== 'draft');
  let n = 1;
  for (const dev of developers) {
    if (dev.status === 'dormant' && chance(0.8)) continue;
    const count = dev.tier === 'Master Developer' ? ri(2, 4) : ri(0, 2);
    for (let k = 0; k < count; k++) {
      const c = pick(eligible);
      const signed = addDays(new Date(c.start_date), -ri(20, 90));
      if (signed > TODAY) continue;
      const expiry = addDays(signed, ri(180, 730));
      const expired = expiry < TODAY;
      const total = ri(4, 14);
      const met = expired ? total - (chance(0.7) ? 0 : ri(1, 2)) : ri(1, total);
      const value = ri(3, 90) * 100000;
      // ROI is only measurable on agreements that have generated activity.
      const roi = expired || c.status === 'completed' ? rf(-8, 240, 1) : rf(-4, 120, 1);

      rows.push({
        agreement_id: `AGR-${String(n++).padStart(3, '0')}`,
        developer_id: dev.developer_id,
        campaign_id: c.campaign_id,
        title: `${pick(['Platinum', 'Gold', 'Silver', 'Strategic', 'Category'])} Sponsorship — ${c.title}`,
        tier: pick(['Platinum', 'Gold', 'Silver', 'Category']),
        value_aed: value,
        signed_date: iso(signed),
        expiry_date: iso(expiry),
        status: expired ? 'expired' : chance(0.9) ? 'active' : 'pending_signature',
        commitments_total: total,
        commitments_met: met,
        invoiced_aed: expired ? value : Math.round(value * rf(0.2, 0.9, 2)),
        roi_percent: roi,
      });
    }
  }
  return rows;
}

function buildAssets(campaigns) {
  const live = campaigns.filter((c) => c.status !== 'draft');
  return ASSET_SEEDS.map(([title, type, fileType], i) => {
    const c = live[i % live.length];
    return {
      asset_id: `AST-${String(i + 1).padStart(3, '0')}`,
      title,
      campaign_id: c.campaign_id,
      type,
      file_type: fileType,
      size_mb: type === 'video' ? rf(48, 420, 1) : type === 'brand-kit' ? rf(12, 180, 1) : rf(0.4, 24, 1),
      uploaded_date: iso(addDays(TODAY, -ri(4, 300))),
      downloads: ri(6, 940),
      access: chance(0.82) ? 'all_partners' : 'approved_only',
      language: chance(0.6) ? 'EN/AR' : 'EN',
    };
  });
}

function buildNotifications(developers, campaigns, requests) {
  const rows = [];
  let n = 1;
  const push = (audience, developerId, kind, title, body, hoursAgo) => {
    rows.push({
      notif_id: `NTF-${String(n++).padStart(4, '0')}`,
      ts: addDays(TODAY, -hoursAgo / 24).toISOString(),
      audience,
      developer_id: developerId || '',
      kind,
      title,
      body,
      read: chance(0.42) ? 'yes' : 'no',
    });
  };

  // Inbound to DLD: uploads and submissions awaiting action — the roadmap's
  // "developer uploads material → alert pings the Communications Center" rule.
  const pendingReqs = requests.filter((r) => r.status === 'pending' || r.status === 'under_review').slice(0, 14);
  pendingReqs.forEach((r, i) => {
    const dev = developers.find((d) => d.developer_id === r.developer_id);
    const c = campaigns.find((x) => x.campaign_id === r.campaign_id);
    push('dld', r.developer_id, 'upload',
      `${dev.name} uploaded materials`,
      `${r.documents_uploaded} of ${r.documents_required} required documents received for "${c.title}".`,
      i * 7 + ri(1, 6));
  });

  // Outbound to developers: approvals and invitations.
  const approved = requests.filter((r) => r.status === 'approved').slice(0, 12);
  approved.forEach((r, i) => {
    const c = campaigns.find((x) => x.campaign_id === r.campaign_id);
    push('developer', r.developer_id, 'approval',
      `Participation approved — ${c.title}`,
      `Your request ${r.request_id} was approved. Asset deadlines are now visible in your workspace.`,
      i * 11 + ri(2, 9));
  });

  campaigns.filter((c) => c.status === 'review' || c.status === 'active').slice(0, 8).forEach((c, i) => {
    push('all', '', 'info', `${c.title} — partner invitations open`,
      `Registration closes ${c.start_date}. ${c.target_partners} partner slots available.`, i * 19 + ri(3, 14));
  });

  return rows.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

/* Monthly rollup — powers the executive trend charts. Values are built as a
   trend with noise rather than sampled independently, so the charts read as a
   growth story instead of static. */
function buildMonthly(developers) {
  const rows = [];
  const months = 18;
  let registered = 9;
  let partnerships = 4;
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
    const growth = ri(0, 2) + (i < 8 ? 1 : 0);
    registered = Math.min(developers.length, registered + growth);
    partnerships += ri(0, 3);
    const activePct = Math.min(94, 52 + (months - i) * 2.1 + rf(-4, 4, 1));
    const submitted = ri(14, 68) + Math.round((months - i) * 1.6);
    rows.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      registered_partners: registered,
      active_partners: Math.round(registered * (activePct / 100)),
      active_pct: +activePct.toFixed(1),
      requests_submitted: submitted,
      requests_approved: Math.round(submitted * rf(0.72, 0.94, 2)),
      // Approval time trends down as workflows move on-platform.
      avg_approval_days: +(7.4 - (months - i) * 0.26 + rf(-0.5, 0.5, 2)).toFixed(1),
      digital_pct: +Math.min(97, 54 + (months - i) * 2.4 + rf(-3, 3, 1)).toFixed(1),
      campaigns_launched: ri(1, 5),
      partnerships_active: partnerships,
      satisfaction_partner: +(3.6 + (months - i) * 0.045 + rf(-0.15, 0.15, 2)).toFixed(2),
      satisfaction_internal: +(3.4 + (months - i) * 0.05 + rf(-0.15, 0.15, 2)).toFixed(2),
    });
  }
  return rows;
}

/* AI advisory lines surfaced in the header panel and per-page banners. */
function buildAdvisories() {
  return [
    ['ADV-01', 'dld', 'high', 'Approval backlog concentrated in one campaign',
      'Nine participation requests for Dubai Property Festival 2026 have been pending beyond the 3-day service target. Reassigning two to the Partnerships Office clears the queue before the registration deadline.'],
    ['ADV-02', 'dld', 'medium', 'Dormant partner segment is re-engageable',
      'Six mid-market developers have not logged in for 45+ days but hold active sponsorship commitments. A targeted invitation to the Q3 Launch Window historically recovers about 40% of this segment.'],
    ['ADV-03', 'dld', 'medium', 'Sponsorship ROI variance widening',
      'Category-tier agreements are returning materially below Platinum on a per-dirham basis. Rebalancing category inventory toward exhibition formats would lift blended ROI.'],
    ['ADV-04', 'dld', 'low', 'Digital completion rate approaching target',
      'Digitally completed transactions reached 93.4% this month. The residual is almost entirely email-channel submissions from four partners — onboarding them closes the gap.'],
    ['ADV-05', 'developer', 'high', 'Two submissions are missing required documents',
      'Your pending requests are short of the required asset pack. Uploading them now keeps you inside the approval window for the current launch cycle.'],
    ['ADV-06', 'developer', 'medium', 'Your engagement is above segment median',
      'Participation across three active campaigns places you in the top quartile of your tier. Exhibition formats have generated your strongest media exposure to date.'],
    ['ADV-07', 'developer', 'low', 'New assets published for your campaigns',
      'The brand kit and motion package for campaigns you have joined were refreshed this week and are available in the asset library.'],
  ].map(([id, audience, severity, title, body]) => ({
    advisory_id: id, audience, severity, title, body,
  }));
}

/* ══════════════════════════════════════════════════════════════════════
   Digital Twin — the geospatial layer
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Physical projects, geo-located. This is the entity the Digital Twin renders:
 * every developer's portfolio scattered around its district centroid, carrying
 * enough attributes (height, status, value, sustainability) to drive both the
 * 2D layer styling and the 3D extrusion.
 */
function buildProjects(developers) {
  const rows = [];
  let n = 1;
  for (const dev of developers) {
    const base = DISTRICT_GEO[dev.district] || DISTRICT_GEO['Downtown Dubai'];
    // A visible sample of the portfolio, not all of it — master developers
    // put more towers on the map, which is what makes the twin legible.
    const count = dev.tier === 'Master Developer' ? ri(6, 9)
      : dev.tier === 'Luxury' ? ri(2, 4)
      : ri(3, 6);

    for (let k = 0; k < count; k++) {
      // Scatter within roughly 3.5 km of the district centre.
      const lng = +(base[0] + rf(-0.032, 0.032, 5)).toFixed(5);
      const lat = +(base[1] + rf(-0.026, 0.026, 5)).toFixed(5);

      const type = pick(PROJECT_TYPES);
      const luxury = dev.tier === 'Luxury' || dev.tier === 'Master Developer';
      const floors = type === 'villas' ? ri(2, 4)
        : luxury ? ri(18, 78)
        : ri(6, 34);
      const units = type === 'commercial' ? ri(40, 240) : floors * ri(4, 12);

      // Older stock has completed; the newest is still on paper.
      const r = rnd();
      const status = r < 0.30 ? 'completed'
        : r < 0.42 ? 'handover'
        : r < 0.78 ? 'under_construction'
        : 'planning';

      const launch = addDays(TODAY, -ri(90, 1700));
      const completion = addDays(launch, ri(540, 1500));

      rows.push({
        project_id: `PRJ-${String(n++).padStart(4, '0')}`,
        developer_id: dev.developer_id,
        name: `${pick(PROJECT_PREFIX)} ${pick(PROJECT_SUFFIX)}`,
        district: dev.district,
        lng,
        lat,
        type,
        status,
        floors,
        // Storey height varies by typology — commercial floorplates are taller.
        height_m: Math.round(floors * (type === 'commercial' ? 4.2 : 3.4)),
        units,
        value_aed: units * ri(700, 3800) * 1000,
        launch_date: iso(launch),
        completion_date: iso(completion),
        sustainability: pick(['LEED Platinum', 'LEED Gold', 'LEED Silver', 'Estidama 3P', 'Estidama 2P', 'None']),
        // Sales velocity only means something once a project is selling.
        sold_pct: status === 'planning' ? 0 : ri(18, 100),
      });
    }
  }
  return rows;
}

/* ══════════════════════════════════════════════════════════════════════
   Events & Exhibitions
   ══════════════════════════════════════════════════════════════════════ */
function buildEvents() {
  return EVENT_SEEDS.map(([title, type, venue, description], i) => {
    const r = i / EVENT_SEEDS.length;
    let status, start;
    if (r < 0.36) { status = 'completed'; start = addDays(TODAY, -ri(40, 300)); }
    else if (r < 0.5) { status = 'live'; start = addDays(TODAY, -ri(0, 3)); }
    else if (r < 0.79) { status = 'confirmed'; start = addDays(TODAY, ri(12, 120)); }
    else { status = 'planning'; start = addDays(TODAY, ri(130, 260)); }

    const days = type === 'exhibition' ? ri(3, 5) : type === 'roadshow' ? ri(5, 9) : ri(1, 2);
    const done = status === 'completed';
    const capacity = type === 'exhibition' ? ri(4000, 24000) : ri(180, 1400);
    const geo = VENUE_GEO[venue] || VENUE_GEO['Dubai World Trade Centre'];

    return {
      event_id: `EVT-${String(i + 1).padStart(3, '0')}`,
      title, type, venue, description, status,
      lng: geo[0], lat: geo[1],
      start_date: iso(start),
      end_date: iso(addDays(start, days)),
      capacity,
      registered: done ? Math.round(capacity * rf(0.62, 0.98, 2)) : Math.round(capacity * rf(0.12, 0.7, 2)),
      target_partners: ri(6, 24),
      budget_aed: ri(4, 70) * 100000,
      // Impact reporting only exists once an event has actually run.
      footfall: done ? Math.round(capacity * rf(0.7, 1.15, 2)) : 0,
      leads_generated: done ? ri(320, 6400) : 0,
      media_value_aed: done ? ri(3, 96) * 100000 : 0,
      satisfaction: done ? rf(3.7, 4.9, 2) : 0,
    };
  });
}

/** The developer ↔ event join, mirroring participation_requests for campaigns. */
function buildEventParticipations(developers, events) {
  const rows = [];
  let n = 1;
  for (const e of events) {
    if (e.status === 'planning') continue; // not open for registration yet
    const pool = [...developers];
    const invited = ri(Math.max(4, e.target_partners - 7), e.target_partners);

    for (let k = 0; k < invited && pool.length; k++) {
      const dev = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      if (dev.status === 'dormant' && chance(0.75)) continue;

      const done = e.status === 'completed';
      const status = done ? (chance(0.9) ? 'confirmed' : 'withdrawn')
        : chance(0.55) ? 'confirmed'
        : chance(0.5) ? 'pending' : 'invited';

      const docsRequired = ri(2, 5);
      const booth = e.type === 'exhibition' ? ri(2, 24) * 9 : 0;

      rows.push({
        participation_id: `EVP-${String(n++).padStart(4, '0')}`,
        event_id: e.event_id,
        developer_id: dev.developer_id,
        status,
        booth_sqm: booth,
        stand_number: booth ? `${pick(['A', 'B', 'C', 'D'])}${ri(10, 89)}` : '',
        staff_count: booth ? ri(2, 18) : ri(1, 5),
        documents_required: docsRequired,
        documents_uploaded: status === 'invited' ? 0 : ri(Math.max(0, docsRequired - 2), docsRequired),
        cost_aed: booth ? booth * ri(900, 2600) : ri(10, 90) * 1000,
        leads_captured: done && status === 'confirmed' ? ri(20, 780) : 0,
        meetings_held: done && status === 'confirmed' ? ri(4, 90) : 0,
      });
    }
  }
  return rows;
}

/* ══════════════════════════════════════════════════════════════════════ */
function generate() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('Generating DLD platform datasets →', DATA_DIR);

  const developers = buildDevelopers();
  const campaigns = buildCampaigns();
  const requests = buildRequests(developers, campaigns);
  const sponsorships = buildSponsorships(developers, campaigns);
  const assets = buildAssets(campaigns);
  const notifications = buildNotifications(developers, campaigns, requests);
  const monthly = buildMonthly(developers);
  const advisories = buildAdvisories();
  /* Appended after the original eight so the seeded RNG stream feeding those
     is untouched — the pre-existing CSVs stay byte-identical. */
  const projects = buildProjects(developers);
  const events = buildEvents();
  const eventParticipations = buildEventParticipations(developers, events);

  writeCsv('developers', developers);
  writeCsv('campaigns', campaigns);
  writeCsv('participation_requests', requests);
  writeCsv('sponsorships', sponsorships);
  writeCsv('assets', assets);
  writeCsv('notifications', notifications);
  writeCsv('engagement_monthly', monthly);
  writeCsv('advisories', advisories);
  writeCsv('projects', projects);
  writeCsv('events', events);
  writeCsv('event_participations', eventParticipations);

  console.log('Done.');
}

if (require.main === module) generate();
/* TODAY is exported as the platform's reference clock. Every dataset is built
   relative to it, so the API must reason from the same instant — using the
   wall clock instead would make a freshly generated dataset read as stale. */
module.exports = { generate, DATA_DIR, REFERENCE_DATE: TODAY };
