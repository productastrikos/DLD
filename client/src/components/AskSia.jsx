import React, { useState, useEffect, useRef } from 'react';
import { fetchApi, postApi, fmt } from '../services/api';
import { useI18n } from '../i18n';
import { AstrikosMark } from './Brand';
import Thinking, { withThinking } from './Thinking';
import { IcoClose, IcoSend, IcoSpark, IcoChevron } from './icons';

/**
 * Ask S!a — the assistant available on every screen.
 *
 * It shares the Copilot's engine, so an answer given here is the same answer
 * the full Copilot screen would give. What differs is framing: the suggested
 * questions follow whichever module the user is currently in, because the
 * question worth asking on the ledger is not the one worth asking on the map.
 */
export default function AskSia({ module }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const scroller = useRef(null);

  // Suggestions re-scope whenever the module changes.
  useEffect(() => {
    let live = true;
    fetchApi(`/assistant/suggestions?module=${encodeURIComponent(module)}`)
      .then((d) => live && setSuggestions(d.questions || []))
      .catch(() => {});
    return () => { live = false; };
  }, [module]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  // A one-time nudge, so the assistant is discoverable without nagging.
  useEffect(() => {
    const seen = sessionStorage.getItem('sia_seen');
    if (!seen) {
      const t1 = setTimeout(() => setUnseen(true), 6000);
      return () => clearTimeout(t1);
    }
  }, []);

  const openPanel = () => {
    setOpen(true); setUnseen(false);
    try { sessionStorage.setItem('sia_seen', '1'); } catch { /* private mode */ }
  };

  const ask = async (question) => {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const payload = await withThinking(postApi('/ai/copilot', { question: q }));
      setMessages((m) => [...m, { role: 'ai', payload }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', payload: { answer: String(e.message || e) } }]);
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button className="sia-launcher" onClick={openPanel} title="Ask S!a">
        <AstrikosMark size={22} />
        <span>{t('Ask S!a')}</span>
        {unseen && <span className="sia-dot" />}
      </button>
    );
  }

  return (
    <div className="sia-panel animate-slide-up">
      <div className="sia-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.16)',
          }}>
            <AstrikosMark size={20} mono />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 750, color: '#fff', lineHeight: 1.2 }}>{t('Ask S!a')}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)' }}>
              <span className="animate-blink" style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: 99,
                background: '#4ade80', marginInlineEnd: 5,
              }} />
              {t('Reading live platform data')}
            </div>
          </div>
        </div>
        <button className="sia-close" onClick={() => setOpen(false)} title={t('Close')}>
          <IcoClose size={15} />
        </button>
      </div>

      <div ref={scroller} className="sia-body">
        {messages.length === 0 && (
          <div style={{
            border: '1px solid var(--app-advisory-border)', background: 'var(--app-advisory-bg)',
            borderRadius: 12, padding: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <span style={{ color: 'var(--app-advisory)', display: 'flex' }}><IcoSpark size={13} /></span>
              <span className="panel-title" style={{ color: 'var(--app-advisory)' }}>{t('How can I help?')}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)', lineHeight: 1.55 }}>
              Ask about anything on this screen or across the platform. Every answer is
              computed from live records, so the figures match what you see.
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'user'
            ? <div key={i} className="copilot-bubble copilot-bubble-user" style={{ maxWidth: '88%', fontSize: 12 }}>{m.text}</div>
            : <SiaAnswer key={i} payload={m.payload} />
        ))}

        {busy && <Thinking compact />}
      </div>

      {/* Suggestions follow the module in view */}
      {suggestions.length > 0 && (
        <div className="sia-suggestions">
          {suggestions.slice(0, 3).map((s) => (
            <button key={s} className="copilot-chip" style={{ fontSize: 11 }} onClick={() => ask(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="sia-input">
        <input
          className="field-input" value={input} disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder={t('Ask a question…')}
          style={{ height: 36, fontSize: 12 }}
        />
        <button className="btn btn-primary" style={{ height: 36, padding: '0 12px' }}
          onClick={() => ask()} disabled={busy || !input.trim()}>
          <IcoSend size={13} />
        </button>
      </div>
    </div>
  );
}

/** Compact answer rendering — prose, key metrics, and a short table if there is one. */
function SiaAnswer({ payload }) {
  if (!payload) return null;
  const { answer, metrics, table, title } = payload;
  return (
    <div className="copilot-bubble copilot-bubble-ai" style={{ maxWidth: '100%', fontSize: 12 }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ color: 'var(--app-advisory)', display: 'flex' }}><IcoSpark size={12} /></span>
          <span style={{ fontWeight: 750, color: 'var(--app-text)' }}>{title}</span>
        </div>
      )}
      <div style={{ color: 'var(--app-text-muted)', lineHeight: 1.6 }}>{answer}</div>

      {metrics?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
          {metrics.map((m) => (
            <div key={m.label} style={{
              padding: '5px 9px', borderRadius: 8, background: 'var(--app-panel)',
              border: '1px solid var(--app-border)',
            }}>
              <div style={{ fontSize: 8.5, color: 'var(--app-text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
              <div className="ltr-num" style={{ fontSize: 12.5, fontWeight: 750, color: 'var(--app-text)' }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {table && table.rows.length > 0 && (
        <div style={{ marginTop: 9, overflowX: 'auto', maxHeight: 190, overflowY: 'auto', background: 'var(--app-panel)', borderRadius: 9, border: '1px solid var(--app-border)' }}>
          <table className="data-table" style={{ fontSize: 11 }}>
            <thead>
              <tr>{table.columns.slice(0, 4).map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.slice(0, 6).map((r, i) => (
                <tr key={i}>
                  {table.columns.slice(0, 4).map((c) => (
                    <td key={c} className={typeof r[c] === 'number' ? 'ltr-num' : undefined}>
                      {r[c] === null || r[c] === undefined || r[c] === ''
                        ? '—'
                        : /_aed$/.test(c) ? fmt.aed(r[c])
                        : typeof r[c] === 'number' && Math.abs(r[c]) >= 10000 ? fmt.compact(r[c])
                        : String(r[c]).replace(/_/g, ' ')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
