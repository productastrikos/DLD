import React, { useEffect, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { fetchApi, fmt } from '../services/api';
import { ThemeToggle } from '../theme';
import { LangToggle, useI18n } from '../i18n';
import { moduleForPath } from '../services/modules';
import { NotificationPanel, AdvisoryPanel, markAllRead } from './Panels';
import { PoweredByAstrikos, DldMark } from './Brand';
import AdvisoryStrip from './AdvisoryStrip';
import AskSia from './AskSia';
import {
  IcoChart, IcoMegaphone, IcoHandshake, IcoFolder, IcoBell, IcoSearch,
  IcoSpark, IcoLogout, IcoInbox, IcoLayers, IcoBuilding,
  IcoGlobe, IcoCube, IcoMessage, IcoSliders, IcoList, IcoTicket, IcoPeople,
  IcoActivity, IcoDollar,
} from './icons';

/* ── Navigation, categorised by portal (RBAC drives which set renders) ──
   The two portals are deliberately separate menus rather than one menu with
   hidden items — a DLD route simply does not exist for a partner account. */
const NAV = {
  dld: [
    {
      section: 'Command Center',
      items: [
        { to: '/dld', label: 'Executive Dashboard', icon: <IcoChart size={17} /> },
        { to: '/dld/partners', label: 'Partner Directory', icon: <IcoPeople size={17} /> },
        { to: '/dld/campaigns', label: 'Initiatives & Campaigns', icon: <IcoMegaphone size={17} /> },
        { to: '/dld/sponsorships', label: 'Sponsorships & Agreements', icon: <IcoHandshake size={17} /> },
      ],
    },
    {
      section: 'Analytics',
      items: [
        { to: '/dld/engagement', label: 'Engagement Analytics', icon: <IcoActivity size={17} /> },
        { to: '/dld/commercial', label: 'Commercial Performance', icon: <IcoDollar size={17} /> },
      ],
    },
    {
      section: 'Digital Twin',
      items: [
        { to: '/dld/twin', label: 'Portfolio Map', icon: <IcoGlobe size={17} /> },
      ],
    },
    {
      section: 'Intelligence',
      items: [
        { to: '/dld/copilot', label: 'AI Copilot', icon: <IcoMessage size={17} /> },
        { to: '/dld/simulator', label: 'What-If Simulator', icon: <IcoSliders size={17} /> },
        { to: '/dld/kpis', label: 'KPI Traceability', icon: <IcoList size={17} /> },
      ],
    },
    {
      section: 'Operations',
      items: [
        { to: '/dld/requests', label: 'Approval Queue', icon: <IcoInbox size={17} /> },
        { to: '/dld/events', label: 'Events & Exhibitions', icon: <IcoTicket size={17} /> },
        { to: '/dld/assets', label: 'Content & Assets', icon: <IcoFolder size={17} /> },
      ],
    },
  ],
  developer: [
    {
      section: 'Partner Hub',
      items: [
        { to: '/partner', label: 'My Activity', icon: <IcoChart size={17} /> },
        { to: '/partner/marketplace', label: 'Opportunity Marketplace', icon: <IcoLayers size={17} /> },
        { to: '/partner/agreements', label: 'My Agreements', icon: <IcoHandshake size={17} /> },
        { to: '/partner/events', label: 'Events & Exhibitions', icon: <IcoTicket size={17} /> },
        { to: '/partner/twin', label: 'My Portfolio Map', icon: <IcoGlobe size={17} /> },
        { to: '/partner/assets', label: 'Digital Assets Library', icon: <IcoFolder size={17} /> },
      ],
    },
  ],
};

/** Route allow-lists. A campaign manager cannot reach the ledger; an executive
 *  is read-only across the board but sees every DLD screen. */
export const ROLE_ROUTES = {
  // Executive: full strategic picture, no operational queues.
  dld_executive: ['/dld', '/dld/partners', '/dld/campaigns', '/dld/sponsorships',
                  '/dld/assets', '/dld/twin', '/dld/copilot', '/dld/simulator',
                  '/dld/kpis', '/dld/events'],
  // Campaign manager: runs the pipeline, but not the commercial ledger.
  dld_manager:   ['/dld', '/dld/partners', '/dld/campaigns', '/dld/requests',
                  '/dld/assets', '/dld/twin', '/dld/copilot', '/dld/simulator',
                  '/dld/events'],
  // dld_admin has no entry → unrestricted across the DLD portal
  developer:     ['/partner', '/partner/marketplace', '/partner/agreements',
                  '/partner/events', '/partner/twin', '/partner/assets'],
};
export const homeFor = (user) => {
  if (!user) return '/login';
  if (user.portal === 'developer') return '/partner';
  return ROLE_ROUTES[user.role]?.[0] || '/dld';
};

const TITLES = {
  '/dld': ['Executive Smart Dashboard', 'Adoption, efficiency and strategic impact across the partner ecosystem'],
  '/dld/campaigns': ['Joint Initiatives & Campaigns', 'Create, launch and monitor joint real estate programmes'],
  '/dld/sponsorships': ['Sponsorships & Agreements Ledger', 'Governance over financial and strategic commitments'],
  '/dld/requests': ['Participation Approval Queue', 'Review partner submissions and required documentation'],
  '/dld/assets': ['Content & Digital Assets Library', 'Approved marketing materials and media assets'],
  '/dld/twin': ['Digital Twin — Portfolio Map', 'Live geospatial view of partner projects across the emirate'],
  '/dld/twin-3d': ['3D City Twin', 'Extruded model of the partner development pipeline'],
  '/dld/partners': ['Partner Directory', 'The developer register — engagement, commercial standing and portfolio'],
  '/dld/engagement': ['Engagement Analytics', 'Adoption, efficiency, satisfaction and request throughput'],
  '/dld/commercial': ['Commercial Performance', 'Contracted value, delivery, collection and event return'],
  '/dld/events': ['Events & Exhibitions', 'Participation management and post-event impact reporting'],
  '/partner/agreements': ['My Agreements', 'Your sponsorship agreements, commitments and delivery standing'],
  '/dld/copilot': ['AI Partnership Copilot', 'Ask questions of the platform data in plain language'],
  '/dld/simulator': ['What-If Campaign Simulator', 'Project programme outcomes before committing budget'],
  '/dld/kpis': ['KPI Traceability Matrix', 'Every KPI in the brief, mapped to the screen that reports it'],
  '/partner/events': ['Events & Exhibitions', 'Register for exhibitions and track your participation'],
  '/partner/twin': ['My Portfolio Map', 'Your developments and their engagement status'],
  '/partner': ['Partner Activity', 'Your relationship with the Dubai Land Department at a glance'],
  '/partner/marketplace': ['Opportunity Marketplace', 'Upcoming partnership opportunities, campaigns and exhibitions'],
  '/partner/assets': ['Digital Assets Library', 'Approved marketing and media materials available to you'],
};

/* Icon and label per result kind, so the dropdown is scannable by shape. */
const KIND_META = {
  developer: { icon: <IcoBuilding size={14} />, label: 'Partner',   tone: 'accent' },
  campaign:  { icon: <IcoMegaphone size={14} />, label: 'Programme', tone: 'teal' },
  event:     { icon: <IcoTicket size={14} />,   label: 'Event',     tone: 'sand' },
  agreement: { icon: <IcoHandshake size={14} />, label: 'Agreement', tone: 'sand' },
  project:   { icon: <IcoGlobe size={14} />,    label: 'Project',   tone: 'accent' },
  asset:     { icon: <IcoFolder size={14} />,   label: 'Asset',     tone: 'teal' },
};

/**
 * Global search.
 *
 * Does two jobs from one box: the term flows into the page (every screen
 * filters on it), and from two characters a dropdown offers direct navigation
 * into any matching record across the entities the role is allowed to see.
 */
function GlobalSearch({ value, onChange }) {
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const navigate = useNavigate();
  const q = value ?? '';

  // Debounced — a keystroke should not be a request. `searching` is tracked
  // separately from an empty result set, so a request in flight never renders
  // as "no records match" and then flips to results a moment later.
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetchApi(`/search?q=${encodeURIComponent(q.trim())}`)
        .then((d) => { setResults(d); setActive(0); })
        .catch(() => setResults(null))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // Click-away closes the dropdown without clearing the page filter.
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const rows = results?.results || [];
  const go = (r) => { setOpen(false); navigate(r.to); };

  const onKeyDown = (e) => {
    if (!open || !rows.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % rows.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + rows.length) % rows.length); }
    else if (e.key === 'Enter') { e.preventDefault(); go(rows[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0, maxWidth: 420, marginInline: 'auto' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <span style={{
          position: 'absolute', insetInlineStart: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--app-text-faint)', pointerEvents: 'none', display: 'flex',
        }}><IcoSearch size={14} /></span>
        <input
          className="field-input"
          value={q}
          onChange={(e) => { onChange?.(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search partners, programmes, projects, agreements…"
          style={{ height: 34, paddingInlineStart: 32, fontSize: 12.5 }}
        />

        {open && q.trim().length >= 2 && (
          <div className="search-pop">
            {searching && !rows.length ? (
              <div className="empty-state" style={{ padding: '22px 12px', fontSize: 12, flexDirection: 'row', gap: 9 }}>
                <span className="app-loading-orbit" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Searching…
              </div>
            ) : rows.length === 0 ? (
              <div className="empty-state" style={{ padding: '22px 12px', fontSize: 12 }}>
                No records match “{q}”
              </div>
            ) : (
              <>
                <div style={{ padding: '4px 10px 7px', fontSize: 10, color: 'var(--app-text-faint)', fontWeight: 600 }}>
                  {results.total} result{results.total === 1 ? '' : 's'} · ↑↓ to move, ↵ to open
                </div>
                {rows.map((r, i) => {
                  const meta = KIND_META[r.kind] || KIND_META.campaign;
                  return (
                    <button key={`${r.kind}-${r.id}`} className={`search-row${i === active ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `var(--app-${meta.tone}-bg)`, color: `var(--app-${meta.tone})`,
                      }}>{meta.icon}</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 650, color: 'var(--app-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title}
                        </span>
                        <span style={{ display: 'block', fontSize: 10.5, color: 'var(--app-text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.sub}
                        </span>
                      </span>
                      <span className="status-chip status-chip-muted" style={{ flexShrink: 0 }}>{meta.label}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Layout({ user, onLogout, children, search, onSearch }) {
  const [collapsed, setCollapsed] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [advisoryOpen, setAdvisoryOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [clock, setClock] = useState(new Date());
  const location = useLocation();

  const portal = user?.portal === 'developer' ? 'developer' : 'dld';

  const { t } = useI18n();
  const [pulse, setPulse] = useState(false);
  const prevUnread = useRef(0);

  const loadNotifs = () => fetchApi('/notifications').then((d) => setNotifs(d.notifications)).catch(() => {});

  useEffect(() => { loadNotifs(); }, [location.pathname]);

  /* The Communication Center is a live desk: the server keeps emitting workflow
     events, so the shell polls and flashes the bell when the count actually
     rises. Polling rather than a socket keeps the POC dependency-free. */
  useEffect(() => {
    const poll = setInterval(loadNotifs, 9000);
    const clockT = setInterval(() => setClock(new Date()), 30000);
    return () => { clearInterval(poll); clearInterval(clockT); };
  }, []);

  const unread = notifs.filter((n) => n.read === 'no').length;

  useEffect(() => {
    if (unread > prevUnread.current) {
      setPulse(true);
      const t1 = setTimeout(() => setPulse(false), 1800);
      prevUnread.current = unread;
      return () => clearTimeout(t1);
    }
    prevUnread.current = unread;
  }, [unread]);
  const allowed = ROLE_ROUTES[user?.role];
  const nav = NAV[portal]
    .map((s) => ({ ...s, items: s.items.filter((i) => !allowed || allowed.includes(i.to)) }))
    .filter((s) => s.items.length);

  const activeModule = moduleForPath(location.pathname);
  const [rawTitle, rawSubtitle] = TITLES[location.pathname] || ['Developer Connectivity Platform', ''];
  // The page header is the most prominent text on any screen, so it has to
  // translate along with everything else.
  const title = t(rawTitle);
  const subtitle = t(rawSubtitle);
  const initials = (user?.company || user?.name || 'DLD')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = {
    dld_executive: 'Executive', dld_manager: 'Campaign Manager',
    dld_admin: 'Administrator', developer: 'Partner',
  }[user?.role] || user?.role;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* ── Side navigation ── */}
      <aside style={{
        width: collapsed ? 68 : 248, flexShrink: 0, background: 'var(--app-chrome-bg)',
        display: 'flex', flexDirection: 'column', padding: collapsed ? '16px 8px' : '16px 12px',
        borderInlineEnd: '1px solid var(--app-panel-border)', overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 0.18s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: collapsed ? '2px 0 14px' : '4px 4px 16px',
          borderBottom: '1px solid var(--app-border)',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <DldMark size={38} />
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-text)', lineHeight: 1.25 }}>
                {t('Developer Connectivity')}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
                {t('Dubai Land Department')}
              </div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, marginTop: 2 }}>
          {nav.map((sec) => (
            <div key={sec.section}>
              {!collapsed ? <div className="nav-section-label">{t(sec.section)}</div> : <div style={{ height: 12 }} />}
              {sec.items.map((it) => (
                <NavLink key={it.to} to={it.to} end
                  title={collapsed ? t(it.label) : undefined}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  style={collapsed ? { justifyContent: 'center', padding: '10px 0' } : undefined}>
                  {it.icon}
                  {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(it.label)}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div style={{
            padding: '12px 10px 4px', borderTop: '1px solid var(--app-border)',
            fontSize: 10, color: 'var(--app-text-faint)', lineHeight: 1.6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="animate-blink" style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--app-success)', display: 'inline-block' }} />
              {portal === 'dld' ? t('Command Center') : t('Partner Hub')}
            </div>
            <div className="ltr-num">Platform POC · v1.0</div>
          </div>
        )}

        {/* Delivery-partner credit, present on every signed-in screen */}
        <PoweredByAstrikos collapsed={collapsed} />
      </aside>

      {/* ── Main column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          height: 'var(--app-header-h)', flexShrink: 0, background: 'var(--app-chrome-bg)',
          borderBottom: '1px solid var(--app-panel-border)',
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px',
        }}>
          <button className="icon-btn" onClick={() => setCollapsed((c) => !c)} title="Toggle sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" style={{ width: 17, height: 17 }}>
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div style={{ minWidth: 0, flexShrink: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--app-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </div>
          </div>

          {/* Global search — filters the current screen and, from two
              characters, offers direct jumps into any matching record. */}
          <GlobalSearch value={search} onChange={onSearch} />


          <button className="app-advisory-btn" onClick={() => setAdvisoryOpen(true)} title="AI Advisory">
            <IcoSpark size={14} /><span>AI ADVISORY</span>
          </button>

          <button className={`icon-btn${alertsOpen ? ' active' : ''}${pulse ? ' is-pulsing' : ''}`}
            onClick={() => setAlertsOpen((o) => !o)} title={t('Notifications')}>
            <IcoBell size={17} />
            {unread > 0 && (
              <span className={pulse ? 'animate-pop' : ''} style={{
                position: 'absolute', top: -5, insetInlineEnd: -5, minWidth: 16, height: 16, borderRadius: 99,
                background: 'var(--app-danger)', color: '#fff', fontSize: 9.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>{unread}</span>
            )}
          </button>

          <LangToggle />
          <ThemeToggle />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ textAlign: 'end', display: 'none' }} />
            <span className={`status-chip status-chip-${portal === 'dld' ? 'accent' : 'teal'}`}>{roleLabel}</span>
            <div title={user?.company || user?.name} style={{
              width: 34, height: 34, borderRadius: 99, flexShrink: 0,
              background: portal === 'dld'
                ? 'linear-gradient(135deg, var(--app-accent-strong), var(--app-accent))'
                : 'linear-gradient(135deg, var(--app-teal), var(--app-sand))',
              color: '#fff', fontWeight: 700, fontSize: 11.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{initials}</div>
            <button className="icon-btn" onClick={onLogout} title="Sign out"><IcoLogout size={16} /></button>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 90px', minHeight: 0, background: 'var(--app-bg)' }}>
          {/* Rotating, module-scoped AI advisory above every screen */}
          <AdvisoryStrip module={activeModule} />
          <div className="animate-fade-in" key={location.pathname}>{children}</div>
        </main>
      </div>

      {/* Always-available assistant; its suggestions follow the module in view */}
      <AskSia module={activeModule} />

      <NotificationPanel
        open={alertsOpen} onClose={() => setAlertsOpen(false)} items={notifs}
        onRead={() => markAllRead().then(loadNotifs)}
        onRefresh={loadNotifs}
      />
      <AdvisoryPanel open={advisoryOpen} onClose={() => setAdvisoryOpen(false)} portal={portal} />
    </div>
  );
}
