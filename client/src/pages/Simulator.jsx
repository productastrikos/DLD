import React, { useState, useEffect, useCallback } from 'react';
import { postApi, fmt } from '../services/api';
import { BarsChart, ChartPanel } from '../components/charts';
import { Loading } from '../components/States';
import {
  IcoSpark, IcoSliders, IcoTarget, IcoDollar, IcoPeople, IcoTrendUp, IcoShield,
} from '../components/icons';

/**
 * What-If Campaign Simulator.
 *
 * Projects an unlaunched programme's outcome from base rates measured on
 * completed programmes of the same format. The derivation is deliberately on
 * screen — base rates, multiplier chain, comparable programmes and a confidence
 * figure — because a projection an executive cannot interrogate is one they
 * will not commit budget against.
 */

const TYPES = [
  { id: 'exhibition', label: 'Exhibition' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'initiative', label: 'Initiative' },
];
const TIERS = ['Master Developer', 'Luxury', 'Premium', 'Mid-Market'];

export default function Simulator() {
  const [form, setForm] = useState({
    type: 'exhibition',
    budget_aed: 2500000,
    target_partners: 12,
    duration_days: 21,
    tiers: ['Master Developer', 'Premium'],
  });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (f) => {
    setBusy(true); setError(null);
    try { setResult(await postApi('/ai/simulate', f)); }
    catch (e) { setError(e); }
    finally { setBusy(false); }
  }, []);

  // Re-projects as the inputs move, so the model feels live rather than
  // batch — debounced so dragging a slider does not spam the endpoint.
  useEffect(() => {
    const t = setTimeout(() => run(form), 220);
    return () => clearTimeout(t);
  }, [form, run]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleTier = (t) => setForm((f) => ({
    ...f,
    tiers: f.tiers.includes(t) ? f.tiers.filter((x) => x !== t) : [...f.tiers, t],
  }));

  const p = result?.projection;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '316px 1fr', gap: 14, alignItems: 'start' }}>
      {/* ── Inputs ── */}
      <div className="card card-pad" style={{ position: 'sticky', top: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
          <span style={{ color: 'var(--app-accent)', display: 'flex' }}><IcoSliders size={15} /></span>
          <div>
            <div className="panel-title">Programme brief</div>
            <div className="panel-sub">Adjust to re-project</div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Format</label>
          <div className="seg" style={{ width: '100%' }}>
            {TYPES.map((t) => (
              <button key={t.id} className={`seg-btn${form.type === t.id ? ' is-active' : ''}`}
                style={{ flex: 1 }} onClick={() => set('type', t.id)}>{t.label}</button>
            ))}
          </div>
        </div>

        <Slider label="Budget" value={form.budget_aed} min={250000} max={20000000} step={250000}
          display={fmt.aedFull(form.budget_aed)} onChange={(v) => set('budget_aed', v)} />
        <Slider label="Partners invited" value={form.target_partners} min={2} max={28} step={1}
          display={`${form.target_partners} partners`} onChange={(v) => set('target_partners', v)} />
        <Slider label="Duration" value={form.duration_days} min={1} max={180} step={1}
          display={`${form.duration_days} days`} onChange={(v) => set('duration_days', v)} />

        <div style={{ marginTop: 4 }}>
          <label className="field-label">Invite which tiers</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TIERS.map((t) => (
              <button key={t} onClick={() => toggleTier(t)}
                className={`status-chip ${form.tiers.includes(t) ? 'status-chip-accent' : 'status-chip-muted'}`}
                style={{ cursor: 'pointer', border: '1px solid', fontFamily: 'inherit' }}>
                {t}
              </button>
            ))}
          </div>
          {form.tiers.length === 0 && (
            <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 6 }}>
              No tier selected — the model falls back to the full ecosystem mix.
            </div>
          )}
        </div>

        {result && (
          <div style={{
            marginTop: 15, padding: 11, borderRadius: 10,
            background: 'var(--app-advisory-bg)', border: '1px solid var(--app-advisory-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <span style={{ color: 'var(--app-advisory)', display: 'flex' }}><IcoShield size={13} /></span>
              <span className="panel-title" style={{ color: 'var(--app-advisory)' }}>Confidence {result.confidence}%</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--app-text-muted)', lineHeight: 1.5 }}>
              Based on {result.basis.label}. Confidence rises with the number of comparable
              programmes and falls as their outcomes spread.
            </div>
          </div>
        )}
      </div>

      {/* ── Projection ── */}
      <div>
        {error && <div className="card card-pad" style={{ color: 'var(--app-danger)' }}>{String(error.message || error)}</div>}
        {!result && busy && <Loading label="Projecting…" />}

        {p && (
          <>
            <div className="grid-kpi" style={{ marginBottom: 14, opacity: busy ? 0.55 : 1, transition: 'opacity 0.15s ease' }}>
              <Proj icon={<IcoPeople size={16} />} label="Projected participants" value={p.participants}
                foot={`${result.basis.approval_rate_pct}% historical approval rate`} />
              <Proj icon={<IcoTarget size={16} />} label="Projected reach" value={fmt.compact(p.reach)} tone="teal"
                foot={`${fmt.aed(p.cost_per_1k_reach)} per 1K reached`} />
              <Proj icon={<IcoTrendUp size={16} />} label="Engagement rate" value={fmt.pct(p.engagement_rate)} tone="teal"
                foot={`Format baseline ${fmt.pct(result.basis.base_engagement_pct)}`} />
              <Proj icon={<IcoSpark size={16} />} label="Projected leads" value={fmt.int(p.leads)} tone="sand"
                foot={`${fmt.aedFull(p.cost_per_lead)} per lead`} />
              <Proj icon={<IcoDollar size={16} />} label="Value returned" value={fmt.aed(p.returned_value_aed)} tone="sand"
                foot={`incl. ${fmt.aed(p.media_value_aed)} earned media`} />
              <Proj icon={<IcoTrendUp size={16} />} label="Projected ROI" value={fmt.pct(p.roi_percent)}
                tone={p.roi_percent >= 0 ? 'accent' : 'sand'}
                foot={p.roi_percent >= 0 ? 'Above break-even' : 'Below break-even at this budget'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 14, marginBottom: 14 }}>
              <ChartPanel title="Budget sensitivity"
                note="What a budget change actually buys, holding every other input constant">
                <BarsChart
                  data={result.sensitivity} xKey="label" height={230}
                  series={[{ key: 'reach', label: 'Projected reach' }]}
                  tickFmt={(v) => fmt.compact(v)} fmt={(v) => fmt.compact(v)}
                />
              </ChartPanel>

              <div className="card" style={{ padding: '15px 16px' }}>
                <div className="panel-title">Model derivation</div>
                <div className="panel-sub" style={{ marginBottom: 11 }}>Every multiplier applied to the base rate</div>
                {result.factors.map((f) => (
                  <div key={f.label} style={{ marginBottom: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--app-text)' }}>{f.label}</span>
                      <span className="ltr-num" style={{
                        fontSize: 12, fontWeight: 750,
                        color: f.value >= 1 ? 'var(--app-success)' : 'var(--app-warning)',
                      }}>×{f.value}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', marginTop: 3, lineHeight: 1.45 }}>{f.note}</div>
                  </div>
                ))}
                <div style={{ paddingTop: 9, borderTop: '1px solid var(--app-border)' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)', lineHeight: 1.5 }}>
                    Base rate <strong style={{ color: 'var(--app-text-muted)' }}>{result.basis.reach_per_aed}</strong> reach
                    per dirham, <strong style={{ color: 'var(--app-text-muted)' }}>{result.basis.leads_per_partner}</strong> leads
                    per participating partner, drawn from {result.basis.programmes} programmes.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="card" style={{ padding: '15px 16px 6px' }}>
                <div className="panel-title">Sensitivity detail</div>
                <div className="panel-sub" style={{ marginBottom: 9 }}>Return at each budget step</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Change</th><th>Budget</th><th>Reach</th><th>Leads</th><th>ROI</th></tr></thead>
                    <tbody>
                      {result.sensitivity.map((s) => (
                        <tr key={s.label} style={s.label === '0%' ? { background: 'var(--app-accent-bg)' } : undefined}>
                          <td style={{ fontWeight: 700, color: 'var(--app-text)' }}>{s.label === '0%' ? 'Current' : s.label}</td>
                          <td className="ltr-num">{fmt.aed(s.budget_aed)}</td>
                          <td className="ltr-num">{fmt.compact(s.reach)}</td>
                          <td className="ltr-num">{fmt.int(s.leads)}</td>
                          <td className="ltr-num" style={{ fontWeight: 700, color: s.roi_percent >= 0 ? 'var(--app-success)' : 'var(--app-danger)' }}>
                            {fmt.pct(s.roi_percent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card" style={{ padding: '15px 16px 6px' }}>
                <div className="panel-title">Comparable programmes</div>
                <div className="panel-sub" style={{ marginBottom: 9 }}>Delivered programmes closest to this budget</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Programme</th><th>Budget</th><th>Reach</th><th>Eng.</th></tr></thead>
                    <tbody>
                      {result.comparables.map((c) => (
                        <tr key={c.campaign}>
                          <td style={{ color: 'var(--app-text)', fontWeight: 600, whiteSpace: 'normal', minWidth: 150 }}>{c.campaign}</td>
                          <td className="ltr-num">{fmt.aed(c.budget_aed)}</td>
                          <td className="ltr-num">{fmt.compact(c.reach)}</td>
                          <td className="ltr-num">{fmt.pct(c.engagement_rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, display, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <label className="field-label" style={{ marginBottom: 0 }}>{label}</label>
        <span className="ltr-num" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--app-text)' }}>{display}</span>
      </div>
      <input className="twin-slider" type="range" min={min} max={max} step={step}
        value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

function Proj({ icon, label, value, foot, tone = 'accent' }) {
  return (
    <div className={`kpi-card${tone !== 'accent' ? ` tone-${tone}` : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 29, height: 29, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `var(--app-${tone}-bg)`, color: `var(--app-${tone})`,
        }}>{icon}</div>
        <p style={{ color: 'var(--app-text-muted)', fontSize: 11.5, fontWeight: 600, lineHeight: 1.3 }}>{label}</p>
      </div>
      <div style={{ marginTop: 11, fontSize: 'clamp(1.4rem, 2vw, 1.85rem)', fontWeight: 750, color: 'var(--app-text)', letterSpacing: '-0.02em', lineHeight: 1 }} className="ltr-num">
        {value}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 9, fontSize: 10.5, color: 'var(--app-text-faint)', lineHeight: 1.4 }}>{foot}</div>
    </div>
  );
}
