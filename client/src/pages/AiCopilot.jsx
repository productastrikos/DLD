import React, { useState, useRef, useEffect } from 'react';
import { postApi, fetchApi, fmt } from '../services/api';
import { TrendChart, ChartPanel } from '../components/charts';
import Thinking, { withThinking } from '../components/Thinking';
import { IcoSpark, IcoSend, IcoRefresh, IcoDoc, IcoCheck } from '../components/icons';

/**
 * AI Partnership Copilot.
 *
 * Every answer is computed server-side from the live tables, so the copilot
 * returns evidence rather than prose alone: the metrics it used, the rows it
 * counted, and — for drafting requests — a real recipient list. The purple
 * frame is the platform's reserved AI colour, which is how an operator can
 * always tell generated output from recorded data.
 */

const INTRO = {
  role: 'ai',
  payload: {
    title: 'Partnership Copilot',
    answer: 'Ask about partner engagement, the approval queue, sponsorship performance, campaign formats or the project portfolio. '
      + 'Answers are computed from live platform records — every figure can be checked against the screen it came from.',
    suggestions: [],
  },
};

export default function AiCopilot() {
  const [messages, setMessages] = useState([INTRO]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const scroller = useRef(null);

  useEffect(() => {
    fetchApi('/ai/suggestions').then((d) => setSuggestions(d.suggestions)).catch(() => {});
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const ask = async (question) => {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      // Held to the length of the thinking animation so the derivation stages
      // are readable — see components/Thinking.jsx.
      const payload = await withThinking(postApi('/ai/copilot', { question: q }));
      setMessages((m) => [...m, { role: 'ai', payload }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', payload: { title: 'Unable to answer', answer: String(e.message || e) } }]);
    } finally {
      setBusy(false);
    }
  };

  const lastSuggestions = [...messages].reverse().find((m) => m.role === 'ai')?.payload?.suggestions;
  const chips = (lastSuggestions?.length ? lastSuggestions : suggestions).slice(0, 4);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 268px', gap: 14, height: 'calc(100vh - 116px)' }}>
      {/* ── Conversation ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '13px 16px', borderBottom: '1px solid var(--app-border)',
          display: 'flex', alignItems: 'center', gap: 10, background: 'var(--app-advisory-bg)',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--app-advisory)', color: '#fff',
          }}><IcoSpark size={16} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="panel-title" style={{ color: 'var(--app-advisory)' }}>AI Partnership Copilot</div>
            <div className="panel-sub">Answers computed from live platform records</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setMessages([INTRO])}>
            <IcoRefresh size={13} /> Reset
          </button>
        </div>

        <div ref={scroller} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            m.role === 'user'
              ? <div key={i} className="copilot-bubble copilot-bubble-user">{m.text}</div>
              : <AiMessage key={i} payload={m.payload} />
          ))}
          {busy && <Thinking />}
        </div>

        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', padding: '0 16px 10px' }}>
            {chips.map((s) => (
              <button key={s} className="copilot-chip" onClick={() => ask(s)} disabled={busy}>{s}</button>
            ))}
          </div>
        )}

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--app-border)', display: 'flex', gap: 9 }}>
          <input
            className="field-input" value={input} disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="Ask about partners, approvals, sponsorships, campaigns…"
          />
          <button className="btn btn-primary" onClick={() => ask()} disabled={busy || !input.trim()}>
            <IcoSend size={14} /> Ask
          </button>
        </div>
      </div>

      {/* ── What it can answer ── */}
      <div className="card card-pad" style={{ overflowY: 'auto' }}>
        <div className="panel-title" style={{ marginBottom: 4 }}>Try asking</div>
        <div className="panel-sub" style={{ marginBottom: 11 }}>Each routes to a different query over live data</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {suggestions.map((s) => (
            <button key={s} className="copilot-chip" style={{ borderRadius: 9 }} onClick={() => ask(s)} disabled={busy}>{s}</button>
          ))}
        </div>

        <div style={{
          marginTop: 16, padding: 12, borderRadius: 11,
          background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)',
        }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>How it works</div>
          <div style={{ fontSize: 11, color: 'var(--app-text-muted)', lineHeight: 1.55 }}>
            The copilot classifies the question, runs the matching aggregation over the
            CSV-backed tables, and returns the numbers with the rows behind them. It is
            deterministic and runs entirely on this server — no external model call, so it
            works on a closed network and returns the same answer twice.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── One AI answer, with whatever evidence came back attached ── */
function AiMessage({ payload }) {
  const [copied, setCopied] = useState(false);
  if (!payload) return null;
  const { title, answer, metrics, table, draft, series, intent } = payload;

  const copyDraft = () => {
    const text = `Subject: ${draft.subject}\n\n${draft.body}\n\nRecipients:\n`
      + draft.recipients.map((r) => `  ${r.developer} — ${r.contact} <${r.email}>`).join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2200);
    }).catch(() => {});
  };

  return (
    <div className="copilot-bubble copilot-bubble-ai">
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <span style={{ color: 'var(--app-advisory)', display: 'flex' }}><IcoSpark size={13} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 750, color: 'var(--app-text)' }}>{title}</span>
          {intent && <span className="status-chip status-chip-muted">{intent}</span>}
        </div>
      )}
      <div style={{ color: 'var(--app-text-muted)' }}>{answer}</div>

      {metrics?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 11 }}>
          {metrics.map((m) => (
            <div key={m.label} style={{
              padding: '7px 11px', borderRadius: 9, background: 'var(--app-panel)',
              border: '1px solid var(--app-border)', minWidth: 92,
            }}>
              <div style={{ fontSize: 9.5, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
              <div style={{ fontSize: 15, fontWeight: 750, color: 'var(--app-text)', marginTop: 2 }} className="ltr-num">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {series?.length > 0 && (
        <div style={{ marginTop: 12, background: 'var(--app-panel)', borderRadius: 10, border: '1px solid var(--app-border)', padding: '10px 8px 4px' }}>
          <TrendChart
            data={series} xKey="month" height={150} area
            series={[{ key: 'registered', label: 'Registered' }, { key: 'active', label: 'Active' }]}
            fmt={(v) => fmt.int(v)}
          />
        </div>
      )}

      {table && (
        <div style={{ marginTop: 12, overflowX: 'auto', background: 'var(--app-panel)', borderRadius: 10, border: '1px solid var(--app-border)' }}>
          <table className="data-table">
            <thead>
              <tr>{table.columns.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {table.columns.map((c) => (
                    <td key={c} className={typeof r[c] === 'number' ? 'ltr-num' : undefined}
                      style={c === table.columns[0] ? { color: 'var(--app-text)', fontWeight: 600 } : undefined}>
                      {formatCell(c, r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div style={{ marginTop: 12, background: 'var(--app-panel)', borderRadius: 11, border: '1px solid var(--app-border)', overflow: 'hidden' }}>
          <div style={{
            padding: '9px 12px', borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-soft)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: 'var(--app-text-faint)', display: 'flex' }}><IcoDoc size={13} /></span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--app-text)', flex: 1 }}>{draft.subject}</span>
            <button className="btn btn-ghost btn-sm" onClick={copyDraft}>
              {copied ? <><IcoCheck size={12} /> Copied</> : 'Copy'}
            </button>
          </div>
          <div style={{ padding: '11px 13px', fontSize: 11.5, color: 'var(--app-text-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 230, overflowY: 'auto' }}>
            {draft.body}
          </div>
          <div style={{ padding: '9px 12px', borderTop: '1px solid var(--app-border)', background: 'var(--app-surface-soft)' }}>
            <div className="panel-title" style={{ marginBottom: 6 }}>{draft.recipients.length} recipients</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {draft.recipients.map((r) => (
                <span key={r.developer_id} className="status-chip status-chip-accent" title={`${r.contact} · ${r.email}`}>
                  {r.developer}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Column-name-driven formatting keeps the copilot's tables readable without
 *  the server having to ship display strings for every cell. */
function formatCell(col, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (/_aed$/.test(col)) return fmt.aed(v);
  if (/_pct$|percent$/.test(col)) return fmt.pct(v);
  if (typeof v === 'number' && Math.abs(v) >= 10000) return fmt.compact(v);
  if (Array.isArray(v)) return v.join(', ');
  return String(v).replace(/_/g, ' ');
}
