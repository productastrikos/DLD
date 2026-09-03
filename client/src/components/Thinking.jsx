import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n';

/**
 * The "working on it" state for AI output.
 *
 * The server answers a copilot query in a few milliseconds, which is too fast
 * to read as reasoning — the answer simply appears, and a reader has no signal
 * that anything was derived. This walks through the stages the engine actually
 * performs (classify → query → aggregate → compose) so the wait is legible
 * rather than merely a spinner, and the reader arrives at the answer knowing
 * where it came from.
 *
 * The stages are real: they name what `server/lib/ai.js` does for that intent.
 */

const STAGES = [
  'Interpreting your question…',
  'Selecting the relevant records…',
  'Aggregating across the dataset…',
  'Composing the answer…',
];

/** Total dwell is deliberate — long enough to read, short enough not to annoy. */
export const THINKING_MS = 2600;

export default function Thinking({ compact = false, stages = STAGES }) {
  const [i, setI] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    const step = THINKING_MS / stages.length;
    const t = setInterval(() => setI((n) => Math.min(stages.length - 1, n + 1)), step);
    return () => clearInterval(t);
  }, [stages.length]);

  return (
    <div className={`copilot-bubble copilot-bubble-ai${compact ? ' is-compact' : ''}`}
      style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: compact ? 12 : 12.5 }}>
      <span className="advisory-spinner" />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span key={i} className="animate-fade-in" style={{ color: 'var(--app-advisory)', fontWeight: 650 }}>
          {t(stages[i])}
        </span>
        {/* Stage pips, so the wait reads as progress rather than a hang */}
        <span style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {stages.map((_, n) => (
            <span key={n} style={{
              height: 3, borderRadius: 99, flex: 1,
              background: n <= i ? 'var(--app-advisory)' : 'var(--app-advisory-border)',
              transition: 'background 0.3s ease',
            }} />
          ))}
        </span>
      </span>
    </div>
  );
}

/**
 * Runs a promise but never resolves faster than the thinking animation, so the
 * stages always complete instead of flashing.
 */
export async function withThinking(promise, ms = THINKING_MS) {
  const [result] = await Promise.all([promise, new Promise((r) => setTimeout(r, ms))]);
  return result;
}
