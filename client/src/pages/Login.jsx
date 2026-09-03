import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../theme';
import { LangToggle, useI18n } from '../i18n';
import { homeFor } from '../components/Layout';
import { CoBrandLockup, AstrikosMark, COMPANY } from '../components/Brand';
import { IcoLock, IcoBuilding, IcoChart } from '../components/icons';

/* Dubai skyline photography. Unsplash's source CDN serves these directly, and
   a gradient scrim over the top keeps the brand palette dominant so the photo
   reads as context rather than decoration. A CSS gradient stands in if the
   image cannot be reached — on a closed network the panel still looks
   deliberate rather than broken. */
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80';

const DLD_ROLES = [
  { role: 'dld_executive', label: 'Executive — Marketing & Communications', hint: 'Read-only across every DLD screen' },
  { role: 'dld_manager',   label: 'Campaign Manager — Partnerships Office',  hint: 'Campaigns and the approval queue' },
  { role: 'dld_admin',     label: 'Platform Administrator',                  hint: 'Unrestricted across the DLD portal' },
];

export default function Login({ onLogin }) {
  const [portal, setPortal] = useState('dld');       // 'dld' | 'developer'
  const [mode, setMode] = useState('sso');           // 'sso' | 'password'
  const [role, setRole] = useState('');
  const [developer, setDeveloper] = useState('');
  const [developers, setDevelopers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/auth/developers')
      .then((r) => r.json())
      .then((d) => setDevelopers(d.developers || []))
      .catch(() => {});
  }, []);

  async function submit(payload) {
    setErr(null); setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Login failed');
      const user = await res.json();
      onLogin(user);
      navigate(homeFor(user));
    } catch (e) { setErr(String(e.message || e)); setBusy(false); }
  }

  function switchPortal(p) {
    setPortal(p); setErr(null); setRole(''); setDeveloper(''); setUsername(''); setPassword('');
  }

  // Picking an identity auto-fills the demo credential pair.
  function pickDldRole(r) {
    setRole(r); setErr(null); setUsername(r); setPassword(r);
  }
  function pickDeveloper(id) {
    setDeveloper(id); setErr(null); setUsername(id); setPassword(id);
  }

  function handleSso() {
    if (portal === 'dld') {
      if (!role) return setErr('Choose a role first');
      return submit({ username: role, password: 'sso', role });
    }
    if (!developer) return setErr('Choose your organisation first');
    return submit({ username: developer, password: 'sso', role: 'developer' });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const id = portal === 'dld' ? role : developer;
    if (!id) return setErr(portal === 'dld' ? 'Choose a role' : 'Choose your organisation');
    if (!username.trim() || !password.trim()) return setErr('Enter a username and password');
    submit({ username: username.trim(), password, role: portal === 'dld' ? role : 'developer' });
  }

  const identityChosen = portal === 'dld' ? role : developer;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--app-bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 18, insetInlineEnd: 20, zIndex: 5, display: 'flex', gap: 8 }}>
        <LangToggle /><ThemeToggle />
      </div>

      {/* ── Left — brand panel over Dubai skyline photography ── */}
      <div style={{
        flex: '0 0 55%', maxWidth: '55%', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '46px 54px',
        background: 'linear-gradient(150deg, #063e6e 0%, #0b5fa5 46%, #2e7d80 100%)',
      }}>
        <div className="login-hero" style={{ backgroundImage: `url("${HERO_IMAGE}")` }} />
        <div className="login-hero-scrim" />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 84% 10%, rgba(255,255,255,0.16), transparent 46%)',
        }} />

        {/* Co-branded lockup — client and delivery partner, divided by a pipe */}
        <div style={{ position: 'relative' }}>
          <CoBrandLockup light />
        </div>

        <div style={{ position: 'relative', maxWidth: 540 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.68)', marginBottom: 16 }}>
            Marketing &amp; Communications
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1.12, letterSpacing: '-0.025em' }}>
            Real Estate Developer<br />Connectivity Platform
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.80)', marginTop: 18, lineHeight: 1.65, maxWidth: 460 }}>
            A unified digital platform for managing strategic partnerships, initiatives,
            and collaborative campaigns with real estate developers.
          </p>
        </div>

        <div style={{ position: 'relative', display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          {[
            ['Unified', 'partner ecosystem'],
            ['Transparent', 'approval workflows'],
            ['Geospatial', 'digital twin'],
            ['Data-driven', 'decision-making'],
          ].map(([a, b]) => (
            <div key={a} style={{
              paddingInlineStart: 11,
              borderInlineStart: '2px solid rgba(255,255,255,0.34)',
            }}>
              <div style={{ fontSize: 14.5, fontWeight: 750, color: '#fff' }}>{a}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.70)' }}>{b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right — sign in ── */}
      <div style={{
        flex: '0 0 45%', maxWidth: '45%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 52px', background: 'var(--app-panel)', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{ fontSize: 23, fontWeight: 800, color: 'var(--app-text)', letterSpacing: '-0.02em' }}>Sign in</h2>
          <p style={{ fontSize: 12.5, color: 'var(--app-text-faint)', marginTop: 6, marginBottom: 20 }}>
            Access is role-based — choose the portal you belong to.
          </p>

          {/* Portal switch — this is the RBAC fork */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { id: 'dld', label: 'DLD Internal', sub: 'Command Center', icon: <IcoChart size={17} /> },
              { id: 'developer', label: 'Developer', sub: 'Partner Hub', icon: <IcoBuilding size={17} /> },
            ].map((p) => (
              <button key={p.id} type="button" onClick={() => switchPortal(p.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                  padding: '12px 13px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', transition: 'all 0.15s ease',
                  background: portal === p.id ? 'var(--app-accent-bg)' : 'var(--app-surface-soft)',
                  border: `1px solid ${portal === p.id ? 'var(--app-accent)' : 'var(--app-border)'}`,
                  color: portal === p.id ? 'var(--app-accent)' : 'var(--app-text-muted)',
                }}>
                {p.icon}
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.label}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>{p.sub}</div>
                </div>
              </button>
            ))}
          </div>

          {/* SSO vs password */}
          <div style={{
            display: 'flex', gap: 4, padding: 4, borderRadius: 11, marginBottom: 18,
            background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)',
          }}>
            {[['sso', 'UAE PASS'], ['password', 'Username & Password']].map(([m, label]) => (
              <button key={m} type="button" onClick={() => { setMode(m); setErr(null); }}
                style={{
                  flex: 1, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                  background: mode === m ? 'var(--app-accent)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--app-text-faint)',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}>{label}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {portal === 'dld' ? (
              <div>
                <label className="field-label">Role</label>
                <select className="field-input" value={role} onChange={(e) => pickDldRole(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="" disabled>Select your role…</option>
                  {DLD_ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
                </select>
                {role && (
                  <p style={{ fontSize: 11, color: 'var(--app-text-faint)', marginTop: 6 }}>
                    {DLD_ROLES.find((r) => r.role === role)?.hint}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="field-label">Organisation</label>
                <select className="field-input" value={developer} onChange={(e) => pickDeveloper(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="" disabled>Select your organisation…</option>
                  {developers.map((d) => <option key={d.developer_id} value={d.developer_id}>{d.name} — {d.tier}</option>)}
                </select>
              </div>
            )}

            {mode === 'password' && (
              <>
                <div>
                  <label className="field-label">Username</label>
                  <input className="field-input" value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username" autoComplete="off" />
                </div>
                <div>
                  <label className="field-label">Password</label>
                  <input className="field-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password" autoComplete="new-password" />
                </div>
              </>
            )}

            {err && <div style={{ fontSize: 12, color: 'var(--app-danger)', fontWeight: 600 }}>{err}</div>}

            {mode === 'sso' ? (
              <button type="button" onClick={handleSso} disabled={busy || !identityChosen}
                className="btn btn-primary" style={{ height: 44, fontSize: 13.5, marginTop: 2 }}>
                <IcoLock size={15} />{busy ? 'Signing in…' : 'Continue with UAE PASS'}
              </button>
            ) : (
              <button type="submit" disabled={busy} className="btn btn-primary" style={{ height: 44, fontSize: 13.5, marginTop: 2 }}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            )}
          </form>

          <p className="ltr-num" style={{ fontSize: 10.5, color: 'var(--app-text-faint)', textAlign: 'center', marginTop: 20, lineHeight: 1.7 }}>
            Demo environment — selecting an identity fills its credentials.<br />
            Password matches the username.
          </p>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--app-border)',
          }}>
            <AstrikosMark size={20} />
            <span style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>
              Delivered on the <strong style={{ color: 'var(--app-text-muted)' }}>{COMPANY} S!aP</strong> platform
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
