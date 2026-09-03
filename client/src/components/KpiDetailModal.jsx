import React, { useEffect, useState } from 'react';
import { fetchApi, fmt } from '../services/api';
import { TrendChart, BarsChart } from './charts';
import { useI18n } from '../i18n';
import { IcoClose, IcoSpark, IcoTarget, IcoInfo } from './icons';

/**
 * KPI explainer — the dialog behind every stat tile.
 *
 * A number on a dashboard is only useful if the reader can find out what it
 * counts and why anyone should care. This opens centred over the page, closes
 * on click-away or Escape, and carries four things: the definition, the maths,
 * a chart, and an AI advisory.
 *
 * The advisory is shown as generating for a beat before it appears. That delay
 * is real work being waited on — the fetch — but it is also deliberate: it
 * marks the advisory as *produced* rather than stored, which is the distinction
 * the purple treatment exists to signal.
 */
export default function KpiDetailModal({ kpiId, onClose }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [advisoryReady, setAdvisoryReady] = useState(false);

  useEffect(() => {
    if (!kpiId) return;
    setData(null); setError(null); setAdvisoryReady(false);
    let live = true;
    fetchApi(`/kpi/${kpiId}`)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e));
    // The advisory settles a beat after the figures, so the reader takes in the
    // number first rather than the commentary.
    const t1 = setTimeout(() => live && setAdvisoryReady(true), 2400);
    return () => { live = false; clearTimeout(t1); };
  }, [kpiId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!kpiId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: 'min(760px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--app-text-faint)' }}>
              {t('Key performance indicator')}
            </div>
            <div style={{ fontSize: 16, fontWeight: 780, color: 'var(--app-text)', marginTop: 3 }}>
              {data ? data.title : '…'}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title={t('Close')}><IcoClose size={16} /></button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ color: 'var(--app-danger)', fontSize: 12.5 }}>
              {String(error.message || error)}
            </div>
          )}

          {!data && !error && (
            <div className="app-loading" style={{ padding: '40px 0' }}>
              <div className="app-loading-orbit" />
              <div className="app-loading-text">{t('Loading…')}</div>
            </div>
          )}

          {data && (
            <>
              {/* ── Headline figure ── */}
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap',
                padding: '14px 16px', borderRadius: 12, marginBottom: 16,
                background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)',
              }}>
                <div>
                  <div style={{ fontSize: 38, fontWeight: 790, color: 'var(--app-text)', letterSpacing: '-0.03em', lineHeight: 1 }} className="ltr-num">
                    {typeof data.value === 'number' ? fmt.int(data.value) : data.value}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--app-text-faint)', marginTop: 5 }}>{data.unit}</div>
                </div>
                {data.target && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={{ color: 'var(--app-teal)', display: 'flex' }}><IcoTarget size={14} /></span>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-text-faint)' }}>{t('Target')}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-text)' }} className="ltr-num">{data.target}</div>
                    </div>
                  </div>
                )}
                {data.breakdown?.length > 0 && (
                  <div style={{ display: 'flex', gap: 16, marginInlineStart: 'auto', flexWrap: 'wrap' }}>
                    {data.breakdown.map((b) => (
                      <div key={b.label}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-text-faint)' }}>{b.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--app-text)', marginTop: 2 }} className="ltr-num">{b.value}</div>
                        {b.sub && <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)' }}>{b.sub}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Definition ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <Section icon={<IcoInfo size={13} />} title={t('What this measures')} body={data.measures} />
                <Section icon={<IcoTarget size={13} />} title={t('Why it matters')} body={data.matters} />
              </div>

              {data.formula && (
                <div style={{
                  padding: '9px 12px', borderRadius: 9, marginBottom: 16,
                  background: 'var(--app-surface-raised)', border: '1px solid var(--app-border)',
                }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-text-faint)', marginBottom: 3 }}>
                    {t('How it is calculated')}
                  </div>
                  <code className="ltr-num" style={{ fontSize: 11.5, color: 'var(--app-text-muted)', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
                    {data.formula}
                  </code>
                </div>
              )}

              {/* ── Chart ── */}
              {data.chart && (
                <div className="card" style={{ padding: '13px 14px 6px', marginBottom: 16 }}>
                  <div className="panel-title" style={{ marginBottom: 9 }}>{t('Trend & breakdown')}</div>
                  <KpiChart chart={data.chart} />
                </div>
              )}

              {/* ── AI advisory ── */}
              <div style={{
                border: '1px solid var(--app-advisory-border)', background: 'var(--app-advisory-bg)',
                borderRadius: 12, padding: 14, minHeight: 108,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--app-advisory)', color: '#fff', flexShrink: 0,
                  }}><IcoSpark size={14} /></div>
                  <div className="panel-title" style={{ color: 'var(--app-advisory)' }}>
                    {t('AI Advisory — generated from live data')}
                  </div>
                </div>

                {advisoryReady ? (
                  <div className="animate-fade-in" style={{ fontSize: 12.5, color: 'var(--app-text-muted)', lineHeight: 1.65 }}>
                    {data.advisory}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="advisory-spinner" />
                    <span style={{ fontSize: 12.5, color: 'var(--app-advisory)', fontWeight: 600 }}>
                      {t('Analysing platform records…')}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, body }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ color: 'var(--app-accent)', display: 'flex' }}>{icon}</span>
        <span className="panel-title">{title}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

/** Renders whichever chart shape the KPI resolver returned. */
function KpiChart({ chart }) {
  const common = { data: chart.data, xKey: chart.xKey, height: 200, unit: chart.unit };
  if (chart.type === 'line' || chart.type === 'area') {
    return <TrendChart {...common} series={chart.series} area={chart.type === 'area'} fmt={(v) => fmt.compact(v)} />;
  }
  return (
    <BarsChart
      {...common}
      series={chart.series}
      layout={chart.horizontal ? 'horizontal' : 'vertical'}
      colorByIndex={chart.colorByIndex}
      catWidth={chart.horizontal ? 150 : 104}
      tickFmt={(v) => fmt.compact(v)}
      fmt={(v) => fmt.compact(v)}
    />
  );
}
