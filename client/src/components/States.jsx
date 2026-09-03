import React from 'react';
import { IcoAlert } from './icons';

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="app-loading">
      <div className="app-loading-orbit" />
      <div className="app-loading-text">{label}</div>
    </div>
  );
}

export function ErrorState({ error }) {
  return (
    <div className="card card-pad" style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      borderColor: 'var(--app-danger-border)', background: 'var(--app-danger-bg)',
    }}>
      <span style={{ color: 'var(--app-danger)' }}><IcoAlert size={20} /></span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text)' }}>Could not load this screen</div>
        <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 4 }}>
          {String(error?.message || error)}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--app-text-faint)', marginTop: 8 }}>
          Check that the API is running on port 5061 (<code>npm run dev</code> starts both).
        </div>
      </div>
    </div>
  );
}

export function Empty({ children = 'Nothing here yet' }) {
  return <div className="empty-state">{children}</div>;
}
