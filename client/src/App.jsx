import React, { useState, createContext, useContext, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout, { ROLE_ROUTES, homeFor } from './components/Layout';
import { AUTH_KEY, getUser } from './services/api';
import { Loading } from './components/States';
import KpiDetailModal from './components/KpiDetailModal';

import Login from './pages/Login';
import DldDashboard from './pages/DldDashboard';
import DldCampaigns from './pages/DldCampaigns';
import DldSponsorships from './pages/DldSponsorships';
import DldRequests from './pages/DldRequests';
import AssetsLibrary from './pages/AssetsLibrary';
import PartnerHome from './pages/PartnerHome';
import PartnerMarketplace from './pages/PartnerMarketplace';
/* The Digital Twin pulls in MapLibre — roughly half the bundle — and most
   sessions never open it. Splitting it out keeps first paint on the dashboard
   fast, and the map arrives while the user is reading the summary strip. */
const DigitalTwin = lazy(() => import('./pages/DigitalTwin'));

import AiCopilot from './pages/AiCopilot';
import Simulator from './pages/Simulator';
import KpiTraceability from './pages/KpiTraceability';
import DldEvents from './pages/DldEvents';
import PartnerEvents from './pages/PartnerEvents';
import PartnerDirectory from './pages/PartnerDirectory';
import PartnerAgreements from './pages/PartnerAgreements';
import EngagementAnalytics from './pages/EngagementAnalytics';
import CommercialPerformance from './pages/CommercialPerformance';

/** Global search term, owned by the shell and consumed by whichever page is
 *  mounted — one search box that filters the screen you are looking at. */
const SearchCtx = createContext({ q: '', setQ: () => {} });
export const useSearch = () => useContext(SearchCtx);

/** Any page can open a KPI explainer; the dialog itself lives in the shell so
 *  it renders above every screen and survives navigation within a module. */
const KpiCtx = createContext({ openKpi: () => {} });
export const useKpi = () => useContext(KpiCtx);

export { moduleForPath } from './services/modules';

export default function App() {
  const [user, setUser] = useState(getUser);
  const [q, setQ] = useState('');
  const [kpiId, setKpiId] = useState(null);
  const navigate = useNavigate();

  const handleLogin = (u) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(u));
    setUser(u);
  };
  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
    setQ('');
    navigate('/login');
  };

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // RBAC gate: a route outside the role's allow-list redirects to its home.
  const allowed = ROLE_ROUTES[user.role];
  const guard = (path, el) => (!allowed || allowed.includes(path) ? el : <Navigate to={homeFor(user)} replace />);

  return (
    <SearchCtx.Provider value={{ q, setQ }}>
      <KpiCtx.Provider value={{ openKpi: setKpiId }}>
      <Layout user={user} onLogout={handleLogout} search={q} onSearch={setQ}>
        <Suspense fallback={<Loading label="Loading module…" />}>
        <Routes>
          <Route path="/login" element={<Navigate to={homeFor(user)} replace />} />

          {/* DLD Command Center */}
          <Route path="/dld" element={guard('/dld', <DldDashboard />)} />
          <Route path="/dld/campaigns" element={guard('/dld/campaigns', <DldCampaigns />)} />
          <Route path="/dld/sponsorships" element={guard('/dld/sponsorships', <DldSponsorships />)} />
          <Route path="/dld/requests" element={guard('/dld/requests', <DldRequests />)} />
          <Route path="/dld/assets" element={guard('/dld/assets', <AssetsLibrary portal="dld" />)} />
          <Route path="/dld/twin" element={guard('/dld/twin', <DigitalTwin />)} />
          {/* The 3D twin is now a camera mode on the one map, not a second screen. */}
          <Route path="/dld/twin-3d" element={<Navigate to="/dld/twin" replace />} />
          <Route path="/dld/partners" element={guard('/dld/partners', <PartnerDirectory />)} />
          <Route path="/dld/engagement" element={guard('/dld/engagement', <EngagementAnalytics />)} />
          <Route path="/dld/commercial" element={guard('/dld/commercial', <CommercialPerformance />)} />
          <Route path="/dld/events" element={guard('/dld/events', <DldEvents />)} />
          <Route path="/dld/copilot" element={guard('/dld/copilot', <AiCopilot />)} />
          <Route path="/dld/simulator" element={guard('/dld/simulator', <Simulator />)} />
          <Route path="/dld/kpis" element={guard('/dld/kpis', <KpiTraceability />)} />

          {/* Developer Partner Hub */}
          <Route path="/partner" element={guard('/partner', <PartnerHome user={user} />)} />
          <Route path="/partner/marketplace" element={guard('/partner/marketplace', <PartnerMarketplace user={user} />)} />
          <Route path="/partner/agreements" element={guard('/partner/agreements', <PartnerAgreements user={user} />)} />
          <Route path="/partner/events" element={guard('/partner/events', <PartnerEvents user={user} />)} />
          <Route path="/partner/twin" element={guard('/partner/twin', <DigitalTwin mode="2d" />)} />
          <Route path="/partner/assets" element={guard('/partner/assets', <AssetsLibrary portal="developer" />)} />

          <Route path="*" element={<Navigate to={homeFor(user)} replace />} />
        </Routes>
        </Suspense>
      </Layout>

      {/* Shell-level so it renders above every screen */}
      <KpiDetailModal kpiId={kpiId} onClose={() => setKpiId(null)} />
      </KpiCtx.Provider>
    </SearchCtx.Provider>
  );
}
