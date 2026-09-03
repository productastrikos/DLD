import React, { useEffect, useState, useRef } from 'react';
import { fetchApi } from '../services/api';
import { useI18n } from '../i18n';
import { IcoSpark, IcoChevron } from './icons';

/**
 * The rotating AI advisory strip that sits at the top of every module.
 *
 * Advisories cycle every few seconds. Two details matter for it to read as
 * intelligence rather than a marquee: the strip pauses while the pointer is
 * over it (so a line can actually be finished), and it exposes dots so the
 * reader can see there is a set and step through it deliberately.
 *
 * Purple is the platform's reserved AI colour — nothing that is merely recorded
 * data is ever rendered in it.
 */

const ROTATE_MS = 4800;
const SEV = { high: 'danger', medium: 'warning', low: 'info' };

export default function AdvisoryStrip({ module }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [entering, setEntering] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let live = true;
    setItems([]); setI(0);
    fetchApi(`/advisories/module?module=${encodeURIComponent(module)}`)
      .then((d) => live && setItems(d.advisories || []))
      .catch(() => {});
    return () => { live = false; };
  }, [module]);

  useEffect(() => {
    if (paused || items.length < 2) return;
    timer.current = setInterval(() => {
      setEntering(true);
      setI((n) => (n + 1) % items.length);
      // Cleared on the next tick so the fade re-triggers each rotation.
      setTimeout(() => setEntering(false), 40);
    }, ROTATE_MS);
    return () => clearInterval(timer.current);
  }, [paused, items.length]);

  if (!items.length) return null;
  const a = items[i];
  const tone = SEV[a.severity] || 'info';

  return (
    <div
      className="advisory-strip"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--app-advisory)', color: '#fff',
      }}>
        <IcoSpark size={15} />
      </div>

      <div key={i} className={entering ? '' : 'animate-fade-in'} style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span className="panel-title" style={{ color: 'var(--app-advisory)' }}>{t('AI Advisory')}</span>
          <span className={`status-chip status-chip-${tone}`}>{a.severity}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--app-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.title}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)', lineHeight: 1.5 }}>
          {a.body}
        </div>
      </div>

      {/* Position dots — clickable, so rotation is steerable rather than imposed */}
      <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
        {items.map((_, n) => (
          <button key={n} onClick={() => setI(n)} aria-label={`Advisory ${n + 1}`}
            style={{
              width: n === i ? 16 : 6, height: 6, borderRadius: 99, border: 'none', padding: 0,
              cursor: 'pointer', transition: 'width 0.25s ease, background 0.25s ease',
              background: n === i ? 'var(--app-advisory)' : 'var(--app-advisory-border)',
            }} />
        ))}
      </div>
    </div>
  );
}
